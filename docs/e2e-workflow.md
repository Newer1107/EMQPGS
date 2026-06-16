# End-to-End Workflow Guide

## System Overview

EMQPGS (Examination Management & Question Paper Generation System) manages the complete lifecycle of academic examination question papers. The system covers subject creation, question contribution, moderation, AI-assisted analysis, paper generation, dean review, and export. Built on Next.js 16 with Prisma ORM, MySQL 8, MinIO object storage, and Auth.js with custom JWT cookies, it serves institutions with a five-role authorization model.

The workflow follows a 4-phase question bank progression: DRAFTING (questions are created and assigned to slots), MODERATION (reviewed by assigned moderators), APPROVAL (AI analysis, paper generation, coordinator decision), and COMPLETE (terminal phase for dean review, locking, and export). The record status (ACTIVE/LOCKED/ARCHIVED) is orthogonal to phase and controls mutability. All phase transitions are manual coordinator actions gated by the ReadinessEngine.

## Architecture Summary

**4-Phase Workflow:** DRAFTING → MODERATION → APPROVAL → COMPLETE (with APPROVAL → MODERATION rejection loopback)

**5 Roles:**
- **COE** — System administration: users, departments, exam cycles, academic years, semesters, exports, backups, audit logs
- **COORDINATOR** — Academic management: subjects, question banks, slot assignments, moderator assignments, phase transitions, AI reports, paper generation, approvals
- **CONTRIBUTOR** — Question creation: create/edit questions, assign to slots, submit for moderation, revise on feedback
- **MODERATOR** — Quality assurance: review assigned questions, approve/reject/request revision
- **DEAN** — Final review: review generated paper variants, select variants for regular/supplementary/KT exams

**Key Entities:**
- QuestionLibraryItem — standalone, reusable question entity scoped to a SubjectVersion
- QuestionSlot — sole linkage between QuestionBank and QuestionLibraryItem; position defined by (moduleNumber, marks, slotNumber)
- ExamCycle — department-scoped. Each department gets its own cycle per (semester, examType). Cross-department cycles are blocked.
- QuestionBank — container per (Subject, ExamCycle) pair with orthogonal phase and record status
- PaperPattern — slot grid template generated at bank initialization (126 slots for ENDSEM)
- ReadinessEngine — advisory gate that evaluates readiness but does not auto-advance
- ApprovalDecision — write-once record created at coordinator approve/reject
- QuestionBankSnapshot — immutable capture of slot assignments at lock time
- PaperSnapshot — upserted per variant at paper generation

## Complete Academic Cycle Walkthrough

### Example Parameters

| Parameter | Value |
|---|---|
| Academic Year | 2026-2027 |
| Semester | 5 (Fifth Semester) |
| Department | Computer Science & Engineering (CSE) |
| Subject | Advanced Algorithms |
| Subject Code | CS501 |
| Credits | 4 |
| Exam Type | ENDSEM |
| Coordinator | coordinator@emqpgs.local |
| Moderator | moderator@emqpgs.local |
| Contributor | contributor@emqpgs.local |
| Dean | dean@emqpgs.local |
| COE | coe@emqpgs.local |

### Phase 1: Setup (COE)

**Step 1.1 — COE creates Department**
Navigate to `/dashboard/coe/departments`, click "Create Department".
- Name: `Computer Science & Engineering`
- Code: `CSE` (auto-uppercased)
- HOD Name: `Dr. A. Sharma`
Submit. System creates Department record with status ACTIVE.

**Step 1.2 — COE creates Academic Year**
Navigate to `/dashboard/coe/academic-years`, click "Create Academic Year".
- Code: `2026-2027` (must match `/^\d{4}-\d{4}$/`)
- Start Date: `2026-06-01`
- End Date: `2027-05-31`
System creates AcademicYear with status ACTIVE.

**Step 1.3 — COE creates Semester**
Navigate to `/dashboard/coe/semesters`, click "Create Semester".
- Number: `5`
- Name: `Fifth Semester`
- Academic Year: select `2026-2027`
System creates Semester linked to AcademicYear.

**Step 1.4 — COE creates Exam Cycle**
Navigate to `/dashboard/coe/exam-cycles`, click "Create Exam Cycle".
- Academic Year: `2026-2027`
- Semester: `5`
- Exam Type: `ENDSEM`
- Department: `CSE`
- Timetable Title: `End Semester Examination Nov/Dec 2026`
- Timetable Issue Date: `2026-10-01`
- Timetable Document Ref: `TTCSE-2026-ENDSEM`
- Timetable Signature: `Controller of Examination`
- Timetable Rows: add each paper with date, time, and paper name
Submit. ExamCycle is created in DRAFT status.

**Step 1.5 — COE activates Exam Cycle**
On the exam cycle list, click "Activate". Status changes to ACTIVE.

**Step 1.6 — COE assigns Coordinator to Department**
Navigate to `/dashboard/coe/coordinator-assignments`.
- Coordinator: select `coordinator@emqpgs.local`
- Department: `CSE`
Submit. Assignment is created. This coordinator can now manage subjects and banks for CSE.

**Step 1.7 — COE creates Users (if not seeded)**
Navigate to `/dashboard/coe/users`, click "Create User". Create all roles:
- coordinator@emqpgs.local (COORDINATOR, Department: CSE)
- moderator@emqpgs.local (MODERATOR)
- contributor@emqpgs.local (CONTRIBUTOR)
- dean@emqpgs.local (DEAN)
Each gets a password (min 8 chars).

### Phase 2: Preparation (Coordinator)

**Step 2.1 — Coordinator creates Subject**
Navigate to `/dashboard/coordinator/subjects`, click "Create Subject".
- Subject Code: `CS501` (auto-uppercased, max 20 chars)
- Subject Name: `Advanced Algorithms`
- Department: `CSE`
- Semester: `5`
- Credits: `4`
Submit. Transaction creates:
- Subject record with code CS501, status ACTIVE, questionBankDueDate = now + 30 days
- SubjectVersion v1 with title "Advanced Algorithms", status ACTIVE, linked to 2026-2027 academic year

**Step 2.2 — Coordinator links Subject to Exam Cycle**
On the subject detail page (`/dashboard/coordinator/subjects/[id]`), click "Link to Exam Cycle".
- Exam Cycle: select the ENDSEM 2026-2027 cycle
Subject is now linked. If exam cycle belongs to a different department, system returns 400.

**Step 2.3 — Coordinator creates Question Bank**
Navigate to `/dashboard/coordinator/question-banks`, click "Create Question Bank".
- Subject: `CS501 — Advanced Algorithms`
- Exam Cycle: `ENDSEM 2026-2027`
Submit. System initializes the bank:
- Phase: DRAFTING
- RecordStatus: ACTIVE
- PaperPattern created for ENDSEM (6 modules, marks [2,5,10], 7 slots/module = 126 total)
- 126 QuestionSlot records created: module 1-6, each with marks 2, 5, 10, each with slots 1-7

**Step 2.4 — Coordinator verifies Question Slots**
Navigate to `/dashboard/coordinator/question-banks/[id]`. The bank detail page shows:
- **Summary bar**: total/filled/empty/approved/pending/rejected slot counts
- **Slot grid**: 6 modules (rows), 3 mark values per module (2, 5, 10), 7 individual slot cells per mark value (color-coded by status: green=approved, amber=pending, blue=draft, red=rejected, dashed=empty)
- **Slot interaction**: clicking any cell opens a detail panel with question text, contributor, CO, RBT level
- **Readiness panel**: shows specific blocking issues and warnings for the current phase
- **Phase-specific sections**: AI report (APPROVAL), generated papers (COMPLETE), dean review (COMPLETE)
- **Sidebar**: phase advancement actions, workflow timeline, next-step guidance
- Phase badge: DRAFTING, Record status badge: ACTIVE

Slot breakdown for ENDSEM:

| Module | 2-mark slots | 5-mark slots | 10-mark slots | Total per module |
|---|---|---|---|---|
| 1 | 7 | 7 | 7 | 21 |
| 2 | 7 | 7 | 7 | 21 |
| 3 | 7 | 7 | 7 | 21 |
| 4 | 7 | 7 | 7 | 21 |
| 5 | 7 | 7 | 7 | 21 |
| 6 | 7 | 7 | 7 | 21 |
| **Total** | **42** | **42** | **42** | **126** |

### Phase 3: Contribution (Contributor + Coordinator)

**Step 3.1 — Contributors create and submit questions**
Contributor logs in. Navigates to `/dashboard/contributor/submit-question`.

Each question requires:
- Subject Version: select `CS501 — Advanced Algorithms v1`
- Module Number: 1-6
- Marks: 2, 5, or 10
- Question Text: min 15 characters
- CO Mapping: CO1-CO6
- RBT Level: L1-L6
- Difficulty Level: optional (EASY, MEDIUM, HARD)
- Teaching Index: optional (max 50 chars)

When submitted with a `questionBankId`, the system auto-assigns to the first empty slot matching (moduleNumber, marks). Alternatively, the contributor can create questions first (status DRAFT), then assign them to specific slots via the slot grid.

To fill all 126 slots, contributors must create at least 126 questions covering every (module, marks, slot) combination. Example breakdown:

| Module | 2-mark questions | 5-mark questions | 10-mark questions |
|---|---|---|---|
| 1 — Algorithm Analysis | 7 | 7 | 7 |
| 2 — Sorting & Searching | 7 | 7 | 7 |
| 3 — Graph Algorithms | 7 | 7 | 7 |
| 4 — Dynamic Programming | 7 | 7 | 7 |
| 5 — NP-Completeness | 7 | 7 | 7 |
| 6 — Advanced Topics | 7 | 7 | 7 |

Example questions for Module 1, 2-mark:
- Slot 1: "Define asymptotic notation O, Ω, and Θ." (CO1, L1, EASY)
- Slot 2: "What is the time complexity of binary search?" (CO1, L2, EASY)
- Slot 3: "State the Master Theorem." (CO1, L1, EASY)
- ...7 questions total

After creation, each question must be submitted for moderation (status changes from DRAFT to PENDING). The coordinator or contributor clicks "Submit for Moderation" on each question.

**Step 3.2 — Coordinator monitors slot fill**
On the question bank detail page, the coordinator checks metrics. All 126 slots must show as filled before advancing.

### Phase 4: Advance to MODERATION (Coordinator)

**Step 4.1 — Coordinator checks readiness**
On the bank detail sidebar, the coordinator sees the "Actions" panel. Clicking the current phase's advance button triggers a readiness check:
- Target Phase: MODERATION
- `ReadinessEngine` checks: all 126 slots must be filled
- If any slot is empty, the panel displays specific issues (e.g. "14 of 126 slots empty")
- Warnings (e.g. low CO coverage) are also shown but do not block advancement

**Step 4.2 — Coordinator advances phase**
Click "Advance to Moderation" in the Actions panel.
- System validates transition DRAFTING → MODERATION via `isValidPhaseTransition()`
- Phase changes to MODERATION

### Phase 5: Moderator Assignment (Coordinator)

**Step 5.1 — Coordinator assigns Moderator**
Navigate to `/dashboard/coordinator/assignments`.
- Select the question bank from the list
- Select a moderator from the dropdown
Submit. `ModeratorBankAssignment` record created. System validates MODERATOR role, prevents duplicates (unique constraint on `[moderatorId, questionBankId]`).

Multiple moderators can be assigned to the same bank.

### Phase 6: Moderation (Moderator)

**Step 6.1 — Moderator reviews questions**
Moderator logs in. Dashboard shows assigned banks and pending questions.
Navigate to `/dashboard/moderator/questions` to see all questions pending review for assigned banks.
Click into a question to see full detail including question text, module, marks, CO, RBT level.

**Step 6.2 — Moderator actions**
For each question, the moderator has three options:

**Approve:** Question status → APPROVED. Question is eligible for paper inclusion.
- Click "Approve" button on `/dashboard/moderator/questions/[id]`

**Reject:** Question status → REJECTED. Question is ineligible. Contributor must create a replacement.
- Add an optional note explaining why
- Click "Reject" button

**Request Revision:** Question status → REVISION_REQUESTED. Contributor must revise.
- Add note specifying required changes
- Click "Request Revision" button

The moderator reviews all 126 questions. Approved questions remain in their slots. Rejected questions stay in their slots (marked REJECTED) — the coordinator can replace them. Revision-requested questions wait for contributor action.

**Step 6.3 — Contributor resubmits revisions**
Contributor logs in. Dashboard shows "Revision Requested" count.
Navigate to `/dashboard/contributor/questions/[id]/edit`.
- Edit question text and/or metadata
- Click "Submit Revision"
- Question status → REVISION_SUBMITTED

Moderator reviews again and approves or rejects.

### Phase 7: Advance to APPROVAL (Coordinator)

**Step 7.1 — Coordinator checks readiness for APPROVAL**
- At least 1 slot filled (always true at this point)
- All filled slots must have moderation decisions (no PENDING questions)
- AI report should be completed (or at least triggered)

**Step 7.2 — Coordinator triggers AI Analysis**
From the bank detail sidebar or via the API (`POST /api/question-banks/[id]/reports`):
- System calls `AiReportService` which may invoke Ollama for natural-language summary
- AnalysisEngine computes coverage, RBT distribution, difficulty distribution, duplicate detection
- Report is stored as AiReport record with status COMPLETED (or FAILED)
- The bank detail page renders the report summary in the AI Report section when available
- Note: AI analysis does NOT auto-advance the phase

**Step 7.3 — Coordinator advances to APPROVAL**
- Target Phase: APPROVAL
- Transition: MODERATION → APPROVAL
- ReadinessEngine validates all conditions
- Phase changes to APPROVAL

### Phase 8: Paper Generation & Coordinator Decision (Coordinator)

**Step 8.1 — Coordinator generates papers**
From the bank detail sidebar or via API (`POST /api/question-banks/[id]/papers`):
- Generates 3 variants (PAPER_A, PAPER_B, PAPER_C)
- `PaperGenerator.generate()` selects 1 approved question per (module, marks) pair per variant — 6 modules × 3 marks = 18 questions per variant, 54 total across all 3 variants
- Each variant draws from the same approved pool. Once a question is used in one variant, it is excluded from subsequent variants within the same generation run (no overlap within a run).
- PDF created via PdfService, uploaded to MinIO `generated-papers` bucket
- GeneratedPaper records created/upserted per variant
- PaperSnapshot upserted with coverage, difficulty, quality scores
- Usage history recorded for each selected question
- Coordinator receives notification

Verification: All 3 variants are distinct. Each variant has 18 questions (6 modules × 3 marks). Duplicate risk score checked via text similarity (threshold 0.84).

**Step 8.2 — Coordinator makes decision**
On the question bank detail page, click "Coordinator Decision".
- Decision: select APPROVED or REJECTED
- Remark: optional (max 500 chars)

**If APPROVED:**
- ApprovalDecision created with decision=APPROVED, decidedById=coordinator, decidedAt=now
- Bank phase → COMPLETE (in same transaction)
- Workflow proceeds to finalization

**If REJECTED:**
- ApprovalDecision created with decision=REJECTED, optional remark
- Bank phase → MODERATION (loops back)
- Moderators can review again
- Coordinator can advance back to APPROVAL when issues resolved

### Phase 9: Lock & Dean Review (Coordinator + Dean)

**Step 9.1 — Coordinator locks the bank**
Once phase is COMPLETE, navigate to question bank detail, click "Lock Bank".
- Preconditions: bank not already LOCKED, exam cycle ACTIVE, exam cycle has endDate set
- RecordStatus → LOCKED, lockedAt set to current time
- QuestionBankSnapshot created with SnapshotType.LOCKED, captures full slot array, phase, status, version
- All mutations rejected from this point (ensureQuestionBankMutable guard)
- Lock is reversible via unlock API if needed

**Step 9.2 — Dean reviews and selects variants**
Dean logs in. Navigate to `/dashboard/dean/review`.
- View generated paper variants (A, B, C) with coverage scores, difficulty scores, quality scores
- Each variant shows the full question list by module

Dean must select three distinct variants:
- Regular Paper: select one variant (PAPER_A, PAPER_B, or PAPER_C)
- Supplementary Paper: select a different variant
- KT Paper: select the remaining variant

All three must be distinct (validated by `deanReviewSchema`).
Submit. DeanReview record created with status SUBMITTED.

### Phase 10: Export & Closure (COE)

**Step 10.1 — COE exports finalized packets**
Navigate to `/dashboard/coe/production` or `/dashboard/coe/exam-cycles`.
Select the question bank, click "Export".
- Format: PDF, DOCX, or ZIP
- Exam Date: date string
- Duration: e.g. "3 hours"
- Maximum Marks: integer positive
- Instructions: at least one instruction string
- Institution Name: optional

Export artifact created in MinIO `exports` bucket. Download via signed URL.

**Step 10.2 — COE closes Exam Cycle**
Navigate to `/dashboard/coe/exam-cycles`, select the cycle, click "Close".
Status changes to CLOSED. No further operations on this cycle.

## Phase Transition Rules

| Current Phase | Target Phase | Gate | ReadinessEngine Checks |
|---|---|---|---|
| DRAFTING | MODERATION | Coordinator advance | All 126 slots filled |
| MODERATION | APPROVAL | Coordinator advance | ≥1 slot filled, all filled slots moderated, AI report completed |
| APPROVAL | COMPLETE | Coordinator decision (APPROVED) | No checks (gated by decision) |
| APPROVAL | MODERATION | Coordinator decision (REJECTED) | No checks (loopback) |
| COMPLETE | — | Terminal | No transitions allowed |

Blocked transitions (return HTTP 409):
- DRAFTING → APPROVAL (skip requires MODERATION)
- DRAFTING → COMPLETE
- MODERATION → COMPLETE
- MODERATION → DRAFTING (no rollback)
- APPROVAL → DRAFTING
- COMPLETE → anything

Validated in `isValidPhaseTransition()` in `src/modules/question-banks/transitions.ts`.

## Key Architecture Invariants

1. **126-slot template.** ENDSEM/SUPPLEMENTARY/KT exam types use 6 modules × 3 marks × 7 slots = 126 positions. ISE uses 3 modules × 3 marks × 7 slots = 63. Generated by `buildQuestionSlotTemplate()` in `src/modules/questions/slot-template.ts`.

2. **Two-axis bank state.** QuestionBankPhase (DRAFTING, MODERATION, APPROVAL, COMPLETE) is orthogonal to RecordStatus (ACTIVE, LOCKED, ARCHIVED). A bank can be in APPROVAL phase and LOCKED simultaneously. Phase transitions change phase axis only; locking changes record status only.

3. **QuestionSlot is the sole linkage.** No QuestionBankQuestion join table exists. A QuestionLibraryItem connects to a QuestionBank exclusively through QuestionSlot. A question can occupy at most one slot per bank but can be assigned to slots in multiple banks simultaneously.

4. **One bank per (subject, exam cycle).** Enforced by `@@unique([subjectId, examCycleId])` on QuestionBank.

5. **One slot position per bank.** Enforced by `@@unique([questionBankId, moduleNumber, marks, slotNumber])` on QuestionSlot. No two slots in the same bank can share the same coordinates.

6. **No duplicate questions per bank.** Application-enforced: a QuestionLibraryItem cannot occupy more than one slot in the same bank.

7. **ApprovalDecision is write-once.** Created in the same transaction as the phase update. No update or delete path.

8. **QuestionBankSnapshot is immutable.** Created on lock (SnapshotType.LOCKED). Contains full slot array at lock time. Never modified after creation.

9. **ReadinessEngine is advisory only.** Does not block or auto-advance phases. Coordinator can advance even with warnings (but not with blocking issues).

10. **Question status lifecycle.** DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED (→ APPROVED/REJECTED loop). Once APPROVED, question is eligible for paper generation.

11. **LOCKED banks reject all mutations.** `ensureQuestionBankMutable()` in `src/modules/question-banks/mutable-guard.ts` throws HTTP 409 on any write attempt. Unlock is available for emergency recovery.

12. **Phase transitions are validated server-side.** `isValidPhaseTransition()` enforces the canonical transition table. Invalid transitions return HTTP 409 with a descriptive message.

13. **Audit chain uses SHA-256 integrity.** Append-only AuditLog table with hash chain linking each record to the previous record's hash.

14. **MinIO buckets are fixed.** Exactly five: `question-bank-attachments`, `generated-papers`, `exports`, `audit-files`, `system-backups`. No additional buckets without updating `minio-init`.
