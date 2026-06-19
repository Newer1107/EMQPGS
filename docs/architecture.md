# Architecture

> System architecture, domain model, core concepts, roles, and invariants.

---

## 1. System Purpose

EMQPGS (Examination Management & Question Paper Generation System) manages the complete lifecycle of academic examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL 8 · MinIO object storage · Auth.js v5 credentials + custom JWT · Ollama (optional)

---

## 2. Five User Roles

| Role | Key Responsibilities |
|---|---|
| **COE** | System admin: departments, users, academic years, exam cycles, exports, backups, audit logs |
| **COORDINATOR** | Academic management: subjects, question banks, slot assignments, moderator assignments, phase transitions, AI reports, paper generation, final approval |
| **CONTRIBUTOR** | Question creation: create/edit questions, assign to slots, submit for moderation, revise on feedback |
| **MODERATOR** | Quality assurance: review assigned questions, approve/reject/request revision |
| **DEAN** | Final review: review generated paper variants, select for regular/supplementary/KT exams |

### RBAC Matrix

| Capability | COE | Coordinator | Moderator | Contributor | Dean |
|---|---|---|---|---|---|
| Users, departments, exam cycles | Manage | — | — | — | — |
| Subjects, question banks | Read | Manage | Review | Own work | Read |
| Slot assignments | — | Manage | — | Own work | — |
| Moderator assignment | — | Manage | — | — | — |
| Contributor assignment | — | Manage | — | — | — |
| Question moderation | — | — | Review | — | — |
| AI reports, paper generation | — | Manage | — | — | — |
| Coordinator approval | — | Manage | — | — | — |
| Dean review | — | — | — | — | Manage |
| Exports, backups, audit | Manage | — | — | — | — |

---

## 3. Core Entity Model

### Primary entities

```
AcademicYear 1─N Semester 1─N ExamCycle
Department 1─N Subject 1─N SubjectVersion 1─N QuestionLibraryItem
Department 1─N ExamCycle
Subject 1─N QuestionBank
QuestionBank 1─N QuestionSlot N─1 QuestionLibraryItem
ExamCycle 1─N QuestionBank
```

### Key entity: QuestionSlot

`QuestionSlot` is the **sole** linkage between `QuestionBank` and `QuestionLibraryItem`. No join table exists. Each slot represents a position defined by `(moduleNumber, marks, slotNumber)` within a bank. A question can occupy at most one slot per bank but can be in multiple banks simultaneously. `reservedById` is deprecated at runtime (schema column kept, no code reads/writes it).

### ContributorBankAssignment

`ContributorBankAssignment` mirrors `ModeratorBankAssignment`. It provides an explicit contributor-to-bank assignment, used by `getContributorAssignedBanks()` alongside the existing slots-based inference. POST/DELETE/GET API at `/api/question-banks/{id}/assignments/contributor`. Coordinator UI for managing assignments.

### Academic domain (June 2026)

Added for curriculum and batch management, independent of the existing QuestionBank pipeline:

- **AcademicUnit** — curriculum ownership body (ES&H, COMP, IT). Distinct from Department (faculty HR).
- **Programme** — degree definition (BE, BTECH, etc.). Belongs to an AcademicUnit.
- **CurriculumScheme** — named curriculum plan per programme (e.g. "2025 Scheme").
- **CurriculumSubject** — authoritative mapping: Subject → (Semester, Scheme, AcademicUnit, Group).
- **Batch** — cohort descriptor (no student table). Links to Programme + CurriculumScheme.
- **BatchSemester** — per-batch semester with independent dates, status (UPCOMING/ACTIVE/COMPLETED).
- **TeachingGroup** — records groups (1 or 2) per batch.

The bridge between the two domains is `CurriculumSubject.subjectId` → `Subject.id`.

---

## 4. Question Bank State Model

Two orthogonal state axes:

| Axis | States | Purpose |
|---|---|---|
| **Phase** (workflow) | DRAFTING → MODERATION → APPROVAL → COMPLETE | Workflow progression |
| **RecordStatus** (mutability) | ACTIVE, LOCKED | Operational mutability |

A bank can be in APPROVAL phase and LOCKED simultaneously. Phase advancement is **manual** (coordinator action). The ReadinessEngine reports readiness but does not auto-advance.

### Phase transitions

| Current | Allowed Next |
|---|---|
| DRAFTING | MODERATION |
| MODERATION | APPROVAL |
| APPROVAL | COMPLETE, MODERATION (rejection loopback) |
| COMPLETE | (none) |

See `docs/workflow.md` for detailed walkthrough.

---

## 5. Key Architecture Decisions

| Decision | Implementation |
|---|---|
| **QuestionSlot linkage** | No `QuestionBankQuestion` table. Slots are first-class positional entities with `@@unique([questionBankId, moduleNumber, marks, slotNumber])`. |
| **Two-axis bank state** | 4-phase + 2-record-status model. `QuestionBankPhase` is orthogonal to `RecordStatus`. |
| **ReadinessEngine is advisory** | Reports readiness with issues/warnings. Does not auto-advance. Coordinators always advance manually. |
| **ApprovalDecision is write-once** | Created in same transaction as phase update. No update or delete path. |
| **Snapshots** | `QuestionBankSnapshot` on lock (immutable). `PaperSnapshot` on paper generation (upsert per variant). |
| **RBAC is two-layer** | `proxy.ts` middleware gates route access by role. `withApiHandler` gates operations. Object-level checks in services. |
| **Append-only audit** | SHA-256 hash chain linking each `AuditLog` record to the previous record's integrity hash. |

---

## 6. Request Flow

```
Browser → proxy.ts middleware (route-level role gate)
        → route.ts handler
        → withApiHandler (CSRF, rate limit, auth, role gate, audit)
        → Service (business logic)
        → Repository (Prisma queries)
        → MySQL / MinIO
```

---

## 7. Key Invariants

1. One bank per (subject, exam cycle) — `@@unique([subjectId, examCycleId])`
2. One slot position per bank — `@@unique([questionBankId, moduleNumber, marks, slotNumber])`
3. No duplicate questions per bank (application-enforced)
4. QuestionSlot is the sole linkage (no QuestionBankQuestion table)
5. LOCKED banks reject all mutations via `ensureQuestionBankMutable()`
6. Phase transitions validated via `isValidPhaseTransition()` in `transitions.ts`
7. ReadinessEngine is advisory only
8. Question marks: 2, 5, or 10. Module: 1-6. RBT: L1-L6. CO: CO1-CO6.
9. MinIO buckets: exactly 5 (`question-bank-attachments`, `generated-papers`, `exports`, `audit-files`, `system-backups`)
10. ExamCycle is department-scoped — `@@unique([semesterId, examType, departmentId])`
11. ApprovalDecision is write-once — no update or delete path
12. Question editing guard: DRAFT and REVISION_REQUESTED statuses are freely editable; PENDING, APPROVED, REJECTED, and REVISION_SUBMITTED block edits via `QuestionLibraryService.update()`
13. Coordinator override: a COORDINATOR editing an APPROVED question auto-reverts its status to REVISION_REQUESTED

---

## 8. Current Limitations

1. **Synchronous long operations** — AI analysis, paper generation, exports, backups run inside the HTTP request. Timeouts possible for large banks.
2. **In-memory rate limiter** — resets on restart; not multi-instance safe.
3. **No background workers** — `workers/` directory exists but is empty. No BullMQ, no Redis.
4. **No scheduled backups** — API/manual-trigger only.
5. **QuestionLibraryItem is SubjectVersion-scoped** — no cross-cycle shared question pool.
6. **Concurrency gaps** — some operations use last-writer-wins semantics.
7. **No dean review update/delete** — write-once selection, no undo path.

---

## 9. End-to-End Workflow Phases

Below is the full operational pipeline with term explanations and a concrete example.

### Phase-by-Phase Pipeline

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

### Term Explanations

| Term | What it is | Why it exists |
|------|-----------|---------------|
| **AcademicUnit** | Curriculum-offering body (e.g. "ES&H", "COMP", "IT"). This is **not** the same as a Department — a Department is an HR/faculty entity, while AcademicUnit owns what is taught. | Separates "who teaches it" (Department) from "what is taught" (AcademicUnit). One department can offer subjects from multiple academic units. |
| **Programme** | Degree definition (e.g. "BE Computer Science", "BTECH Information Technology"). | The degree a batch of students is pursuing. Every batch belongs to exactly one programme. |
| **CurriculumScheme** | A named curriculum plan for a programme (e.g. "2025 Scheme", "NEP 2026 Scheme"). | Programmes get revised over time. The scheme captures which version of the curriculum applies to which batch. |
| **CurriculumSubject** | The authoritative mapping that says "Subject X is taught in Semester Y of Scheme Z under AcademicUnit W." | A subject like "Mathematics" can appear in different semesters under different schemes. This entity disambiguates. |
| **AcademicYear** | A time period (e.g. "2026-2027") that spans all semesters. | The temporal container for exam cycles. Each academic year generates 8 semesters automatically. |
| **Batch** | A cohort descriptor (e.g. "2024-2028 BE Computer batch"). | A group of students that started together and progresses through semesters together. No student roster is stored — the batch is a label. |
| **BatchSemester** | A single semester within a batch (e.g. "Batch 2024-28, Semester 3"). Has its own dates and status. | The actual timebox for teaching. Activating a BatchSemester sets the Batch's `currentSemester` — this is how the system knows which semester a batch is in right now. |
| **ExamCycle** | A single examination event (e.g. "ENDSEM Nov 2026"). Department-scoped. | The reason the entire question bank pipeline exists. An exam cycle is the target event for which question banks are created and papers generated. |
| **QuestionBank** | The container for all questions, slots, and workflow state for one (Subject, ExamCycle) pair. | The central operational unit. Every action — contribution, moderation, approval, paper generation — happens within a question bank. |
| **QuestionSlot** | A single position in the question paper defined by `(moduleNumber, marks, slotNumber)`. | The linkage between a bank and its questions. There is no `QuestionBankQuestion` join table — slots are the only bridge. |
| **PaperPattern** | The template that defines how many slots exist per module and mark value. | Different exam types (ISE vs ENDSEM) have different slot counts. The pattern is set once at bank initialization. |
| **SubjectVersion** | A versioned syllabus of a Subject. Questions belong to a SubjectVersion, not directly to a Subject. | Syllabi change. SubjectVersion lets the system track which version of the syllabus a question was written for. |
| **QuestionLibraryItem** | A single reusable question. Can be in multiple banks simultaneously. | A well-written question shouldn't need to be re-created for every exam cycle. Library items can be shared across banks. |
| **GeneratedPaper** | One of three variants (A, B, or C) produced for a bank. | The final deliverable. Three variants allow the dean to select different papers for regular, supplementary, and KT exams. |
| **DeanReview** | A record of the dean's selection: which variant goes to which exam slot (Regular/Supp/KT). | The authorization record. Without a DeanReview, no paper is authorized for use. |
| **ExportArtifact** | The final ZIP/DOCX/PDF package stored in MinIO. | The distributable deliverable. COE downloads this for printing and distribution. |

### Concrete Example: "ENDSEM Nov 2026 — Computer Networks"

Here is the full walkthrough from nothing to exported exam papers, using a single concrete scenario.

**Characters:**
- **Dr. Sharma** — COE (system admin)
- **Prof. Patil** — Coordinator (dept: Computer Engineering)
- **Ms. Iyer** — Contributor (junior faculty)
- **Dr. Mehta** — Moderator (senior faculty)
- **Prof. Desai** — Dean (academic dean)

**Setup: The university wants to conduct ENDSEM exams in Nov 2026 for the 2024-28 BE Computer batch.**

#### Step 1: COE sets up the institutional structure

Dr. Sharma logs in as COE and creates:

1. **AcademicUnit "COMP"** — because the Computer Engineering programme needs a curriculum-owning body.
2. **Programme "BE Computer"** under AcademicUnit "COMP" — the degree definition.
3. **CurriculumScheme "2024 Scheme"** under Programme "BE Computer" — the curriculum plan for this batch.
4. **AcademicYear "2026-2027"** — this auto-generates 8 semesters (Sem 1 through Sem 8).
5. **Batch "2024-28 BE Computer"** linked to Programme "BE Computer" + Scheme "2024 Scheme".
6. **Activate BatchSemester for Sem 5** (Nov 2026 is the 5th semester for a 2024-entry batch) — this sets `Batch.currentSemester = 5`.
7. **ExamCycle "ENDSEM Nov 2026"** for Semester 5, Department "Computer Engineering" — the target examination event.
8. **CurriculumSubject:** links Subject "Computer Networks" to Semester 5 of Scheme "2024 Scheme" under AcademicUnit "COMP".
9. **Assigns Prof. Patil** as Coordinator for Department "Computer Engineering".

The exam cycle now exists. The coordinator can see it in their dashboard.

#### Step 2: Coordinator prepares the question bank

Prof. Patil logs in as Coordinator. In her dashboard, she sees "Computer Networks" is a subject without a question bank for "ENDSEM Nov 2026". She:

1. **Creates Subject "Computer Networks"** — this auto-creates `SubjectVersion v1`.
2. **Initializes QuestionBank** for (Computer Networks, ENDSEM Nov 2026):
   - Bank is created with phase `DRAFTING`, status `ACTIVE`.
   - `PaperPattern` is created for ENDSEM (6 modules × 21 slots = 126 total).
   - 126 `QuestionSlots` are instantiated: 42 two-mark slots, 42 five-mark slots, 42 ten-mark slots, spread across 6 modules.
3. **Assigns Contributors:** Adds Ms. Iyer and two other faculty as contributors to the bank.
4. **Assigns Moderator:** Adds Dr. Mehta as moderator for the bank.

Ms. Iyer now sees "Computer Networks — 126 slots need questions" on her dashboard.

#### Step 3: Contributors write questions

Ms. Iyer logs in as Contributor. Her dashboard shows: "Computer Networks (ENDSEM Nov 2026): 42 slots assigned to you." She:

1. **Clicks the bank.** She sees a grid of 126 slots color-coded: white = empty, green = filled, yellow = pending moderation.
2. **Filters by her assigned slots.** She sees 42 empty white cells.
3. **Clicks an empty slot** (Module 3, 10 marks, slot 5 of 7).
4. **Creates a question** — the form pre-fills module=3, marks=10, slot=5. She types the question text, RBT level (L3), CO (CO2), and uploads a diagram.
5. **Saves as DRAFT** → the question appears in the slot. The slot turns yellow (occupied but not submitted).
6. **Reviews and Submits** → status changes to `PENDING`. The slot turns blue (under moderation).

She repeats this over several days until all 42 of her slots are filled and submitted.

Other contributors do the same for their assigned 42 slots each.

#### Step 4: Coordinator advances bank to moderation

Prof. Patil checks the bank. The readiness panel shows "126/126 slots filled — ready for moderation." She clicks **Advance to MODERATION**. The bank phase changes from `DRAFTING` to `MODERATION`.

Dr. Mehta receives a notification: "Computer Networks: 126 questions awaiting moderation."

#### Step 5: Moderator reviews questions

Dr. Mehta logs in as Moderator. His queue shows 126 questions for Computer Networks. He:

1. **Reviews a question** — sees the question text, RBT level, CO mapping, and any attached diagram.
2. **Finds a well-written question** → clicks **Approve**. Status: `APPROVED`. The slot turns green. Auto-advances to the next question.
3. **Finds a vague question** → clicks **Request Revision** with a comment "Clarify the network topology diagram." Status: `REVISION_REQUESTED`. The slot turns orange.
4. **Finds a duplicate question** → clicks **Reject** with a comment "Question is identical to Slot 14." Status: `REJECTED`. The slot turns red.

Over the week, Dr. Mehta moderates all 126 questions. Ms. Iyer revises her 3 revision-requested questions and resubmits them. Dr. Mehta approves those too.

#### Step 6: Coordinator approves the bank

Prof. Patil sees the readiness panel: "126/126 slots moderated. Ready for APPROVAL." She advances the bank to `APPROVAL`.

She triggers the **AI analysis**: the system evaluates CO coverage, RBT level distribution, difficulty balance, and quality scoring. An `AiReport` is generated showing:
- CO coverage: CO1-CO6 all covered (80-100% each)
- RBT distribution: L1(5%), L2(20%), L3(40%), L4(25%), L5(8%), L6(2%) — good spread
- Quality score: 87/100
- Warning: "Module 2 has 60% L3 questions — consider adding an L4 or L5 question."

Prof. Patil reviews the report, decides the warning is acceptable, and clicks **Approve**. The bank phase changes to `COMPLETE`. An `ApprovalDecision` record is created.

#### Step 7: Paper generation and locking

Prof. Patil triggers **Generate Papers**:

1. The system selects one approved question per (module, marks) pair per variant.
2. Three variants (A, B, C) are generated, each with 18 questions (6 modules × 3 marks values × 1 question).
3. PDFs are created via `PdfService` and uploaded to MinIO `generated-papers` bucket.
4. `GeneratedPaper` records are created for variants A, B, C.
5. `PaperSnapshot` captures the final state with coverage, difficulty, and quality scores.

Prof. Patil reviews the generated papers, then **Locks the bank**:
- `recordStatus` → `LOCKED`
- `lockedAt` is set
- A `QuestionBankSnapshot` captures all slot assignments immutably
- No further mutations allowed — `ensureQuestionBankMutable()` will reject all writes

#### Step 8: Dean reviews and selects

Prof. Desai logs in as Dean. His dashboard shows "Computer Networks (ENDSEM Nov 2026) — ready for review." He opens the review workspace:

1. Sees three paper variants side-by-side with coverage, difficulty, and quality metrics.
2. Variant A: balanced difficulty (good for regular exam)
3. Variant B: slightly harder (good for supplementary exam)
4. Variant C: similar to A but different question selection (good for KT exam)
5. The AI recommends: "Variant A for Regular, Variant B for Supplementary, Variant C for KT."
6. Prof. Desai selects:
   - Regular → **Variant A**
   - Supplementary → **Variant B**
   - KT → **Variant C**
7. Clicks **Submit** — a `DeanReview` record is created with the selections.

#### Step 9: COE exports

Dr. Sharma logs in as COE. The exam cycle "ENDSEM Nov 2026" shows "Computer Networks — Ready for Export." He:

1. Clicks **Export** for Computer Networks.
2. The system packages the selected variant PDFs (A, B, C) into a single ZIP.
3. The ZIP is uploaded to MinIO `exports` bucket.
4. An `ExportArtifact` record is created with metadata (bank ID, dean review ID, file URL, generated at).

Dr. Sharma downloads the ZIP and sends it to the print shop.

**The full lifecycle from institutional setup to printed exam papers is complete.**

---

## Cross-References

| Topic | Document |
|---|---|
| Workflow guide | `docs/workflow.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Deployment guide | `docs/deployment.md` |
| Glossary | `docs/glossary.md` |
