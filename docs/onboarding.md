# Developer Onboarding

> Goal: Understand the system in under 30 minutes.
> Prerequisite: Completed setup in README §6.

---

## 1. Architecture summary

EMQPGS is an examination question paper management system. Key architectural decisions:

- **Next.js 16 App Router** — app/ directory, proxy.ts middleware (not middleware.ts), server components
- **Prisma + MySQL** — 26 models, 19 enums, local query engine (no Accelerate)
- **Auth.js v5 + custom JWT** — credentials provider, custom cookie management (`emqpgs_access_token`, `emqpgs_refresh_token`)
- **Two-axis bank state** — `QuestionBankPhase` (4 states) + `RecordStatus` (3 states) orthogonal
- **QuestionSlot linkage** — no join table, slots are first-class positional entities
- **ReadinessEngine** — advisory checks, auto-advance does not exist
- **Snapshots** — `QuestionBankSnapshot` on lock, `PaperSnapshot` on paper generation

---

## 2. Important services

| Service | File | Role |
|---|---|---|
| `QuestionLibraryService` | `src/modules/question-library/service.ts` | CRUD, submit, transfer ownership, revision history |
| `QuestionBankService` | `src/modules/question-banks/service.ts` | Create, phase advance, lock/unlock |
| `QuestionBankWorkflowService` | `src/modules/coordinator/question-bank.service.ts` | Coordinator orchestration, bank init, detail, lock |
| `QuestionSlotService` | `src/modules/question-slots/service.ts` | Slot assignment/unassignment |
| `ReadinessEngine` | `src/modules/readiness/engine.ts` | Phase readiness evaluation |
| `ReportService` | `src/modules/reports/service.ts` | AI reports, coordinator decision |
| `PaperGenerationService` | `src/modules/reports/paper.service.ts` | Paper generation, PDF, snapshots |
| `QuestionBankMetricsService` | `src/modules/question-bank-metrics/service.ts` | Slot fill, moderation, coverage analytics |
| `ModeratorService` | `src/modules/moderation/service.ts` | Question moderation |
| `DeanReviewService` | `src/modules/production/dean-review.service.ts` | Dean paper selection |

---

## 3. Important modules

### Module pattern

Every well-structured feature module has:
```
src/modules/<feature>/
├── service.ts        Business logic
├── repository.ts     Prisma queries (extends BaseRepository)
└── validation.ts     Zod schemas
```

Modules that follow this pattern: `academic-years`, `semesters`, `subject-versions`, `exam-cycles`, `departments`, `users`, `question-library`, `question-banks`, `question-slots`, `coordinator-departments`, `moderator-assignments`.

Modules that use direct Prisma calls (no repo layer): `coordinator/`, `reports/`, `readiness/`, `question-bank-metrics/`, `production/`, `moderation/`, `notifications/`, `dashboard/`, `ai/`.

### Empty / dead modules

- `src/modules/subjects/` — **empty directory**. Subject logic is in `coordinator/subject.service.ts`.
- `src/modules/questions/` — contains only `slot-template.ts` (computational 126-slot helper).

---

## 4. Common workflows

### Creating a question and assigning to a slot

```
1. GET /api/subject-versions → find the subject version
2. POST /api/question-library → create QuestionLibraryItem (include ?questionBankId)
   → Service auto-assigns to first empty matching slot
   OR
2. POST /api/question-library → create question without bankId
3. GET /api/question-banks/[id]/slots → find empty slot matching (module, marks)
4. PATCH /api/question-banks/[id]/slots/[slotId] → { assignedQuestionId }
```

### Advancing a bank phase

```
1. GET /api/question-banks/[id]/readiness?targetPhase=MODERATION → check readiness
2. PATCH /api/question-banks/[id]/advance → { targetPhase: "MODERATION" }
```

### Generating papers

```
1. POST /api/question-banks/[id]/reports → trigger AI analysis
2. GET /api/question-banks/[id]/reports → poll until COMPLETED
3. POST /api/question-banks/[id]/papers → generate A, B, C
4. GET /api/question-banks/[id]/papers → view generated papers
```

### Coordinator decision

```
1. POST /api/question-banks/[id]/coordinator-decision → { decision: "APPROVED" }
   → Phase set to COMPLETE
   OR
   POST /api/question-banks/[id]/coordinator-decision → { decision: "REJECTED", remark: "..." }
   → Phase set back to MODERATION
```

---

## 5. Important API patterns

### withApiHandler

Every route handler wraps with `withApiHandler`:

```typescript
export const GET = withApiHandler(async (request, { user }) => {
  const result = await service.list();
  return result;
}, {
  roles: ["COORDINATOR"],
  audit: { action: "LIST_BANKS", entityType: "questionBank" },
});
```

The wrapper provides:
- CSRF protection (all non-GET)
- Rate limiting
- Role-based access control
- Automatic audit logging (if `audit:` option provided)
- Consistent error formatting

### Route file structure

```
app/api/question-banks/[id]/
├── route.ts              GET (detail)
├── advance/
│   └── route.ts          PATCH (advance phase)
├── lock/
│   └── route.ts          PATCH (lock)
├── unlock/
│   └── route.ts          POST (unlock)
├── slots/
│   ├── route.ts          GET (list slots)
│   └── [slotId]/
│       └── route.ts      PATCH (assign), DELETE (unassign)
└── ...
```

---

## 6. Database key relationships

```
SubjectVersion ──1:N── QuestionLibraryItem
QuestionLibraryItem ──N:M── QuestionBank (via QuestionSlot)
QuestionBank ──1:N── QuestionSlot
QuestionBank ──1:1── PaperPattern
QuestionBank ──1:N── QuestionBankSnapshot
QuestionBank ──1:N── PaperSnapshot
QuestionBank ──1:N── ApprovalDecision
QuestionBank ──1:1── DeanReview
```

The question-to-bank relationship is indirect. A `QuestionSlot` has an `assignedQuestionId` FK to `QuestionLibraryItem`. A question can be assigned to slots in multiple banks. Within one bank, a question can only occupy one slot.

---

## 7. Testing

```bash
npm run test                          # All tests
npx vitest run tests/unit/slot-template.test.ts  # Unit test for slot template
```

Tests live in `tests/{unit,integration,permission}/`. Unit tests run without infrastructure. Integration tests need MySQL (via Docker).

---

## 8. Debugging tips

| Problem | Likely cause |
|---|---|
| `verify-prisma-client` fails | Run `npm run prisma:generate` after schema changes |
| 401 on API calls | Token expired or missing CSRF header |
| 403 on API calls | User lacks the required role for the endpoint |
| 409 on advance phase | Invalid phase transition (check `transitions.ts`) |
| 409 on slot assignment | Question already assigned to another slot in same bank |
| 409 on lock | Exam cycle not ACTIVE or missing endDate |
| `integrityHash` mismatch | Audit chain tampered or concurrency issue |

### Reading the Prisma schema

```bash
# Open schema.prisma — it's the source of truth for the data model
code prisma/schema.prisma
```

### Checking migrations

```bash
# See migration history
ls prisma/migrations/
# View a specific migration SQL
cat prisma/migrations/<migration_name>/migration.sql
```

---

## 9. Extension points

### Adding a new module

1. Create `src/modules/<name>/service.ts`, `repository.ts`, `validation.ts`
2. Repository extends `BaseRepository` (gets `this.prisma`)
3. Create route files under `app/api/<name>/`
4. Route handlers use `withApiHandler`
5. If the module needs audit logging, pass the `audit:` option

### Adding a new enum

1. Add to `prisma/schema.prisma`
2. Run `npm run prisma:generate`
3. Import from `@prisma/client`

### Adding a new API endpoint

1. Create route file in `app/api/` following existing patterns
2. Wrap handler with `withApiHandler`
3. Set `roles:` to restrict access
4. Add audit logging if needed

### Adding a new MinIO bucket

1. Add bucket name to `docker-compose.yml` `minio-init` command
2. Add bucket to `src/lib/storage.ts` or equivalent configuration
3. Update `docker-compose.yml` with `mc mb -p` command

---

## 10. Key files reference

| File | What it is |
|---|---|
| `prisma/schema.prisma` | Complete data model (26 models, 19 enums) |
| `proxy.ts` | Middleware (route-level auth, NOT middleware.ts) |
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

## 11. Next.js 16 quirks

- Middleware is `proxy.ts` exporting `proxy()` — **not** `middleware.ts`
- App Router under `app/`, pages under `app/(protected)/dashboard/<role>/`
- API routes under `app/api/**/route.ts`
- CSP allows `'unsafe-eval'` in development only (webpack HMR)
- All route handlers wrapped with `withApiHandler`
