# Responsibility-Based Authorization Migration — Implementation Summary

**Date:** 2026-06-21  
**Files Changed:** 114  
**Lines:** +1023 / -868  
**Verification:** Oracle-reviewed, all 9 requirements passed.

---

## Overview

Migrated the EMQPGS authorization system from **static single-role** (`User.role`) to **dynamic multi-responsibility** (`ResponsibilityAssignment` records). A user can now hold multiple responsibilities simultaneously (e.g., Coordinator in one department, Moderator for a question bank).

---

## Architecture Change

```
Before:                      After:
User                         User (identity only)
  ├── role: Role (single)       ├── name, email, password
  ├── departmentId              ├── homeDepartmentId (info only)
  └── ...                       └── has_many → ResponsibilityAssignment[]
                                    ├── ResponsibilityAssignment[]
                                    │   ├── type: ResponsibilityType
                                    │   ├── scope: ScopeType + scopeId
                                    │   ├── activeFrom / activeTo
                                    │   └── ...
                                    ↓
                                Workspace (active assignment)
                                    ↓
                                AuthorizationService (permission checks)
```

---

## Files Changed

### Prisma Schema — `prisma/schema.prisma`

| Change | Detail |
|--------|--------|
| **Added enums** | `ResponsibilityType` (COE, DEAN, COORDINATOR, MODERATOR, CONTRIBUTOR), `ScopeType` (INSTITUTION, DEPARTMENT, QUESTION_BANK) |
| **Removed enum** | `Role` (COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN) |
| **Added model** | `ResponsibilityAssignment` — generic assignment table with `@@unique([userId, responsibility, scopeType, scopeId])` |
| **Removed field** | `role` from User model |
| **Renamed field** | `departmentId` → `homeDepartmentId` on User (informational, never used for auth) |
| **Removed tables** | `CoordinatorDepartmentAssignment`, `ModeratorBankAssignment`, `ContributorBankAssignment` (their data migrated to `ResponsibilityAssignment`) |
| **Removed relations** | `coordinatorDepartments`, `moderatorBankAssignments`, `contributorBankAssignments` from User; `coordinatorAssignments` from Department; `moderatorAssignments`, `contributorAssignments` from QuestionBank |

### Auth Core — `src/lib/`

| File | Change |
|------|--------|
| `types.ts` | New `Actor` type: `{ id, email, name }` (no role). New `AuthContext` type: `{ user, responsibilities: ResponsibilityInfo[] }` |
| `auth.ts` | Removed `Role` import. Removed `role` from JWT/se ssion population. Added `homeDepartmentId` |
| `jwt.ts` | `TokenPayload` no longer includes `role` or `departmentId`. Now has `homeDepartmentId` |
| `api-context.ts` | `getCurrentUserFromCookies()` returns User without role. Unchanged otherwise |
| `api-handler.ts` | `RouteOptions.roles?` → `RouteOptions.responsibility?`. Uses `AuthorizationService` to check responsibilities |
| `constants.ts` | Removed `Role` import, `roleLabels`, `rbacMatrix`. Added `responsibilityLabels` |

### New Authorization Layer — `src/lib/auth/`

| File | Purpose |
|------|---------|
| `responsibility-resolver.ts` | Loads active responsibilities from DB (derives "active" from `activeFrom`/`activeTo` dates). `resolve(userId)` and `resolveAsContext(userId, actor)` methods |
| `workspace-resolver.ts` | Validates that `assignmentId` belongs to user, is active, returns `Workspace` context. Client never sends permission info |
| `authorization-service.ts` | Centralized permission checks. Methods: `has()`, `hasAny()`, `hasAll()`, `require()`, `requireAny()`, `requireCoordinator()`, `requireModerator()`, `requireContributor()`, `requireCoe()`, `requireDean()` |

### API Routes — `app/api/` (61 files)

All route options changed from:
```typescript
// Before
{ roles: [Role.COORDINATOR] }
// After
{ responsibility: ["COORDINATOR" as ResponsibilityType] }
```

**Special in-handler checks migrated (4 files):**
- `users/route.ts` — Coordinator user list filtering uses `authz.has()`
- `storage/presign/route.ts` — COE-only bucket guard uses `authz.has()`
- `question-library/route.ts` — Contributor/Coordinator logic uses `authz.has()`
- `question-banks/[id]/dean-review/route.ts` — Conditional behavior uses `authz.has()`

**Auth routes unchanged (7 files):** login, logout, refresh, csrf, forgot-password, reset-password — no role gating existed.

### Services — `src/modules/` (22 files)

Every service that checked `actor.role` migrated to use `AuthorizationService` or `AuthContext`:

| Service | Role Check → Responsibility Check |
|---------|----------------------------------|
| `coordinator/department-utils.ts` | `actor.role === Role.COE` → `authz.has("COE", "INSTITUTION")` |
| `coordinator/subject.service.ts` | `actor.role === Role.COORDINATOR` → `AuthorizationService` |
| `coordinator/question-bank.service.ts` | `actor.role !== "COORDINATOR"` → context-based |
| `coordinator-departments/service.ts` | `coordinator.role !== Role.COORDINATOR` → authorization service |
| `moderator-assignments/service.ts` | `moderator.role !== Role.MODERATOR` → context-based |
| `contributor-assignments/service.ts` | `contributor.role !== Role.CONTRIBUTOR` → context-based |
| `moderation/service.ts` | `actor.role !== Role.MODERATOR` → `AuthorizationService` |
| `question-library/service.ts` | 6 string-based checks → `authContext`/`AuthorizationService` |
| `question-slots/service.ts` | Local Actor type removed, string check → context-based |
| `production/export.service.ts` | `actor.role !== Role.COE` (×2) → `AuthorizationService` |
| `production/dean-review.service.ts` | `actor.role !== Role.DEAN` + role DB query → responsibility query |
| `coe/dashboard.service.ts` | `r.role === Role.X` aggregates → responsibility query |
| `auto-initialize/service.ts` | `where: { role: "COE" }` → responsibility query |
| `users/service.ts` | Removed `role?` parameter from `list()` |
| `users/repository.ts` | Removed `role` from selects and filters |
| `users/validation.ts` | `z.nativeEnum(Role)` → `z.nativeEnum(ResponsibilityType)` |
| `moderation/dashboard.service.ts` | `Actor`→`AuthContext`, `actor.id`→`authContext.user.id` |
| `reports/ai-report.service.ts` | Updated imports |
| `reports/paper.service.ts` | Updated imports |
| `coordinator/service.ts` | `Actor`→`AuthContext` for dashboard method |

### Frontend — `app/(protected)/dashboard/` and `src/components/` (16 files)

| File | Change |
|------|--------|
| `layout.tsx` (root) | Extracts `workspaceType` from resolved responsibilities instead of `user.role` |
| `coe/layout.tsx` | `user.role !== Role.COE` → responsibility check via `AuthorizationService` |
| `coordinator/layout.tsx` | Same pattern |
| `moderator/layout.tsx` | Same pattern |
| `contributor/layout.tsx` | Same pattern |
| `dean/layout.tsx` | Same pattern |
| `app-shell.tsx` | `NavItem.roles` → `NavItem.workspaceTypes`. Prop `role` → `workspaceType`. Uses `responsibilityLabels` |
| `dashboard/page.tsx` | `dashboards[user.role]` → resolved workspace routing |
| `coe/users/page.tsx` | `Role` → `ResponsibilityType`, `roleLabels` → `responsibilityLabels` |
| `coe/users/edit-dialog.tsx` | `role` state → `responsibility` state. `ResponsibilityType` enu m dropdown |
| `coordinator/assignments/page.tsx` | Queries responsibilityAssignment instead of role-based tables |
| `coe/coordinator-assignments/page.tsx` | Same migration pattern |
| `login/page.tsx` | `roleLabels` → `responsibilityLabels` |
| `workflow-timeline.tsx` | Static `role` strings → `responsibility` enum values |
| `inline-assign-panel.tsx` | Union type already matches `ResponsibilityType` values — no change needed |

### Workspace UI — New Components

| File | Purpose |
|------|---------|
| `src/components/workspace/workspace-picker.tsx` | Workspace selection screen for multi-responsibility users |
| `src/components/workspace/workspace-switcher.tsx` | In-header dropdown to switch workspaces without logout |
| `app/api/auth/workspace/route.ts` | API endpoint to validate and activate a workspace |

### Seed Data — `prisma/seed.ts`

- Users created as **identity only** (no `role` field)
- COE and Dean assigned via `ResponsibilityAssignment` with `INSTITUTION` scope
- Coordinators assigned to departments via `ResponsibilityAssignment` with `DEPARTMENT` scope
- Moderators and Contributors are assigned to question banks at runtime (not in seed)

### Database Migration

- Migration file generated: `prisma/migrations/20260621071505_responsibility_based_auth/`
- Database schema pushed and seeded successfully

### Documentation — `README.md`

- Updated features list with responsibility-based authorization
- Replaced "Role Hierarchy" with "Authorization Model" section
- Updated authentication flow diagram (shows responsibility loading after login)
- Updated demo credentials table (shows responsibility + scope instead of single role)
- Updated project structure to include new `src/lib/auth/` directory
- Updated security section references
- Updated ER diagram to show `ResponsibilityAssignment` instead of old separate assignment tables

---

## Unchanged Architecture

The following remain unaffected by this migration:

- **Question bank lifecycle** — DRAFTING → MODERATION → APPROVAL → COMPLETE
- **Question slot template** — 126-slot model (6 modules × 3 marks × 7 slots)
- **Paper generation flow** — AI analysis, variant generation, dean review, export
- **Audit trail** — SHA-256 hash chain
- **MinIO storage** — 5 buckets
- **Rate limiting, CSRF, session management**

---

## Remaining Work

| Item | Effort | Notes |
|------|--------|-------|
| **Update test files** | ~1 day | 10 test files reference old `Role` enum and mock actor shapes. Need to use `AuthContext`/`ResponsibilityType` |
| **Update documentation** | ~0.5 day | `docs/architecture.md`, `docs/database.md`, `docs/developer-guide.md` still reference old role model |
| **Add responsibility CRUD UI** | ~2 days | Admin interface to create/update responsibility assignments (currently seed-only) |
| **Add workspace persistence** | ~0.5 day | Server-side session storage for last workspace (currently localStorage only) |
