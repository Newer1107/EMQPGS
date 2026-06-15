# Exam Cycle Lifecycle — Complete Walkthrough

> **What is an Exam Cycle?**
> An exam cycle represents a single examination event — e.g. "ENDSEM Nov 2026 for CSE Semester 5". It is the top-level container that ties together subjects, question banks, assignments, question contributions, moderation, AI analysis, paper generation, dean review, and exports.

---

## 1. The Core Data Model

```
ExamCycle
  ├── academicYear + semester + examType ── UNIQUE (only one cycle per combo)
  ├── status: DRAFT → ACTIVE → CLOSED
  ├── departmentId ── scoped to a department (nullable)
  ├── startDate / endDate
  ├── timetable fields (documentRef, issueDate, title, rows, signature)
  │
  ├── SubjectExamCycleLink[] ── join table linking subjects to this cycle
  │     └── Subject
  │           └── belongs to a Department
  │
  └── QuestionBank[] ── one per linked subject (unique constraint)
        ├── 126 question slots (6 modules × 3 marks × 7 slots)
        ├── questions assigned to slots
        ├── contributor assignments (per module)
        ├── moderator assignment
        ├── AI report
        ├── generated papers (A, B, C)
        ├── dean review
        └── export artifacts
```

### Enums

| Enum | Values |
|---|---|
| `ExamCycleStatus` | `DRAFT` → `ACTIVE` → `CLOSED` |
| `ExamType` | `ISE_1`, `ISE_2`, `ENDSEM`, `SUPPLEMENTARY`, `KT` |
| `QuestionBankStatus` | 10 states (see §7 below) |
| `QuestionStatus` | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `REVISION_SUBMITTED` |

---

## 2. Phase 1: COE Creates the Exam Cycle (DRAFT)

**Who:** COE only (`Role.COE`)
**Where:** `/dashboard/coe/exam-cycles`
**API:** `POST /api/exam-cycles`

### What the COE fills in:

| Field | Rules |
|---|---|
| `academicYear` | Must match `YYYY-YYYY` (e.g. `"2026-2027"`) |
| `semester` | 1–8 |
| `examType` | One of: ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT |
| `departmentId` | Optional — can leave blank (no department scope) or pick a department |
| `status` | DRAFT (default), ACTIVE, or CLOSED |
| `timetable*` | Document ref, issue date, title, rows (date+time+paper table), signature |

### What happens in the backend (`ExamCycleService.create`):

```
IF status == ACTIVE:
  → Run serializable transaction
  → Check that no OTHER ACTIVE cycle exists for the same department
  → If conflict, throw 409: "Another active exam cycle already exists"
  → Otherwise create or update the cycle
ELSE:
  → Create with unique constraint check
  → Constraint: (academicYear, semester, examType) must be unique
```

> **Key rule:** Only **one** ACTIVE exam cycle per department at a time. Many DRAFT cycles can exist, though.

### 🖼️ What the COE sees:

A form with all the above fields pre-filled with sensible defaults (current year `"2026-2027"`, semester I, ENDSEM, etc.) plus a dynamic timetable table where rows can be added/deleted. Previously saved cycles appear in a list below, each with an "Edit Stored Cycle" button.

### Audit event logged: `EXAM_CYCLE_CREATED`

---

## 3. Phase 2: COE Activates the Cycle (DRAFT → ACTIVE)

The COE either:
- Creates the cycle directly with `status: "ACTIVE"`, or
- Edits an existing DRAFT cycle and changes status to ACTIVE via `PATCH /api/exam-cycles/[id]`

### The activation guard in `activateInTransaction`:

```
1. Open Prisma transaction (Serializable isolation)
2. Query: find any EXAM_CYCLE with status=ACTIVE and same departmentId
3. If found → ERROR 409 "Another active exam cycle already exists for this department"
4. If not found → proceed with create/update
```

> Once ACTIVE, the cycle is "live" — coordinators can link subjects to it, initialize question banks, and start the full question workflow.

---

## 4. Phase 3: Coordinator Links Subjects to the Cycle

**Who:** COORDINATOR only (`Role.COORDINATOR`)
**Where:** `/dashboard/coordinator/subjects`
**API:** `POST /api/subjects/[subjectId]/link-cycle` with body `{ examCycleId: "..." }`

### What "linking a subject" actually means:

Linking creates a row in the `SubjectExamCycleLink` join table. It does **not** create a question bank. It simply says: *"This subject participates in this exam cycle."*

### The rules enforced by `CoordinatorService.linkSubjectToExamCycle`:

```
1. Subject must exist ✓
2. Exam cycle must exist ✓
3. Coordinator must have department access to the subject ✓
4. Exam cycle's departmentId must match subject's departmentId ✓
   → ERROR 400 if they differ: "Exam cycle must belong to the same department as the subject."
5. Exam cycle must be ACTIVE ✓
   → ERROR 400 if not: "Only active exam cycles can be linked."
6. Idempotent — uses upsert, so linking the same pair again is a no-op ✓
```

### 💡 Why this matters:

Before you can create a question bank for a subject+cycle pair, the subject **must** be linked. The `initializeQuestionBank` method checks:

```
if (!subject.examCycleLinks.some(link => link.examCycleId === examCycleId))
  → ERROR 400: "Subject must be linked to the exam cycle before initializing a bank."
```

### 🖥️ Coordinator's Subjects page shows:

```
| Department | Code  | Name               | Sem | Credits | Status | Linked Exam Cycles                   |
|------------|-------|--------------------|-----|---------|--------|--------------------------------------|
| CSE        | CS501 | Advanced Algorithms| 5   | 4       | ACTIVE | 2026-2027 / Sem 5 / ENDSEM           |
```

### Audit event logged: `SUBJECT_LINKED_TO_EXAM_CYCLE`

---

## 5. Phase 4: Coordinator Initializes Question Banks

**Who:** COORDINATOR
**Where:** `/dashboard/coordinator/question-banks`
**API:** `POST /api/question-banks` with body `{ subjectId, examCycleId }`

### What happens in `initializeQuestionBank`:

```
1. Subject must exist and be ACTIVE ✓
2. Coordinator has department access ✓
3. Subject must have a SubjectExamCycleLink to this exam cycle ✓
4. Create QuestionBank with status = IN_PROGRESS (skips DRAFT)
5. Call ensureSlotGrid(bankId) → creates 126 slots
```

### The 126-slot grid (`buildQuestionSlotTemplate`):

```
6 modules (1–6)
× 3 mark categories (2, 5, 10)
× 7 slots per (module, marks) combination
= 126 slots total
```

First slot: `{ moduleNumber: 1, marks: 2, slotNumber: 1 }`
Last slot: `{ moduleNumber: 6, marks: 10, slotNumber: 7 }`

Each slot can hold exactly one question. This is the **canvas** on which contributors paint questions.

### Note about status:

The question bank is created at `IN_PROGRESS`, **not** `DRAFT`. The `DRAFT` state exists in the enum but is skipped by the coordinator flow (a bank goes directly to IN_PROGRESS upon initialization).

### Unique constraint:

```
@@unique([subjectId, examCycleId]) → One bank per subject per cycle
```

> A question bank IS the container for all work: questions, assignments, AI reports, generated papers, dean reviews, and exports. Each subject+cycle gets exactly one.

### Audit event logged: `QUESTION_BANK_CREATED`

---

## 6. Phase 5: Assignments (Contributors + Moderators)

**Who:** COORDINATOR
**Where:** `/dashboard/coordinator/assignments`
**APIs:**
- `POST /api/question-banks/[id]/assignments` — assign contributor to a module
- `POST /api/question-banks/[id]/assignments/moderator` — assign moderator to a bank

### Contributor assignments:

Each contributor is assigned to a **specific module** within a question bank. The unique constraint is:
```
@@unique([questionBankId, teacherId, assignmentRole, moduleNumber])
```
→ One assignment per module per contributor per bank.

### Moderator assignments:

The moderator is assigned to the **entire bank** (no moduleNumber). Validates:
- User has `MODERATOR` role
- No duplicate assignment exists
- Sends `ACTION_REQUIRED` notification

### Notifications:

All assignment changes trigger in-app notifications via `NotificationService`.

---

## 7. Phase 6: The Full Question Bank Status Lifecycle (10 states)

This is the heart of the system. The question bank progresses through these states:

```
DRAFT ───────────→ IN_PROGRESS ──────────→ UNDER_MODERATION ──→ MODERATED
  │                    │                        │                    │
  └──→ LOCKED         └──→ LOCKED              └──→ LOCKED          └──→ LOCKED
                                                                          │
                                                                          ▼
                                                                    REPORT_GENERATED
                                                                          │
                                                              ┌───────────┴───────────┐
                                                              │                       │
                                                              ▼                       ▼
                                                      AWAITING_HOD_SIGN          LOCKED
                                                              │
                                                              ▼
                                                      SIGNED_REPORT_UPLOADED
                                                              │
                                                              ▼
                                                  AWAITING_COORDINATOR_APPROVAL
                                                      │           │
                                                      ▼           ▼
                                                  APPROVED    AWAITING_HOD_SIGN (loopback)
                                                      │
                                                      ▼
                                                    LOCKED (terminal)
```

### What happens at each state:

| Status | What it means | Who advances it |
|---|---|---|
| `DRAFT` | Initial (unused in practice — coordinator skips this) | — |
| `IN_PROGRESS` | Bank created, slots ready, contributors adding questions | Coordinator |
| `UNDER_MODERATION` | Questions being moderated | Coordinator |
| `MODERATED` | All moderation complete | Moderator → Coordinator |
| `REPORT_GENERATED` | AI/deterministic analysis done | Coordinator triggers report |
| `AWAITING_HOD_SIGN` | Waiting for HOD's digital signature on report | Auto-advance from report |
| `SIGNED_REPORT_UPLOADED` | HOD signed report PDF uploaded by moderator | Moderator |
| `AWAITING_COORDINATOR_APPROVAL` | Coordinator reviews the signed report | Auto-advance from upload |
| `APPROVED` | Coordinator approved (but not yet locked) | Coordinator |
| `LOCKED` | **Terminal** — bank is frozen, no edits possible | Coordinator locks explicitly |

### Transition rules (from `src/modules/question-banks/transitions.ts`):

```
DRAFT                 → IN_PROGRESS, LOCKED
IN_PROGRESS           → UNDER_MODERATION, LOCKED
UNDER_MODERATION      → MODERATED, LOCKED
MODERATED             → REPORT_GENERATED, LOCKED
REPORT_GENERATED      → AWAITING_HOD_SIGN, LOCKED
AWAITING_HOD_SIGN     → SIGNED_REPORT_UPLOADED, LOCKED
SIGNED_REPORT_UPLOADED→ AWAITING_COORDINATOR_APPROVAL, LOCKED
AWAITING_COORDINATOR_APPROVAL → APPROVED, LOCKED, AWAITING_HOD_SIGN
APPROVED              → LOCKED
LOCKED                → (none — terminal)
```

Note the **loopback edge**: `AWAITING_COORDINATOR_APPROVAL → AWAITING_HOD_SIGN` — if the coordinator rejects, the bank goes back for HOD re-sign.

### Locking prerequisites (`lockQuestionBank`):

```
1. Bank is not already LOCKED ✓
2. Exam cycle is ACTIVE ✓
3. Exam cycle has an endDate set ✓
4. Uses optimistic locking (version field) ✓
```

---

## 8. Phase 7: Contribution & Moderation Detail

### Contributor workflow:

```
1. See assigned question bank + module
2. Reserve a specific slot (prevents double-booking)
3. Write question text, set fields:
   - moduleNumber (1–6)
   - marks (2, 5, or 10)
   - rbtLevel (L1–L6)
   - courseOutcome (CO1–CO6)
   - difficultyLevel (EASY, MEDIUM, HARD)
   - teachingIndex
4. Upload attachments (images, diagrams) via signed MinIO URLs
5. Save as DRAFT or SUBMIT
```

### Moderation workflow:

```
1. Moderator sees all submitted questions for assigned bank
2. For each question: APPROVE, REJECT (with reason), or REVISION_REQUESTED
3. If revision requested → contributor revises and resubmits
4. Moderator can also override previously approved questions (while bank is mutable)
```

### Question statuses: `DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED`

---

## 9. Phase 8: AI Analysis & Paper Generation

### AI Analysis (`POST /api/question-banks/[id]/reports`)

**Who:** COORDINATOR
**Prerequisite:** At least **60 approved questions** in the bank

What the report contains:
- **Module coverage** — how many approved questions per module
- **CO distribution** — mapping to Course Outcomes
- **RBT level distribution** — Bloom's taxonomy levels
- **Difficulty distribution** — EASY / MEDIUM / HARD balance
- **Duplicate detection** — flag similar questions
- **Quality findings** — gaps and recommendations
- **Ollama summary** (optional) — natural language overlay if Ollama is configured

Output: JSON + PDF stored in MinIO (`exports` bucket). Bank status → `REPORT_GENERATED`.

### Paper Generation (`POST /api/question-banks/[id]/papers`)

**Who:** COORDINATOR
**Prerequisite:** Bank status is `REPORT_GENERATED` or `LOCKED`

What happens:
```
1. Generate 3 variants: PAPER_A, PAPER_B, PAPER_C
2. Each paper selects exactly 18 questions (6 modules × 3 mark types)
3. Avoids:
   - Recently used questions (same year/semester/exam type)
   - Historically excluded questions
4. Ranks candidates by usageCount, recency, difficulty
5. Generates PDF via PdfService
6. Uploads to MinIO (generated-papers bucket)
7. Updates question usage tracking counters
```

---

## 10. Phase 9: HOD Sign, Coordinator Decision, Lock, Dean Review

### HOD Sign (Moderator uploads):

`POST /api/question-banks/[id]/signed-report`
→ Bank status: `SIGNED_REPORT_UPLOADED`

### Coordinator Decision:

`POST /api/question-banks/[id]/coordinator-decision`
- **APPROVED** → status: `APPROVED` (not locked yet!)
- **REJECTED** → status: `AWAITING_HOD_SIGN` (loopback)

### Coordinator Locks:

`PATCH /api/question-banks/[id]/lock`
→ Status: `LOCKED` (terminal)
→ `lockedAt` timestamp set
→ Version-incrementing optimistic lock

Once LOCKED, the bank is **immutable** — no edits, no new questions, no moderation.

### Dean Review:

`POST /api/question-banks/[id]/dean-review`

The dean sees all 3 generated paper variants with scores/recommendations and selects:
- Which variant → Regular exam slot
- Which variant → Supplementary exam slot
- Which variant → KT exam slot

All 3 selections must be **distinct** variants. Creates a `DeanReview` record.

---

## 11. Phase 10: COE Production & Export

**Who:** COE
**Where:** `/dashboard/coe/production`

The COE sees:
- All question banks with AI report status, generated papers, dean selections
- Export console to generate final exam packets

### Export (`POST /api/exports`):

```
1. Requires completed dean review
2. Builds selected papers per dean's choices
3. Generates PDF, DOCX, or ZIP bundle (with both PDF + DOCX + manifest.json)
4. Uploads to MinIO (exports bucket)
5. Creates ExportArtifact record with expiry
6. Provides signed download URL: GET /api/exports/[id]/download
```

---

## 12. Phase 11: Cycle Closure (ACTIVE → CLOSED)

**Who:** COE
**API:** `PATCH /api/exam-cycles/[id]` with `{ status: "CLOSED" }`

The COE transitions the cycle to CLOSED. This is a plain update — there is **no formal validation** requiring all question banks to be locked first. However, the intended business process is that all banks are locked before closure.

### What CLOSED means:

- No new subject links can be added (linking requires ACTIVE)
- Locked banks remain immutable
- The cycle is archived/historical

### Note:

Unlike QuestionBankStatus, ExamCycleStatus does **not** have a formal transition table. The service only validates:
- `→ ACTIVE` — guard against duplicate active cycles per department
- All other transitions (including `DRAFT→CLOSED` or `ACTIVE→CLOSED`) go through without additional validation

---

## 13. Exam Cycle & Question Bank Readiness Dashboard

### Coordinator Dashboard (`/dashboard/coordinator`):

Shows **readiness** for each question bank:
```
IF approved questions >= 60:
  IF generated papers exist:         "Ready for Dean Review"
  ELSE IF AI report completed:       "Ready for Generation"
  ELSE:                              "Ready for AI Analysis"
ELSE:
  "Insufficient approved questions"
```

Also shows:
- Per-subject bank fill status (filled / total slots, approved, pending, rejected counts)
- Pending teacher assignments (modules without a contributor)
- Active exam cycles per department

### COE Dashboard (`/dashboard/coe`):

- Stats: active cycles count, total banks, assignments
- Production console: all banks with their full status pipeline

---

## 14. Complete End-to-End Timeline (Visual Summary)

```
COE                          Coordinator              Contributor    Moderator    Dean        COE
│                            │                        │              │            │           │
├─ Create Exam Cycle (DRAFT)─┤                        │              │            │           │
├─ Activate (→ ACTIVE)───────┤                        │              │            │           │
│                            ├─ Create Subjects        │              │            │           │
│                            ├─ Link Subjects to Cycle│              │            │           │
│                            ├─ Initialize Q. Banks   │              │            │           │
│                            ├─ Assign Contributors───┤              │            │           │
│                            ├─ Assign Moderator──────┤──────────────┤            │           │
│                            │                        ├─ Reserve Slot│            │           │
│                            │                        ├─ Write Qn    │            │           │
│                            │                        ├─ Submit Qn───┤            │           │
│                            │                        │              ├─ Approve   │           │
│                            ├─ Advance Status→UM/MOD─┤              │            │           │
│                            ├─ Trigger AI Report─────┤              │            │           │
│                            ├─ Generate Papers───────┤              │            │           │
│                            │                        │              ├─ Upload    │           │
│                            │                        │              │  HOD Sign  │           │
│                            ├─ Coordinator Decision──┤              │            │           │
│                            ├─ Lock Bank             │              │            │           │
│                            │                        │              │            ├─ Review   │
│                            │                        │              │            ├─ Select   │
│                            │                        │              │            │  Variants  │
│                            │                        │              │            │           ├─ Export
│                            │                        │              │            │           ├─ Close Cycle
▼                            ▼                        ▼              ▼            ▼           ▼
```

---

## 15. Roles and Permissions Summary

| Action | COE | Coordinator | Moderator | Contributor | Dean |
|---|---|---|---|---|---|
| Create/Update Exam Cycle | ✅ | ❌ | ❌ | ❌ | ❌ |
| Link Subject to Cycle | ❌ | ✅ | ❌ | ❌ | ❌ |
| Initialize Question Bank | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assign Contributors | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assign Moderators | ❌ | ✅ | ❌ | ❌ | ❌ |
| Advance Bank Status | ❌ | ✅ | ✅ (limited) | ❌ | ❌ |
| Reserve Slot & Write Questions | ❌ | ✅ (own) | ❌ | ✅ (assigned) | ❌ |
| Moderate Questions | ❌ | ✅ (override) | ✅ | ❌ | ❌ |
| Trigger AI Report | ❌ | ✅ | ❌ | ❌ | ❌ |
| Generate Papers | ❌ | ✅ | ❌ | ❌ | ❌ |
| Upload Signed HOD Report | ❌ | ❌ | ✅ | ❌ | ❌ |
| Lock Question Bank | ❌ | ✅ | ❌ | ❌ | ❌ |
| Dean Review | ❌ | ❌ | ❌ | ❌ | ✅ |
| Export & Download | ✅ | ❌ | ❌ | ❌ | ❌ |
| Close Exam Cycle | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 16. Key Source Files Reference

| File | What it contains |
|---|---|
| `prisma/schema.prisma:193-218` | ExamCycle model definition |
| `prisma/schema.prisma:302-311` | SubjectExamCycleLink join table |
| `prisma/schema.prisma:241-272` | QuestionBank model (all relations) |
| `prisma/schema.prisma:36-53` | ExamCycleStatus & QuestionBankStatus enums |
| `src/modules/exam-cycles/service.ts` | ExamCycleService (create/update/activate) |
| `src/modules/exam-cycles/validation.ts` | Zod schema for exam cycle fields |
| `src/modules/exam-cycles/repository.ts` | DB queries for exam cycles |
| `app/api/exam-cycles/route.ts` | GET (list) + POST (create) endpoints |
| `app/api/exam-cycles/[id]/route.ts` | PATCH (update) endpoint |
| `app/api/subjects/[id]/link-cycle/route.ts` | POST link subject to cycle |
| `app/api/question-banks/route.ts` | POST initialize question bank |
| `app/api/question-banks/[id]/lock/route.ts` | PATCH lock bank |
| `app/api/question-banks/[id]/status/route.ts` | PATCH advance status |
| `src/modules/coordinator/service.ts:322-344` | linkSubjectToExamCycle logic |
| `src/modules/coordinator/service.ts:423-449` | initializeQuestionBank logic |
| `src/modules/coordinator/service.ts:490-518` | lockQuestionBank logic |
| `src/modules/question-banks/transitions.ts` | 10-state transition table |
| `src/modules/question-banks/service.ts` | QuestionBankService (create/updateStatus) |
| `src/modules/questions/slot-template.ts` | buildQuestionSlotTemplate (126 slots) |
| `src/modules/questions/service.ts` | QuestionService (ensureSlotGrid, CRUD) |
| `src/modules/reports/service.ts` | AI report + paper generation |
| `src/modules/reports/paper-generator.ts` | Paper selection algorithm |
| `src/modules/reports/analysis-engine.ts` | Deterministic analysis logic |
| `src/modules/production/service.ts` | Dean review + exports + backup |
| `src/components/dashboard/exam-cycle-timetable-manager.tsx` | COE exam cycle UI (545 lines) |
| `app/(protected)/dashboard/coordinator/page.tsx` | Coordinator dashboard |
| `app/(protected)/dashboard/coordinator/subjects/page.tsx` | Subjects management page |
| `app/(protected)/dashboard/coordinator/question-banks/page.tsx` | Question banks page |
| `prisma/seed.ts` | Seed data (shows the full setup flow) |

---

## 17. Common Questions / Confusions

### Q: What does "linking a subject to the cycle" mean?

It creates a row in the `SubjectExamCycleLink` table — a pure join record. It does **not** create a question bank. It just tells the system: *"Subject CS501 participates in the 2026-2027 ENDSEM cycle."* The question bank is created in a **separate step** (`initializeQuestionBank`), and that step requires the link to exist first.

### Q: Why do I need to link before creating a bank?

Because the system enforces: `@@unique([subjectId, examCycleId])` on QuestionBank — only one bank per subject+cycle. The link is a prerequisite check to ensure the coordinator has intentionally associated the subject with this cycle.

### Q: Can I have multiple ACTIVE exam cycles?

**No, not for the same department.** The `activateInTransaction` guard ensures at most one ACTIVE cycle per department. You CAN have ACTIVE cycles in different departments simultaneously.

### Q: What's the difference between APPROVED and LOCKED?

- **APPROVED**: The coordinator has reviewed and approved the signed report. The bank is ready to be locked.
- **LOCKED**: The terminal state. The coordinator explicitly locks the bank, which sets `lockedAt` timestamp and increments the version. No further changes are possible.

### Q: Can a question bank be modified after locking?

**No.** The `ensureQuestionBankMutable()` check throws an error for any mutation on LOCKED banks.

### Q: What happens if I don't set an endDate on the exam cycle?

The coordinator **cannot lock** any question bank in that cycle. The `lockQuestionBank` method requires `bank.examCycle.endDate` to be set. The COE must update the cycle to include an end date.

### Q: Can I close the cycle while banks are still in progress?

Technically yes — the code does not enforce all banks being locked before cycle closure. However, the intended business process is: lock all banks → close cycle. Once closed, subjects cannot be linked anymore, but locked banks remain locked (immutable).

### Q: How does the 126-slot grid work?

For every question bank, exactly 126 slots are created: 6 modules × 3 mark values (2, 5, 10) × 7 slots = 126. This ensures a predictable structure for paper generation, which needs exactly 18 questions per paper (6 modules × 3 marks, one question per slot).

---

> **Generated from codebase analysis.** For implementation details, refer to the source files listed in §16 above.
