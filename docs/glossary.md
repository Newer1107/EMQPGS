# Glossary

> Domain terms and concepts used throughout the system.

---

| Term | Definition |
|---|---|
| **AcademicYear** | Time period (e.g. "2026-2027") containing 8 semesters. |
| **ApprovalDecision** | Write-once record created when a coordinator approves or rejects a bank. |
| **Batch** | Cohort descriptor (e.g. "2024-28 BE Computer batch"). No student table. |
| **BatchSemester** | Per-batch semester schedule with independent dates and status. |
| **COE** | Controller of Examination — system admin role. |
| **COORDINATOR** | Faculty role managing subjects, banks, and phase transitions. |
| **CONTRIBUTOR** | Faculty role creating and submitting questions. |
| **CurriculumScheme** | Named curriculum plan for a department (e.g. "2025 Scheme"). Has `durationSemesters`. |
| **CurriculumSubject** | Authoritative mapping: Subject → (Semester, Scheme, Department, Group). |
| **DEAN** | Final reviewer role — selects paper variants for use. |
| **DeanReview** | Record of dean's variant selection for a bank. |
| **Department** | Single organizational entity handling both faculty administration and curriculum ownership. |
| **ExamCycle** | A single examination event (e.g. "ENDSEM Nov 2026"). Linked to a BatchSemester. Consumes existing QuestionBanks — does not own them. |
| **GeneratedPaper** | A generated paper variant (A, B, or C) for a bank. |
| **MODERATOR** | Quality reviewer role — approves/rejects questions. |
| **ModerationEvent** | Record of a moderator action on a question. |
| **PaperPattern** | Slot grid template for a bank (63 slots for ISE, 126 for ENDSEM). |
| **PaperSnapshot** | Immutable capture of a generated paper's state. |

| **QuestionBank** | Annual academic asset — one per (BatchSemester, Subject). Repository for all questions across all exam types (ISE-1, ISE-2, ENDSEM). Auto-created on batch semester activation. |
| **QuestionBankPhase** | Workflow progression: DRAFTING → MODERATION → APPROVAL → COMPLETE. |
| **QuestionBankSnapshot** | Immutable capture of slot assignments at lock time. |
| **QuestionLibraryItem** | A standalone, reusable question entity. Scoped to a SubjectVersion. |
| **QuestionSlot** | Sole linkage between QuestionBank and QuestionLibraryItem. Position defined by (module, marks, slot). |
| **RBAC** | Role-Based Access Control — two-layer: proxy.ts route gating + withApiHandler operation gating. |
| **ReadinessEngine** | Advisory component that evaluates whether a bank can advance to the next phase. |
| **RecordStatus** | Mutability axis: ACTIVE or LOCKED. Orthogonal to phase. |
| **SubjectVersion** | A versioned syllabus of a Subject. QuestionLibraryItems belong to this. |
| **TeachingGroup** | Records that a batch has up to two teaching groups. |

---

## Cross-References

| Topic | Document |
|---|---|
| Architecture | `docs/architecture.md` |
| Workflow | `docs/workflow.md` |
| Database schema | `docs/database.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Deployment | `docs/deployment.md` |
