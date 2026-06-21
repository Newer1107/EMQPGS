# Workspace & Authorization Architecture Rules

> Permanent architectural contract for the Workspace and Authorization subsystem.
> All future development must extend this architecture rather than modify it.

## 1. WorkspaceContext Is the Only Operational Context

Contributor and Moderator workspaces represent **exactly one QuestionBank**. COORDINATOR workspaces represent one Department. DEAN and COE workspaces represent the Institution.

Operational pages (dashboard, question lists, moderation actions) derive all entity context from `WorkspaceContext` — never from `ResponsibilityAssignment` queries.

```
WorkspaceContext
    ├── bankId
    ├── questionBank (with slots, pattern, batchSemester)
    ├── subject
    ├── subjectVersion
    ├── batchSemester (with batch, academicYear)
    └── department
```

## 2. Contributor and Moderator Never Query Assignments

Operational pages for CONTRIBUTOR and MODERATOR must never access:

- `responsibilityAssignment.findMany`
- `getAssignedBankIds()`
- `getContributorAssignedBanks()`
- Any assignment repository

The only valid source of scope identity is `ActiveWorkspace.scopeId`.

Assignment queries belong only to:
- Workspace selection and switching
- COE administrative pages
- COORDINATOR management pages
- Reports and administrative tools

## 3. WorkspaceContext Is Immutable

`WorkspaceContext` represents request context. It is resolved once per request and never modified. No service may attach additional properties, overwrite fields, or mutate the context object.

Resolve once. Read everywhere. Dispose after request.

## 4. Single Entry Point

All operational pages use the single `getWorkspaceContext()` function:

```ts
const { user, active, context } = await getWorkspaceContext("CONTRIBUTOR");
// or "MODERATOR"
```

This function:
1. Resolves the active workspace from cookie
2. Validates the workspace exists
3. Validates the responsibility type matches the expected type
4. Validates the workspace has a scopeId
5. Loads the full `WorkspaceContext` in one query
6. In development mode, runs invariant assertions

No page should manually call `ActiveWorkspaceResolver.resolve()` + `WorkspaceContextResolver.resolve()` — use `getWorkspaceContext()` instead.

## 4a. Three-Layer Workspace Resolution

Workspace resolution is split into three independent components, each with exactly one responsibility.

```
ActiveWorkspaceResolver    — Read-only: resolves workspace from cookie, validates, returns null on invalid
WorkspaceSelector          — Pure decision: picks best workspace from a list, no HTTP state
WorkspaceCookieManager     — HTTP writes: set/clear/get cookie, only called from Route Handlers
```

### ActiveWorkspaceResolver

Read-only. Resolves the active workspace from the cookie. Validates the assignment exists, belongs to the user, and is within its active date range. Returns `ActiveWorkspace | null`.

**Safe to call from:** Server Components, Route Handlers, Server Actions, Middleware, Tests.

**Never:** sets cookies, clears cookies, redirects, or mutates HTTP state. If the cookie is stale or invalid, returns `null`. Does not attempt cookie repair — that is the responsibility of a downstream Route Handler or the workspace activation flow.

```ts
const resolver = new ActiveWorkspaceResolver();
const active = await resolver.resolve(userId);
if (!active) { /* redirect or show appropriate UI */ }
```

### WorkspaceSelector

Pure decision engine. Applies priority ordering to choose the best workspace from a list of active assignments. No HTTP state access, no database queries in its pure form.

```ts
const picked = new WorkspaceSelector().pickDefault(activeAssignments);
// { assignmentId: "...", responsibility: "CONTRIBUTOR" } | null
```

A convenience method `pickDefaultForUser(userId)` queries the database and applies the same logic.

### WorkspaceCookieManager

**Only** component allowed to mutate workspace cookies. Set, clear, and get the active workspace cookie.

May only be called from contexts that can write cookies: Route Handlers, Server Actions, Middleware.

```ts
const cm = new WorkspaceCookieManager();
await cm.set(assignmentId);    // write cookie (Route Handler only)
await cm.clear();              // clear cookie (Route Handler only)
const id = await cm.get();     // read cookie (safe everywhere)
```

### Automatic Workspace Selection Flow

```
Login → Route Handler (sets session cookie)
  ↓
Dashboard page → ActiveWorkspaceResolver.resolve(userId)
  ├─ Valid cookie → redirect to /dashboard/{type}
  └─ Invalid/no cookie → WorkspaceSelector.pickDefaultForUser(userId)
       ├─ 1+ assignments → redirect to /api/auth/workspace?assignmentId=X
       │    ↓
       │    Route Handler → CookieManager.set() → redirect to dashboard
       ├─ 1 assignment → GET /api/auth/workspace?assignmentId=X
       └─ 0 assignments → redirect to /workspace-select
```

**Server Components never write cookies.** Cookie writes only happen in:
- `GET /api/auth/workspace` — auto-activation (Route Handler)
- `POST /api/auth/workspace` — workspace switching (Route Handler)

## 5. Authorization Flows Through AuthorizationService

Permission checks must be centralized in `AuthorizationService`. No page or component should contain:

```ts
if (responsibility === ...)
// or
switch (responsibility)
```

for permission decisions. UI rendering based on workspace type (nav items, layout) is acceptable; permission enforcement must remain centralized.

## 6. Internal IDs Are Never Shown to Users

Users should always see meaningful information:

- Subject names, not subject IDs
- Semester numbers, not batch semester IDs
- Batch names, not batch IDs
- Academic year codes, not academic year IDs
- Department names, not department IDs

Never expose `scopeId`, `assignmentId`, `questionBank.id`, or other internal identifiers.

## 7. Operational Pages Operate on Exactly One Scope

- CONTRIBUTOR operates on exactly one QuestionBank
- MODERATOR operates on exactly one QuestionBank
- COORDINATOR operates on exactly one Department (but may aggregate multiple banks within it)
- DEAN operates on the Institution
- COE operates on the Institution

Operational pages never ask users to choose entities already defined by the workspace.

## 8. Administrative Pages May Aggregate Multiple Scopes

COE and COORDINATOR pages may query multiple entities (users, departments, question banks) for management views. These pages are explicitly exempt from Rule 2.

## 9. Workspace Lifecycle Is Deterministic

| Transition | Behavior |
|---|---|
| Login → 0 assignments | Redirect to `/no-access` |
| Login → 1 assignment | Auto-activate (set cookie), redirect to dashboard |
| Login → 2+ assignments | Redirect to workspace picker |
| Workspace switch | POST `/api/auth/workspace` with `assignmentId` |
| Stale/expired cookie | Cleared, user redirected to workspace picker or auto-activated |
| Logout | Cookie cleared server-side |

Every transition is deterministic. No stale cookies, stale state, or orphan workspaces.

## 10. Runtime Assertions

In development mode, `getWorkspaceContext()` runs invariant assertions:

- CONTRIBUTOR/MODERATOR workspace must resolve a QuestionBank
- COORDINATOR workspace must resolve a Department
- DEAN/COE workspace must have INSTITUTION scope
- QUESTION_BANK scoped workspace must have a non-null scopeId

Violations throw immediately. Architecture violations never silently continue.

## 11. Layer Separation: Business Services Are Authorization-Agnostic

Each layer has strict responsibilities. No layer reaches across another.

```
Authentication          ← auth cookies, withApiHandler
    ↓
Workspace Resolution   ← getWorkspaceContext(), ActiveWorkspaceResolver
    ↓
Authorization          ← AuthorizationService (in API routes and layouts only)
    ↓
Business Services      ← ModeratorService, QuestionLibraryService, etc.
                            (no AuthContext, no AuthorizationService)
    ↓
Repositories           ← Prisma (no authorization logic)
```

### Authentication
Identifying the user and validating the session. Nothing else.

### Workspace Resolution
Resolving the active workspace from cookie, validating it, building WorkspaceContext. Nothing else.

### Authorization
Deciding whether the caller is permitted to perform the action. Answers questions like:
- Can this contributor submit a question?
- Can this moderator approve this question?
- Can this coordinator edit an approved question?

If authorization fails, the request never reaches the business service.

### Business Services
Implement business behavior only. Services assume:
- Caller is authenticated
- Caller is authorized
- Workspace is already resolved

Services receive **context objects** containing the minimum identity and scope information they need:
- `{ userId: string }` for identity (who performed this action)
- `{ bankId: string }` for scope
- `{ isCoordinator?: boolean }` for privileged behavior modes

Services do **not** receive:
- `AuthContext`
- `AuthorizationService`
- `ResponsibilityAssignment`
- Any authentication or authorization infrastructure

### Repositories
Data access only. No authorization logic.

## 12. Performance: One Query per Context Resolution

`WorkspaceContextResolver` loads everything in a single `prisma.questionBank.findUnique({ include: { ... } })` call. No N+1 lookups, no repeated queries for subject, batch, academic year, or department.

Pages reuse the resolved context. No page issues additional Prisma queries for data already in `WorkspaceContext`.

## Extension Points

To add a new responsibility type:
1. Add the type to Prisma schema
2. Add scope resolution to `WorkspaceContextResolver.resolve()`
3. Add display logic to `WorkspaceDisplayResolver.resolve()`
4. Add authorization convenience method to `AuthorizationService`
5. Add UI navigation items to `AppShell`
6. Create the dashboard pages using `getWorkspaceContext()`

To add a new operational page:
1. Call `getWorkspaceContext(expectedResponsibility)` — never resolve manually
2. Access context from the returned `WorkspaceContext` — never query assignments
3. Use `AuthorizationService` for permission checks — never inline

## Deprecated APIs

| Function | Reason | Replacement |
|---|---|---|
| `getContributorAssignedBanks()` | Multi-bank query, unnecessary in single-bank workspace | Use `ActiveWorkspace.scopeId` + direct bank query |
| `getAssignedBankIds()` | Responsibility-based lookup, unnecessary with bankId param | Pass `bankId` to `listQuestions(auth, bankId)` |
| `ResponsibilityResolver.resolveAsContext()` | Redundant when workspace already determines scope | Use `getWorkspaceContext()` + exported `WorkspaceSession` |
