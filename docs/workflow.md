# Workflow

> The authoritative guide to question bank lifecycle, phase transitions, readiness, locking, approval, and paper generation.

---

## 1. Question Bank Lifecycle

The QuestionBank has two orthogonal state axes:

```
Phase:        DRAFTING → MODERATION → APPROVAL → COMPLETE
RecordStatus: ACTIVE ←→ LOCKED (ARCHIVED for retention)
```

These are independent — a bank can be in APPROVAL phase and LOCKED simultaneously.

### Phase transition table

| Current → Target | Gate | ReadinessEngine checks |
|---|---|---|
| DRAFTING → MODERATION | Coordinator advance | All slots filled |
| MODERATION → APPROVAL | Coordinator advance | ≥1 slot filled, all moderated, AI report completed |
| APPROVAL → COMPLETE | Coordinator approves | No checks (gated by decision) |
| APPROVAL → MODERATION | Coordinator rejects | No checks (loopback) |

**Blocked transitions** (return HTTP 409): DRAFTING → APPROVAL, DRAFTING → COMPLETE, MODERATION → COMPLETE, MODERATION → DRAFTING, APPROVAL → DRAFTING, COMPLETE → anything.

### RecordStatus transitions

```
ACTIVE → LOCKED : lock()  (creates QuestionBankSnapshot)
LOCKED → ACTIVE : unlock() (reversible — available for emergency recovery)
ACTIVE → ARCHIVED : archive()
```

---

## 2. Complete End-to-End Flow

### Phase 1: Setup (COE)

1. **Create Department** → `/dashboard/coe/departments`
2. **Create Academic Year** → auto-generates 8 semesters
3. **Create Exam Cycle** → department-scoped, status DRAFT
4. **Activate Exam Cycle** → status → ACTIVE
5. **Assign Coordinator** to department
6. **Create Users** (if not seeded)

### Phase 2: Preparation (Coordinator)

7. **Create Subject** → auto-creates SubjectVersion v1
8. **Link Subject to Exam Cycle**
9. **Initialize QuestionBank** → phase DRAFTING, PaperPattern created, all QuestionSlots generated (63 for ISE, 126 for ENDSEM)
10. **Assign Moderator** to bank

### Phase 3: Contribution (Contributor + Coordinator)

11. **Create QuestionLibraryItem** → belongs to SubjectVersion, status DRAFT
12. **Assign to Slot** → matches `(moduleNumber, marks)` position
13. **Submit for Moderation** → status → PENDING

All slots must be filled before advancing out of DRAFTING.

### Phase 4: Moderation (Moderator)

14. **Review questions** → Approve / Reject / Request Revision

Question lifecycle: `DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED → APPROVED | REJECTED`

### Phase 5: Approval (Coordinator)

15. **Advance to APPROVAL**
16. **Trigger AI analysis** → `POST /api/question-banks/[id]/reports`
17. **Generate papers** → 3 variants (A, B, C), 18 questions each for ENDSEM
18. **Coordinator decision** → Approve (→COMPLETE) or Reject (→MODERATION)

### Phase 6: Finalization

19. **Lock bank** → creates QuestionBankSnapshot, all mutations blocked
20. **Dean review** → select distinct variants for Regular, Supplementary, KT
21. **COE export** → PDF/DOCX/ZIP
22. **Close Exam Cycle**

---

## 3. ReadinessEngine Rules

`src/modules/readiness/engine.ts` — `ReadinessEngine.isReady(questionBankId, targetPhase)`

| Target Phase | Checks |
|---|---|
| MODERATION | All slots filled (no empty slots) |
| APPROVAL | ≥1 filled slot, all filled slots have moderation decisions, AI report completed. Coverage warnings for CO/RBT spread. |
| COMPLETE | No checks (gated by coordinator decision) |

**Key rule:** Readiness does **not** auto-advance. The coordinator must explicitly call `advancePhase()`. Readiness is advisory — a coordinator can advance even with warnings (but not with blocking issues).

---

## 4. Locking Behavior

**Lock** (`PATCH /api/question-banks/[id]/lock`, coordinator only):
- Preconditions: bank not already LOCKED, exam cycle ACTIVE, exam cycle has `endDate` set
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

### Slot breakdown (ENDSEM)

| Module | 2-mark slots | 5-mark slots | 10-mark slots | Total |
|---|---|---|---|---|
| 1-6 (each) | 7 | 7 | 7 | 21 |
| **Total** | **42** | **42** | **42** | **126** |

ISE types use 3 modules → 63 total slots.

---

## Cross-References

| Topic | Document |
|---|---|
| Domain model & RBAC | `docs/architecture.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Glossary | `docs/glossary.md` |
