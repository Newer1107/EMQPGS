# Workflow

> The authoritative guide to question bank lifecycle, phase transitions, readiness, locking, approval, and paper generation.

---

## 1. Question Bank Lifecycle

The QuestionBank has two orthogonal state axes:

```
Phase:        DRAFTING → MODERATION → APPROVAL → COMPLETE
RecordStatus: ACTIVE ←→ LOCKED
```

These are independent — a bank can be in APPROVAL phase and LOCKED simultaneously.

### Phase transition table

| Current → Target | Gate | ReadinessEngine checks |
|---|---|---|
| DRAFTING → MODERATION | Coordinator advance | ≥1 slot filled (warns on empty, does not block) |
| MODERATION → APPROVAL | Coordinator advance | ≥1 slot filled, all filled slots moderated, AI report completed |
| APPROVAL → COMPLETE | Coordinator approves | No checks (gated by decision) |
| APPROVAL → MODERATION | Coordinator rejects | No checks (loopback) |

**Blocked transitions** (return HTTP 409): DRAFTING → APPROVAL, DRAFTING → COMPLETE, MODERATION → COMPLETE, MODERATION → DRAFTING, APPROVAL → DRAFTING, COMPLETE → anything.

### RecordStatus transitions

```
ACTIVE → LOCKED : lock()  (creates QuestionBankSnapshot)
LOCKED → ACTIVE : unlock() (reversible — available for emergency recovery)
```

---

## 2. Complete End-to-End Flow

### Phase 1: Setup (COE)

1. **Create Department** → `/dashboard/coe/departments`
2. **Create CurriculumScheme** → define curriculum plan per department
3. **Create Academic Year** → temporal container
4. **Create Batch** → cohort linked to department + curriculum scheme
5. **Create CurriculumSubjects** → map subjects to semesters in the scheme
6. **Create Users** (if not seeded)
7. **Assign Coordinator** to department
8. **Activate BatchSemester** → `/api/batch-semesters/[id]?action=activate`
   - **Auto-creates** all QuestionBanks (126-slot, DRAFTING)
   - **Auto-creates** Exam Cycles (ISE-1, ISE-2, ENDSEM) with subject links
   - **Sends notifications** to coordinators

### Phase 2: Coordinator Workspace

9. **Create Subject** (if not already in curriculum) → auto-creates SubjectVersion v1
10. **Assign Moderator** to bank
11. **Assign Contributor** to bank → contributor sees bank immediately in their dashboard
12. **Manage progress** — view filled slots, pending questions, stalled status

### Phase 3: Contribution (Contributor + Coordinator)

12. **Create QuestionLibraryItem** → belongs to SubjectVersion, status DRAFT
13. **Assign to Slot** → matches `(moduleNumber, marks)` position
14. **Submit for Moderation** → status → PENDING

The coordinator decides when sufficient questions are present. Slots do not need to be fully filled before advancing to MODERATION — partial banks can move forward.

**Editing rules:** DRAFT and REVISION_REQUESTED questions are freely editable. PENDING, APPROVED, REJECTED, and REVISION_SUBMITTED block edits via `QuestionLibraryService.update()`. If a COORDINATOR edits an APPROVED question, it auto-reverts to REVISION_REQUESTED.

### Phase 4: Moderation (Moderator)

15. **Review questions** → Approve / Reject / Request Revision

Question lifecycle: `DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED → APPROVED | REJECTED`

### Phase 5: Approval (Coordinator)

16. **Advance to APPROVAL**
17. **Trigger AI analysis** → `POST /api/question-banks/[id]/reports`
18. **Generate papers** → `POST /api/question-banks/[id]/papers` (specify exam type in body)
    - ISE-1: generates from modules 1-3 (3 × 3 marks × 3 variants = 27 questions)
    - ISE-2: generates from modules 4-6 (3 × 3 marks × 3 variants = 27 questions)
    - ENDSEM: generates from modules 1-6 (6 × 3 marks × 3 variants = 54 questions)
19. **Coordinator decision** → Approve (→COMPLETE) or Reject (→MODERATION)

### Phase 6: Finalization

20. **Lock bank** → creates QuestionBankSnapshot, all mutations blocked
21. **Dean review** → select distinct variants for Regular, Supplementary, KT
22. **COE export** → PDF/DOCX/ZIP
23. **BatchSemester completes** → all banks auto-locked

---

## 3. ReadinessEngine Rules

`src/modules/readiness/engine.ts` — `ReadinessEngine.isReady(questionBankId, targetPhase)`

| Target Phase | Checks |
|---|---|
| MODERATION | ≥1 filled slot (warns on empty, does not block) |
| APPROVAL | ≥1 filled slot, all filled slots have moderation decisions, AI report completed. Coverage warnings for CO/RBT spread. |
| COMPLETE | No checks (gated by coordinator decision) |

**Key rule:** Readiness does **not** auto-advance. The coordinator must explicitly call `advancePhase()`. Readiness is advisory — a coordinator can advance even with warnings (but not with blocking issues).

---

## 4. Locking Behavior

**Lock** (`PATCH /api/question-banks/[id]/lock`, coordinator only):
- Preconditions: bank not already LOCKED, batch semester ACTIVE, batch semester has `endDate` set
- Effects: `recordStatus → LOCKED`, `lockedAt` set, `QuestionBankSnapshot` created (full slot array captured)
- All mutations rejected by `ensureQuestionBankMutable()` guard

**Unlock** (`POST /api/question-banks/[id]/unlock`, coordinator only):
- Sets `recordStatus` back to ACTIVE, clears `lockedAt`. No snapshot created.

---

## 5. Approval Behavior

`POST /api/question-banks/[id]/coordinator-decision` (coordinator only):

- **APPROVED:** `ApprovalDecision` created + bank phase → COMPLETE (single transaction)
- **REJECTED:** `ApprovalDecision` created + bank phase → MODERATION (loopback)

The decision is write-once — no update or delete path. `ApprovalDecision` fields: `decision` (APPROVED/REJECTED), `remark` (optional), `decidedById`, `decidedAt`.

---

## 6. Paper Generation

`POST /api/question-banks/[id]/papers` (coordinator only):

1. Validates bank is in APPROVAL or COMPLETE phase
2. `PaperGenerator.generate()` selects one approved question per `(module, marks)` pair per variant
3. 3 variants (A, B, C) generated simultaneously
4. PDF created via `PdfService`, uploaded to MinIO `generated-papers` bucket
5. `GeneratedPaper` records created/upserted per variant
6. `PaperSnapshot` upserted for each variant (coverage, difficulty, quality scores)
7. Usage history recorded for each selected question

### Slot breakdown (Annual Bank — all exam types share the same 126 slots)

| Module | 2-mark slots | 5-mark slots | 10-mark slots | Total |
|---|---|---|---|---|
| 1-6 (each) | 7 | 7 | 7 | 21 |
| **Total** | **42** | **42** | **42** | **126** |

All banks use the same 6-module pattern. The paper generator filters by the exam type's module range:
- **ISE-1**: modules 1-3 only (3 × 3 × 7 = 63 available slots)
- **ISE-2**: modules 4-6 only (3 × 3 × 7 = 63 available slots)
- **ENDSEM**: modules 1-6 (6 × 3 × 7 = 126 available slots)

QuestionUsageHistory prevents question reuse across exam cycles. See `src/lib/constants.ts` → `EXAM_MODULE_RANGES` for the centralized module range configuration.

---

## Cross-References

| Topic | Document |
|---|---|
| Domain model & RBAC | `docs/architecture.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Glossary | `docs/glossary.md` |
