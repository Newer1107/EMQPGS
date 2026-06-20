# Developer Guide

> Onboarding, module patterns, testing, debugging, and common workflows.

---

## 1. Architecture Summary

EMQPGS is an examination question paper management system on **Next.js 16 App Router** with Prisma + MySQL.

Key architectural decisions:

- **proxy.ts middleware** (not `middleware.ts`) — exports a function named `proxy`. Route-level role gating for `/dashboard/<role>` and `/api/**`.
- **withApiHandler** — every API route wraps this. Provides CSRF, rate limiting, role-based access, audit logging, and consistent error formatting.
- **Custom JWT auth** — Auth.js v5 credentials provider. Cookie names: `emqpgs_access_token`, `emqpgs_refresh_token`, `emqpgs_csrf_token`.
- **Two-axis bank state** — `QuestionBankPhase` (4 states) + `RecordStatus` (3 states), orthogonal.
- **QuestionSlot linkage** — no join table. Slots are first-class positional entities.
- **ReadinessEngine** — advisory checks. Auto-advance does not exist.

---

## 2. Setup

```bash
# 1. Start infrastructure
docker compose up -d mysql minio minio-init

# 2. Install dependencies (postinstall = prisma generate + verify)
npm ci

# 3. Apply database migrations
npm run prisma:migrate

# 4. Seed with demo data
npm run prisma:seed

# 5. Start dev server
npm run dev
```

Dev server at `http://localhost:3000`.

---

## 3. Module Pattern

Every well-structured feature module has:

```
src/modules/<feature>/
├── service.ts        Business logic
├── repository.ts     Prisma queries (extends BaseRepository)
└── validation.ts     Zod schemas
```

Modules following this pattern: `academic-years`, `semesters`, `subject-versions`, `exam-cycles`, `departments`, `users`, `question-library`, `question-banks`, `question-slots`, `coordinator-departments`, `moderator-assignments`, `curriculum-schemes`, `curriculum-subjects`, `batches`, `batch-semesters`, `teaching-groups`.

Modules using direct Prisma calls: `coordinator/`, `reports/`, `readiness/`, `question-bank-metrics/`, `production/`, `moderation/`, `notifications/`, `dashboard/`, `ai/`.

### Adding a new module

1. Create `src/modules/<name>/service.ts`, `repository.ts`, `validation.ts`
2. Repository extends `BaseRepository` (gets `this.prisma`)
3. Create route files under `app/api/<name>/`
4. Route handlers use `withApiHandler`
5. Pass `audit:` option for audit logging

---

## 4. Important Services

| Service | File | Responsibility |
|---|---|---|
| QuestionLibraryService | `src/modules/question-library/service.ts` | CRUD, submit, transfer ownership |
| QuestionBankService | `src/modules/question-banks/service.ts` | Create, phase advance, lock/unlock |
| QuestionBankWorkflowService | `src/modules/coordinator/question-bank.service.ts` | Coordinator orchestration, bank init |
| QuestionSlotService | `src/modules/question-slots/service.ts` | Slot assignment/unassignment |
| ReadinessEngine | `src/modules/readiness/engine.ts` | Phase readiness evaluation |
| ReportService | `src/modules/reports/service.ts` | AI reports, coordinator decision |
| PaperGenerationService | `src/modules/reports/paper.service.ts` | Paper generation, PDF, snapshots |

---

## 5. Key Files Reference

| File | What it is |
|---|---|
| `prisma/schema.prisma` | Complete data model (34 models, 26 enums) |
| `proxy.ts` | Middleware (route-level auth) |
| `src/lib/api-handler.ts` | `withApiHandler` — all routes use this |
| `src/lib/db.ts` | Prisma singleton |
| `src/lib/jwt.ts` | JWT signing/verification |
| `src/lib/csrf.ts` | CSRF token management |
| `src/lib/audit.ts` | Append-only audit chain |
| `src/lib/env.ts` | Zod-validated environment variables |
| `src/modules/question-banks/transitions.ts` | Phase transition table |
| `src/modules/readiness/engine.ts` | ReadinessEngine |
| `src/modules/question-banks/mutable-guard.ts` | Lock guard |
| `tests/setup.ts` | Test environment configuration |

---

## 6. Common Workflows

### Creating a question and assigning to a slot

```
1. GET /api/subject-versions → find subject version
2. POST /api/question-library → create QuestionLibraryItem
   (include ?questionBankId for auto-assignment)
   OR
   PATCH /api/question-banks/[id]/slots/[slotId] → assign manually
```

### Advancing a bank phase

```
1. GET /api/question-banks/[id]/readiness?targetPhase=MODERATION → check
2. PATCH /api/question-banks/[id]/advance → { targetPhase: "MODERATION" }
```

### Generating papers

```
1. POST /api/question-banks/[id]/reports → trigger AI analysis
2. POST /api/question-banks/[id]/papers → generate A, B, C
```

### Coordinator decision

```
POST /api/question-banks/[id]/coordinator-decision → { decision: "APPROVED" }
  → Phase set to COMPLETE
  OR
POST /api/question-banks/[id]/coordinator-decision → { decision: "REJECTED" }
  → Phase set back to MODERATION
```

---

## 7. Testing

```bash
npm run test                # All tests
npx vitest run tests/unit/slot-template.test.ts  # Single file
npx vitest run -t "slot generation"              # Pattern match
```

Tests live in `tests/{unit,integration,permission}/`. Unit tests run without infrastructure. Integration tests need MySQL (via Docker).

---

## 8. Debugging Tips

| Problem | Likely cause |
|---|---|
| `verify-prisma-client` fails | Run `npm run prisma:generate` after schema changes |
| 401 on API calls | Token expired or missing CSRF header |
| 403 on API calls | User lacks required role |
| 409 on advance phase | Invalid phase transition (check `transitions.ts`) |
| 409 on lock | Exam cycle not ACTIVE or missing endDate |
| `integrityHash` mismatch | Audit chain tampered or concurrency issue |

---

## 9. Next.js 16 Quirks

- Middleware is `proxy.ts` exporting `proxy()` — **not** `middleware.ts`
- App Router under `app/`, pages under `app/(protected)/dashboard/<role>/`
- API routes under `app/api/**/route.ts`
- CSP allows `'unsafe-eval'` in development only
- All route handlers wrapped with `withApiHandler`

---

## Cross-References

| Topic | Document |
|---|---|
| Architecture | `docs/architecture.md` |
| Workflow | `docs/workflow.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Deployment | `docs/deployment.md` |
| Glossary | `docs/glossary.md` |
