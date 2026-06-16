# Current System Architecture

> A single document to understand EMQPGS end-to-end.
> For depth on any topic, follow the cross-references.

---

## 1. System Purpose

EMQPGS (Examination Management & Question Paper Generation System) manages the complete lifecycle of academic examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL 8 · MinIO object storage · Auth.js v5 credentials + custom JWT · Ollama (optional for AI summaries)

---

## 2. Five User Roles

| Role | Key Responsibilities |
|---|---|
| **COE** | System admin: departments, users, academic years, exam cycles, exports, backups, audit logs |
| **COORDINATOR** | Academic management: subjects, question banks, slot assignments, moderator assignments, phase transitions, AI reports, paper generation, final approval |
| **CONTRIBUTOR** | Question creation: create/edit questions, assign to slots, submit for moderation, revise on feedback |
| **MODERATOR** | Quality assurance: review assigned questions, approve/reject/request revision |
| **DEAN** | Final review: review generated paper variants, select for regular/supplementary/KT exams |

See `docs/rbac-matrix.md` for detailed capability matrix.

---

## 3. Core Entities (ER Model)

```
AcademicYear 1─N Semester 1─N ExamCycle
Department 1─N Subject 1─N SubjectVersion 1─N QuestionLibraryItem
Department 1─N ExamCycle
Subject 1─N QuestionBank
QuestionBank 1─N QuestionSlot N─1 QuestionLibraryItem
ExamCycle 1─N QuestionBank
```

**Key entity:** `QuestionSlot` is the **sole** linkage between `QuestionBank` and `QuestionLibraryItem`. No join table exists.

See `docs/database.md` for full schema. See `docs/architecture.md` for detailed ER diagram.

---

## 4. Workflow Phases

```
DRAFTING → MODERATION → APPROVAL → COMPLETE
                ↑            │
                └── REJECT ──┘  (loopback from APPROVAL → MODERATION)
```

Phase advancement is **manual** (coordinator action). The `ReadinessEngine` reports readiness but does not auto-advance.

See `docs/workflow.md` for detailed phase walkthrough. See `docs/e2e-workflow.md` for a complete example cycle.

---

## 5. Question Bank Architecture

Two orthogonal state axes:

| Axis | States | Purpose |
|---|---|---|
| **Phase** | DRAFTING, MODERATION, APPROVAL, COMPLETE | Workflow progression |
| **RecordStatus** | ACTIVE, LOCKED, ARCHIVED | Operational mutability |

A bank can be in APPROVAL phase and LOCKED simultaneously. Locking prevents all mutations via `ensureQuestionBankMutable()` guard.

**Slot template:** ENDSEM/SUPPLEMENTARY/KT exam types use 126 slots (6 modules × 3 marks × 7 slots). ISE types use 63 slots (3 modules × 3 marks × 7 slots).

See `src/modules/question-banks/transitions.ts` for the transition table. See `src/modules/question-banks/mutable-guard.ts` for the lock guard.

---

## 6. Exam Cycle Architecture

Exam cycles are **department-scoped**: `@@unique([semesterId, examType, departmentId])`. Each department gets its own cycle per (semester, examType). Cross-department cycles are blocked.

Statuses: DRAFT → ACTIVE → CLOSED.

See `docs/archive/exam-cycle-lifecycle.md` for detailed state machine documentation.

---

## 7. Approval Architecture

1. Bank enters APPROVAL phase
2. Coordinator triggers AI analysis, generates papers
3. Coordinator makes decision via `POST /api/question-banks/[id]/coordinator-decision`
4. **APPROVED:** `ApprovalDecision` created + phase → COMPLETE (same transaction)
5. **REJECTED:** `ApprovalDecision` created + phase → MODERATION (loopback)

ApprovalDecision is write-once — no update or delete path.

---

## 8. Snapshots

| Snapshot Type | Trigger | Content | Mutability |
|---|---|---|---|
| QuestionBankSnapshot | Bank lock | Full slot assignment array | Immutable |
| PaperSnapshot | Paper generation | Paper JSON + scores | Upsert (last write wins) |

---

## 9. Readiness Engine

Evaluates whether a bank meets requirements for advancing to the next phase:

| Target Phase | Checks |
|---|---|
| MODERATION | All slots must be filled |
| APPROVAL | ≥1 filled slot, all moderated, AI report completed |
| COMPLETE | No checks (gated by coordinator decision) |

See `src/modules/readiness/engine.ts`.

---

## 10. RBAC Architecture (Two-Layer)

1. **`proxy.ts` middleware** — Route-level role gating for `/dashboard/<role>` and `/api/**`
2. **`withApiHandler` wrapper** — Operation-level role gating, CSRF, rate limiting, audit

Object-level checks (e.g., moderator can only see their assigned banks) live in services.

See `src/lib/api-handler.ts`, `proxy.ts`.

---

## 11. Key Invariants

1. One bank per (subject, exam cycle) — `@@unique([subjectId, examCycleId])`
2. One slot position per bank — `@@unique([questionBankId, moduleNumber, marks, slotNumber])`
3. No duplicate questions per bank (application-enforced)
4. QuestionSlot is the sole linkage (no QuestionBankQuestion table)
5. LOCKED banks reject all mutations
6. Phase transitions are validated via `isValidPhaseTransition()`
7. ReadinessEngine is advisory only
8. Question marks: 2, 5, or 10. Module: 1-6. RBT: L1-L6. CO: CO1-CO6.
9. MinIO buckets: exactly 5 (question-bank-attachments, generated-papers, exports, audit-files, system-backups)

---

## 12. Current Limitations

1. Synchronous long operations — AI analysis, paper generation, exports, backups run in-request
2. In-memory rate limiter — resets on restart, not multi-instance safe
3. No background workers — `workers/` directory is empty (reserved)
4. No scheduled backups — API/manual-trigger only
5. QuestionLibraryItem is SubjectVersion-scoped — no cross-cycle shared question pool
6. Concurrency gaps — some operations use last-writer-wins semantics
7. No dean review update/delete — write-once selection

---

## Cross-References

| Topic | Primary Document | Secondary |
|---|---|---|
| Architecture deep-dive | `docs/architecture.md` | Domain docs in `docs/archive/` |
| Database schema | `docs/database.md` | `prisma/schema.prisma` |
| Workflow details | `docs/workflow.md` | `docs/e2e-workflow.md` |
| API reference | `docs/api.md` | `docs/archive/api-reference.md` |
| Operations | `docs/operations-manual.md` | — |
| Onboarding | `docs/onboarding.md` | — |
| RBAC | `docs/rbac-matrix.md` | — |
| ADR (decisions) | `docs/adr/ADR-001` through `005` | — |
