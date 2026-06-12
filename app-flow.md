# EMQPGS — Complete Application Flow

## Overview

EMQPGS (Examination Management & Question Paper Generation System) orchestrates the entire lifecycle of exam paper creation — from institutional setup through question contribution, moderation, AI analysis, paper generation, dean review, and final export. This document describes every stage of that lifecycle in detail.

---

## System Architecture Summary

```
Browser (Next.js App Router)
        ↓ HTTPS
Next.js Route Handlers (API layer)
        ↓
Service Layer (src/modules/)
        ↓
Repository Layer (Prisma ORM)
        ↓
MySQL 8 (primary data store)

Async Work:
  BullMQ → Redis → Workers (AI analysis, paper generation, exports, backups)

File Storage:
  MinIO (presigned URLs, never public direct access)

AI:
  Ollama (local LLM for natural language summary overlays)

Auth:
  Auth.js credentials provider → JWT access + refresh cookies
```

---

## Phase 0: Authentication Flow

All users — regardless of role — go through the same authentication flow before accessing any protected page.

### Login

```
1. User navigates to /login (public route)
2. User enters email + password
3. Frontend fetches CSRF token: GET /api/auth/csrf
4. Frontend POSTs to /api/auth/login with credentials + CSRF token
5. Server:
   a. Validates CSRF token (rejects if missing or invalid)
   b. Looks up user by email in MySQL
   c. Verifies bcrypt password hash
   d. On success: generates JWT access token + refresh token
   e. Sets HttpOnly cookies: access_token (short TTL) + refresh_token (long TTL)
6. Server responds with user role and redirect target
7. Client redirects to role-appropriate dashboard:
   - COE        → /dashboard/coe
   - COORDINATOR→ /dashboard/coordinator
   - MODERATOR  → /dashboard/moderator
   - CONTRIBUTOR→ /dashboard/contributor
   - DEAN       → /dashboard/dean
```

### Session Maintenance

```
- Every protected API call checks the access_token cookie
- If access_token is expired but refresh_token is valid:
    → POST /api/auth/refresh is called automatically
    → New access_token is issued; refresh_token TTL is extended if rolling
- If both tokens are invalid/missing:
    → User is redirected to /login
- Session idle timeout:
    → Inactivity for SESSION_IDLE_TIMEOUT_MINUTES causes forced logout
    → On logout: POST /api/auth/logout clears both cookies
```

### Password Reset

```
1. User clicks "Forgot Password" on /login
2. POST /api/auth/forgot-password with email
3. System generates a time-limited reset token and sends email (abstracted mailer)
4. User clicks email link → /reset-password?token=[TOKEN]
5. POST /api/auth/reset-password with token + new password
6. Password is updated; old sessions are invalidated
```

---

## Phase 1: Platform Setup (COE)

Before any question contribution can happen, the COE must configure the foundational data structures.

### Step 1.1 — Create Departments

```
COE → /dashboard/coe/departments → Create Department
  Fields: name, code, description
  Result: Department record created in MySQL
  Audit: "DEPARTMENT_CREATED" event logged
```

### Step 1.2 — Create Users

```
COE → /dashboard/coe/users → Create User
  Fields: name, email, role, department assignment
  Result:
    - User record created with hashed default/temporary password
    - User receives welcome email with password reset link
  Roles: COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN
  Audit: "USER_CREATED" event logged
```

### Step 1.3 — Assign Coordinators to Departments

```
COE → /dashboard/coe/departments → Assign Coordinator
  Select a COORDINATOR user → link to department
  Result: CoordinatorDepartment join record created
  Audit: "COORDINATOR_ASSIGNED" event logged
```

### Step 1.4 — Create Exam Cycles

```
COE → /dashboard/coe/exam-cycles → Create Exam Cycle
  Fields: name (e.g. "Even Semester 2025"), academic year, semester type (ODD/EVEN), status (DRAFT)
  Result: ExamCycle record created with status = DRAFT
  Audit: "EXAM_CYCLE_CREATED" event logged
```

### Step 1.5 — Activate Exam Cycle

```
COE → /dashboard/coe/exam-cycles → Activate
  Transitions ExamCycle.status: DRAFT → ACTIVE
  Constraint: only one ACTIVE cycle per semester type per department
  Audit: "EXAM_CYCLE_ACTIVATED" event logged
```

---

## Phase 2: Subject and Bank Setup (Coordinator)

With the exam cycle active, Coordinators set up subjects and initialize question banks.

### Step 2.1 — Create Subjects

```
Coordinator → /dashboard/coordinator/subjects → Create Subject
  Fields: name, code, department, semester, credit load
  Result: Subject record linked to Coordinator's department
  Audit: "SUBJECT_CREATED" event logged
```

### Step 2.2 — Link Subjects to Exam Cycle

```
Coordinator → /dashboard/coordinator/subjects → Link to Exam Cycle
  Select subject + active exam cycle
  Result: SubjectExamCycle association record created
  Audit: "SUBJECT_LINKED_TO_CYCLE" event logged
```

### Step 2.3 — Initialize Question Banks

```
Coordinator → /dashboard/coordinator/question-banks → Initialize Bank
  Select subject-cycle combination
  Result:
    - QuestionBank record created (status = OPEN)
    - 126 QuestionSlot records generated (6 modules × 3 mark types × 7 slots)
    - All slots initialized with status = EMPTY
  Audit: "QUESTION_BANK_INITIALIZED" event logged
```

The 126 slots follow this coordinate system:

```
For module M (1–6):
  For mark type T (2, 5, 10):
    For slot index S (1–7):
      Slot coordinate: M.T.S
      Example: 3.10.5 = Module 3, 10-mark question, slot 5
```

### Step 2.4 — Assign Contributors to Modules

```
Coordinator → /dashboard/coordinator/assignments → Assign Contributor
  Select question bank → select module(s) → select CONTRIBUTOR user
  Result: ModuleAssignment records created
  Contributor receives notification: "You have been assigned to [Subject] Module [N]"
  Audit: "CONTRIBUTOR_ASSIGNED" event logged
```

---

## Phase 3: Question Contribution (Contributor)

Contributors fill their assigned slots with questions.

### Step 3.1 — View Assigned Slots

```
Contributor → /dashboard/contributor/questions
  Sees: only their own assigned modules and slots
  Slot statuses visible: EMPTY, DRAFT, PENDING, APPROVED, REJECTED, REVISION_REQUESTED, REVISION_SUBMITTED
```

### Step 3.2 — Draft a Question

```
Contributor → clicks an EMPTY slot → opens question editor
  Fields:
    - Question text (required)
    - CO tag (required) — Course Outcome selection
    - RBT level (required) — L1 through L6
    - Difficulty (required) — Easy / Medium / Hard
    - Attachments (optional) — triggers presigned upload flow:
        1. Client requests presigned upload URL from server
        2. Server generates presigned PUT URL for MinIO bucket "question-bank-attachments"
        3. Client uploads file directly to MinIO via presigned URL
        4. MinIO object key saved to question record
  Action: "Save as Draft"
  Result: Question record created with status = DRAFT
  Audit: "QUESTION_DRAFT_SAVED" event logged
```

### Step 3.3 — Submit a Question

```
Contributor → opens a DRAFT question → clicks "Submit"
  OR
Contributor → fills form directly → clicks "Submit" (skips draft)

  Validation:
    - All required fields present
    - CO tag and RBT level selected
    - Slot is EMPTY or DRAFT (cannot resubmit an APPROVED question)

  Result:
    - Question.status → PENDING
    - Slot.status → PENDING
    - Moderator receives notification: "[Subject] Module [N]: New question submitted"
    - Coordinator receives notification: "Slot [coordinate] submitted for review"
  Audit: "QUESTION_SUBMITTED" event logged
```

---

## Phase 4: Moderation (Moderator)

Moderators review every pending question and make a quality decision.

### Step 4.1 — Review Queue

```
Moderator → /dashboard/moderator/questions
  Sees: all PENDING and REVISION_SUBMITTED questions across assigned banks
  Can filter by: status, module, mark type, bank, contributor
```

### Step 4.2 — Approve a Question

```
Moderator → opens PENDING question → clicks "Approve"
  Result:
    - Question.status → APPROVED
    - Slot.status → APPROVED
    - Slot counts as filled toward bank readiness
    - Contributor receives notification: "Your question for [Slot] was approved"
  Audit: "QUESTION_APPROVED" event logged
```

### Step 4.3 — Request Revision

```
Moderator → opens PENDING question → clicks "Request Revision"
  Required: revision instructions (free text)
  Result:
    - Question.status → REVISION_REQUESTED
    - Slot.status → REVISION_REQUESTED
    - Contributor receives notification with revision instructions
  Audit: "REVISION_REQUESTED" event logged
```

### Step 4.4 — Contributor Revises and Resubmits

```
Contributor → opens REVISION_REQUESTED question → edits → clicks "Resubmit"
  Result:
    - Question content updated (new version stored, old version archived in revision history)
    - Question.status → REVISION_SUBMITTED
    - Moderator receives notification: "Revised question ready for re-review"
  Audit: "QUESTION_RESUBMITTED" event logged
```

### Step 4.5 — Reject a Question

```
Moderator → opens PENDING or REVISION_SUBMITTED question → clicks "Reject"
  Required: rejection reason (free text)
  Result:
    - Question.status → REJECTED
    - Slot.status → EMPTY (freed for a new submission)
    - Contributor receives notification with rejection reason
    - Rejected question archived (not deleted)
  Audit: "QUESTION_REJECTED" event logged
```

### Step 4.6 — Moderation Override (Post-Approval Correction)

```
Moderator → opens APPROVED question (bank not yet LOCKED) → clicks "Override / Reopen"
  Result:
    - Question.status → PENDING
    - Slot.status → PENDING
    - Approval is reversed
  Audit: "MODERATION_OVERRIDE" event logged
  Note: Override blocked if question bank is LOCKED
```

---

## Phase 5: AI Analysis (Coordinator + Background Worker)

Once a question bank is sufficiently filled with approved questions, the Coordinator can trigger AI analysis.

### Step 5.1 — Trigger AI Analysis

```
Coordinator → /dashboard/coordinator/question-banks → selects bank → "Run AI Analysis"
  API: POST /api/question-banks/[id]/reports

  Server:
    1. Validates bank has minimum approved question threshold
    2. Enqueues "ai-analysis" job in BullMQ queue (stored in Redis)
    3. Returns 202 Accepted with job ID
  Audit: "AI_ANALYSIS_TRIGGERED" event logged
```

### Step 5.2 — Background Worker Processes Analysis

```
BullMQ Worker (workers/) picks up job:

  Deterministic report generation:
  ┌─────────────────────────────────────────────────────┐
  │ 1. Module Coverage Analysis                         │
  │    - Count approved questions per module            │
  │    - Calculate coverage % vs. expected distribution │
  │                                                     │
  │ 2. CO Coverage Analysis                             │
  │    - Map questions to Course Outcomes               │
  │    - Identify uncovered COs                         │
  │                                                     │
  │ 3. RBT Distribution Analysis                        │
  │    - Count questions per Bloom's level (L1–L6)      │
  │    - Flag imbalances (too many L1/L2, too few L4+)  │
  │                                                     │
  │ 4. Difficulty Distribution Analysis                 │
  │    - Count Easy / Medium / Hard per mark type       │
  │    - Flag skewed difficulty profiles                │
  │                                                     │
  │ 5. Duplicate Detection                              │
  │    - Compare question text similarity within bank   │
  │    - Compare against historical question database   │
  │    - Flag potential duplicates                      │
  │                                                     │
  │ 6. Missing Areas Detection                          │
  │    - Cross-reference module syllabus coverage       │
  │    - List topics with no approved questions         │
  │                                                     │
  │ 7. Quality Findings                                 │
  │    - Revision rate per slot (revisions needed = ↓)  │
  │    - Rejection rate per module                      │
  │    - Flag slots with low-quality indicators         │
  │                                                     │
  │ 8. Bloom's Balance Score                            │
  │    - Compute higher-order thinking (L4–L6) ratio    │
  │    - Benchmark against institutional targets        │
  └─────────────────────────────────────────────────────┘

  Ollama AI Overlay:
    - Structured report JSON is sent to Ollama (OLLAMA_BASE_URL)
    - Ollama generates a natural language summary paragraph
    - Summary is appended to the report

  Storage:
    - Full report saved as JSON to MinIO "signed-reports" bucket
    - PDF version of report generated via pdf-lib and saved to MinIO
    - Report record created in MySQL with MinIO object keys

  Notification: Coordinator notified "AI analysis report ready"
  Audit: "AI_ANALYSIS_COMPLETED" event logged
```

### Step 5.3 — View AI Report

```
Coordinator (or COE) → /dashboard/coordinator/question-banks → "View Report"
  API: GET /api/question-banks/[id]/reports

  Server generates short-lived presigned URLs for:
    - JSON report (MinIO "signed-reports")
    - PDF report (MinIO "signed-reports")

  UI renders:
    - Module coverage chart
    - CO coverage table
    - RBT distribution bar chart
    - Difficulty distribution pie chart
    - Duplicate detection results list
    - Missing areas list
    - Quality findings table
    - Bloom's balance score gauge
    - Ollama summary paragraph
```

---

## Phase 6: Paper Generation (Coordinator + Background Worker)

### Step 6.1 — Trigger Paper Generation

```
Coordinator → question bank → "Generate Papers"
  API: POST /api/question-banks/[id]/papers

  Pre-conditions checked:
    - Minimum approved question count met
    - AI analysis report exists for this bank (optional but recommended)
    - Bank status = OPEN (not yet locked)

  Server enqueues "paper-generation" job in BullMQ
  Returns 202 Accepted with job ID
  Audit: "PAPER_GENERATION_TRIGGERED" event logged
```

### Step 6.2 — Paper Generation Algorithm (Background Worker)

```
Worker executes generation algorithm for PAPER_A, PAPER_B, PAPER_C simultaneously:

  For each paper:
  ┌─────────────────────────────────────────────────────┐
  │ 1. Fetch all APPROVED questions for the bank        │
  │                                                     │
  │ 2. Apply usage priority sort:                       │
  │    - Questions with usageCount = 0 prioritized      │
  │    - Questions used in recent exams deprioritized   │
  │    - Questions from same year/semester excluded     │
  │                                                     │
  │ 3. Apply module balance constraint:                 │
  │    - Each paper must represent all 6 modules        │
  │    - Question count per module within allowed range │
  │                                                     │
  │ 4. Apply mark type balance:                         │
  │    - Required number of 2, 5, and 10 mark questions │
  │    - Matches the exam format specification          │
  │                                                     │
  │ 5. Apply historical exclusion:                      │
  │    - Questions used in last 1–2 exam cycles         │
  │    - are excluded or given lowest priority          │
  │                                                     │
  │ 6. Apply cross-paper uniqueness:                    │
  │    - A question selected for PAPER_A cannot         │
  │    - appear in PAPER_B or PAPER_C                   │
  │                                                     │
  │ 7. Apply no-duplicate check:                        │
  │    - No two questions in the same paper may be      │
  │    - semantically similar (from duplicate analysis) │
  │                                                     │
  │ 8. Check inventory warnings:                        │
  │    - If approved question pool is insufficient for  │
  │    - cross-paper uniqueness, flag warning           │
  │                                                     │
  │ 9. Compute per-paper scores:                        │
  │    - coverage score                                 │
  │    - difficulty score                               │
  │    - quality score                                  │
  │    - duplicate risk                                 │
  │    - recommendation text                            │
  └─────────────────────────────────────────────────────┘

  Update question usage tracking:
    - Increment usageCount for selected questions
    - Record lastUsedExam, lastUsedYear, lastUsedSemester, lastUsedType

  Storage:
    - Each paper saved as JSON to MinIO "generated-papers" bucket
    - Paper records created in MySQL

  Notification: Coordinator notified "Papers A, B, C generated"
  Audit: "PAPERS_GENERATED" event logged
```

### Step 6.3 — View Generated Papers

```
Coordinator (or COE) → /dashboard/coordinator/question-banks → "View Papers"
  API: GET /api/question-banks/[id]/papers

  UI shows:
    - Three paper tabs (PAPER_A, PAPER_B, PAPER_C)
    - Per paper: scores dashboard + full question list
    - Inventory warnings (if any insufficient slots)

  After review, Coordinator sends bank to Dean review:
    - Status transition: bank flagged for dean review
    - Dean receives notification
```

---

## Phase 7: Dean Review (Dean)

### Step 7.1 — Dean Opens Review

```
Dean → /dashboard/dean/review
  Sees list of banks pending review
  Selects a bank → API: GET /api/question-banks/[id]/dean-review

  Server returns:
    - PAPER_A, PAPER_B, PAPER_C with all questions and scores
    - Per-paper AI scores: coverage, difficulty, quality, duplicate risk, recommendation
```

### Step 7.2 — Dean Reviews Papers

```
Dean reads each paper's:
  - Score metrics
  - Full question list (module, mark type, CO, RBT, difficulty, text)
  - Ollama recommendation text

Dean decides which paper best serves each purpose.
```

### Step 7.3 — Dean Submits Selection

```
Dean selects:
  - Regular Exam Paper  → PAPER_[A|B|C]
  - Supplementary Paper → PAPER_[A|B|C]
  - KT Paper            → PAPER_[A|B|C]

  Constraint: each paper used for exactly one slot

API: POST /api/question-banks/[id]/dean-review
  Body: { regularPaper: "A", supplementaryPaper: "B", ktPaper: "C" }

Server:
  - Validates selections are distinct and valid
  - Saves DeanReview record in MySQL
  - COE receives notification: "Dean review complete for [Subject]"

Audit: "DEAN_REVIEW_COMPLETED" event logged
```

---

## Phase 8: Production & Export (COE)

### Step 8.1 — COE Reviews Selections

```
COE → /dashboard/coe/production
  Views dean selections per bank
  Reads AI scores and dean-selected papers
  Reviews AI analysis report
```

### Step 8.2 — Export PDF

```
COE → "Export PDF"
  Pre-condition: dean review completed for this bank
  API: POST /api/exports  (body: { bankId, format: "pdf" })

  Server:
    1. Validates COE auth and dean review status
    2. Enqueues "export" job in BullMQ

  Worker:
    1. Fetches selected paper questions from MySQL
    2. Generates PDF using pdf-lib:
       - Institution header and exam metadata
       - Questions grouped by module and mark type
       - Page numbering, watermarks if configured
    3. Uploads PDF to MinIO "exports" bucket
    4. Creates Export record in MySQL

  COE polls or receives notification: "Export ready"
  API: GET /api/exports/[id]/download
    → Server generates presigned GET URL (TTL = SIGNED_URL_EXPIRY_SECONDS)
    → COE downloads PDF

  Audit: "EXPORT_PDF_CREATED" and "EXPORT_DOWNLOADED" logged
```

### Step 8.3 — Export DOCX

```
COE → "Export DOCX"
  Same flow as PDF but:
  - Worker uses `docx` library to generate .docx
  - Stores in MinIO "exports" bucket
  - Presigned download URL served to COE

  Audit: "EXPORT_DOCX_CREATED" logged
```

### Step 8.4 — Export ZIP Bundle

```
COE → "Export ZIP"
  Worker assembles:
    - PAPER_A.pdf
    - PAPER_B.pdf
    - PAPER_C.pdf
    - ai-analysis-report.pdf
    - dean-review-summary.pdf (or JSON)
    - question-metadata.json
  Packages into .zip using jszip
  Uploads to MinIO "exports" bucket
  Presigned download URL served

  Audit: "EXPORT_ZIP_CREATED" logged
```

### Step 8.5 — Print Flow

```
COE → "Print"
  Identical to PDF export but uses print-optimized layout
  Browser download triggers print dialog
```

---

## Phase 9: Exam Cycle Closure (COE)

### Step 9.1 — Close Exam Cycle

```
COE → /dashboard/coe/exam-cycles → "Close Cycle"
  Transition: ExamCycle.status ACTIVE → CLOSED

  Side effects:
    - All associated QuestionBanks → status LOCKED
    - LOCKED banks: no further contributions, moderations, or re-generation
    - Moderation override blocked on LOCKED banks
    - All remaining PENDING questions are auto-rejected with system note

  Audit: "EXAM_CYCLE_CLOSED" event logged
  Coordinator and Contributors receive notifications
```

---

## Phase 10: Operational Background Tasks

These run automatically via BullMQ workers on schedule.

### Nightly Backup

```
Scheduled trigger (cron) → enqueues "backup" job in BullMQ

Worker:
  1. Runs mysqldump (requires mysqldump in runtime PATH)
  2. Compresses backup archive
  3. Uploads to MinIO "system-backups" bucket with timestamp
  4. Prunes backups older than BACKUP_RETENTION_DAYS
  5. Logs result

  COE monitoring dashboard shows last backup timestamp and size
  Audit: "BACKUP_COMPLETED" logged
```

### Retention Cleanup

```
Scheduled trigger → enqueues "retention-cleanup" job

Worker:
  1. Identifies exports older than EXPORT_RETENTION_DAYS
  2. Deletes expired objects from MinIO "exports" bucket
  3. Marks Export records as expired in MySQL
  4. Logs objects purged count

  Audit: "RETENTION_CLEANUP_COMPLETED" logged
```

---

## Complete End-to-End Lifecycle Summary

```
[COE]          Setup: Departments → Users → Exam Cycles
                       ↓
[COE+COORD]    Structure: Subjects → Link to Cycle → Initialize Banks (126 slots)
                       ↓
[COORDINATOR]  Assign: Contributors → Modules
                       ↓
[CONTRIBUTOR]  Contribute: Draft → Submit → Revise (if needed)
                       ↓
[MODERATOR]    Moderate: Approve / Reject / Request Revision
                       ↓
[COORDINATOR]  Analyze: Trigger AI Analysis → Review Report
                       ↓
[COORDINATOR]  Generate: Trigger Paper Generation → Review Papers A/B/C
                       ↓
[DEAN]         Review: Compare Papers → Select Regular/Supplementary/KT
                       ↓
[COE]          Produce: View Selections → Export PDF/DOCX/ZIP → Print
                       ↓
[COE]          Close: Lock Exam Cycle → Archive
```

---

## Data Flow: Files and Storage

```
MinIO Buckets:

question-bank-attachments
  ← Contributor uploads (diagrams, images)
  → Moderator/Coordinator downloads (presigned GET)

signed-reports
  ← AI analysis JSON + PDF (worker uploads)
  → Coordinator/COE downloads (presigned GET)

generated-papers
  ← Paper generation JSON + PDFs (worker uploads)
  → Coordinator/COE/Dean reads (presigned GET)

exports
  ← Export worker uploads (PDF, DOCX, ZIP)
  → COE downloads (presigned GET, short-lived)

audit-files
  ← Audit log exports (COE-triggered)
  → COE downloads

system-backups
  ← Nightly backup worker uploads (mysqldump archives)
  → COE views via monitoring dashboard
```

---

## Queue Architecture

```
Redis (BullMQ backend)

Queues:
  ai-analysis        → triggered by Coordinator via API
  paper-generation   → triggered by Coordinator via API
  export             → triggered by COE via API
  backup             → triggered by cron schedule
  retention-cleanup  → triggered by cron schedule

Workers (workers/ directory):
  - Pick up jobs from Redis
  - Execute processing logic
  - Update MySQL on completion
  - Upload artifacts to MinIO
  - Send notifications
  - Write audit events
```

---

## Security Architecture Summary

```
Authentication:
  - Auth.js credentials provider
  - JWT access token (short TTL: ACCESS_TOKEN_TTL_MINUTES)
  - Refresh token (long TTL: REFRESH_TOKEN_TTL_DAYS)
  - HttpOnly cookies (not accessible to JavaScript)
  - Session idle timeout (SESSION_IDLE_TIMEOUT_MINUTES)

Authorization:
  - Role-based access at reverse proxy and route handler level
  - Object-level authorization (users can only access their own data)

Request Protection:
  - CSRF tokens required for all mutating requests
  - Rate limiting (RATE_LIMIT_WINDOW_SECONDS / RATE_LIMIT_MAX_REQUESTS)
  - Secure HTTP headers

Storage Security:
  - No public MinIO bucket access
  - All file access via server-generated presigned URLs
  - Short-lived URLs (SIGNED_URL_EXPIRY_SECONDS)

Data Integrity:
  - Append-only audit trail with hash chain
  - Immutable locked banks
  - No hard deletes (soft deactivation model)
```

---

## Notification Flow

```
Platform events trigger in-app notifications:

Contributor ← question approved/rejected/revision requested
Contributor ← assignment added/removed
Coordinator ← question submitted in their bank
Coordinator ← AI analysis ready
Coordinator ← papers generated
Coordinator ← dean review complete
Moderator   ← new question pending / revision submitted
Dean        ← bank ready for review
COE         ← dean review complete / export ready / backup completed

All notifications delivered via:
  - In-platform notification inbox (real-time via polling or WebSocket)
  - Email abstraction layer (email provider configurable)
```