# EMQPGS — Examination Management & Question Paper Generation System

A full-stack web application for managing the complete lifecycle of examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL 8 · MinIO · Auth.js v5 credentials + custom JWT · Ollama (optional)

---

## 1. Core concepts

### QuestionLibraryItem

A standalone, reusable question entity. Belongs to a `SubjectVersion` (not to a bank). Stores `moduleNumber`, `marks`, `questionText`, `coMapping`, `rbtLevel`, `difficultyLevel`, `status`, and ownership. Is versioned via `QuestionRevision` and tracks usage via `QuestionUsageHistory`. A question may be assigned to slots in **multiple banks simultaneously**.

Status lifecycle: `DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED`

### QuestionSlot

The sole linkage between a `QuestionBank` and `QuestionLibraryItem`. Each slot represents a position within a bank defined by `(moduleNumber, marks, slotNumber)`. A slot has an optional `assignedQuestionId` FK to a library item. Slots are created when a bank is initialized (based on the bank's `PaperPattern`).

Uniqueness: `@@unique([questionBankId, moduleNumber, marks, slotNumber])`. A question can only occupy one slot per bank (enforced at application layer), but can be in multiple banks simultaneously.

### QuestionBank

A container for exam questions for one `(Subject, ExamCycle)` pair. Has a `QuestionBankPhase` and a `RecordStatus` — two orthogonal axes of state.

**Phases** (workflow progression):
```
DRAFTING → MODERATION → APPROVAL → COMPLETE
                 ↑            │
                 └── REJECT ──┘  (loopback from APPROVAL → MODERATION)
```

**RecordStatus** (operational state):
- `ACTIVE` — mutable, open for editing
- `LOCKED` — immutable snapshot; prevents all modifications
- `ARCHIVED` — hidden from active workflows

Phase advancement is manual (coordinator action). The `ReadinessEngine` reports readiness but does not auto-advance.

### PaperPattern

One per bank, created at initialization. Defines the slot grid dimensions based on `ExamType`:

| ExamType | Modules | Marks | Slots/module | Total slots |
|---|---|---|---|---|
| ISE_1 | 3 | 2,5,10 | 7 | 63 |
| ISE_2 | 3 | 2,5,10 | 7 | 63 |
| ENDSEM | 6 | 2,5,10 | 7 | 126 |
| SUPPLEMENTARY | 6 | 2,5,10 | 7 | 126 |
| KT | 6 | 2,5,10 | 7 | 126 |

### ReadinessEngine

Evaluates whether a bank is ready to advance to the next phase. Checks slot fill rate, moderation coverage, and AI report completion for `APPROVAL`. Returns a `ReadinessAssessment` with issues and warnings. Does **not** automatically advance phases — that is always a manual coordinator action.

### ApprovalDecision

Created when a coordinator makes an approve/reject decision during the `APPROVAL` phase. Approval advances the bank to `COMPLETE`. Rejection loops back to `MODERATION`. The decision is recorded immutably with the deciding user, timestamp, and optional remark.

### Snapshots

Immutable records of bank state at key moments:

- **QuestionBankSnapshot** — created when a bank is locked (`SnapshotType.LOCKED`). Contains the full slot assignment grid at lock time.
- **PaperSnapshot** — created/upserted each time papers are generated. Captures the paper JSON, coverage, difficulty, and quality scores for each variant.

---

## 2. Workflow

```
COE:
  Create AcademicYear → (8 semesters auto-generated) → Create ExamCycle (DRAFT) → Activate (ACTIVE)

Coordinator:
  Create Subject (auto-creates SubjectVersion v1) → Link Subject to ExamCycle
  → Initialize QuestionBank (phase DRAFTING, slots created from PaperPattern)
  → Assign contributors (via slot assignment API) → Assign Moderator (per bank)
  → Advance phase through: DRAFTING → MODERATION → APPROVAL → COMPLETE

Contributor:
  Create QuestionLibraryItem (linked to SubjectVersion)
  → Assign to slot in bank (via slot assignment API)
  → Submit for moderation (status → PENDING)

Moderator:
  Review assigned questions → Approve / Reject / Request Revision

Coordinator (continued):
  Trigger AI Analysis → Generate 3 Paper Variants (A, B, C)
  → Readiness check → Advance phase → Coordinator Decision (Approve/Reject)
  → Lock Question Bank (creates snapshot, immutable state)

Dean:
  Review generated papers → Select variants for Regular / Supplementary / KT

COE:
  Export finalized packets (PDF/DOCX/ZIP)
  → Monitor system → Close Exam Cycle
```

### Phase transitions (canonical table)

```
Current Phase        → Allowed Next
──────────────────────────────────────
DRAFTING             → MODERATION
MODERATION           → APPROVAL
APPROVAL             → COMPLETE, MODERATION (rejection loopback)
COMPLETE             → (none)
```

Transitions not listed are illegal and return HTTP 409. Record status (`ACTIVE`/`LOCKED`/`ARCHIVED`) is orthogonal to phase.

---

## 3. Module architecture

```
src/modules/
├── academic-years/       AcademicYear CRUD (auto-generates 8 semesters, has activeSemesterType ODD/EVEN)
├── semesters/            Semester read-only (auto-generated, no manual CRUD)
├── subject-versions/     SubjectVersion CRUD + archive
├── exam-cycles/          ExamCycle CRUD + activation
├── departments/          Department CRUD
├── users/                User CRUD + auth
├── question-library/     QuestionLibraryItem CRUD, submit, ownership, history
├── question-banks/       QuestionBank CRUD, phase transitions, lock/unlock
├── question-slots/       Slot assignment/unassignment (links QLI to bank)
├── question-bank-metrics/ Slot fill, moderation, coverage analytics
├── moderation/           Moderator question review + dashboard
├── readiness/            ReadinessEngine for phase gating
├── coordinator/          Coordinator dashboard, workflow orchestration
├── reports/              AI analysis, paper generation, PDF, coordinator decisions
├── production/           Dean review, exports, backup, monitoring
├── notifications/        In-app + email notifications
├── dashboard/            Generic role-based dashboard
├── coordinator-departments/ Coordinator-department assignment management
├── moderator-assignments/   Moderator-to-bank assignment
├── ai/                   Ollama integration
├── questions/            Slot template builder (computational 126-slot pattern)
└── shared/               BaseRepository

src/lib/
├── api-handler.ts        withApiHandler wrapper (RBAC, CSRF, rate limit, audit, errors)
├── api-context.ts        Request metadata extraction
├── jwt.ts                JWT signing/verification
├── csrf.ts               CSRF token management
├── audit.ts              Append-only audit chain (SHA-256 hash chain)
├── rate-limit.ts         In-memory rate limiter
├── db.ts                 Prisma singleton
├── errors.ts             AppError, NotFoundError, ForbiddenError
├── storage.ts            MinIO client
├── constants.ts          Cookie names, entity types
├── env.ts                Zod-parsed env vars
├── client-fetch.ts       Browser CSRF wrapper
├── optimistic-lock.ts    Optimistic concurrency utilities
└── logger.ts             Structured logger
```

---

## 4. Role-based access

| Role | Capabilities |
|---|---|
| **COE** | Users, departments, exam cycles, academic years, semesters, audit logs, exports, backups, monitoring |
| **COORDINATOR** | Subjects, question banks, slot assignments, moderator assignments, phase advancement, AI reports, paper generation, lock/unlock, coordinator decisions, ownership transfers |
| **CONTRIBUTOR** | Create/edit/own questions, assign to slots, submit for moderation, revise on feedback |
| **MODERATOR** | Review assigned questions, approve/reject/request revision |
| **DEAN** | Review paper variants, select for regular/supplementary/KT slots |

RBAC is two-layer: `proxy.ts` middleware gates route-level access by role; `withApiHandler({ roles: [...] })` gates operation-level. Object-level checks (e.g. moderator can only see assigned banks) live in services.

---

## 5. Database

26 models, 19 enums. Key relationships:

```
SubjectVersion 1─N QuestionLibraryItem 1─N QuestionRevision
                                           1─N QuestionOwnershipHistory
                                           1─N QuestionUsageHistory
                                           1─N ModerationEvent
                                           1─N QuestionSlot (via assignedQuestionId)
QuestionBank 1─N QuestionSlot
              1─1 PaperPattern
              1─N QuestionBankSnapshot
              1─N PaperSnapshot
              1─N ApprovalDecision
              1─N AiReport
              1─N GeneratedPaper
              1─N ModeratorBankAssignment
              1─1 DeanReview
              1─N ExportArtifact
ExamCycle 1─N QuestionBank
           1─N SubjectExamCycleLink
Subject 1─N SubjectVersion
        1─N QuestionBank
```

See `docs/database.md` for full schema documentation.

---

## 6. Setup

### Prerequisites
- Node.js 24+
- Docker Desktop
- `mysqldump` in PATH (for backups)

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

Dev server at `http://localhost:3000`. The dev script automatically runs `prisma:generate` → `prisma:verify-client` → `next dev`.

---

## 7. Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `AUTH_URL` | Yes | Canonical app URL (CSRF origin verification) |
| `AUTH_SECRET` | Yes | Auth.js secret (min 32 chars) |
| `JWT_ACCESS_SECRET` | Yes | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key (min 32 chars) |
| `CSRF_SECRET` | Recommended | Falls back to `AUTH_SECRET` if unset |
| `MINIO_*` | Yes | MinIO host, port, access/secret keys, SSL flag |
| `SMTP_*` | For email | SMTP host, port, user, app password |
| `OLLAMA_*` | Optional | Ollama URL, model name |
| `HEALTHCHECK_TOKEN` | Recommended | Shared secret for health endpoint |

All variables validated at startup by `src/lib/env.ts` using Zod. No `.env.example` — use committed `.env` as reference.

---

## 8. Database commands

| Command | Purpose |
|---|---|
| `npm run prisma:migrate` | Apply pending migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:seed` | Seed demo data |

---

## 9. Seed data

```bash
npm run prisma:seed
```

Creates 2 departments (CSE, ECE), 5 users with password `Password@123`:
- `coe@emqpgs.local` (COE)
- `coordinator@emqpgs.local` (COORDINATOR)
- `moderator@emqpgs.local` (MODERATOR)
- `contributor@emqpgs.local` (CONTRIBUTOR)
- `dean@emqpgs.local` (DEAN)

Plus 27 active exam cycles (ENDSEM, 2026-2027, 9 departments × 3 semesters III/V/VII), subjects per department, question banks, and coordinator-department assignments.

---

## 10. Testing

```bash
npm run test                 # All tests
npm run test:watch           # Watch mode
npx vitest run tests/unit/slot-template.test.ts  # Single file
npx vitest run -t "slot generation"              # Pattern match
```

Tests: `tests/{unit,integration,permission}/`. Path alias `@/` → `src/`. Unit tests run without infrastructure; integration tests need MySQL.

---

## 11. MinIO buckets

| Bucket | Purpose |
|---|---|
| `question-bank-attachments` | Question attachments and assets |
| `generated-papers` | Generated paper PDFs |
| `exports` | Export artifacts (PDF, DOCX, ZIP) |
| `audit-files` | Audit log exports |
| `system-backups` | Database backup files |

Created by `minio-init` service in `docker-compose.yml`. Do not add buckets without updating that init step.

---

## 12. Architecture documents

| Document | What it covers |
|---|---|
| `docs/architecture.md` | Domain model, entity relationships, workflow, readiness, paper generation, snapshots, approval |
| `docs/database.md` | Every table, purpose, relationships, invariants |
| `docs/api.md` | All active routes with request/response shapes and permissions |
| `docs/workflow.md` | Phase transitions, ReadinessEngine rules, locking, approval, paper lifecycle |
| `docs/onboarding.md` | 30-minute developer orientation |
| `docs/gap-report.md` | Documentation audit findings |

---

## 13. Known limitations

1. **Synchronous long operations** — AI analysis, paper generation, exports, and backups run inside the HTTP request. Timeouts possible for large banks.
2. **In-memory rate limiter** — resets on restart; not multi-instance safe.
3. **No background workers** — `workers/` directory exists but is empty. No BullMQ, no Redis.
4. **No scheduled backups** — API/manual-trigger only.
5. **QuestionLibraryItem is SubjectVersion-scoped** — no cross-cycle shared question pool.
6. **Concurrency gaps** — some operations use last-writer-wins semantics.
7. **No dean review update/delete** — write-once selection, no undo path.
