# EMQPGS — Examination Management & Question Paper Generation System

A full-stack web application for managing the complete lifecycle of examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL · MinIO · Auth.js v5 (credentials) · Ollama (optional AI overlay)

---

## 1. Project Overview

EMQPGS replaces paper-based or spreadsheet-based question paper management with a structured, role-based digital workflow. Five distinct user roles collaborate through a shared system to produce examination papers that meet coverage, difficulty, and quality standards.

The system handles:
- **Academic structure management** — departments, academic years, semesters, subjects with versioned syllabi
- **Question library** — a reusable, cross-cycle question repository with ownership tracking, revision history, and usage intelligence
- **Question bank workflow** — a 10-state lifecycle from creation through moderation, AI analysis, signing, approval, and locking
- **Paper generation** — automatic construction of three paper variants (A, B, C) from approved questions, with coverage scoring
- **Dean review** — selection of variants for regular, supplementary, and KT examination slots
- **Export** — PDF, DOCX, and ZIP export of finalized examination packets
- **Audit & monitoring** — append-only audit chain with SHA-256 integrity hashing, operational health checks

---

## 2. Current Architecture

### Academic Domain

```
AcademicYear (2026-2027, startDate, endDate, status)
└── Semester (number 1-8, name)
    ├── Subject (subjectCode, subjectName, credits, department)
    │   └── SubjectVersion (versionNumber, title, syllabusDescription, status)
    │       └── QuestionLibraryItem ← library questions linked here
    └── ExamCycle (examType, status, timetable)
        └── QuestionBank
            └── QuestionBankQuestion ← bridge to library items
```

**Entities:** `AcademicYear`, `Semester`, `Subject`, `SubjectVersion`
**Relationships:** Department 1→N Subjects, AcademicYear 1→N Semesters, Semester 1→N Subjects/ExamCycles, SubjectVersion tracks curriculum per Subject per AcademicYear
**Invariants:** One Semester number per AcademicYear, one Subject code per Department, SubjectVersion version numbers auto-increment per Subject

### Question Domain

```
SubjectVersion
└── QuestionLibraryItem (moduleNumber, marks, coMapping, rbtLevel, difficulty, status, owner)
    ├── QuestionRevision — immutable history of question text/metadata changes
    ├── QuestionOwnershipHistory — immutable log of ownership transfers
    ├── QuestionUsageHistory — immutable log of paper inclusion
    ├── ModerationEvent — record of each moderation action
    └── QuestionBankQuestion → links to QuestionBank
        └── QuestionBank
```

**Entities:** `QuestionLibraryItem`, `QuestionOwnershipHistory`, `QuestionRevision`, `QuestionUsageHistory`, `ModerationEvent`
**Invariants:** Questions belong to a SubjectVersion (not directly to a Bank). Linking to a Bank creates a `QuestionBankQuestion` join record. Usage tracking is append-only via `QuestionUsageHistory`.

### Exam Domain

```
ExamCycle (academicYear + semester + examType → unique)
└── QuestionBank (subject + examCycle → unique)
    ├── QuestionBankQuestion → library item links
    ├── ModeratorBankAssignment
    ├── AiReport
    ├── GeneratedPaper (PAPER_A, PAPER_B, PAPER_C)
    ├── DeanReview (one per bank)
    └── ExportArtifact (PDF, DOCX, or ZIP)
```

**Entities:** `ExamCycle`, `QuestionBank`, `QuestionBankQuestion`, `GeneratedPaper`, `DeanReview`
**Invariants:** One bank per subject+cycle pair. QuestionBank has a 10-state lifecycle enforced by a transition table (`transitions.ts`). Bank lock is terminal. DeanReview is write-once.

### Production Domain

```
Dean Review → Paper Selection (regular, supplementary, KT)
    → Export (PDF, DOCX, ZIP bundle)
        → Signed download URL

Monitoring → Health check, workflow metrics, storage status
Backup → mysqldump → MinIO → system-backups bucket
```

**Services:** `DeanReviewService`, `ExportService`, `MonitoringService`, `BackupService`, `DocumentService`

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.x |
| Database | MySQL 8.x |
| ORM | Prisma (`prisma-client-js`, local query engine) |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.31`, credentials provider) + custom JWT cookies |
| Object Storage | MinIO (6 buckets) |
| AI Analysis | Ollama (optional, deterministic analysis runs without it) |
| PDF Generation | Custom `PdfService` (server-side) |
| Email | SMTP via Nodemailer + Gmail OAuth2 |
| Testing | Vitest |

---

## 4. Local Development Setup

**Prerequisites:** Node.js 24+, Docker Desktop, `mysqldump` in PATH (for backups)

```bash
# 1. Start infrastructure
docker compose up -d mysql minio minio-init

# 2. Install dependencies (runs postinstall = prisma generate + verify)
npm ci

# 3. Apply database migrations
npm run prisma:migrate

# 4. Seed with demo data
npm run prisma:seed

# 5. Start dev server
npm run dev
```

Dev server at `http://localhost:3000`. The server automatically runs `prisma:generate` → `prisma:verify-client` → `next dev`.

---

## 5. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `AUTH_URL` | Yes | Canonical app URL (used for CSRF origin verification) |
| `AUTH_SECRET` | Yes | Auth.js secret (min 32 chars) |
| `JWT_ACCESS_SECRET` | Yes | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key (min 32 chars) |
| `CSRF_SECRET` | Recommended | Falls back to `AUTH_SECRET` if unset |
| `MINIO_*` | Yes | MinIO host, port, access/secret keys, SSL flag |
| `SMTP_*` | For email | SMTP host, port, user, app password |
| `OLLAMA_*` | Optional | Ollama URL, model name |
| `HEALTHCHECK_TOKEN` | Recommended | Shared secret for health endpoint |

All variables are validated at startup by `src/lib/env.ts` using Zod. The app refuses to start if required vars are missing.

There is no `.env.example`. The committed `.env` is the development reference.

---

## 6. Database Setup

Migration commands:

| Command | Purpose |
|---|---|
| `npm run prisma:migrate` | Apply pending migrations in dev |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:seed` | Seed demo data |

The `postinstall` hook and all `dev`/`build`/`start` scripts run `scripts/verify-prisma-client.cjs` which validates:
- Client is generated
- Schema matches `prisma/schema.prisma`
- Engine is local (no `--no-engine` or Accelerate mode)
- Engine binary exists

---

## 7. Seeding

```bash
npm run prisma:seed
```

Creates:
- **2 departments:** CSE, ECE
- **5 users** (all password `Password@123`):
  - `coe@emqpgs.local` (COE)
  - `coordinator@emqpgs.local` (COORDINATOR)
  - `moderator@emqpgs.local` (MODERATOR)
  - `contributor@emqpgs.local` (CONTRIBUTOR)
  - `dean@emqpgs.local` (DEAN)
- **1 active exam cycle** (ENDSEM, 2026-2027, Semester 5)
- **1 subject** (CS501 - Advanced Algorithms)
- **1 question bank** (linked to subject + cycle)
- **Coordinator-CSE department assignment**

---

## 8. Running Tests

```bash
npm run test           # All tests
npm run test:watch     # Watch mode
npx vitest run tests/unit/slot-template.test.ts   # Single file
npx vitest run -t "slot generation"               # Pattern match
```

Tests live under `tests/{unit,integration,permission}/`. Path alias `@/` → `src/` is configured in both `tsconfig.json` and `vitest.config.ts`.

Integration tests require a running MySQL. Unit tests (`tests/unit/`) run without infrastructure.

---

## 9. Folder Structure

```
emqpgs/
├── app/                          # Next.js App Router
│   ├── (protected)/              # Authenticated routes
│   │   └── dashboard/            # Role-based dashboards
│   │       ├── coe/              #   COE: users, departments, exam-cycles, production, monitoring, audit
│   │       ├── coordinator/      #   Coordinator: subjects, question-banks, questions, assignments
│   │       ├── contributor/      #   Contributor: my-subjects, submit-question, my-submissions
│   │       ├── moderator/        #   Moderator: questions queue, approved, rejected
│   │       └── dean/             #   Dean: review, reports, readiness-overview
│   ├── login/                    # Login page
│   ├── forgot-password/          # Password reset request
│   ├── reset-password/           # Password reset
│   └── api/                      # ~55 API route files, ~90 endpoints
├── src/
│   ├── modules/                  # Feature modules
│   │   ├── academic-years/       #   AcademicYear CRUD
│   │   ├── semesters/            #   Semester CRUD
│   │   ├── subject-versions/     #   SubjectVersion CRUD + archiving
│   │   ├── subjects/             #   Subject management (via CoordinatorService delegation)
│   │   ├── exam-cycles/          #   ExamCycle CRUD + activation
│   │   ├── question-library/     #   QuestionLibraryItem CRUD, ownership, history
│   │   ├── question-banks/       #   QuestionBank service, transitions, validation
│   │   ├── question-bank-questions/ # Bridge table management
│   │   ├── coordinator/          #   Coordinator dashboard, workflow orchestration
│   │   ├── moderation/           #   Moderation workflows, question review
│   │   ├── reports/              #   AI analysis, paper generation, signed reports
│   │   ├── production/           #   Dean review, exports, backup, monitoring
│   │   ├── notifications/        #   In-app + email notifications
│   │   ├── users/                #   User CRUD
│   │   ├── departments/          #   Department CRUD
│   │   ├── dashboard/            #   Dashboard aggregation
│   │   ├── ai/                   #   Ollama integration
│   │   └── shared/               #   BaseRepository, shared utilities
│   ├── lib/                      # Shared infrastructure
│   │   ├── api-handler.ts        #   withApiHandler wrapper (RBAC, CSRF, rate limit, audit, error formatting)
│   │   ├── api-context.ts        #   Request metadata extraction
│   │   ├── jwt.ts                #   JWT signing/verification
│   │   ├── csrf.ts               #   CSRF token management
│   │   ├── audit.ts              #   Append-only audit chain
│   │   ├── rate-limit.ts         #   In-memory rate limiter
│   │   ├── db.ts                 #   Prisma singleton
│   │   ├── errors.ts             #   AppError, NotFoundError, ForbiddenError
│   │   ├── constants.ts          #   Cookie names, entity types
│   │   ├── env.ts                #   Zod-parsed env vars
│   │   ├── storage.ts            #   MinIO client
│   │   ├── client-fetch.ts       #   Browser fetch wrapper (auto CSRF)
│   │   ├── server-data.ts        #   SSR data helpers
│   │   └── optimistic-lock.ts    #   Optimistic concurrency utilities
│   └── components/               # Shared React components
├── prisma/
│   ├── schema.prisma             # 26 models, 19 enums
│   ├── migrations/               # SQL migration files
│   └── seed.ts                   # Demo data seeder
├── tests/
│   ├── unit/                     # Unit tests (no infrastructure needed)
│   ├── integration/              # Integration tests (require MySQL)
│   └── permission/               # RBAC tests
├── scripts/
│   └── verify-prisma-client.cjs  # CI guard for Prisma client integrity
├── proxy.ts                      # Middleware (NOT middleware.ts)
├── docker-compose.yml            # MySQL + MinIO + minio-init
└── Dockerfile                    # Production container (node:24-alpine)
```

---

## 10. User Roles

### COE (Controller of Examination)
- Manages users, departments, exam cycles, academic years, semesters
- Views audit logs and monitoring dashboard
- Triggers paper exports (PDF, DOCX, ZIP) and system backups
- Cannot create subjects or question banks

### Coordinator
- Manages subjects and question banks for their assigned departments
- Creates question banks, assigns contributors per module, assigns moderators
- Triggers AI analysis, paper generation, and locks banks
- Approves or rejects signed reports (coordinator decision)
- Performs question ownership transfers

### Contributor
- Views assigned question banks and their module slots
- Creates, edits, and submits question drafts
- Revises questions in response to moderator feedback
- Cannot moderate or approve questions

### Moderator
- Reviews submitted questions for assigned banks
- Approves, rejects, or requests revision on questions
- Can override previously approved questions (while bank is mutable)
- Uploads HOD-signed report PDFs

### Dean
- Reviews generated paper variants with scores and recommendations
- Selects variants for regular, supplementary, and KT examination slots
- View-only access to question banks and reports

---

## 11. Current Workflow

```
Subject → SubjectVersion → Question Library → Moderation → Question Bank → Paper Generation → Dean Review → Export

Detailed flow:

COE:
  Create AcademicYear → Create Semester → Create ExamCycle (DRAFT) → Activate (ACTIVE)

Coordinator:
  Create Subject (auto-creates SubjectVersion v1) → Link Subject to ExamCycle
  → Initialize QuestionBank (status IN_PROGRESS, creates bridge table)
  → Assign Contributors (per module) → Assign Moderator (per bank)
  → Advance bank status through workflow

Contributor:
  Create Question (links to SubjectVersion) → Link to QuestionBank
  → Submit for moderation (status → PENDING)

Moderator:
  Review questions → Approve / Reject / Request Revision
  → Upload HOD-signed report (when applicable)

Coordinator (continued):
  Trigger AI Analysis → Generate Paper Variants (A, B, C)
  → Upload signed report → Coordinator Decision (APPROVED/REJECTED)
  → Lock Question Bank (terminal)

Dean:
  Review generated papers → Select variants for Regular / Supplementary / KT

COE:
  Export finalized packets (PDF/DOCX/ZIP)
  → Monitor system → Close Exam Cycle
```

**State machine** (QuestionBankStatus — 10 states enforced by `transitions.ts`):

```
DRAFT → IN_PROGRESS → UNDER_MODERATION → MODERATED → REPORT_GENERATED
        → AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED
        → AWAITING_COORDINATOR_APPROVAL → APPROVED → LOCKED
```

All states can fast-lock to `LOCKED`. No exits from `LOCKED`.

---

## 12. Known Limitations

1. **Synchronous long operations** — AI analysis, paper generation, exports, and backups run inside the HTTP request. Timeouts possible for large question banks.
2. **In-memory rate limiter** — resets on restart; not multi-instance safe.
3. **No background workers** — the `workers/` directory exists but is empty. No BullMQ, no Redis.
4. **No scheduled backups** — backups are API/manual-trigger only.
5. **QuestionLibraryItem is SubjectVersion-scoped** — questions cannot exist outside a subject version context. No cross-cycle shared question pool.
6. **Question slot grid as computational helper** — the 126-slot template (6 modules × 3 marks × 7 slots) is no longer a persisted grid of pre-allocated slots. It's used as a computational template by the `PaperGenerator` and `AnalysisEngine`.
7. **Concurrency gaps** — concurrent moderator actions and contributor edits use last-writer-wins semantics (no optimistic locking on question-level operations).
8. **Lock bypass** — `lockQuestionBank()` bypasses the state machine transition table for certain paths.
9. **Password hash leak** — some moderator/coordinator API responses include `passwordHash` via `include: { contributor: true }`.
10. **No dean review update/delete** — dean selection is write-once, no undo path.

---

## 13. Roadmap

### Short-term (P0/P1 fixes)
- Moderator assignment route (currently missing — P0)
- Object-level access checks on 3 routes (status update, coordinator decision, subject version archive)
- Build UI for question creation, editing, moderation, and bank workflow actions
- Emergency unlock endpoint for locked banks (COE-only)
- Transaction wrapping for ownership transfer (atomicity guarantee)

### Medium-term
- Background job queue for AI reports, paper generation, exports, backups
- Redis-backed rate limiter for multi-instance deployments
- Auto-advance for question bank status when conditions are met
- Question usage history visualization
- Optimistic concurrency adoption across all services

### Long-term
- Cross-cycle shared question pool (decouple from SubjectVersion)
- Syllabus/curriculum versioning with CO definitions per subject
- Assignment template system
- Multi-institution tenancy
- Schema deduplication (remove redundant moduleNumber/marks/slotNumber from Question)
- Paper version history (immutable past papers)
