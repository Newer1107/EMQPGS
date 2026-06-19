# Architecture Audit — EMQPGS Platform

**Audited:** 2026-06-19  
**Source of Truth:** Source code only.  
**Verification basis:** All 893-line Prisma schema, 25+ service files, 47 page.tsx files, 60+ API route handlers, seed data, infrastructure layer, and UI components.

---

## A. Actual Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                            │
│                                                                     │
│  app/(protected)/dashboard/          app/api/                       │
│  ├── COE         (20 pages)          ├── 26 resource endpoints      │
│  ├── COORDINATOR (13 pages)          └── withApiHandler middleware  │
│  ├── MODERATOR   (5 pages)               ├─ role guard (rbacMatrix) │
│  ├── CONTRIBUTOR (5 pages)               ├─ CSRF (double-submit)   │
│  └── DEAN        (4 pages)               ├─ rate-limit (in-memory) │
│                                           ├─ auth (cookie JWT)      │
│                                           └─ audit (SHA-256 chain) │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│  src/modules/  — 28 domain modules                                  │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐       │
│  │ question-   │  │ question-    │  │  question-slots/      │       │
│  │ library/    │  │ banks/       │  │  ├── assignToSlot()   │       │
│  │ ├── CRUD    │  │ ├── advance  │  │  └── unassignFromSlot()│     │
│  │ ├── submit  │  │ ├── lock    │  │                        │       │
│  │ ├── status  │  │ ├── unlock  │  │  readiness/            │       │
│  │ ├── history │  │ ├── snapshot│  │  └── engine.ts         │       │
│  │ └── transfer│  │ └── metrics │  │                        │       │
│  └─────────────┘  └──────────────┘  └───────────────────────┘       │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐       │
│  │ reports/    │  │ production/  │  │  dashboard/           │       │
│  │ ├── paper-  │  │ ├── dean-    │  │  └── service.ts       │       │
│  │ │  generator│  │ │   review   │  │  (generic stats)      │       │
│  │ ├── analysis│  │ ├── export   │  │                        │       │
│  │ │  -engine   │  │ ├── document│  │  coordinator/          │       │
│  │ ├── ai-     │  │ │  -service  │  │  ├── service.ts        │       │
│  │ │  report   │  │ ├── backup   │  │  ├── question-bank.   │       │
│  │ ├── pdf-    │  │ └── monitor  │  │  │   service.ts        │       │
│  │ │  service  │  └──────────────┘  │  ├── subject.service   │       │
│  │ └── ollama- │                     │  └── reporting.service │       │
│  │    service  │                     │                        │       │
│  └─────────────┘                     │  moderation/           │       │
│                                      │  ├── service.ts        │       │
│  ┌─────────────┐  ┌──────────────┐  │  └── dashboard.service │       │
│  │ users/      │  │ notifications│   └───────────────────────┘       │
│  │ ├── auth    │  │ └── service  │                                   │
│  │ └── CRUD    │    └── email    │                                   │
│  └─────────────┘                 │                                   │
└──────────────────────────────────┴───────────────────────────────────┘
```

**Key pattern:** Every domain module follows `service.ts` → `repository.ts` → `validation.ts`.  
**Request path:** Browser → Next.js Route Handler → `withApiHandler()` middleware → Module Service → Repository → Prisma → MySQL.

---

## B. Actual Workflow Diagram

### Complete End-to-End Workflow

```
COE SETUP PHASE
┌──────────────────────────────────────────────────────────────┐
│ AcademicUnit → Programme → CurriculumScheme → CurriculumSubject│
│ AcademicYear → Batch → BatchSemester → ExamCycle              │
│   └── BatchSemester activation sets Batch.currentSemester     │
│   └── ExamCycle creation auto-links subjects from curriculum  │
│   └── COE assigns Coordinator to Department(s)                │
└──────────────────────────────────────────────────────────────┘

COORDINATOR PHASE
┌──────────────────────────────────────────────────────────────┐
│ initializeQuestionBank(subjectId, examCycleId)                 │
│   └── Creates: QuestionBank (DRAFTING, ACTIVE)                │
│   └── Creates: PaperPattern (modules/marks/slots config)      │
│   └── Creates: 63 (ISE) or 126 (ENDSEM) QuestionSlots         │
│                                                               │
│ assignContributors(questionBankId, contributorIds)             │
│ assignModerators(questionBankId, moderatorIds)                 │
└──────────────────────────────────────────────────────────────┘

CONTRIBUTOR PHASE
┌──────────────────────────────────────────────────────────────┐
│ createQuestion(subjectVersionId, ...) → status: DRAFT         │
│ submitQuestion(questionId) → status: PENDING                  │
│   └── Optionally via createForBank(): auto-assigns to slot    │
│   └── Or assignToSlot(slotId, questionId) manually            │
└──────────────────────────────────────────────────────────────┘

MODERATION PHASE
┌──────────────────────────────────────────────────────────────┐
│ Coordinator advances bank: DRAFTING → MODERATION              │
│   └── Readiness check: all slots must be filled               │
│                                                               │
│ Moderator reviews questions in PENDING or REVISION_SUBMITTED  │
│   ├── approveQuestion() → status: APPROVED                    │
│   ├── rejectQuestion()  → status: REJECTED                    │
│   └── requestRevision() → status: REVISION_REQUESTED          │
└──────────────────────────────────────────────────────────────┘

APPROVAL PHASE
┌──────────────────────────────────────────────────────────────┐
│ Coordinator advances: MODERATION → APPROVAL                   │
│   └── Readiness: all questions moderated, AI report complete  │
│                                                               │
│ Coordinator triggers AI analysis → AiReport created           │
│ Coordinator reviews AI report                                 │
│ Coordinator makes decision:                                    │
│   ├── APPROVED → Bank phase: COMPLETE                         │
│   └── REJECTED → Bank phase: MODERATION (feedback loop)      │
└──────────────────────────────────────────────────────────────┘

COMPLETE PHASE → PRODUCTION
┌──────────────────────────────────────────────────────────────┐
│ Coordinator triggers paper generation → 3 variants (A/B/C)   │
│ Coordinator locks bank → snapshot created, immutable          │
│                                                               │
│ Dean reviews workspace → selects variant per exam slot        │
│   └── Creates DeanReview record                               │
│                                                               │
│ COE exports → PDF/DOCX/ZIP via DocumentService                │
│   └── Uploaded to MinIO/S3 storage                            │
│   └── Creates ExportArtifact record                           │
└──────────────────────────────────────────────────────────────┘
```

### State Machine Diagram

```
Question Status:
  DRAFT ──submit()──► PENDING ──approve()──► APPROVED
    ▲                    │  └──reject()───► REJECTED
    │                    │
    │    ┌──update()─────┘  (COORDINATOR edits approved)
    │    │
    └────┴── revision requested
         │
    REVISION_REQUESTED ──submit()──► REVISION_SUBMITTED
         ▲                               │
         └────── moderator actions ──────┘

Question Bank Phase:
  DRAFTING ──advance()──► MODERATION ──advance()──► APPROVAL
                              ▲                          │
                              │       coordinator        │
                              └────── rejects ───────────┘
                                                      │
                                              coordinator approves
                                                      │
                                                      ▼
                                                   COMPLETE
                                                      │
                                               coordinator locks
                                                      │
                                                 LOCKED

ExamCycle Status:
  DRAFT ──► ACTIVE ──► CLOSED

BatchSemester Status:
  UPCOMING ──activate()──► ACTIVE ──complete()──► COMPLETED
```

---

## C. Entity Dependency Graph

```
AcademicUnit ─────────────────────────────────────────────────────┐
    ├── Programme (homeAcademicUnit)                               │
    ├── Programme (firstYearAcademicUnit)                           │
    ├── CurriculumSubject (which unit offers the subject)          │
    └── BatchSemester (semester's owning unit)                     │
                                                                    │
Programme ───────────────────────────────────────────────────────┘│
    ├── CurriculumScheme ── CurriculumSubject ── Subject          │
    └── Batch ── BatchSemester ── ExamCycle ── QuestionBank ──┐   │
              │         │                        │            │   │
              │         │                   SubjectExamCycle  │   │
              │         │                       Link          │   │
              │    AcademicYear                               │   │
              │         │                                     │   │
              │    TeachingGroup                              │   │
              │                                               │   │
              └───────────────────────────────────────────────┘   │
                                                                   │
Department ── User ──────────────────────────────────────────┐    │
    │            ├── Notification                              │    │
    │            ├── AuditLog                                  │    │
    │            ├── ModeratorBankAssignment ──────────────────┤────┤
    │            ├── ContributorBankAssignment ────────────────┤────┤
    │            ├── QuestionBank (creator)                    │    │
    │            ├── QuestionLibraryItem (creator/owner)       │    │
    │            ├── ModerationEvent                           │    │
    │            ├── DeanReview                                │    │
    │            ├── ExportArtifact                            │    │
    │            └── CoordinatorDepartmentAssignment           │    │
    │                                                          │    │
    └── Subject ───────────────────────────────────────────────┘    │
         ├── SubjectVersion ── QuestionLibraryItem ──────────┐     │
         │                                   │               │     │
         │                              QuestionSlot ────────┤─────┘
         │                                   │               │
         │                              GeneratedPaperItem   │
         │                                   │               │
         │                              GeneratedPaper       │
         │                                   │               │
         │                              PaperSnapshot        │
         │                                   │               │
         │                              DeanReview           │
         │                                   │               │
         │                              ExportArtifact       │
         │                                   │               │
         │                              FileAsset            │
         │                                   │               │
         │                              AiReport             │
         │                                   │               │
         │                              ApprovalDecision     │
         │                                   │               │
         │                              QuestionBankSnapshot  │
         │                                                   │
         └── QuestionRevision                               │
         └── QuestionOwnershipHistory                       │
         └── QuestionUsageHistory                           │
                                                            │
QuestionBank ─────────────────────────────────────────────────┘
    ├── QuestionSlot (63-126 slots per bank)
    ├── PaperPattern
    ├── ModeratorBankAssignment
    ├── ContributorBankAssignment
    ├── ApprovalDecision
    ├── AiReport
    ├── GeneratedPaper ── GeneratedPaperItem
    ├── DeanReview
    ├── ExportArtifact
    ├── QuestionBankSnapshot
    └── PaperSnapshot
```

---

## D. Source-of-Truth Matrix

| Concept | Authoritative Source | Verified In | Notes |
|---------|-------------------|-------------|-------|
| **Semester placement** | `CurriculumSubject.semesterNumber` | `modules/curriculum-subjects/` + `modules/exam-cycles/service.ts` line resolving curriculum subjects | ✅ |
| **Academic year** | `AcademicYear` + `BatchSemester.academicYearId` | `modules/academic-years/` + seed data | ✅ |
| **Subject ownership** | `Subject.departmentId` | `modules/coordinator/subject.service.ts` | ✅ |
| **Question ownership** | `QuestionLibraryItem.ownerId` | `modules/question-library/service.ts` transferOwnership() | ✅ |
| **Contributor assignment** | `ContributorBankAssignment` | `modules/contributor-assignments/service.ts` | ✅ |
| **Moderator assignment** | `ModeratorBankAssignment` | `modules/moderator-assignments/service.ts` | ✅ |
| **Bank readiness** | `ReadinessEngine.isReady()` | `modules/readiness/engine.ts` | ✅ Computed each call, not stored |
| **Paper approval** | `ApprovalDecision` + phase transition | `modules/coordinator/question-bank.service.ts` | ✅ |
| **Paper generation** | `GeneratedPaper` + `PaperSnapshot` | `modules/reports/paper.service.ts` | ✅ |
| **Lock status** | `QuestionBank.recordStatus` | `modules/question-banks/mutable-guard.ts` | ✅ |
| **Question status** | `QuestionLibraryItem.status` | `modules/question-library/service.ts` | ✅ |
| **AI status** | `AiReport.status` | `modules/reports/ai-report.service.ts` | ✅ |
| **Dean approval** | `DeanReview` | `modules/production/dean-review.service.ts` | ✅ |
| **Batch current semester** | `Batch.currentSemesterNumber` + `Batch.currentBatchSemesterId` | `modules/batch-semesters/service.ts` activate()/complete() | ✅ Dual sources (id + number) — intentional denormalization |
| **Who can moderate a bank** | `ModeratorBankAssignment` table | `modules/moderation/service.ts` getAssignedBankIds() | ✅ |
| **Who can contribute to a bank** | `ContributorBankAssignment` table | `modules/question-slots/service.ts` step 3 | ✅ |

**All sources are singular** — no dual-source conflicts detected.

---

## E. Architecture Inconsistencies

### Critical

1. **Dashboard service is generic while role pages do individual queries**  
   `src/modules/dashboard/service.ts` returns the same 4 global stats for every role and has hardcoded pending task strings. **However**, each role dashboard page (`coe/page.tsx`, `coordinator/page.tsx`, `moderator/page.tsx`, `contributor/page.tsx`) bypasses it entirely — COE does 11 direct Prisma queries, Coordinator calls `CoordinatorService.getDashboard()`, Moderator calls `ModeratorDashboardService.getDashboard()`, Contributor calls raw Prisma. The `DashboardService` class is effectively **unused** by actual dashboards.  
   **Evidence:** `src/modules/dashboard/service.ts` (37 lines) vs the page implementations.

2. **`next.config.ts` has `x-powered-by` and `server` headers disabled**  
   Evidence: next.config.ts config. Minor but consistent.

### High

3. **No moderator GET endpoint in assignments API**  
   `GET /api/question-banks/:id/assignments/contributor` exists; `GET /api/question-banks/:id/assignments/moderator` does not. The moderator assignments page at `/dashboard/coordinator/assignments` fetches **all** moderator bank assignments globally rather than filtered by bank.  
   **Evidence:** Route list from API exploration — moderator assignments has `POST` and `DELETE` only.

4. **Question delete is not implemented**  
   There is no DELETE endpoint for questions. Questions are never physically removed — they transition through statuses. This is by design (the comment says "no hard deletes") but it means rejected questions accumulate indefinitely with no cleanup or archival path.  
   **Evidence:** No DELETE handler in any question-library route file.

5. **Paper generator copies seed's hardcoded mark values**  
   `paper-generator.ts` hardcodes `marksPattern = [2, 5, 10]` and `modules = [1,2,3,4,5,6]`. If a `PaperPattern` ever deviates from these exact values, the generator will silently produce wrong results or crash. The marks pattern is already stored in `PaperPattern.marksPattern` (JSON) — the generator should read from it instead.  
   **Evidence:** `src/modules/reports/paper-generator.ts` line: `const modules = [1,2,3,4,5,6]`, `const marksPattern = [2,5,10]`.

### Medium

6. **`AnalysisEngine.detectDuplicates()` returns empty array**  
   The deterministic duplicate detection returns `[]` always. The paper generator has real duplicate detection (Jaccard similarity), but the AI report's deterministic analysis does not ship any duplicate data.  
   **Evidence:** `src/modules/reports/analysis-engine.ts` method `detectDuplicates`: `return [];`

7. **Fire-and-forget notifications**  
   `NotificationService` is called without `await` in several places (e.g., `ModeratorAssignmentService.assignModerator()` line 52, `ContributorAssignmentService.assignContributor()` line 52). If notification creation fails, the error is silently swallowed.  
   **Evidence:** `service.ts` in moderator-assignments and contributor-assignments.

8. **In-memory rate limiter**  
   `rate-limit.ts` uses a global `Map<string, { count, expiresAt }>`. In serverless/containerized deployments (Dockerfile exists), this state is per-process — rate limits reset on each replica. Fine for single-server, misleading if horizontally scaled.  
   **Evidence:** `src/lib/rate-limit.ts`.

9. **Redundant `Module` label string in coordinator service dashboard**  
   `coordinator/service.ts` maps module names: `1: "Module 1"` ... `6: "Module 6"` — this is purely cosmetic and should live in the UI layer.  
   **Evidence:** `modules/coordinator/service.ts` line building `MODULE_LABELS`.

### Low

10. **`MinioProvider` is a passthrough**  
   `minio-provider.ts` extends `S3CompatibleProvider` with zero overrides.  
   **Evidence:** Empty subclass.

11. **Seed marks pattern hardcoded**  
   Seed creates patterns with `marksPattern: [2, 5, 10]` hardcoded in strings, not using the Prisma JSON type properly.  
   **Evidence:** `prisma/seed.ts` pattern creation.

12. **`RecordStatus.ACTIVE` vs QuestionBankPhase enum overlap**  
   Both `DRAFTING` and `ACTIVE` exist as concepts — one is phase, one is record status. `ACTIVE` in `RecordStatus` means "not locked" while `DRAFTING` in `QuestionBankPhase` means "still being written". This is a reasonable design (two orthogonal axes) but can confuse new developers.

---

## F. Dead Code Report

### Models/Fields: All are used in runtime code
Every model in the Prisma schema is referenced by at least one service or repository. However:

### Enums: All used

### APIs: All are reachable
Every route handler at `app/api/` connects to a live module service.

### Unused Dashboard Service
`src/modules/dashboard/service.ts` — the `DashboardService.getRoleDashboard()` method is **not called by any dashboard page**. The COE, Coordinator, Moderator, and Contributor dashboards all bypass it with their own queries.  
**Evidence:** grepping for `DashboardService` imports in page files returns zero results.

### Unused Components Directory
`src/components/coe/` — **empty directory**  
`src/components/questions/` — **empty directory**  
These directories exist in the filesystem but contain no `.tsx` files.

### Unused coordinator dashboard directory `coverage/`
`app/(protected)/dashboard/coordinator/coverage/` exists but has no `page.tsx` — no route.

### Fields written but never read
`Subject.questionBankDueDate` — Set at creation (30 days from now) in `subject.service.ts`, but **never read by any service** (no deadline enforcement, no warning calculation, no dashboard metric).  
**Evidence:** `prisma.subject.findFirst({questionBankDueDate})` — zero hits in non-seed source code. The seed sets it to a global date (Dec 15, 2026), but no runtime code checks it.

`QuestionBank.lockedReason` — Set when locking (`lockQuestionBank` sets it to `"Locked at completion"`), but **never displayed in any UI** or queried for any purpose.  
**Evidence:** UI pages don't reference `lockedReason` in their prop mappings.

### Fields read but never written
None detected — all schema fields are written somewhere in the codebase.

### Unused utilities
`src/lib/pagination.ts` — `paginatedResponse()`, `buildCursorWhere()`, `buildCursorPaginationParams()`, `extractPaginationMeta()`. These are exported and present in the codebase but **no API route uses cursor-based pagination**. All list endpoints use `take`/`skip` offset pagination or no pagination at all.  
**Evidence:** Grep for `paginatedResponse` in route handlers returns zero results.

`src/lib/optimistic-lock.ts` — `withOptimisticLock()`, `buildOptimisticUpdate()`, `buildOptimisticWhere()`. Only used by `QuestionBankService.advancePhase()` and `QuestionBankWorkflowService.lockQuestionBank()` / `coordinatorDecision()`. Question library updates roll their own optimistic lock via Prisma P2025 catching. The generic utility is underutilized.

### Unused RBAC matrix
`src/lib/constants.ts` — `rbacMatrix` defines string-based permissions (`"users:create"`, `"question-banks:manage"`, etc.) but **no runtime code checks these permissions**. The actual access control is role-based (`roles: [...]` array in `withApiHandler` options), not permission-based. The rbacMatrix is defined but never imported or used.  
**Evidence:** `grep -r "rbacMatrix" src/` returns only the definition. Zero references in any service, route handler, or middleware.

### API routes defined but never called from UI
No evidence found — all defined endpoints appear to have corresponding UI functionality.

---

## G. Workflow Correctness Report

### Verified Correct Flows

| Workflow | Status | Evidence |
|----------|--------|----------|
| COE setup (AcademicUnit → Programme → Scheme → Batch → Semester → ExamCycle) | ✅ Correct | `exam-cycles/service.ts` creates ExamCycle, validated by curriculum subjects |
| Coordinator creates question bank | ✅ Correct | `coordinator/question-bank.service.ts` initializes with pattern + all slots |
| Contributor creates and submits question | ✅ Correct | `question-library/service.ts` enforces ownership, status gating, bank mutability |
| Contributor assignment to slot | ✅ Correct | `question-slots/service.ts` 6-step guard chain including contributor check |
| Moderator approval/rejection/revision | ✅ Correct | `moderation/service.ts` moderate() enforces phase, status, mutability, optimistic locking |
| Coordinator advances phase | ✅ Correct | `question-banks/service.ts` advancePhase() validates transition + readiness |
| Coordinator decision (approve/reject bank) | ✅ Correct | `coordinator/question-bank.service.ts` uses transaction + optimistic lock |
| Paper generation | ✅ Correct | `reports/paper.service.ts` generates 3 variants, deduplicates, records usage |
| Dean review submission | ✅ Correct | `production/dean-review.service.ts` validates all 3 variants distinct and exist |
| Export to PDF/DOCX/ZIP | ✅ Correct | `production/export.service.ts` + `document-service.ts` generates and uploads |
| Backup | ✅ Correct | `production/backup.service.ts` runs mysqldump, uploads to S3 |
| Batch semester activation/completion | ✅ Correct | `batch-semesters/service.ts` advances batch's current semester pointer |

### Enforced Guards

| Guard | Where | Enforced |
|-------|-------|----------|
| Can't advance phase if not in allowed transition | `transitions.ts` | ✅ Runtime |
| Can't advance phase if readiness fails | `readiness/engine.ts` | ✅ Runtime |
| Can't modify locked bank | `mutable-guard.ts` | ✅ Runtime |
| Can't assign unassigned contributor | `question-slots/service.ts` | ✅ Runtime |
| Can't moderate outside MODERATION phase | `moderation/service.ts` | ✅ Runtime |
| Can't moderate non-PENDING question | `moderation/service.ts` | ✅ Runtime |
| Can't submit question that's not DRAFT | `question-library/service.ts` | ✅ Runtime |
| Can't transfer ownership if not COORDINATOR | `question-library/service.ts` | ✅ Role + Runtime |
| Can't dean review without all 3 variants | `production/dean-review.service.ts` | ✅ Zod + Runtime |
| Can't export without dean review | `production/export.service.ts` | ✅ Runtime |
| Can't create duplicate exam cycle (batch+type) | Prisma unique constraint | ✅ DB + Runtime |
| Can't create duplicate question bank (subject+cycle) | Prisma unique constraint | ✅ DB + Runtime |
| Can't assign same question to multiple slots in same bank | `question-slots/service.ts` | ✅ Runtime (no DB partial index) |
| Can't activate completed batch semester | `batch-semesters/service.ts` | ✅ Runtime |

### Illegal Transitions (Prevented Correctly)

| Transition | Prevention |
|------------|-----------|
| DRAFTING → APPROVAL | Transitions.ts only allows DRAFTING→MODERATION |
| DRAFTING → COMPLETE | Transitions.ts only allows DRAFTING→MODERATION |
| COMPLETE → anything | Transitions.ts has empty array for COMPLETE |
| LOCKED bank phase change | Mutable guard throws 409 |

---

## H. Architecture Score

### Overall: 87/100

| Category | Score | Deductions |
|----------|-------|------------|
| **Domain Model** | 95 | Clean separation of academic (CurriculumSubject) from operational (QuestionBank). AcademicUnit/Programme/Batch hierarchy is well-designed. -5 for Subject.questionBankDueDate being defined but unused |
| **Separation of Concerns** | 90 | Clean module-per-domain pattern (service/repository/validation). API routes are thin. -10 for DashboardService being dead code while pages do their own queries |
| **Workflow Consistency** | 92 | 5-role workflow is complete end-to-end. Phase transitions are explicit. -8 for missing delete/archive path for rejected questions |
| **Source of Truth** | 98 | Singular authoritative source for every concept. No dual-source drift detected. -2 for Batch.currentSemesterNumber being denormalized (intentional, minor) |
| **Maintainability** | 85 | Consistent module structure. Well-named files. Some services are large (coordinator/service.ts does too many things). -5 for hardcoded values (paper generator marks pattern), -10 for unused utilities (pagination, rbacMatrix) |
| **Scalability** | 70 | In-memory rate limiter won't scale horizontally. No caching layer. Dashboard queries could be expensive at scale (COE dashboard does 11+ queries per page load). -30 for no query optimization strategy |
| **Security** | 92 | CSRF, rate limiting, audit chain, cookie-based JWT with refresh tokens, role guards on every API route, department isolation. -8 for no permission-level RBAC enforcement (rbacMatrix defined but unused), fire-and-forget notifications |
| **Data Integrity** | 95 | Optimistic locking on key mutations, Prisma transactions where needed, SHA-256 audit chain, question revision history. -5 for no physical delete path (accumulating rejected/revision-requested questions) |
| **UI Consistency** | 88 | All 47 pages use real data from real API/services. No mock/placeholder data detected. -12 for DashboardService being skipped by all pages (inconsistency between intended and actual data flow) |
| **Production Readiness** | 65 | Development seed with hardcoded password. No CI/CD config visible beyond Dockerfile. No error monitoring (Sentry env vars exist but no Sentry SDK in package.json). No automated test files for the core workflows (Vitest installed but zero test files found in src/). No database migration strategy for schema evolution beyond prisma migrate dev. -35 cumulative |

### Key Deductions Explained

- **Production Readiness (-35):** No tests, no CI/CD, seed data uses shared password, no migration automation in deployment pipeline.
- **Scalability (-30):** Per-process rate limiter, 11+ query dashboard, no caching, no read replicas.
- **UI Consistency (-12):** DashboardService is defined but unused. Pages implement their own data fetching, creating an inconsistent architecture.
- **Maintainability (-15):** Hardcoded values in paper generator, dead code (pagination utilities, rbacMatrix).
- **Security (-8):** rbacMatrix defined but not enforced. Notification fire-and-forget.
- **Data Integrity (-5):** No question cleanup/archive path.

---

## I. Recommended Architecture

### Quick Wins (Low Effort, High Impact)

1. **Delete dead code**  
   - Remove `src/modules/dashboard/service.ts` (unused — 37 lines)  
   - Remove `src/lib/pagination.ts` (unused cursor pagination) or start using it in list endpoints  
   - Remove `rbacMatrix` from constants.ts or start enforcing it in `withApiHandler`  
   - Remove empty directories `src/components/coe/` and `src/components/questions/`  
   - Remove `coverage/` route directory (no page.tsx)

2. **Read `PaperPattern.marksPattern` in paper generator**  
   Change `paper-generator.ts` to read `modules` and `marksPattern` from the bank's `PaperPattern` instead of hardcoding `[1,2,3,4,5,6]` and `[2,5,10]`. This is a one-line change that prevents a future bug.

3. **Display `lockedReason` in question bank detail page**  
   The UI already passes `recordStatus` — just add `lockedReason` to the `BankDetailClientProps` and display it in a badge/tooltip.

4. **Await notification calls**  
   Add `await` to the fire-and-forget `this.notificationService.create()` calls in moderator-assignments and contributor-assignments services.

5. **Implement `detectDuplicates` in AnalysisEngine**  
   The Jaccard similarity function already exists in `paper.service.ts`. Move it to a shared utility and use it in `analysis-engine.ts`.

### Major Refactors (Separate from Quick Wins)

6. **Add test infrastructure**  
   The project has Vitest configured but **zero test files**. Minimum:
   - Unit tests for state machines (transitions.ts, mutable-guard.ts)
   - Integration tests for the critical workflow path (create bank → assign → moderate → approve → generate → review → export)
   - Repository tests with a test database

7. **Implement question archival/cleanup**  
   Add a `DELETE` endpoint for questions (or a soft-delete `ARCHIVED` status) so rejected/revision-requested questions don't accumulate indefinitely.

8. **Add caching for dashboard queries**  
   The COE dashboard makes 11+ Prisma queries on every page load. Add a data loader pattern or Redis caching layer with TTL-based invalidation.

9. **Replace in-memory rate limiter**  
   Use a Redis-based rate limiter (or database-backed) for horizontal scalability. The in-memory approach is fine for single-server deployment but the Dockerfile suggests containerized deployment.

10. **Implement rbacMatrix enforcement**  
   Either enforce the permission strings in `withApiHandler` (adding a `permissions` option alongside `roles`) or remove the dead matrix. If the role-based approach is sufficient, just remove the unused matrix to reduce confusion.

11. **Use `Subject.questionBankDueDate` for deadline enforcement**  
   Add a readiness check, dashboard warning, or notification when a question bank's deadline is approaching. The field exists and is populated — it's just never read.

### Design Principles to Preserve

- **Module-per-domain** pattern (service/repository/validation) — do not deviate
- **State machine as explicit transitions.ts** — keep phase transitions declarative
- **Optimistic locking** on all mutations — preserve the pattern
- **SHA-256 audit chain** — this is a strong audit feature, preserve and extend
- **Role-department isolation** — the `DepartmentAccessUtils` pattern works well
- **Graceful AI degradation** — AI report falls back to deterministic-only if Ollama is down

### What NOT to Change

- The dual `RecordStatus` + `QuestionBankPhase` orthogonal model (phase = workflow step, record status = lock/active)
- The assignment model (explicit `ModeratorBankAssignment`/`ContributorBankAssignment` join tables rather than inferred from role/department)
- The curriculum model (AcademicUnit → Programme → CurriculumScheme → CurriculumSubject is well-designed)
- The slot-based question bank structure (question containers separate from question content)
- The cookie-based JWT auth (works well for same-origin deployment)

---

## Appendix: Key File Paths Referenced

| Component | Path |
|-----------|------|
| Prisma schema | `prisma/schema.prisma` |
| Seed data | `prisma/seed.ts` |
| Auth middleware | `src/lib/api-handler.ts` |
| Auth config | `src/lib/auth.ts` |
| JWT utilities | `src/lib/jwt.ts` |
| CSRF | `src/lib/csrf.ts` |
| Rate limiter | `src/lib/rate-limit.ts` |
| Audit logging | `src/lib/audit.ts` |
| Constants (RBAC, labels) | `src/lib/constants.ts` |
| Pagination (unused) | `src/lib/pagination.ts` |
| Dashboard service (unused) | `src/modules/dashboard/service.ts` |
| Coordinator dashboard service | `src/modules/coordinator/service.ts` |
| Coordinator question bank service | `src/modules/coordinator/question-bank.service.ts` |
| Coordinator subject service | `src/modules/coordinator/subject.service.ts` |
| Question bank service | `src/modules/question-banks/service.ts` |
| Question bank transitions | `src/modules/question-banks/transitions.ts` |
| Question bank mutable guard | `src/modules/question-banks/mutable-guard.ts` |
| Question library service | `src/modules/question-library/service.ts` |
| Question slot service | `src/modules/question-slots/service.ts` |
| Moderation service | `src/modules/moderation/service.ts` |
| Moderator dashboard service | `src/modules/moderation/dashboard.service.ts` |
| Moderator assignments | `src/modules/moderator-assignments/service.ts` |
| Contributor assignments | `src/modules/contributor-assignments/service.ts` |
| Readiness engine | `src/modules/readiness/engine.ts` |
| Paper generator | `src/modules/reports/paper-generator.ts` |
| Paper service | `src/modules/reports/paper.service.ts` |
| Analysis engine | `src/modules/reports/analysis-engine.ts` |
| AI report service | `src/modules/reports/ai-report.service.ts` |
| PDF service | `src/modules/reports/pdf-service.ts` |
| Ollama service | `src/modules/ai/ollama-service.ts` |
| Dean review service | `src/modules/production/dean-review.service.ts` |
| Export service | `src/modules/production/export.service.ts` |
| Document service | `src/modules/production/document-service.ts` |
| Backup service | `src/modules/production/backup.service.ts` |
| Monitoring service | `src/modules/production/monitoring.service.ts` |
| Exam cycle service | `src/modules/exam-cycles/service.ts` |
| Batch semester service | `src/modules/batch-semesters/service.ts` |
| Department access utils | `src/modules/coordinator/department-utils.ts` |
| COE dashboard page | `app/(protected)/dashboard/coe/page.tsx` |
| Coordinator dashboard | `app/(protected)/dashboard/coordinator/page.tsx` |
| Moderator dashboard | `app/(protected)/dashboard/moderator/page.tsx` |
| Contributor dashboard | `app/(protected)/dashboard/contributor/page.tsx` |
| Dean dashboard | `app/(protected)/dashboard/dean/page.tsx` |
| Bank detail page | `app/(protected)/dashboard/coordinator/question-banks/[id]/page.tsx` |
| Dean review page | `app/(protected)/dashboard/dean/review/page.tsx` |
| COE production page | `app/(protected)/dashboard/coe/production/page.tsx` |
| Moderator question detail | `app/(protected)/dashboard/moderator/questions/[id]/page.tsx` |
| Environment config | `src/lib/env.ts` |
| NextAuth config | `src/lib/auth.ts` |
| API context | `src/lib/api-context.ts` |
