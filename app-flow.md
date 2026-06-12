# EMQPGS - Complete Application Flow

## Overview

EMQPGS manages the full exam-paper lifecycle:

1. COE configures departments, users, and exam cycles
2. Coordinators manage subjects, question banks, and assignments
3. Contributors draft and submit questions with attachments
4. Moderators approve, reject, or request revisions
5. Coordinators trigger AI analysis and paper generation
6. Dean reviews generated papers and selects regular, supplementary, and KT variants
7. COE exports final artifacts, monitors the platform, and closes operational cycles

Current implementation note:
- The repository does **not** use BullMQ, Redis, or background worker processes.
- AI analysis, paper generation, exports, backups, and cleanup run through application services and request-time or manually triggered flows.

## System Architecture Summary

```text
Browser (Next.js App Router)
        ↓
Route Handlers (app/api)
        ↓
Service Layer (src/modules)
        ↓
Prisma ORM
        ↓
MySQL

Operational Services:
  - AI analysis via Ollama-backed services
  - Export and report generation in application services
  - Backup and cleanup invoked through application endpoints/services

File Storage:
  - MinIO with signed upload/download URLs

Security:
  - Auth.js credentials + JWT cookies
  - CSRF on mutating routes
  - RBAC in proxy and handlers
  - Rate limiting in shared API handler
```

## Phase 0: Authentication

- Users sign in at `/login`
- Client fetches `GET /api/auth/csrf`
- Client posts credentials to `POST /api/auth/login`
- Server validates CSRF, verifies password hash, issues access and refresh cookies, and redirects to the role dashboard
- Refresh and logout use `POST /api/auth/refresh` and `POST /api/auth/logout`
- Password reset uses `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`

## Phase 1: COE Setup

### Departments

- COE creates departments from `/dashboard/coe/departments`
- Result: department record stored in MySQL and audited

### Users

- COE creates users from `/dashboard/coe/users`
- Result: hashed password stored, role assigned, optional department linked, audit entry created

### Exam Cycles

- COE creates and updates exam cycles from `/dashboard/coe/exam-cycles`
- Active-cycle conflicts are validated before activation
- Cycle state transitions are audited

## Phase 2: Coordinator Setup

### Subjects

- Coordinators create and manage subjects from `/dashboard/coordinator/subjects`
- Subjects are linked to departments and used as the basis for question banks

### Question Banks

- Coordinators initialize question banks for a subject + cycle combination
- The application materializes the 126-slot template on demand through question-slot services

### Assignments

- Coordinators assign moderators and contributors to question banks
- Assignment changes trigger in-app notifications

## Phase 3: Contributor Workflow

- Contributors view assigned workspaces
- They reserve a slot, save a draft, upload attachments through signed URLs, and submit questions
- Submission changes question state to `SUBMITTED` and notifies moderators

## Phase 4: Moderator Workflow

- Moderators review submitted questions
- Actions:
  - approve
  - reject with reason
  - request revision with remarks
  - override previously approved questions while the bank remains mutable
- Moderation actions update question state, notify contributors, and write audit entries

## Phase 5: Coordinator Analysis And Paper Generation

### AI Analysis

- Coordinator triggers `POST /api/question-banks/[id]/reports`
- Report service computes deterministic analysis, invokes Ollama for summary overlay, stores JSON/PDF assets in MinIO, and persists the AI report record

### Paper Generation

- Coordinator triggers `POST /api/question-banks/[id]/papers`
- Report service selects approved questions, enforces balance and uniqueness constraints, stores generated papers, and updates usage history

## Phase 6: Dean Review

- Dean opens `/dashboard/dean/review` or `/dashboard/dean/reports`
- The app shows generated papers plus scores and recommendations
- Dean submits distinct regular, supplementary, and KT selections through `POST /api/question-banks/[id]/dean-review`

## Phase 7: COE Production

### Exports

- COE opens `/dashboard/coe/production`
- COE triggers PDF, DOCX, or ZIP exports using `POST /api/exports`
- Production service generates the artifact immediately, uploads to MinIO, stores an export record, and exposes a signed download URL through `GET /api/exports/[id]/download`

### Monitoring

- COE monitors `/dashboard/coe/monitoring`
- `GET /api/health` returns service health
- `GET /api/monitoring` returns workflow, storage, and system metrics aligned to the no-worker architecture

### Backups And Cleanup

- COE can trigger manual backups via `POST /api/backups`
- Backup execution runs `mysqldump`, stores the resulting file in MinIO, and records status in MySQL
- Cleanup is an application service that expires old exports and backups when invoked

## Phase 8: Cycle Closure

- COE transitions an exam cycle to closed
- Related banks become locked
- Locked banks reject further edits, moderation changes, and content mutation

## Storage Flow

```text
question-bank-attachments
  ← contributor uploads via signed URL
  → contributor/moderator/coordinator downloads via signed URL

signed-reports
  ← AI report JSON/PDF uploads
  → coordinator/COE access

generated-papers
  ← generated paper assets
  → coordinator/COE/Dean access

exports
  ← COE export artifacts
  → COE signed downloads

audit-files
  ← audit export artifacts

system-backups
  ← backup files generated by the application
```

## End-To-End Lifecycle Summary

```text
COE
  → Departments
  → Users
  → Exam Cycles

Coordinator
  → Subjects
  → Question Banks
  → Assignments

Contributor
  → Draft
  → Submit
  → Revise

Moderator
  → Approve / Reject / Request Revision / Override

Coordinator
  → AI Analysis
  → Paper Generation

Dean
  → Review generated papers
  → Select regular / supplementary / KT

COE
  → Export PDF / DOCX / ZIP
  → Monitor
  → Backup
  → Close cycle
```
