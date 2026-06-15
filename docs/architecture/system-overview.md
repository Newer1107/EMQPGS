# EMQPGS — System Overview

Current architecture as of June 2026.

---

## Domain Model (High-Level)

```
AcademicYear
└── Semester
    ├── Subject ─── SubjectVersion ─── QuestionLibraryItem
    │                                    ├── QuestionOwnershipHistory
    │                                    ├── QuestionRevision
    │                                    ├── QuestionUsageHistory
    │                                    └── QuestionBankQuestion → QuestionBank
    │                                                                  ├── AiReport
    │                                                                  ├── GeneratedPaper (A, B, C)
    │                                                                  ├── DeanReview
    │                                                                  ├── ExportArtifact
    │                                                                  └── ModeratorBankAssignment
    └── ExamCycle ─── QuestionBank
```

Four domains: **Academic**, **Question**, **Exam**, **Production**. Each is documented separately in `docs/domains/`.

---

## Service Boundaries

| Service Module | Responsibility | Key Methods |
|---|---|---|
| `academic-years/` | AcademicYear CRUD + findCurrent | `list`, `create`, `findById`, `update` |
| `semesters/` | Semester CRUD, query by academic year | `list`, `create`, `findById`, `update`, `findByAcademicYear` |
| `subject-versions/` | SubjectVersion CRUD, auto-versioning, archiving | `findBySubject`, `create`, `archive`, `findActiveBySubject` |
| `coordinator/` | Subject + question bank orchestration, assignments | `createSubject`, `listSubjects`, `initializeQuestionBank`, `assignContributor`, `lockQuestionBank`, dashboard queries |
| `question-banks/` | QuestionBank CRUD, status transitions | `create`, `updateStatus`, `findById` |
| `question-library/` | QuestionLibraryItem CRUD, ownership, history | `create`, `search`, `update`, `submit`, `transferOwnership`, `getUsageStats`, `getFullDetail` |
| `moderation/` | Question moderation workflows | `listQuestions`, `approveQuestion`, `rejectQuestion`, `requestRevision` |
| `reports/` | AI analysis, paper generation, signed reports | `createAiReport`, `generatePapers`, `uploadSignedReport`, `coordinatorDecision` |
| `production/` | Dean review, exports, monitoring, backups | `submitDeanReview`, `createExport`, `getObservabilityOverview`, `runSystemBackup` |
| `notifications/` | In-app + email notifications | `createAndEmail`, `listForUser`, `markAsRead` |
| `users/` | User CRUD, credentials | `list`, `create`, `update`, `verifyCredentials` |
| `departments/` | Department CRUD | `list`, `create`, `update`, `delete` |
| `dashboard/` | Role-specific dashboard aggregation | `getRoleDashboard` |

---

## Data Flow

### Request Flow (API → Service → Database)

```
Browser → proxy.ts (JWT guard, role gate)
       → app/api/.../route.ts (Zod validation)
       → withApiHandler (CSRF check, RBAC, rate limit, audit wrapper)
           → Service method (business logic, calls repository or Prisma directly)
               → Prisma ORM → MySQL
               → StorageService → MinIO (for attachments, reports, exports)
           ← Response envelope { success, data } | { success, error }
```

### Workflow Data Flow

```
Subject creation → auto-creates SubjectVersion v1
Question creation → QuestionLibraryItem + QuestionRevision (initial snapshot)
Submit for moderation → status → PENDING
Moderator action → status change + ModerationEvent + Notification
AI report → AnalysisEngine + optional Ollama → PDF/JSON to MinIO
Paper generation → PaperGenerator.select() + PdfService → PDF to MinIO
Dean review → variant selection
Export → DocumentService (PDF/DOCX/ZIP) → MinIO exports bucket
```

### Audit Data Flow

```
every mutating API call
  → logAudit({ actorId, action, entityType, entityId, metadata })
    → reads previous AuditLog entry (SHA-256 of last entry)
    → computes integrityHash = SHA-256(previousHash + payload)
    → appends new AuditLog row
```

---

## Authorization Model

Two-layer RBAC:

1. **Middleware layer** (`proxy.ts`): Route-level role gating for `/dashboard/<role>` dashboards. Blocks unauthorized page access at the network boundary.

2. **Handler layer** (`withApiHandler({ roles: [...] })`): Operation-level role check. Every API route declares which roles can call it.

3. **Object-level checks**: Some services verify department access (`DepartmentAccessUtils`) or moderator bank assignment (`ModeratorBankAssignment`) before returning data.

Roles: `COE`, `COORDINATOR`, `MODERATOR`, `CONTRIBUTOR`, `DEAN`. See `docs/domains/` for per-role capabilities.

---

## Audit Model

- Append-only `AuditLog` table — no updates, no deletes
- SHA-256 hash chain: each entry stores `previousHash` (of prior entry) + `integrityHash` (of self)
- Audit wrapper in `withApiHandler` — every state-changing route auto-creates an entry
- Request body is NOT auto-captured (prevents accidental logging of sensitive data)
- IP address and user agent recorded for every operation
- Viewable by COE role via `/api/audit-logs`

---

## Infrastructure

| Component | Production Setup |
|---|---|
| Database | MySQL 8.x (managed) |
| Object Storage | MinIO (6 buckets) |
| Container | `node:24-alpine`, includes `mysql-client` for backups |
| AI | Ollama (optional, deterministic analysis runs without it) |
| Auth | JWT (HS256) + Auth.js credentials provider |

### MinIO Buckets

| Bucket | Purpose |
|---|---|
| `question-bank-attachments` | Contributor question uploads |
| `signed-reports` | HOD-signed report PDFs |
| `generated-papers` | Paper variants (A, B, C) |
| `exports` | Final exam packets + AI reports |
| `audit-files` | Audit export artifacts |
| `system-backups` | `mysqldump` backups |

### Security Headers

Set globally in `next.config.ts`: CSP (`connect-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, strict `Permissions-Policy`.

> **Dev note**: In development (`NODE_ENV=development`), `'unsafe-eval'` is conditionally added to `script-src` to support Next.js webpack HMR and React dev tools. This is stripped in production. See `docs/security-checklist.md` for rationale.
