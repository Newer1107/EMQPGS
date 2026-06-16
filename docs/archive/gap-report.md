# Documentation Gap Report

> Generated: 2026-06-15
> Audit scope: All `.md` files in `docs/`, `README.md`, `AGENTS.md`, `EMQPGS-Complete-Operational-Workflow.md`

## Key finding

The entire documentation set describes a **different architecture** than what is implemented. Major concepts that were removed from code (`QuestionBankQuestion`, `QuestionBankStatus` with 10 states, `SignedReport` entity and workflow, `QuestionBankQuestion` module and routes) are still present in all documentation. The codebase migrated to a 4-phase + 3-record-status model with `QuestionSlot` as the sole linking mechanism, but every doc file still references the old model.

---

## Critical gaps (information is wrong)

### 1. `README.md` — 16 outdated references

| Section | Problem | Replacement |
|---|---|---|
| §1 (line 16) | "10-state lifecycle" | 4-phase (QuestionBankPhase) + 3 RecordStatus |
| §2 Academic Domain (line 36) | Shows `QuestionBankQuestion ← bridge to library items` | `QuestionSlot` is the linkage. No QuestionBankQuestion entity |
| §2 Question Domain (line 52) | `QuestionBankQuestion → links to QuestionBank` | `QuestionSlot` links via assignedQuestionId |
| §2 Question Domain (line 57) | "Linking to a Bank creates a `QuestionBankQuestion` join record" | Linking creates a `QuestionSlot.assignedQuestionId` assignment |
| §2 Exam Domain (line 64) | `QuestionBankQuestion → library item links` | No such entity. Use `slots → assignedQuestion` |
| §2 Exam Domain (line 72-73) | "10-state lifecycle" | 4-phase lifecycle |
| §2 Exam Domain (line 73) | "Bank lock is terminal" | Lock is reversible (unlock API exists) |
| §4 (line 114-125) | Setup instructions are correct | OK |
| §9 Folder Structure (line 233) | `question-bank-questions/` module listed | No such module exists on disk |
| §9 Folder Structure (line 238) | `reports/` described as "signed reports" | No signed report module; reports is AI + paper generation |
| §10 Roles: Coordinator (line 290-291) | "assigns contributors per module" | Module-level assignments were removed with TeacherAssignment |
| §10 Roles: Coordinator (line 289) | "Approves or rejects signed reports" | No signed report workflow; coordinator approves/rejects via ApprovalDecision |
| §10 Roles: Moderator (line 304) | "Uploads HOD-signed report PDFs" | Removed |
| §11 Workflow (line 338) | "Upload signed report → Coordinator Decision" | No signed report upload |
| §11 Workflow (line 350-358) | Full 10-state QuestionBankStatus diagram | 4-phase + 3-record-status model |
| §11 Workflow (line 358) | "All states can fast-lock to LOCKED. No exits from LOCKED." | Lock is reversible; unlock API exists |

### 2. `docs/architecture/system-overview.md` — 3 outdated references

| Section | Problem | Replacement |
|---|---|---|
| Domain Model Diagram | `QuestionBankQuestion` shown as bridge | `QuestionSlot` is the linkage |
| MinIO Buckets (line ~80) | `signed-reports` bucket listed | Removed; 5 buckets remain |
| Module listing | `question-bank-questions/` module listed | No such module |

### 3. `docs/api/reference.md` — 5 outdated references

| Section | Problem | Replacement |
|---|---|---|
| `GET /api/question-bank-questions` | Route no longer exists | Use slot list API |
| `POST /api/question-bank-questions` | Route no longer exists | Use slot assign API |
| `POST /api/question-banks/[id]/signed-report` | Route no longer exists | Removed |
| `POST /api/question-banks/[id]/signed-report/presign` | Route no longer exists | Removed |
| `ReportService.uploadSignedReport()` | Service method no longer exists | Removed |

### 4. `docs/domains/question-domain.md` — 2 outdated references

| Section | Problem | Replacement |
|---|---|---|
| Entity list | `QuestionBankQuestion` as join entity | `QuestionSlot` is primary linkage mechanism |
| Workflow steps | References `POST /api/question-bank-questions` | Use slot assignment API |

### 5. `docs/domains/exam-domain.md` — 3 outdated references

| Section | Problem | Replacement |
|---|---|---|
| QuestionBank fields | `signedReportAssetId`, `signedReportUploadedAt` | These fields no longer exist |
| Status transitions | Full 10-state QuestionBankStatus diagram | 4-phase model |
| Transition table | `AWAITING_HOD_SIGN`, `SIGNED_REPORT_UPLOADED` | Removed |

### 6. `docs/developer/onboarding.md` — 3 outdated references

| Section | Problem | Replacement |
|---|---|---|
| Invariants | "10-state bank lifecycle" | 4-phase lifecycle |
| Invariants | "Locked banks are terminal (no unlock)" | unlock API exists |
| Modules | `question-bank-questions/` listed | No such module |

### 7. `docs/rbac-matrix.md` — 1 outdated reference

| Section | Problem | Replacement |
|---|---|---|
| Capability row | "Upload signed HOD report" — MODERATOR | Removed capability |

### 8. `docs/production-checklist.md` — 1 outdated reference

| Section | Problem | Replacement |
|---|---|---|
| Security validation | "Coordinator decision APPROVED sets status to APPROVED (not LOCKED)" | Now sets phase to COMPLETE |

### 9. `docs/security-checklist.md` — 1 outdated reference

| Section | Problem | Replacement |
|---|---|---|
| Access control | "Question bank status transitions enforce state machine" | References old 10-state machine |

### 10. `AGENTS.md` — 3 outdated references

| Section | Problem | Replacement |
|---|---|---|
| Rules (line ~30) | "126-slot template" as computational pattern text is fine but references QuestionBankQuestion join table | `QuestionSlot` is only linkage |
| Fix table (line ~135) | "New module `question-bank-questions/`" | Module does not exist on disk |
| New modules table (line ~157) | `question-bank-questions/` listed | Does not exist |

### 11. `EMQPGS-Complete-Operational-Workflow.md` — 5 outdated references

| Section | Problem | Replacement |
|---|---|---|
| Part 5 Step 8 | "Upload Signed Report (HOD Sign-off)" full 3-step process | Removed |
| Part 6 | Full 10-state status model with transition arrows | 4-phase model |
| Part 6 | `SIGNED_REPORT_UPLOADED` status | Removed |
| Part 6 | `AWAITING_HOD_SIGN` status | Removed |
| Part 4 Step 4 | `QuestionBankQuestion` join record creation | `QuestionSlot` assignment |

---

## Warnings (information is misleading but not fully wrong)

| File | Section | Issue |
|---|---|---|
| `docs/domains/question-domain.md` | Question status 6-state machine | Status values are correct but descriptions don't mention that moderation is slot-scoped, not question-scoped |
| `docs/domains/exam-domain.md` | Lock semantics | Says LOCKED has no outgoing transitions — code has unlock API |
| `docs/developer/onboarding.md` | Lock semantics | Says locked banks are terminal — code has unlock API |
| `README.md` | Known limitations (§12) | Multiple items reference architecture code doesn't have (lock bypass, password hash leak, no dean review update) |

---

## Outdated docs to delete or archive

| File | Action | Reason |
|---|---|---|
| `docs/api/reference.md` | **Rewrite completely** | Describes deleted routes, old entity names |
| `docs/architecture/system-overview.md` | **Rewrite completely** | Domain model diagram references removed entities |
| `docs/domains/question-domain.md` | **Rewrite completely** | References QuestionBankQuestion, old workflow |
| `docs/domains/exam-domain.md` | **Rewrite completely** | 10-state machine, signed report workflow |
| `docs/developer/onboarding.md` | **Rewrite completely** | Multiple outdated architecture references |
| `docs/rbac-matrix.md` | **Update** | Remove signed report row |
| `docs/production-checklist.md` | **Update** | Fix status references |
| `docs/security-checklist.md` | **Update** | Fix state machine references |
| `docs/domains/academic-domain.md` | **Review only** | Academic entities unchanged |
| `docs/domains/production-domain.md` | **Review only** | Production entities unchanged |
| `docs/deployment-guide.md` | **Keep** | Still accurate |
| `docs/monitoring-guide.md` | **Keep** | Still accurate |
| `docs/audits/` | **Keep (archive)** | Historical record of migration |
| `docs/archive/` | **Keep (archive)** | Historical record |
| `EMQPGS-Complete-Operational-Workflow.md` | **Rewrite or archive** | References deleted workflow |
| `AGENTS.md` | **Update** | References deleted modules |
| `README.md` | **Rewrite completely** | 16+ outdated architecture references |

---

## Summary

| Severity | Count |
|---|---|
| Critical (wrong architecture) | 44 references across 11 files |
| Warning (misleading) | 8 references |
| Outdated (should be rewritten) | 7 primary docs + README + AGENTS |
| Correct (keep as-is) | 6 files |
