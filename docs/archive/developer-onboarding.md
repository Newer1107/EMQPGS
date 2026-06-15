# Developer Onboarding

You should be able to understand the system architecture, data model, workflows, and development practices within 30 minutes.

---

## System Architecture

EMQPGS is a Next.js 16 App Router application with Prisma ORM connecting to MySQL. MinIO provides object storage for attachments, reports, and exports. Auth.js v5 (credentials provider) handles authentication with custom JWT cookies.

**Architecture pattern:** Feature modules under `src/modules/<feature>/` with service → repository → validation files. Route handlers in `app/api/<route>/route.ts` call services through the `withApiHandler` wrapper which handles CSRF, RBAC, rate limiting, audit logging, and error formatting.

**Key structural files:**

| File | Purpose |
|---|---|
| `src/lib/api-handler.ts` | Wraps every API route with cross-cutting concerns |
| `src/lib/jwt.ts` | JWT signing and verification |
| `src/lib/csrf.ts` | CSRF token generation and verification |
| `src/lib/audit.ts` | Append-only audit log with hash chain |
| `src/lib/rate-limit.ts` | In-memory rate limiting |
| `src/lib/db.ts` | Prisma singleton |
| `src/lib/env.ts` | Zod-validated environment variables |
| `proxy.ts` | Middleware (NOT `middleware.ts`) — JWT guard + role gating |
| `scripts/verify-prisma-client.cjs` | CI guard for Prisma client |

---

## Data Model

**22 Prisma models, 19 enums.** The schema is at `prisma/schema.prisma`.

Four domains (documented in `docs/domains/`):

1. **Academic:** `AcademicYear` → `Semester` → `Subject` → `SubjectVersion`. Subjects belong to departments and are versioned for curriculum tracking.

2. **Question:** `QuestionLibraryItem` is the central entity. Scoped to a `SubjectVersion`. Links to `QuestionBank` via `QuestionBankQuestion` join table. Has immutable history via `QuestionRevision`, `QuestionOwnershipHistory`, `QuestionUsageHistory`.

3. **Exam:** `ExamCycle` → `QuestionBank` (1:N). Banks have a 10-state lifecycle. `GeneratedPaper` (A, B, C), `DeanReview` (write-once), `ExportArtifact`.

4. **Production:** Four services: `DeanReviewService`, `ExportService`, `MonitoringService`, `BackupService`.

**Key invariants:**
- One bank per (subject, exam cycle) pair
- 10-state bank lifecycle enforced by `transitions.ts`
- Locked banks are terminal (no unlock)
- Questions are linked to banks via join table, not owned by banks
- Audit log is append-only with SHA-256 hash chain

---

## Workflow (End-to-End)

```
COE creates AcademicYear → Semester → ExamCycle (ACTIVE)
Coordinator creates Subject (auto-creates SubjectVersion v1) → links to cycle
  → creates QuestionBank → assigns contributors + moderator
Contributor creates QuestionLibraryItem → links to bank → submits
Moderator approves/rejects/requests revision
Coordinator triggers AI report → generates papers (A, B, C)
  → uploads signed report → coordinator decision → locks bank
Dean selects variants for regular/supplementary/KT
COE exports PDF/DOCX/ZIP
```

---

## Services

| Module | Key Service Class | Responsibilities |
|---|---|---|
| `coordinator/` | `CoordinatorService` | Subject + bank orchestration, dashboard, assignments |
| `question-library/` | `QuestionLibraryService` | Question CRUD, ownership, history, coverage |
| `moderation/` | `ModeratorService` | Question review queue, approve/reject/revision |
| `reports/` | `ReportService` + sub-services | AI analysis, paper generation, signed reports |
| `production/` | `DeanReviewService`, `ExportService`, etc. | Dean review, exports, monitoring, backups |
| `question-banks/` | `QuestionBankService` | Status transitions, validation |
| `exam-cycles/` | `ExamCycleService` | CRUD + activation guard |
| `notifications/` | `NotificationService` | In-app + email notifications |

**Pattern:** Services accept `Actor` (picked user object) as first parameter. Constructor injection with defaults allows unit testing: `new SomeService(mockRepo)`.

---

## Repositories

Modules with repositories (they extend `BaseRepository` from `src/modules/shared/base-repository.ts`):
- `academic-years/`, `semesters/`, `subject-versions/`, `question-library/`, `question-banks/`, `users/`, `departments/`, `exam-cycles/`

Modules using Prisma directly (no repository layer):
- `coordinator/`, `moderation/`, `production/`, `reports/`, `notifications/`, `dashboard/`

**Recent additions (June 2026):**
- `coordinator-departments/` — service + repository + validation for coordinator-department assignments
- `moderator-assignments/` — service + repository + validation for moderator-to-bank assignments
- `question-bank-questions/` — service + repository + validation for question-to-bank linking
- All three now have proper Zod validation and audit logging

---

## API Structure

~55 route files under `app/api/`. Every handler follows this pattern:

```typescript
export const GET = withApiHandler({
  roles: [Role.COORDINATOR, Role.COE],
  audit: { action: "LIST_BANKS", entityType: ENTITY_TYPES.QUESTION_BANK },
  handler: async ({ user, request }) => {
    const data = await someService.someMethod(actor);
    return NextResponse.json({ success: true, data });
  },
});
```

`withApiHandler` automatically handles:
- CSRF validation (all non-GET)
- Role check (against `roles` array)
- Rate limiting
- Audit logging (if `audit` option provided)
- Error formatting (Zod → 400, AppError → status code, unknown → 500)

---

## Testing Strategy

| Directory | Infra needed | What it tests |
|---|---|---|
| `tests/unit/` | None | Pure logic: services, repositories, utilities, slot template |
| `tests/integration/` | MySQL | API endpoints end-to-end |
| `tests/permission/` | MySQL | RBAC enforcement per route |

Run `npm run test` for all tests. Path alias `@/` → `src/` is configured.

---

## Key Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (auto-generates Prisma client) |
| `npm run build` | Production build |
| `npm run test` | Run all tests |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Apply pending migrations |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:seed` | Seed demo data |

---

## Next.js 16 Quirks

- Middleware lives in `proxy.ts` (not `middleware.ts`). Export a function named `proxy` (not `middleware`).
- Adding `middleware.ts` will be silently ignored.
- Security headers are set globally in `next.config.ts` — don't duplicate in route handlers.

---

## Environment Variables

All validated at startup by `src/lib/env.ts`. Required vars: `DATABASE_URL`, `AUTH_URL`, `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET` (falls back to `AUTH_SECRET`), `MINIO_*` variables.

---

## Quick Start

1. `docker compose up -d mysql minio minio-init`
2. `npm ci` (runs postinstall = Prisma generate + verify)
3. `npm run prisma:migrate`
4. `npm run prisma:seed`
5. `npm run dev`

Seed users (all password `Password@123`):
- `coe@emqpgs.local` (COE)
- `coordinator@emqpgs.local` (COORDINATOR)
- `moderator@emqpgs.local` (MODERATOR)
- `contributor@emqpgs.local` (CONTRIBUTOR)
- `dean@emqpgs.local` (DEAN)
