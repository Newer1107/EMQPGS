# EMQPGS — Documentation Index

Navigation hub for the active documentation set. Historical records in `archive/`.

---

## Core documents

| Document | What it covers |
|---|---|
| [README.md](../README.md) | Project overview, core concepts, workflow, setup, testing |
| [architecture.md](architecture.md) | Domain model, entity relationships, workflow, readiness, paper generation, snapshots, approval, service graph, invariants |
| [database.md](database.md) | Every table, purpose, relationships, ownership rules, invariants, enum reference |
| [api.md](api.md) | All active routes with request/response shapes, permissions, error codes |
| [workflow.md](workflow.md) | Phase transitions, ReadinessEngine rules, locking, approval, rejection loopback, paper generation lifecycle |
| [onboarding.md](onboarding.md) | 30-minute developer orientation |

## Reference

| Document | What it covers |
|---|---|
| [rbac-matrix.md](rbac-matrix.md) | Role capability matrix (5 roles x capabilities) |
| [deployment-guide.md](deployment-guide.md) | Dev, staging, and production setup |
| [security-checklist.md](security-checklist.md) | Auth, CSRF, rate limiting, input validation, access control, audit trail, security headers |
| [production-checklist.md](production-checklist.md) | Pre-go-live validation steps |
| [monitoring-guide.md](monitoring-guide.md) | Health check, monitoring endpoints, operational checks |

## Architecture Decision Records

| Document | Topic |
|---|---|
| [adr/ADR-001-question-slot-replaces-question-bank-question.md](adr/ADR-001-question-slot-replaces-question-bank-question.md) | QuestionSlot as sole linkage mechanism |
| [adr/ADR-002-question-bank-phase-and-record-status.md](adr/ADR-002-question-bank-phase-and-record-status.md) | Two-axis state model replacing 10-state enum |
| [adr/ADR-003-signed-report-workflow-removal.md](adr/ADR-003-signed-report-workflow-removal.md) | Removal of signed report workflow |
| [adr/ADR-004-readiness-engine-and-manual-advancement.md](adr/ADR-004-readiness-engine-and-manual-advancement.md) | Advisory ReadinessEngine, manual phase advancement |
| [adr/ADR-005-snapshot-architecture.md](adr/ADR-005-snapshot-architecture.md) | QuestionBankSnapshot and PaperSnapshot |

## Historical records

| Location | Contents |
|---|---|
| [archive/](archive/) | Migration reports, audit reports, refactor notes, superseded role guides |
| [audits/](audits/) | Workflow verification and post-fix audits |
| [gap-report.md](gap-report.md) | Documentation audit findings (2026-06-15) |
