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

## Cross-References

| Topic | Document |
|---|---|
| Workflow guide | `docs/workflow.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Deployment guide | `docs/deployment.md` |
| Glossary | `docs/glossary.md` |
