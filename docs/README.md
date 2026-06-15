# EMQPGS — Documentation Index

Navigation hub for the active documentation set. Historical records are in `archive/`.

---

## Start Here

| Document | What it covers |
|---|---|
| [README.md](../README.md) | Project overview, current architecture, tech stack, setup, roles, workflow, limitations, roadmap |
| [architecture/system-overview.md](architecture/system-overview.md) | Domain model diagram, service boundaries, data flow, request flow, authorization model, audit model, infrastructure |

## Domain Docs

| Document | Entities covered |
|---|---|
| [domains/academic-domain.md](domains/academic-domain.md) | AcademicYear, Semester, Subject, SubjectVersion |
| [domains/question-domain.md](domains/question-domain.md) | QuestionLibraryItem, QuestionOwnershipHistory, QuestionRevision, QuestionUsageHistory, ModerationEvent, QuestionBankQuestion |
| [domains/exam-domain.md](domains/exam-domain.md) | ExamCycle, QuestionBank, GeneratedPaper, GeneratedPaperItem, DeanReview, ExportArtifact |
| [domains/production-domain.md](domains/production-domain.md) | DeanReviewService, ExportService, MonitoringService, BackupService, DocumentService |

## Developer Docs

| Document | What it covers |
|---|---|
| [developer/onboarding.md](developer/onboarding.md) | 30-minute orientation: architecture, data model, workflow, services, repos, API structure, testing, commands |
| [api/reference.md](api/reference.md) | All ~55 API route files, ~90 endpoints, with method, roles, request body, service handler |

## Reference

| Document | What it covers |
|---|---|
| [rbac-matrix.md](rbac-matrix.md) | Role capability matrix (5 roles × 24 capabilities) |
| [deployment-guide.md](deployment-guide.md) | Dev, staging, and production setup |
| [security-checklist.md](security-checklist.md) | Auth, CSRF, rate limiting, input validation, access control, audit trail, security headers |
| [production-checklist.md](production-checklist.md) | Pre-go-live validation steps |
| [monitoring-guide.md](monitoring-guide.md) | Health check, monitoring endpoints, operational checks |

## Historical Records

| Location | Contents |
|---|---|
| [archive/](archive/) | Migration reports, audit reports, refactor notes, superseded role guides, temp implementation notes |
