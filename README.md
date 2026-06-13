# EMQPGS — Examination Management & Question Paper Generation System

A full-stack, role-driven platform for managing the complete lifecycle of academic examination paper creation — from department setup and question authoring through AI-assisted analysis, automated paper generation, dean review, and final export — built with Next.js, TypeScript, Prisma, MySQL, Auth.js, MinIO, and Ollama.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Role-Based Access Control](#role-based-access-control)
5. [Feature Walkthrough](#feature-walkthrough)
   - [Authentication & Security](#authentication--security)
   - [COE — Controller of Examinations](#coe--controller-of-examinations)
   - [Coordinator](#coordinator)
   - [Contributor](#contributor)
   - [Moderator](#moderator)
   - [AI Analysis Engine](#ai-analysis-engine)
   - [Paper Generation Engine](#paper-generation-engine)
   - [Dean Review](#dean-review)
   - [COE Production & Exports](#coe-production--exports)
   - [Monitoring & Observability](#monitoring--observability)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Environment Variables](#environment-variables)
9. [Project Structure](#project-structure)
10. [Getting Started](#getting-started)
11. [Docker & Deployment](#docker--deployment)
12. [Testing](#testing)
13. [Security Hardening](#security-hardening)
14. [Documentation Index](#documentation-index)
15. [Seed Users](#seed-users)
16. [NPM Scripts](#npm-scripts)
17. [Design Decisions & Conventions](#design-decisions--conventions)
18. [Notes & Operational Considerations](#notes--operational-considerations)

---

## Project Overview

EMQPGS digitises and streamlines the end-to-end process of creating, moderating, analysing, and finalising university-level examination question papers. It replaces ad-hoc spreadsheets, email chains, and manual paper assembly with a structured, auditable, role-separated digital workflow.

The system enforces a strict five-role hierarchy:

| Role | Responsibility |
|------|----------------|
| **COE** (Controller of Examinations) | Platform administration, department/user/cycle management, final export, backups, monitoring |
| **Coordinator** | Subject management, question bank initialisation, teacher assignments, triggering AI reports and paper generation, coordinator decisions |
| **Contributor** (Faculty) | Drafting and submitting questions within assigned modules and mark slots, handling revision requests |
| **Moderator** | Reviewing, approving, rejecting, or requesting revisions on submitted questions; uploading signed HOD reports |
| **Dean** | Reviewing AI-generated paper variants (A/B/C), selecting papers for regular, supplementary, and KT examinations |

Each question bank is initialised with a **126-slot coordinate grid** (6 modules × 3 mark categories × 7 slots each), ensuring complete coverage planning before a single question is drafted. AI-powered deterministic analysis evaluates coverage, quality, and Bloom's taxonomy balance, with an optional Ollama-generated natural-language summary overlay. A constraint-based paper generator then assembles three distinct paper variants (A, B, C) that avoid cross-paper duplication, maintain module balance, respect historical exclusions, and track usage across exam cycles.

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.7 | React framework with App Router |
| React | 19.2.4 | UI library |
| TypeScript | ^5 | Type-safe development |
| Tailwind CSS | ^4 | Utility-first CSS framework with `@tailwindcss/postcss` |
| Radix UI | ^1–^2 | Accessible, unstyled UI primitives (dialog, dropdown-menu, label, select, slot, tabs, toast) |
| Lucide React | ^1.17.0 | Icon library |
| Sonner | ^2.0.7 | Toast notification system |
| React Hook Form | ^7.78.0 | Performant form state management |
| @hookform/resolvers | ^5.4.0 | Zod schema resolver for React Hook Form |
| class-variance-authority | ^0.7.1 | Type-safe component variant API |
| clsx | ^2.1.1 | Conditional class name utility |
| tailwind-merge | ^3.6.0 | Tailwind class conflict resolver |

### Backend (Next.js Route Handlers)
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js Route Handlers | 16.2.7 | RESTful API endpoints |
| Prisma ORM | ^6.16.2 | Type-safe database client and migration engine |
| MySQL | 8.4 | Relational database (via Docker or external) |
| Zod | ^4.4.3 | Runtime schema validation for all inputs |
| jose | ^6.2.3 | JWT signing and verification (HMAC-SHA256) |
| bcryptjs | ^3.0.3 | Password hashing (12 salt rounds) |
| date-fns | ^4.4.0 | Date formatting and manipulation |
| uuid | ^14.0.0 | UUID generation for file assets and resources |

### Authentication
| Technology | Version | Purpose |
|------------|---------|---------|
| Auth.js (next-auth) | 5.0.0-beta.31 | Authentication framework with credentials provider |
| Custom JWT Layer | — | Dual access + refresh token cookies with session idle timeout |
| Custom CSRF Layer | — | HMAC-SHA256 signed tokens, cookie + header verification, origin check |

### Storage
| Technology | Version | Purpose |
|------------|---------|---------|
| MinIO | Latest | S3-compatible object storage (6 buckets) |
| @aws-sdk/client-s3 | ^3.1064.0 | S3 API client for presigned URLs |
| @aws-sdk/lib-storage | ^3.1064.0 | Multipart upload support |
| @aws-sdk/s3-request-presigner | ^3.1064.0 | Presigned URL generation |
| minio (JS client) | ^8.0.7 | MinIO-specific client operations |

### Document Generation & AI
| Technology | Version | Purpose |
|------------|---------|---------|
| pdf-lib | ^1.17.1 | Server-side PDF generation for reports and exam papers |
| docx | ^9.7.1 | Server-side DOCX generation for exam papers |
| jszip | ^3.10.1 | ZIP bundle creation for multi-format exports |
| Ollama | — | Local LLM runtime for AI summary overlays on analysis reports |

### Development & Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | ^3.2.4 | Test runner and assertion library |
| ESLint | ^9 | Static code analysis with `eslint-config-next` |
| tsx | ^4.22.4 | TypeScript execution for seeding and scripts |
| Docker | — | Containerised infrastructure (MySQL, MinIO, app) |

---

## System Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────┐
│                   app/                           │
│  ┌──────────┐  ┌──────────────────────────────┐ │
│  │  Pages   │  │       API Route Handlers      │ │
│  │ (React)  │  │  (63 route.ts files, ~95 ops) │ │
│  └──────────┘  └──────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│                 src/modules/                     │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐ │
│  │   Services   │  │Repositories│  │Validation │ │
│  │ (business    │  │ (DB access│  │(Zod schemas│ │
│  │  logic)      │  │  layer)   │  │ for inputs)│ │
│  └──────────────┘  └──────────┘  └───────────┘ │
├─────────────────────────────────────────────────┤
│                  src/lib/                        │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │api-handler│ │audit │ │csrf  │ │rate-limit │  │
│  └──────────┘ └──────┘ └──────┘ └───────────┘  │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │  jwt.ts  │ │auth  │ │logger│ │ env.ts    │  │
│  └──────────┘ └──────┘ └──────┘ └───────────┘  │
├─────────────────────────────────────────────────┤
│                 prisma/                          │
│  ┌──────────────┐ ┌────────┐ ┌──────────────┐  │
│  │schema.prisma │ │seed.ts │ │ migrations/  │  │
│  │  (23 models) │ │        │ │  (3 applied) │  │
│  └──────────────┘ └────────┘ └──────────────┘  │
└─────────────────────────────────────────────────┘
```

### Architectural Patterns

- **Feature-based modular architecture**: Each domain concern (users, subjects, questions, moderation, reports, production, etc.) is isolated in `src/modules/<feature>/` with its own service, repository, and validation files.
- **Repository-Service pattern**: Repositories handle raw Prisma database queries; services encapsulate business logic, orchestrate multiple repository calls, and enforce domain rules. Route handlers delegate to services.
- **Centralised API handler wrapper** (`src/lib/api-handler.ts`): Every API route is wrapped in `withApiHandler()`, which provides rate limiting, CSRF verification, role-based access control (RBAC), structured error handling, audit logging, and request/response logging in a single middleware-like pipeline.
- **Validation at every boundary**: Zod schemas validate all incoming request bodies, query parameters, and path parameters. Services receive already-validated data.
- **RBAC at two levels**: (1) `proxy.ts` middleware blocks unauthorised route access by decoding the JWT cookie; (2) `withApiHandler()` enforces server-side role checks for each API operation.
- **Append-only audit trail**: All mutating operations are logged with a SHA-256 hash chain for integrity verification.
- **Structured JSON logging**: All logs (info, warn, error) are emitted as JSON objects for machine consumption.

### Request Lifecycle

```
Client Request
  │
  ▼
proxy.ts middleware ─── JWT decode → redirect if unauthenticated
  │                        or role-mismatched
  ▼
withApiHandler() ─── rate limit check → CSRF verification (mutations)
  │                  → RBAC check → parse body → delegate to service
  ▼
Module Service ─── business logic, validation, repository calls
  │
  ▼
Module Repository ─── Prisma queries → MySQL
  │
  ▼
Response + audit log entry (mutations)
```

### Detailed directory references

- `docs/architecture.md` — Full architecture documentation
- `docs/architecture-diagram.md` — Visual architecture diagram with component relationships
- `docs/api-documentation.md` — Complete API reference with request/response schemas

---

## Role-Based Access Control

```
  COE ──────► Full platform administration
               ↓
  Coordinator ──► Subject & bank management, teacher assignment,
                  AI/paper triggers, coordinator decisions
               ↓
  Contributor ──► Question drafting & submission within assigned
                  modules and mark slots
               ↓
  Moderator ──► Question review, approval, rejection, revision
                requests, signed HOD report upload
               ↓
  Dean ──────► Paper variant review and exam paper selection
```

### RBAC Matrix (Complete)

| Capability | COE | Coordinator | Moderator | Contributor | Dean |
|---|---|---|---|---|---|
| Login, logout, JWT refresh | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forgot / reset password | ✓ | ✓ | ✓ | ✓ | ✓ |
| View role-based dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage users (CRUD, disable) | ✓ | — | — | — | — |
| Manage departments (CRUD) | ✓ | — | — | — | — |
| Manage exam cycles (create, activate, close) | ✓ | — | — | — | — |
| View exam cycles | ✓ | ✓ | — | — | — |
| Manage subjects (CRUD, link to cycle, deactivate) | ✓ | ✓ | — | — | — |
| Initialise question banks (126-slot grid) | — | ✓ | — | — | — |
| Update question bank status | ✓ | ✓ | ✓ | — | — |
| Lock question bank (immutable) | — | ✓ | — | — | — |
| Assign teachers (moderator + contributor) | — | ✓ | — | — | — |
| Remove / reassign teacher assignments | — | ✓ | — | — | — |
| Notify contributors of assignments | — | ✓ | — | — | — |
| View all questions in a bank | — | ✓ (read-only) | ✓ | Own questions only | — |
| Draft questions | — | — | ✓ (override) | ✓ | — |
| Reserve / release question slots | — | — | ✓ (override) | ✓ | — |
| Submit questions for moderation | — | — | — | ✓ | — |
| Edit own draft questions | — | — | ✓ | ✓ | — |
| Add / manage question attachments | — | — | ✓ | ✓ | — |
| Download question attachments | ✓ | ✓ | ✓ | ✓ | — |
| Moderate questions (approve, reject, request revision) | — | — | ✓ | — | — |
| Override approved questions to pending | — | — | ✓ | — | — |
| View moderation queue with filters | — | — | ✓ | — | — |
| Upload signed HOD report | — | — | ✓ | — | — |
| Trigger AI analysis reports | ✓ | ✓ | ✓ | — | — |
| View AI analysis reports | ✓ | ✓ | ✓ | — | ✓ |
| Trigger paper generation (A/B/C) | ✓ | ✓ | — | — | — |
| View generated papers | ✓ | ✓ | ✓ | — | ✓ |
| Coordinator decision (approve/reject report) | — | ✓ | — | — | — |
| Dean review: select exam papers | — | — | — | — | ✓ |
| View dean selections | ✓ | ✓ | — | — | ✓ |
| Export PDF / DOCX / ZIP | ✓ | — | — | — | — |
| Download export artifacts | ✓ | — | — | — | — |
| Trigger database backup | ✓ | — | — | — | — |
| View system monitoring dashboard | ✓ | — | — | — | — |
| View health endpoint | ✓ | ✓ | ✓ | ✓ | ✓ (public, optional token) |
| View audit logs | ✓ | — | — | — | — |
| View in-app notifications | ✓ | ✓ | ✓ | ✓ | ✓ |

Full reference: `docs/rbac-matrix.md`

---

## Feature Walkthrough

### Authentication & Security

**Login Flow:**
1. Client fetches CSRF token via `GET /api/auth/csrf`
2. Client submits email + password + CSRF token to `POST /api/auth/login`
3. Server verifies credentials (bcrypt, 12 rounds), generates JWT access token (default 15-minute TTL) and JWT refresh token (default 7-day TTL)
4. Tokens are set as `HttpOnly`, `Secure`, `SameSite=Lax` cookies: `emqpgs_access_token` and `emqpgs_refresh_token`
5. A new CSRF token is issued and stored in a readable cookie (`emqpgs_csrf_token`) for client-side injection
6. Login event is recorded in the append-only audit log

**Token Refresh Flow:**
1. When the access token expires, client calls `POST /api/auth/refresh`
2. Server verifies the refresh token signature, expiry, and session idle timeout (default 30 minutes from last activity)
3. If valid, a new access token is issued; refresh token rotation is handled transparently
4. If the idle timeout has been exceeded, the refresh token is rejected (full re-login required)

**Password Reset Flow:**
1. User requests reset via `POST /api/auth/forgot-password` with email
2. Server generates a SHA-256 hashed reset token with 30-minute expiry
3. In development mode, the raw token is returned in the response for testing; in production, it would be emailed
4. User submits new password + token to `POST /api/auth/reset-password`
5. Server verifies token hash and expiry, updates password hash

**CSRF Protection:**
- Every mutating request (POST, PUT, PATCH, DELETE) must include both:
  - `emqpgs_csrf_token` cookie (set by server)
  - `x-csrf-token` request header (set by client)
- Server verifies HMAC-SHA256 signature match between cookie and header
- Origin/referer header is verified against the configured `AUTH_URL`
- `src/lib/client-fetch.ts` provides a client-side fetch wrapper that automatically injects the CSRF header from the cookie

**Rate Limiting:**
- In-memory rate limiter with SHA-256 hashed client keys (default: 120 requests per 60-second window)
- Configurable via `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`
- Applied to all API routes through `withApiHandler()`

**Session Idle Timeout:**
- Refresh tokens are rejected if the user has been inactive for longer than `SESSION_IDLE_TIMEOUT_MINUTES` (default 30 minutes)
- The `iat` (issued-at) claim on the refresh token tracks the last activity timestamp

**Audit Trail:**
- All mutating operations are recorded in the `AuditLog` table with:
  - Actor ID (the user who performed the action)
  - Action type (e.g., `LOGIN`, `CREATE_QUESTION`, `APPROVE_QUESTION`)
  - Resource type and resource ID
  - Metadata (request details, old/new values)
  - IP address and user agent
- Each log entry includes a SHA-256 hash of the previous entry, forming an **append-only integrity chain**
- Audit logs are viewable only by COE users via `GET /api/audit-logs`

---

### COE — Controller of Examinations

The COE is the super-administrator role responsible for platform setup, user management, organisational structure, and final production controls.

**User Management:**
- **List users**: `GET /api/users` — returns all users with role, department, and status. Coordinators can also list users (for assignment purposes).
- **Create user**: `POST /api/users` — name, email, password, role, department assignment. Password is bcrypt-hashed with 12 salt rounds.
- **Update user**: `PATCH /api/users/[id]` — update name, email, role, department, or reset password.
- **Disable user**: `DELETE /api/users/[id]` — soft-disable (sets `status = DISABLED`). Disabled users cannot log in but their historical data (questions, moderation events, audit logs) is preserved.

**Department Management:**
- **List departments**: `GET /api/departments` — returns all departments with code, name, HOD name, and active status.
- **Create department**: `POST /api/departments` — department name, code (unique), HOD name.
- **Update department**: `PATCH /api/departments/[id]` — update any field; code uniqueness is enforced.
- **Delete department**: `DELETE /api/departments/[id]` — only if no users are assigned to it.

**Exam Cycle Management:**
- **List exam cycles**: `GET /api/exam-cycles` — returns cycles with academic year, semester, exam type, status, and timetable dates.
- **Create exam cycle**: `POST /api/exam-cycles` — academic year, semester (1–8), exam type (REGULAR/SUPPLEMENTARY/KT), department association, exam timetable dates (start, end, result date).
- **Update exam cycle**: `PATCH /api/exam-cycles/[id]` — update status or timetable fields.
- **Single-active-cycle constraint**: Only one exam cycle per department can be `ACTIVE` at a time. Activating a new cycle automatically deactivates the previous active cycle.

**Exam Types:**
- `REGULAR` — Standard end-of-semester examination
- `SUPPLEMENTARY` — Supplementary / re-examination
- `KT` — Backlog / keep-term examination

**Cycle Statuses:**
- `DRAFT` — Being configured
- `ACTIVE` — Currently in use for question bank creation
- `CLOSED` — Examination completed, archived

**Audit Log Viewer:**
- `GET /api/audit-logs` — returns the last 100 audit log entries with actor, action, resource, timestamp, and metadata.
- COE-exclusive access. Each entry links to its predecessor via SHA-256 hash for integrity.

---

### Coordinator

The Coordinator is the operational manager for each department's examination cycle — responsible for subjects, question banks, teacher assignments, and triggering the AI analysis and paper generation pipelines.

**Dashboard:**
- `GET /api/dashboard` (with Coordinator role) returns:
  - Active exam cycles count
  - Subjects count and status breakdown
  - Question banks with progress (slot fill percentage)
  - Pending teacher assignments
  - Recent AI reports and paper generation results
  - Dean review status

**Subject Management:**
- **List subjects**: `GET /api/subjects` — with optional filters: `departmentId`, `examCycleId`, `status`, `semester`, search by name/code. Supports pagination.
- **Create subject**: `POST /api/subjects` — subject code (unique), subject name, credits, semester, department, question bank due date.
- **Update subject**: `PUT /api/subjects/[id]` (full update) or `PATCH /api/subjects/[id]` (partial update).
- **Link subject to exam cycle**: `POST /api/subjects/[id]/link-cycle` — establishes a many-to-many relationship between a subject and an exam cycle, making the subject eligible for question bank creation under that cycle.
- **Deactivate subject**: `PATCH /api/subjects/[id]/deactivate` — marks subject as inactive; existing question banks are preserved but new ones cannot be created.

**Question Bank Management:**
- **Initialise question bank**: `POST /api/question-banks` — creates a question bank for a subject under a specific exam cycle. Upon creation, the system automatically generates **126 question slots** (6 modules × 3 mark categories × 7 slots each), forming a complete coverage grid. The bank starts in `DRAFT` status.
- **List question banks**: `GET /api/question-banks` — with optional filters: `subjectId`, `examCycleId`, `status`.
- **View question bank detail**: `GET /api/question-banks/[id]` — returns the bank with all 126 slots (showing reserved/filled status), AI reports, generated papers, dean review status, and teacher assignments.
- **Update bank status**: `PATCH /api/question-banks/[id]/status` — transition through: `DRAFT → IN_PROGRESS → READY_FOR_REVIEW → LOCKED`. Moderators can also update status.
- **Lock bank**: `PATCH /api/question-banks/[id]/lock` — sets status to `LOCKED`. Once locked, the bank becomes **immutable**: no new questions can be added, no existing questions can be edited, and no moderation actions can be taken. Locking triggers the bank for AI analysis and paper generation.

**Teacher Assignment Management:**
- **List assignments**: `GET /api/question-banks/[id]/assignments` — returns all moderator and contributor assignments for a bank, grouped by module.
- **Assign contributor**: `POST /api/question-banks/[id]/assignments` — assigns a contributor (faculty) to a specific module in a question bank. Validates that the user has the `CONTRIBUTOR` role. Multiple contributors can be assigned to different modules within the same bank.
- **Assign moderator**: Also handled through `POST /api/question-banks/[id]/assignments` — assigns a moderator to oversee the entire question bank (or specific modules). Validates `MODERATOR` role.
- **Reassign**: `PUT /api/question-banks/[id]/assignments/[assignmentId]` — changes the assigned user or module.
- **Remove assignment**: `DELETE /api/question-banks/[id]/assignments/[assignmentId]` — removes a teacher from the bank. Does not delete their submitted questions.
- **Notify contributor**: `POST /api/question-banks/[id]/assignments/[assignmentId]/notify` — sends an in-app notification to the assigned contributor informing them of their assignment, due dates, and module details.

**Question Bank Status Flow:**
```
DRAFT ──► IN_PROGRESS ──► READY_FOR_REVIEW ──► LOCKED
  │            │                  │                │
  │   Contributors draft    All 126 slots    Immutable;
  │   questions; slots      filled + all     triggers AI
  │   being reserved        questions        analysis &
  │                          moderated        paper gen
  │
  └── Coordinator configures bank settings, assigns teachers
```

**Triggering AI Analysis:**
- `POST /api/question-banks/[id]/reports` — triggers a new AI analysis report for the bank. The report:
  1. Runs the **deterministic analysis engine** (module coverage, CO distribution, RBT/Difficulty breakdown, duplicate detection, quality findings, Bloom's balance)
  2. Optionally calls **Ollama** for a natural-language summary overlay (if Ollama is available at `OLLAMA_BASE_URL`)
  3. Stores the JSON report data in the database and the rendered PDF in MinIO (`generated-papers` bucket)
- `GET /api/question-banks/[id]/reports` — lists all generated AI reports for the bank with status, model, and timestamp.

**Triggering Paper Generation:**
- `POST /api/question-banks/[id]/papers` — triggers paper generation, which produces three distinct variants (Paper A, Paper B, Paper C). See [Paper Generation Engine](#paper-generation-engine) for details.
- `GET /api/question-banks/[id]/papers` — lists all generated papers with scores, recommendations, and PDF asset references.

**Coordinator Decision:**
- `POST /api/question-banks/[id]/coordinator-decision` — after reviewing AI reports and generated papers, the Coordinator can:
  - `APPROVE` — forward the bank and papers to the Dean for final selection
  - `REJECT` — send the bank back for further work (questions need revision, coverage is insufficient)
- Decision is recorded with a reason/comment.

**Signed HOD Report:**
- Moderators upload a signed HOD (Head of Department) approval report via:
  - `POST /api/question-banks/[id]/signed-report/presign` — get a presigned upload URL for the `signed-reports` bucket
  - `POST /api/question-banks/[id]/signed-report` — record the uploaded file asset against the question bank

---

### Contributor

The Contributor (typically a faculty member) drafts exam questions within their assigned modules and mark slots, submits them for moderation, and handles revision requests.

**Dashboard:**
- `GET /api/dashboard` (with Contributor role) returns:
  - Assigned subjects and question banks
  - Slot fill progress per bank (how many of the assigned slots are drafted/submitted)
  - Pending revision requests from moderators
  - Recent notification activity

**Question Drafting & Management:**
- **Create question**: `POST /api/questions` — requires `bankId`, `module` (1–6), `marks` (2, 5, or 10), question text, course outcome (`CO1`–`CO6`), RBT level (`L1`–`L6`), difficulty (`EASY`/`MEDIUM`/`HARD`). The system automatically reserves the next available slot in the matching (module, marks) category.
- **List questions**: `GET /api/questions?bankId=...` — Contributors see only their own questions. Moderators see all questions in a bank. Coordinators see all questions (read-only).
- **View question**: `GET /api/questions/[id]` — returns full question details including text, metadata, attachments, moderation status, revision history, and slot information.
- **Update question**: `PATCH /api/questions/[id]` — edit question text or metadata. Only allowed when the question is in `DRAFT` status or after a revision has been requested.
- **Submit for moderation**: `POST /api/questions/[id]/submit` — changes question status from `DRAFT` to `PENDING_MODERATION`. The question becomes visible to the assigned moderator.
- **Handle revision request**: After a moderator requests revision, the question status returns to `DRAFT` with revision instructions visible. The contributor edits and resubmits.

**Question Status Flow:**
```
DRAFT ──► PENDING_MODERATION ──► APPROVED
  ▲              │                    │
  │              ▼                    ▼
  │      REVISION_REQUESTED    (included in
  │              │             paper generation)
  │              │
  └──────────────┘
         (contributor edits and resubmits)

DRAFT ──► PENDING_MODERATION ──► REJECTED
                                    │
                              (contributor may
                               create replacement)
```

**Slot Reservation System:**
- Each question bank has a 126-slot grid: 6 modules × 3 mark categories (2, 5, 10 marks) × 7 slots
- When creating a question, the system finds the next available (unreserved) slot in the matching (module, marks) coordinate
- A slot is `reservedBy` the contributor upon question creation; slots can be overridden by moderators
- Slot override: `POST /api/question-slots/[id]/override` — moderator can release a slot or reassign it

**Question Attachments:**
- Contributors can attach images, diagrams, or supplementary files to questions
- **Presigned upload**: `POST /api/questions/[id]/attachments/presign` — generates a short-lived presigned PUT URL (default 900 seconds) for direct upload to MinIO (`question-bank-attachments` bucket)
- **Add attachment**: `POST /api/questions/[id]/attachments` — records the uploaded file metadata in the database
- **List attachments**: `GET /api/questions/[id]/attachments` — returns all attachments for a question with download URLs
- **Download attachment**: `GET /api/question-attachments/[id]/download` — generates a presigned GET URL with RBAC verification (only users who can view the parent question can download its attachments)
- **Replace attachment**: `PATCH /api/question-attachments/[id]`
- **Delete attachment**: `DELETE /api/question-attachments/[id]`

**Question Revision History:**
- Every edit to a question creates a `QuestionRevision` record storing the previous text
- Moderators and Coordinators can view the full revision history to understand how a question evolved

---

### Moderator

The Moderator is responsible for quality assurance — reviewing every submitted question, approving sound questions, rejecting substandard ones, and requesting revisions where improvement is possible.

**Dashboard & Moderation Queue:**
- `GET /api/moderation/questions` — the moderator's primary workspace. Supports comprehensive filtering:
  - `bankId` — filter by question bank
  - `status` — filter by `PENDING_MODERATION`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`
  - `module` — filter by module (1–6)
  - `marks` — filter by mark category (2, 5, 10)
  - `contributorId` — filter by the contributor who submitted
  - `sort` — sort by creation date, submission date, module, marks
- **Question detail**: `GET /api/moderation/questions/[id]` — full question view with:
  - Question text and metadata (module, marks, CO, RBT, difficulty)
  - All attachments with download links
  - Revision history (all previous versions)
  - Complete moderation event history (approvals, rejections, revision requests, overrides)

**Moderation Actions:**
- **Approve**: `PATCH /api/moderation/questions/[id]/approve` — marks question as `APPROVED`. Approved questions are immediately available for paper generation. An optional moderator comment can be included.
- **Reject**: `PATCH /api/moderation/questions/[id]/reject` — marks question as `REJECTED`. Requires a mandatory `reason` field. Rejected questions cannot be included in papers. Contributors can create replacement questions in the freed slot.
- **Request revision**: `PATCH /api/moderation/questions/[id]/request-revision` — marks question as `REVISION_REQUESTED` and requires `revisionInstructions` explaining what the contributor should fix. The question returns to `DRAFT` status for the contributor to edit.
- **Override approved**: `PATCH /api/moderation/questions/[id]/override` — if a previously approved question needs to be sent back (e.g., a policy change or new quality concern), the moderator can override it back to `PENDING_MODERATION` status.

**Moderation Events:**
- Every moderation action creates a `ModerationEvent` record with:
  - Action type (APPROVE, REJECT, REQUEST_REVISION, OVERRIDE)
  - Acting moderator ID
  - Timestamp
  - Comment / reason / revision instructions
- The full event history is visible to all moderators and coordinators, providing a complete audit trail of quality decisions.

**Signed HOD Report:**
- After all questions in a bank are approved, the moderator uploads a signed HOD (Head of Department) approval report:
  - `POST /api/question-banks/[id]/signed-report/presign` — get a presigned upload URL for MinIO
  - `POST /api/question-banks/[id]/signed-report` — record the uploaded file against the question bank
  - The signed report is stored in the `signed-reports` MinIO bucket

**Notification System:**
- Moderators receive in-app notifications for:
  - New question submissions in their assigned banks
  - Bank status changes (e.g., all slots filled, bank locked)
  - Coordinator decisions
- `GET /api/notifications` — list notifications for the current user (with optional unread-only filter)
- `PATCH /api/notifications` — mark individual notification as read, or mark all as read
- Email abstraction layer is in place (`src/modules/notifications/email-service.ts`) with a console provider; can be swapped for SMTP/SendGrid/etc. in production

---

### AI Analysis Engine

The AI analysis system provides comprehensive, data-driven quality assessment of question banks. It operates in two tiers:

**Tier 1 — Deterministic Analysis Engine** (`src/modules/reports/analysis-engine.ts`):

This engine performs rules-based, deterministic analysis without requiring an external LLM. It evaluates:

1. **Module Coverage Analysis**:
   - Maps which modules (1–6) have questions, how many questions per module, and how many slots are filled vs. total
   - Identifies modules with zero or insufficient questions
   - Calculates coverage percentage per module

2. **Course Outcome (CO) Coverage**:
   - Maps 6 course outcomes (CO1–CO6) against module coverage
   - Identifies COs with zero mapped questions
   - Flags COs that are under-represented relative to the expected distribution

3. **RBT (Revised Bloom's Taxonomy) Distribution**:
   - Categorises questions across 6 cognitive levels: L1 (Remember), L2 (Understand), L3 (Apply), L4 (Analyse), L5 (Evaluate), L6 (Create)
   - Calculates the percentage distribution and flags imbalance
   - Recommends redistribution if higher-order thinking levels are underrepresented

4. **Difficulty Distribution**:
   - Categorises questions as EASY, MEDIUM, or HARD
   - Reports percentage breakdown
   - Flags if the distribution deviates significantly from the ideal (typically 30%-50%-20%)

5. **Duplicate Detection**:
   - Compares question texts within the same bank
   - Uses token-based similarity to identify near-duplicates
   - Reports potential duplicate pairs with similarity scores

6. **Quality Findings**:
   - Flags questions with unusually short or long text
   - Identifies potential formatting issues
   - Detects mismatched CO-to-module mappings

7. **Bloom's Balance Score**:
   - Composite score evaluating whether the bank has adequate representation across all 6 cognitive levels
   - Calculated as a weighted score that penalises missing or severely underrepresented levels

8. **Missing Areas**:
   - Identifies module-CO combinations that have zero questions
   - Highlights "coverage gaps" that need attention before finalisation
   - Suggests which modules/COs need additional questions

**Tier 2 — Ollama AI Summary Overlay** (`src/modules/ai/ollama-service.ts`):

When Ollama is available at the configured `OLLAMA_BASE_URL`:

1. The deterministic report data is formatted as a structured prompt
2. Ollama generates a natural-language executive summary highlighting:
   - Overall bank quality assessment
   - Key strengths and weaknesses
   - Actionable recommendations for the coordinator
   - Suggested priority order for filling gaps
3. The summary is appended to the deterministic report
4. Both the raw analysis data (JSON) and the rendered report (PDF) are stored in MinIO

**Report Storage:**
- Analysis results are stored as `AiReport` records in the database with status tracking (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`)
- PDF renders are stored in the `generated-papers` MinIO bucket
- Reports are linked to their parent question bank for retrieval

**Triggering and Retrieval:**
- `POST /api/question-banks/[id]/reports` — COE, Coordinator, or Moderator can trigger a new analysis
- `GET /api/question-banks/[id]/reports` — list all reports for a bank with status and timestamp
- Reports are generated asynchronously; the API returns the report record immediately and the status updates as processing completes

---

### Paper Generation Engine

The Paper Generation Engine (`src/modules/reports/paper-generator.ts`) assembles complete examination papers from approved questions using a constraint-based algorithm.

**Input Requirements:**
- Question bank must be in `LOCKED` status
- Sufficient approved questions must exist across all modules and mark categories
- The engine validates slot coverage before generation

**Output:**
- Three distinct paper variants: **PAPER_A**, **PAPER_B**, **PAPER_C**
- Each paper is a complete, standalone examination paper
- Papers are stored as `GeneratedPaper` records with associated `GeneratedPaperItem` entries (individual question selections)
- A rendered PDF for each paper is stored in the `generated-papers` MinIO bucket

**Generation Constraints:**

1. **No Cross-Paper Duplicates**: A question selected for Paper A cannot also appear in Paper B or Paper C. Each of the three papers must use entirely unique questions.

2. **Module Balance**: Each paper must have an equitable distribution of questions across all 6 modules, proportional to the module's weight in the overall curriculum.

3. **Mark Category Distribution**: Each paper must include the prescribed number of 2-mark, 5-mark, and 10-mark questions according to the subject's examination pattern.

4. **Course Outcome (CO) Coverage**: Each paper must cover all 6 course outcomes. The generator ensures no CO is omitted across any paper variant.

5. **Difficulty Balance**: Each paper should maintain the prescribed difficulty distribution (typically ~30% Easy, ~50% Medium, ~20% Hard). The generator scores candidates against this target.

6. **RBT Level Distribution**: Papers should include questions across a range of cognitive levels (L1–L6), avoiding concentration at only lower or higher levels.

7. **Historical Exclusion**: Questions that have been used in previous examination cycles within a configurable lookback period are deprioritised or excluded to maintain paper freshness and prevent predictability.

8. **Usage Priority**: Questions with fewer prior usages (`usageCount`) are preferred over frequently-used ones, promoting rotation.

9. **Inventory Warnings**: If the bank does not contain enough approved questions to generate three complete, distinct papers, the generator issues warnings specifying which modules or mark categories are deficient.

**Usage Tracking:**
- When a question is included in a generated paper, its usage is tracked:
  - `usageCount` — incremented each time
  - `lastUsedExam` — the exam type (REGULAR/SUPPLEMENTARY/KT)
  - `lastUsedYear` — academic year
  - `lastUsedSemester` — semester number
  - `lastUsedType` — paper variant (A/B/C)
- This tracking feeds back into the historical exclusion constraint for future cycles.

**Paper Scoring:**
Each generated paper receives a set of scores used for comparison:

| Score | Description |
|-------|-------------|
| **Coverage Score** | How well the paper covers all modules, COs, and mark categories |
| **Difficulty Score** | How closely the difficulty distribution matches the target |
| **Quality Score** | Aggregate of question quality, RBT balance, and formatting consistency |
| **Duplicate Risk** | Cross-paper duplication risk assessment (should be zero for valid generation) |
| **Recommendation** | Overall recommendation: `RECOMMENDED`, `ACCEPTABLE`, or `NOT_RECOMMENDED` |

**Triggering and Retrieval:**
- `POST /api/question-banks/[id]/papers` — COE or Coordinator triggers generation
- `GET /api/question-banks/[id]/papers` — list all generated papers for a bank
- Papers are generated asynchronously; the API returns immediately with initial `PENDING` status

---

### Dean Review

The Dean is the final academic authority who selects which paper variants will be used for each examination type.

**Dean Workspace:**
- `GET /api/question-banks/[id]/dean-review` — returns:
  - All three generated papers (A, B, C) with their scores and recommendations
  - Question-level detail for each paper
  - The current selection status
  - The coordinator's decision and any notes

**Paper Selection:**
- `POST /api/question-banks/[id]/dean-review` — the Dean selects one paper variant for each exam type:
  - **Regular exam paper** — for the standard end-of-semester examination (mandatory selection)
  - **Supplementary paper** — for supplementary / re-examination (mandatory selection if the bank has a supplementary cycle)
  - **KT paper** — for backlog / keep-term examination (mandatory selection if the bank has a KT cycle)
- The selection is **final and irrevocable** once submitted. It cannot be changed after confirmation.
- Selection is stored as a `DeanReview` record linked to the question bank.

**Post-Selection Flow:**
- Once the Dean submits selections, the question bank status transitions to `FINALISED`
- The COE gains access to the selected papers in the production console for export
- No further modifications can be made to the question bank or its questions

---

### COE Production & Exports

After Dean selection, the COE produces final examination materials.

**Export Formats:**
- **PDF**: Full question paper rendered via `pdf-lib` with proper formatting, headers (institution name, subject, exam type, date, instructions), and pagination
- **DOCX**: Editable Word document generated via `docx` library with structured formatting, tables, and exam metadata
- **ZIP**: Bundle containing PDF + DOCX + any supplementary materials (answer keys, formula sheets), created via `jszip`

**Export Workflow:**
1. `POST /api/exports` — creates an export job specifying the question bank, export format(s), and optionally a paper variant
2. The export is processed asynchronously:
   - Questions are retrieved from the selected paper variant (or all approved questions if a specific variant is not selected)
   - The document service (`src/modules/production/document-service.ts`) renders the paper in the requested format(s)
   - The output file is uploaded to the `exports` MinIO bucket
   - An `ExportArtifact` record is created with status tracking (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`)
3. `GET /api/exports` — lists all export artifacts with status, format, creation date, and expiration date
4. `GET /api/exports/[id]/download` — generates a presigned download URL (short-lived) for the export artifact

**Export Expiration:**
- Export artifacts have a configurable retention period (default: 30 days via `EXPORT_RETENTION_DAYS`)
- The cleanup workflow periodically removes expired exports from both the database and MinIO

**Database Backups:**
- `POST /api/backups` — triggers a database backup:
  1. Executes `mysqldump` on the MySQL database using the configured `DATABASE_URL` credentials
  2. Compresses the dump file
  3. Uploads to the `system-backups` MinIO bucket
  4. Creates a `SystemBackup` record with status, file size, and expiration date
- Backups also have a configurable retention period (default: 30 days via `BACKUP_RETENTION_DAYS`)
- Backup execution expects `mysqldump` to be available in the runtime environment (installed in the Docker image or host system)

**Cleanup & Retention:**
- Expired artifacts (exports and backups) are periodically cleaned up:
  - Database records are deleted
  - Corresponding MinIO objects are removed
  - Cleanup runs as part of the application workflow

---

### Monitoring & Observability

**Health Endpoint:**
- `GET /api/health` — public health check returning:
  - Application status (`ok` / `degraded`)
  - Uptime
  - Timestamp
- Optionally secured with `HEALTHCHECK_TOKEN` — if configured, the request must include a matching `Authorization` header
- Used by Docker healthchecks, load balancers, and monitoring tools

**Monitoring Endpoint (COE only):**
- `GET /api/monitoring` — comprehensive system observability dashboard returning:

  1. **Database Metrics**:
     - Connection status
     - Total records per table (Users, Questions, Banks, Subjects, etc.)
     - Recent query performance

  2. **MinIO Metrics**:
     - Connection status
     - Bucket sizes and object counts per bucket:
       - `question-bank-attachments`
       - `signed-reports`
       - `generated-papers`
       - `exports`
       - `audit-files`
       - `system-backups`

  3. **Workflow Status**:
     - Active exam cycles count
     - Question banks by status
     - Questions by status (Draft, Pending Moderation, Approved, Rejected)
     - Pending AI reports
     - Pending paper generations
     - Pending exports
     - Recent backup status

  4. **Rate Limiter Status**:
     - Current request rates
     - Blocked request counts (if any)

  5. **System Resources** (when available):
     - Memory usage
     - CPU usage
     - Uptime

**Structured Logging:**
- All logs are emitted as JSON objects with fields: `level`, `message`, `timestamp`, `requestId`, `userId`, `ip`
- Logger levels: `info`, `warn`, `error`
- Logs are written to stdout/stderr for consumption by log aggregators (Docker logs, CloudWatch, Datadog, etc.)

---

## Database Schema

### Entity-Relationship Overview

The database consists of **23 models** with **16 enums**, managed by Prisma ORM and MySQL 8.4.

### Core Organisational Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `Department` | Academic department | `id`, `name`, `code` (unique), `hodName`, `isActive` |
| `User` | System user with role | `id`, `name`, `email` (unique), `passwordHash`, `role` (enum), `status` (enum), `departmentId` (FK), `resetToken`, `resetTokenExpiry` |
| `ExamCycle` | Examination cycle | `id`, `academicYear`, `semester`, `examType` (enum), `status` (enum), `departmentId` (FK), `examStartDate`, `examEndDate`, `resultDate` |
| `Subject` | Academic subject | `id`, `subjectCode` (unique), `subjectName`, `credits`, `semester`, `status` (enum), `departmentId` (FK), `questionBankDueDate` |

### Question & Moderation Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `QuestionBank` | Question bank per subject+cycle | `id`, `subjectId` (FK), `examCycleId` (FK), `status` (enum), `signedReportAssetId` (FK → FileAsset), `coordinatorDecision` (enum), `coordinatorDecisionNote` |
| `QuestionSlot` | 126-slot coordinate in a bank | `id`, `bankId` (FK), `module` (1–6), `marks` (2/5/10), `slotNumber` (1–7), `reservedBy` (FK → User), `isLocked` |
| `Question` | Exam question | `id`, `bankId` (FK), `slotId` (FK, unique), `text`, `marks`, `module`, `courseOutcome` (enum), `rbtLevel` (enum), `difficulty` (enum), `status` (enum), `contributorId` (FK), `moderatorId` (FK), `usageCount`, `lastUsedExam`, `lastUsedYear`, `lastUsedSemester`, `lastUsedType` |
| `QuestionAttachment` | File attached to question | `id`, `questionId` (FK), `fileAssetId` (FK → FileAsset) |
| `QuestionRevision` | Version history of question edits | `id`, `questionId` (FK), `previousText`, `editedAt`, `editedBy` (FK) |
| `ModerationEvent` | History of moderation actions | `id`, `questionId` (FK), `moderatorId` (FK), `action` (APPROVE/REJECT/REVISION/OVERRIDE), `comment`, `revisionInstructions`, `createdAt` |
| `ModeratorBankAssignment` | Moderator-to-bank mapping | `id`, `userId` (FK), `bankId` (FK) |

### Workflow & Assignment Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `TeacherAssignment` | Contributor/Moderator assignment | `id`, `userId` (FK), `bankId` (FK), `role` (enum: MODERATOR/CONTRIBUTOR), `module` (1–6) |
| `CoordinatorDepartmentAssignment` | Coordinator-to-department mapping | `id`, `userId` (FK), `departmentId` (FK) |
| `SubjectExamCycleLink` | Many-to-many: subject↔cycle | `id`, `subjectId` (FK), `examCycleId` (FK) |

### AI & Production Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `AiReport` | AI analysis report | `id`, `bankId` (FK), `status` (enum), `model` (ollama model used), `summary` (text), `chartData` (JSON), `triggeredBy` (FK), `fileAssetId` (FK) |
| `GeneratedPaper` | Generated paper variant | `id`, `bankId` (FK), `variant` (A/B/C), `status` (enum), `coverageScore`, `difficultyScore`, `qualityScore`, `duplicateRisk`, `recommendation`, `fileAssetId` (FK) |
| `GeneratedPaperItem` | Individual question in a paper | `id`, `paperId` (FK), `questionId` (FK) |
| `DeanReview` | Dean's paper selection | `id`, `bankId` (FK, unique), `regularPaperId` (FK), `supplementaryPaperId` (FK), `ktPaperId` (FK), `reviewedBy` (FK), `reviewedAt` |

### Operations & Audit Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `Notification` | In-app notification | `id`, `recipientId` (FK), `title`, `message`, `type` (enum), `isRead`, `createdAt` |
| `AuditLog` | Append-only audit trail | `id`, `actorId` (FK), `action`, `resourceType`, `resourceId`, `metadata` (JSON), `ipAddress`, `userAgent`, `previousHash` (SHA-256 chain), `createdAt` |
| `FileAsset` | MinIO file metadata | `id`, `bucket`, `objectKey`, `fileName`, `mimeType`, `size`, `uploadedBy` (FK), `createdAt` |
| `ExportArtifact` | COE export record | `id`, `bankId` (FK), `format` (enum), `status` (enum), `fileAssetId` (FK), `expiresAt` |
| `SystemBackup` | Database backup record | `id`, `status` (enum), `fileAssetId` (FK), `size`, `expiresAt`, `triggeredBy` (FK) |

### Complete Enum Reference

| Enum | Values |
|------|--------|
| `Role` | `COE`, `COORDINATOR`, `MODERATOR`, `CONTRIBUTOR`, `DEAN` |
| `UserStatus` | `ACTIVE`, `DISABLED` |
| `SubjectStatus` | `ACTIVE`, `INACTIVE` |
| `ExamType` | `REGULAR`, `SUPPLEMENTARY`, `KT` |
| `ExamCycleStatus` | `DRAFT`, `ACTIVE`, `CLOSED` |
| `QuestionBankStatus` | `DRAFT`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `LOCKED`, `FINALISED` |
| `AiReportStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `PaperGenerationStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `PaperVariant` | `PAPER_A`, `PAPER_B`, `PAPER_C` |
| `CoordinatorDecision` | `PENDING`, `APPROVED`, `REJECTED` |
| `ExportFormat` | `PDF`, `DOCX`, `ZIP` |
| `ExportArtifactStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED` |
| `BackupStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `EXPIRED` |
| `AssignmentRole` | `MODERATOR`, `CONTRIBUTOR` |
| `NotificationType` | `ASSIGNMENT`, `SUBMISSION`, `MODERATION`, `REVISION`, `BANK_STATUS`, `COORDINATOR_DECISION`, `DEAN_SELECTION`, `EXPORT`, `SYSTEM` |
| `CourseOutcome` | `CO1`, `CO2`, `CO3`, `CO4`, `CO5`, `CO6` |
| `RbtLevel` | `L1` (Remember), `L2` (Understand), `L3` (Apply), `L4` (Analyse), `L5` (Evaluate), `L6` (Create) |
| `DifficultyLevel` | `EASY`, `MEDIUM`, `HARD` |
| `QuestionStatus` | `DRAFT`, `PENDING_MODERATION`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED` |

The complete Prisma schema is at `prisma/schema.prisma`.

---

## API Reference

### Complete Endpoint Listing (95+ operations across 63 route files)

#### Authentication (7 route files, 8 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/auth/csrf` | Public | All | Generate or retrieve CSRF token |
| `POST` | `/api/auth/login` | Public | All | Authenticate user, issue JWT cookies + CSRF token |
| `POST` | `/api/auth/logout` | Public | All | Clear all auth cookies |
| `POST` | `/api/auth/refresh` | Public | All | Refresh access token using refresh token |
| `POST` | `/api/auth/forgot-password` | Public | All | Generate password reset token |
| `POST` | `/api/auth/reset-password` | Public | All | Reset password with valid token |
| `GET` | `/api/auth/[...nextauth]` | — | — | Auth.js internal handler |
| `POST` | `/api/auth/[...nextauth]` | — | — | Auth.js internal handler |

#### Users & Administration (4 route files, 6 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/users` | Required | COE, Coordinator | List all users |
| `POST` | `/api/users` | Required | COE | Create new user |
| `PATCH` | `/api/users/[id]` | Required | COE | Update user details |
| `DELETE` | `/api/users/[id]` | Required | COE | Disable user account |

#### Departments (2 route files, 4 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/departments` | Required | COE, Coordinator | List all departments |
| `POST` | `/api/departments` | Required | COE | Create department |
| `PATCH` | `/api/departments/[id]` | Required | COE | Update department |
| `DELETE` | `/api/departments/[id]` | Required | COE | Delete department |

#### Exam Cycles (2 route files, 3 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/exam-cycles` | Required | COE, Coordinator | List exam cycles |
| `POST` | `/api/exam-cycles` | Required | COE | Create exam cycle |
| `PATCH` | `/api/exam-cycles/[id]` | Required | COE | Update exam cycle |

#### Subjects (4 route files, 6 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/subjects` | Required | Coordinator, COE | List subjects with filters |
| `POST` | `/api/subjects` | Required | Coordinator, COE | Create subject |
| `PUT` | `/api/subjects/[id]` | Required | Coordinator | Full update subject |
| `PATCH` | `/api/subjects/[id]` | Required | Coordinator | Partial update subject |
| `POST` | `/api/subjects/[id]/link-cycle` | Required | Coordinator | Link subject to exam cycle |
| `PATCH` | `/api/subjects/[id]/deactivate` | Required | Coordinator | Deactivate subject |

#### Question Banks (13 route files, 19 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/question-banks` | Required | Coordinator | List question banks with filters |
| `POST` | `/api/question-banks` | Required | Coordinator | Initialise bank with 126-slot grid |
| `GET` | `/api/question-banks/[id]` | Required | Coordinator+ | Get bank detail with slots, reports, papers, review |
| `PATCH` | `/api/question-banks/[id]/status` | Required | Coordinator, Moderator | Update bank status |
| `PATCH` | `/api/question-banks/[id]/lock` | Required | Coordinator | Lock bank (make immutable) |
| `GET` | `/api/question-banks/[id]/reports` | Required | COE, Coordinator, Moderator | List AI reports |
| `POST` | `/api/question-banks/[id]/reports` | Required | COE, Coordinator, Moderator | Trigger AI analysis |
| `GET` | `/api/question-banks/[id]/papers` | Required | COE, Coordinator, Moderator | List generated papers |
| `POST` | `/api/question-banks/[id]/papers` | Required | COE, Coordinator | Trigger paper generation |
| `GET` | `/api/question-banks/[id]/dean-review` | Required | Coordinator, Dean | Get dean review status |
| `POST` | `/api/question-banks/[id]/dean-review` | Required | Dean | Submit dean paper selections |
| `GET` | `/api/question-banks/[id]/assignments` | Required | Coordinator | List teacher assignments |
| `POST` | `/api/question-banks/[id]/assignments` | Required | Coordinator | Assign teacher to bank |
| `PUT` | `/api/question-banks/[id]/assignments/[assignmentId]` | Required | Coordinator | Reassign teacher |
| `DELETE` | `/api/question-banks/[id]/assignments/[assignmentId]` | Required | Coordinator | Remove assignment |
| `POST` | `/api/question-banks/[id]/assignments/[assignmentId]/notify` | Required | Coordinator | Notify assigned contributor |
| `POST` | `/api/question-banks/[id]/coordinator-decision` | Required | Coordinator | Approve or reject bank for dean review |
| `POST` | `/api/question-banks/[id]/signed-report` | Required | Moderator | Record signed HOD report upload |
| `POST` | `/api/question-banks/[id]/signed-report/presign` | Required | Moderator | Get presigned URL for HOD report upload |

#### Questions (6 route files, 11 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/questions` | Required | Contributor (own), Moderator (all), Coordinator (all r/o) | List questions by bank (role-filtered) |
| `POST` | `/api/questions` | Required | Contributor, Moderator (override) | Create question (slot auto-reserved) |
| `GET` | `/api/questions/[id]` | Required | Contributor (own), Moderator, Coordinator | Get question detail |
| `PATCH` | `/api/questions/[id]` | Required | Contributor (own, draft), Moderator | Update question |
| `POST` | `/api/questions/[id]/submit` | Required | Contributor (own) | Submit question for moderation |
| `POST` | `/api/questions/[id]/moderate` | Required | Moderator | Moderate question (approve/reject/revision) |
| `GET` | `/api/questions/[id]/attachments` | Required | Question owner + Moderator + Coordinator | List attachments |
| `POST` | `/api/questions/[id]/attachments` | Required | Question owner + Moderator | Add attachment |
| `POST` | `/api/questions/[id]/attachments/presign` | Required | Question owner + Moderator | Get presigned upload URL |

#### Question Slots (2 route files, 3 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/question-slots` | Required | All | List slots (filtered by bank) |
| `POST` | `/api/question-slots` | Required | Contributor, Moderator | Reserve slot |
| `POST` | `/api/question-slots/[id]/override` | Required | Moderator | Override slot reservation |

#### Question Attachments (2 route files, 4 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `PATCH` | `/api/question-attachments/[id]` | Required | Owner + Moderator | Replace attachment |
| `DELETE` | `/api/question-attachments/[id]` | Required | Owner + Moderator | Delete attachment |
| `GET` | `/api/question-attachments/[id]/download` | Required | Authorised viewers | Get signed download URL (RBAC-gated) |

#### Storage (1 route file, 1 operation)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/storage/presign` | Required | All | Generate general presigned upload URL (bucket-validated) |

#### Moderation (6 route files, 6 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/moderation/questions` | Required | Moderator | List questions for moderation with filters |
| `GET` | `/api/moderation/questions/[id]` | Required | Moderator | Get question with full revision + moderation history |
| `PATCH` | `/api/moderation/questions/[id]/approve` | Required | Moderator | Approve question |
| `PATCH` | `/api/moderation/questions/[id]/reject` | Required | Moderator | Reject question (requires reason) |
| `PATCH` | `/api/moderation/questions/[id]/request-revision` | Required | Moderator | Request revision (requires instructions) |
| `PATCH` | `/api/moderation/questions/[id]/override` | Required | Moderator | Override approved question back to pending |

#### Production & Operations (5 route files, 7 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/exports` | Required | COE | List export artifacts |
| `POST` | `/api/exports` | Required | COE | Create export (PDF/DOCX/ZIP) |
| `GET` | `/api/exports/[id]/download` | Required | COE | Get signed download URL for export |
| `POST` | `/api/backups` | Required | COE | Trigger database backup |
| `GET` | `/api/monitoring` | Required | COE | Get full system metrics and status |

#### Other (4 route files, 6 operations)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/health` | Optional (token) | Public | Health check probe |
| `GET` | `/api/dashboard` | Required | All | Role-based dashboard data |
| `GET` | `/api/audit-logs` | Required | COE | View audit log (last 100 entries) |
| `GET` | `/api/notifications` | Required | All | List user notifications |
| `PATCH` | `/api/notifications` | Required | All | Mark notification(s) as read |
| `GET` | `/api/assignments` | Required | COE, Coordinator | List all assignments |
| `POST` | `/api/assignments` | Required | Coordinator | Create assignment |

Full API documentation with request/response schemas: `docs/api-documentation.md`

---

## Environment Variables

All environment variables are documented in `.env.example`. Copy this file to `.env` and configure as needed.

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `mysql://emqpgs:emqpgs@localhost:3306/emqpgs` | MySQL connection string for Prisma |
| `AUTH_SECRET` | — | Auth.js secret key (minimum 32 characters) |
| `AUTH_URL` | `http://localhost:3000` | Application canonical URL (used for CSRF origin check) |
| `JWT_ACCESS_SECRET` | — | Secret for signing JWT access tokens (minimum 32 characters) |
| `JWT_REFRESH_SECRET` | — | Secret for signing JWT refresh tokens (minimum 32 characters) |
| `CSRF_SECRET` | — | Secret for HMAC-SHA256 CSRF token signing (minimum 32 characters) |

### Token & Session Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime in minutes |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token lifetime in days |
| `SESSION_IDLE_TIMEOUT_MINUTES` | `30` | Maximum idle time before refresh token is rejected |

### MinIO / Object Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO server hostname or IP |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_USE_SSL` | `false` | Whether to use HTTPS for MinIO connections |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_REGION` | `us-east-1` | MinIO region |
| `SIGNED_URL_EXPIRY_SECONDS` | `900` | Presigned URL lifetime in seconds (default: 15 minutes) |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate limiting window duration |
| `RATE_LIMIT_MAX_REQUESTS` | `120` | Maximum requests per window per client |

### AI (Ollama)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3.1` | Ollama model identifier for AI summaries |

### Institution & Branding

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTITUTION_NAME` | `EMQPGS Institution` | Institution name used in generated documents and headers |

### Retention & Cleanup

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPORT_RETENTION_DAYS` | `30` | Number of days before export artifacts expire |
| `BACKUP_RETENTION_DAYS` | `30` | Number of days before database backups expire |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTHCHECK_TOKEN` | (empty) | If set, required as `Authorization` header on `/api/health` |
| `SENTRY_DSN` | (empty) | Sentry Data Source Name for error tracking (if configured) |

---

## Project Structure

```
EMQPGS/
│
├── .env.example                          # Documented environment variable template
├── .gitignore                            # Git ignore rules
├── AGENTS.md                             # AI agent behaviour rules for the repo
├── CLAUDE.md                             # Claude-specific assistant instructions
├── README.md                             # This file
├── app-flow.md                           # Detailed application workflow documentation
├── docker-compose.yml                    # Docker Compose: app, mysql, minio, minio-init
├── Dockerfile                            # Multi-stage production Docker build (Node 24 Alpine)
├── eslint.config.mjs                     # ESLint configuration (Next.js core-web-vitals)
├── next.config.ts                        # Next.js configuration with security headers
├── package.json                          # NPM package manifest with all scripts
├── package-lock.json                     # Dependency lockfile
├── postcss.config.mjs                    # PostCSS config for Tailwind CSS
├── proxy.ts                              # Next.js middleware: auth + role-based routing
├── tsconfig.json                         # TypeScript configuration
├── vitest.config.ts                      # Vitest test runner configuration
│
├── app/                                  # Next.js App Router (pages + API routes)
│   ├── layout.tsx                        # Root layout: fonts, metadata, Toaster
│   ├── page.tsx                          # Root page: redirects / → /login
│   ├── globals.css                       # Global styles with Tailwind + CSS variables
│   ├── favicon.ico                       # Site favicon
│   │
│   ├── login/page.tsx                    # Login page with CSRF-protected form
│   ├── forgot-password/page.tsx          # Forgot password request page
│   ├── reset-password/page.tsx           # Reset password with token page
│   │
│   ├── (protected)/                      # Protected route group (auth required)
│   │   ├── layout.tsx                    # Protected layout: JWT validation + AppShell
│   │   └── dashboard/
│   │       ├── page.tsx                  # Dashboard index: role-based card navigation
│   │       ├── coe/                      # ─── COE workspace ───
│   │       │   ├── page.tsx              # COE landing dashboard
│   │       │   ├── users/page.tsx        # User management
│   │       │   ├── departments/page.tsx  # Department management
│   │       │   ├── exam-cycles/page.tsx  # Exam cycle management
│   │       │   ├── audit/page.tsx        # Audit log viewer
│   │       │   ├── production/page.tsx   # Production controls (exports)
│   │       │   └── monitoring/page.tsx   # System monitoring dashboard
│   │       ├── coordinator/              # ─── Coordinator workspace ───
│   │       │   ├── page.tsx              # Coordinator landing dashboard
│   │       │   ├── layout.tsx            # Coordinator-specific layout
│   │       │   ├── subjects/page.tsx     # Subject management
│   │       │   ├── question-banks/page.tsx # Question bank management
│   │       │   ├── assignments/page.tsx  # Teacher assignment management
│   │       │   └── questions/page.tsx    # Read-only question overview
│   │       ├── moderator/                # ─── Moderator workspace ───
│   │       │   ├── page.tsx              # Moderator landing dashboard
│   │       │   ├── layout.tsx            # Moderator-specific layout
│   │       │   ├── questions/page.tsx    # Moderation review queue
│   │       │   ├── approved/page.tsx     # Approved questions view
│   │       │   └── rejected/page.tsx     # Rejected questions view
│   │       ├── contributor/              # ─── Contributor workspace ───
│   │       │   ├── page.tsx              # Contributor landing dashboard
│   │       │   ├── questions/page.tsx    # My submitted questions
│   │       │   ├── my-subjects/page.tsx  # My assigned subjects
│   │       │   └── submit-question/page.tsx # Question submission form
│   │       └── dean/                     # ─── Dean workspace ───
│   │           ├── page.tsx              # Dean landing dashboard
│   │           ├── layout.tsx            # Dean-specific layout
│   │           ├── review/page.tsx       # Paper review and selection
│   │           ├── reports/page.tsx      # Report viewing
│   │           └── readiness-overview/page.tsx # Readiness overview
│   │
│   └── api/                              # ─── API route handlers (63 files, ~95 operations) ───
│       ├── auth/
│       │   ├── [...nextauth]/route.ts    # Auth.js core handlers
│       │   ├── login/route.ts            # POST: user authentication
│       │   ├── logout/route.ts           # POST: clear auth cookies
│       │   ├── refresh/route.ts          # POST: refresh access token
│       │   ├── csrf/route.ts             # GET: generate/retrieve CSRF token
│       │   ├── forgot-password/route.ts  # POST: generate reset token
│       │   └── reset-password/route.ts   # POST: reset password
│       │
│       ├── users/                        # User CRUD (COE)
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/route.ts             # PATCH (update), DELETE (disable)
│       │
│       ├── departments/                  # Department CRUD (COE)
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/route.ts             # PATCH (update), DELETE (delete)
│       │
│       ├── exam-cycles/                  # Exam cycle CRUD (COE)
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/route.ts             # PATCH (update)
│       │
│       ├── subjects/                     # Subject management (Coordinator)
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   ├── [id]/route.ts             # PUT, PATCH (update)
│       │   ├── [id]/link-cycle/route.ts  # POST (link to exam cycle)
│       │   └── [id]/deactivate/route.ts  # PATCH (deactivate)
│       │
│       ├── question-banks/               # Question bank operations
│       │   ├── route.ts                  # GET (list), POST (initialise with slots)
│       │   ├── [id]/route.ts             # GET (detail)
│       │   ├── [id]/status/route.ts      # PATCH (update status)
│       │   ├── [id]/lock/route.ts        # PATCH (lock bank)
│       │   ├── [id]/reports/route.ts     # GET (list), POST (trigger AI)
│       │   ├── [id]/papers/route.ts      # GET (list), POST (trigger generation)
│       │   ├── [id]/dean-review/route.ts # GET (status), POST (submit selection)
│       │   ├── [id]/assignments/route.ts # GET (list), POST (assign)
│       │   ├── [id]/assignments/[assignmentId]/route.ts  # PUT (reassign), DELETE (remove)
│       │   ├── [id]/assignments/[assignmentId]/notify/route.ts # POST (notify)
│       │   ├── [id]/coordinator-decision/route.ts # POST (approve/reject)
│       │   ├── [id]/signed-report/route.ts        # POST (record upload)
│       │   └── [id]/signed-report/presign/route.ts # POST (presigned URL)
│       │
│       ├── questions/                    # Question lifecycle
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   ├── [id]/route.ts             # GET (detail), PATCH (update)
│       │   ├── [id]/submit/route.ts      # POST (submit for moderation)
│       │   ├── [id]/moderate/route.ts    # POST (moderate)
│       │   ├── [id]/attachments/route.ts # GET (list), POST (add)
│       │   └── [id]/attachments/presign/route.ts # POST (presigned upload URL)
│       │
│       ├── question-slots/               # Slot management
│       │   ├── route.ts                  # GET (list), POST (reserve)
│       │   └── [id]/override/route.ts    # POST (moderator override)
│       │
│       ├── question-attachments/         # Attachment file operations
│       │   ├── [id]/route.ts             # PATCH (replace), DELETE (delete)
│       │   └── [id]/download/route.ts    # GET (signed download URL)
│       │
│       ├── moderation/                   # Moderator workflow
│       │   ├── questions/route.ts        # GET (list with filters)
│       │   └── questions/[id]/route.ts   # GET (detail)
│       │       ├── approve/route.ts      # PATCH (approve)
│       │       ├── reject/route.ts       # PATCH (reject)
│       │       ├── request-revision/route.ts # PATCH (revision)
│       │       └── override/route.ts     # PATCH (override)
│       │
│       ├── storage/
│       │   └── presign/route.ts          # POST (general presigned upload)
│       │
│       ├── exports/                      # COE exports
│       │   ├── route.ts                  # GET (list), POST (create)
│       │   └── [id]/download/route.ts    # GET (signed download URL)
│       │
│       ├── backups/route.ts              # POST (trigger database backup)
│       ├── monitoring/route.ts           # GET (full system metrics)
│       ├── health/route.ts               # GET (health check probe)
│       ├── dashboard/route.ts            # GET (role-based dashboard data)
│       ├── notifications/route.ts        # GET (list), PATCH (mark read)
│       ├── audit-logs/route.ts           # GET (view audit trail)
│       └── assignments/route.ts          # GET (list all), POST (create)
│
├── src/                                  # ─── Application source code ───
│   ├── types/
│   │   └── next-auth.d.ts               # Auth.js type extensions (role, departmentId)
│   │
│   ├── lib/                              # ─── Cross-cutting infrastructure (17 files) ───
│   │   ├── api-context.ts               # Extract user from JWT cookies + request metadata
│   │   ├── api-handler.ts               # Centralised API wrapper (RBAC, CSRF, rate-limit, audit, logging)
│   │   ├── audit.ts                     # Append-only audit log with SHA-256 chain hashing
│   │   ├── auth.ts                      # Auth.js v5 configuration (credentials provider, JWT callbacks)
│   │   ├── client-fetch.ts             # Client-side fetch with automatic CSRF token injection
│   │   ├── constants.ts                # Enums, labels, cookie names, RBAC permission matrix
│   │   ├── csrf.ts                     # CSRF token generation, HMAC signing, origin verification
│   │   ├── db.ts                       # Prisma client singleton
│   │   ├── env.ts                      # Zod-validated environment variable parsing
│   │   ├── errors.ts                   # AppError, UnauthorizedError, ForbiddenError, NotFoundError
│   │   ├── jwt.ts                      # JWT access + refresh token sign/verify with idle timeout
│   │   ├── logger.ts                   # Structured JSON logger (info/warn/error)
│   │   ├── parse-body.ts               # JSON body parser helper for NextRequest
│   │   ├── rate-limit.ts               # In-memory rate limiter with SHA-256 key hashing
│   │   ├── server-data.ts              # Server-side data fetching helpers for dashboard pages
│   │   ├── utils.ts                    # cn() class merger, toSlug(), safeJsonParse()
│   │   └── storage/                    # MinIO storage abstraction
│   │       ├── storage-service.ts      # Upload/download link creation, server-side upload, cleanup
│   │       ├── s3-compatible-provider.ts # AWS SDK S3 presigned URL provider
│   │       └── minio-provider.ts       # MinIO provider (extends S3CompatibleProvider)
│   │
│   ├── modules/                         # ─── Feature modules (15 sub-modules, 37 files) ───
│   │   ├── shared/
│   │   │   └── base-repository.ts      # Abstract base class with Prisma instance access
│   │   │
│   │   ├── users/                      # User management
│   │   │   ├── service.ts              # User CRUD, credential verification, disable logic
│   │   │   ├── repository.ts           # Database queries (public + auth selects)
│   │   │   └── validation.ts           # Zod schema for UserInput
│   │   │
│   │   ├── departments/                # Department management
│   │   │   ├── service.ts              # Department CRUD with code uniqueness enforcement
│   │   │   ├── repository.ts           # Database queries
│   │   │   └── validation.ts           # Zod schema for DepartmentInput
│   │   │
│   │   ├── exam-cycles/                # Exam cycle management
│   │   │   ├── service.ts              # CRUD with single-active-cycle constraint per department
│   │   │   ├── repository.ts           # Database queries
│   │   │   └── validation.ts           # Zod schema for ExamCycleInput
│   │   │
│   │   ├── subjects/                   # Subject management
│   │   │   ├── service.ts              # Subject CRUD with filters and pagination
│   │   │   ├── repository.ts           # Database queries
│   │   │   └── validation.ts           # Zod schema for SubjectInput
│   │   │
│   │   ├── question-banks/             # Question bank management
│   │   │   ├── service.ts              # Bank CRUD with 126-slot grid initialisation, lock check
│   │   │   ├── repository.ts           # Database queries with transaction support
│   │   │   └── validation.ts           # Zod schema for QuestionBankInput
│   │   │
│   │   ├── questions/                  # Question lifecycle management
│   │   │   ├── service.ts              # Slot reservation, CRUD, submit, moderate, attachments
│   │   │   ├── repository.ts           # Question + slot DB ops with transaction support
│   │   │   ├── slot-template.ts        # 126-slot grid generator (6×3×7)
│   │   │   ├── permissions.ts          # RBAC functions: canView, canEdit, canModerateQuestion
│   │   │   └── validation.ts           # Schemas for questions, slots, moderation, attachments
│   │   │
│   │   ├── assignments/                # Teacher assignment management
│   │   │   ├── service.ts              # Assignment CRUD with role validation
│   │   │   ├── repository.ts           # Database queries
│   │   │   └── validation.ts           # Zod schema for AssignmentInput
│   │   │
│   │   ├── moderation/                 # Moderator workflow
│   │   │   └── service.ts              # Full moderation: queue, approve, reject, revision, override
│   │   │
│   │   ├── coordinator/               # Coordinator workflow
│   │   │   └── service.ts              # Dashboard, subjects, banks, assignments, AI/paper triggers, decisions
│   │   │
│   │   ├── dashboard/                 # Role-based dashboard
│   │   │   └── service.ts              # Aggregation of stats, pending tasks, notifications per role
│   │   │
│   │   ├── notifications/             # Notification system
│   │   │   ├── service.ts              # In-app notification CRUD + mark read
│   │   │   ├── email-service.ts        # Email sending abstraction
│   │   │   └── email-provider.ts       # Console email provider (swappable for SMTP/SendGrid)
│   │   │
│   │   ├── reports/                   # AI analysis + paper generation
│   │   │   ├── service.ts              # Report generation, paper generation, signed reports, coordinator decisions
│   │   │   ├── analysis-engine.ts      # Deterministic analysis: module/CO/RBT coverage, duplicates, quality
│   │   │   ├── paper-generator.ts      # Paper A/B/C generation with constraint solving
│   │   │   ├── pdf-service.ts          # PDF generation via pdf-lib
│   │   │   └── validation.ts           # Zod schemas for report and paper inputs
│   │   │
│   │   ├── ai/                        # AI integration
│   │   │   ├── ollama-service.ts       # Ollama API client for AI summary overlay
│   │   │   └── types.ts                # TypeScript types for AI report data
│   │   │
│   │   └── production/                # Production controls (COE)
│   │       ├── service.ts              # Dean review, exports, backups, cleanup, monitoring
│   │       ├── document-service.ts     # Combined PDF, DOCX, ZIP bundle generation
│   │       └── validation.ts           # Zod schemas for dean review + export inputs
│   │
│   └── components/                     # ─── React components (20 files) ───
│       ├── layout/
│       │   └── app-shell.tsx           # Sidebar navigation with role-based menu filtering
│       │
│       ├── ui/                         # shadcn/ui-style reusable primitives
│       │   ├── badge.tsx               # Status/role badges
│       │   ├── button.tsx              # Button variants (primary, secondary, destructive, ghost)
│       │   ├── card.tsx                # Card, CardHeader, CardTitle, CardDescription, CardContent
│       │   ├── input.tsx               # Form input
│       │   ├── label.tsx               # Form label
│       │   ├── select.tsx              # Dropdown select
│       │   ├── table.tsx               # Data table (Table, TableHeader, TableBody, TableRow, TableCell)
│       │   └── textarea.tsx            # Multiline text input
│       │
│       ├── dashboard/
│       │   ├── data-table-card.tsx     # Reusable data table inside a card
│       │   ├── exam-cycle-timetable-manager.tsx  # Exam cycle timetable editor
│       │   ├── simple-form.tsx         # Generic form component
│       │   └── stat-card.tsx           # Statistics display card
│       │
│       ├── coordinator/
│       │   ├── assignments-manager.tsx # Teacher assignment management UI
│       │   └── subject-create-form.tsx # Subject creation form
│       │
│       ├── moderator/
│       │   ├── moderation-workspace.tsx # Moderation review queue and actions
│       │   └── notification-inbox.tsx   # Notification list for moderators
│       │
│       ├── questions/
│       │   └── workspace.tsx           # Question contribution workspace
│       │
│       └── production/
│           ├── dean-notifications-inbox.tsx   # Dean notification view
│           ├── dean-review-workspace.tsx      # Dean paper review and selection UI
│           ├── examination-timetable-builder.tsx # Exam timetable builder
│           └── export-console.tsx             # COE export console
│
├── prisma/                              # ─── Database layer ───
│   ├── schema.prisma                   # Complete database schema (23 models, 16 enums)
│   ├── seed.ts                         # Seed data: 2 departments, 5 users, exam cycle, subject, bank, 126 slots
│   └── migrations/                     # Prisma migration history (3 migrations applied)
│
├── docs/                                # ─── Documentation ───
│   ├── api-documentation.md            # Full API reference with request/response schemas
│   ├── architecture.md                 # Detailed architecture overview
│   ├── architecture-diagram.md         # Visual architecture diagram
│   ├── deployment-guide.md             # Production deployment instructions
│   ├── final-audit-report.md           # System audit report
│   ├── monitoring-guide.md             # Monitoring and observability guide
│   ├── production-checklist.md         # Pre-production readiness checklist
│   ├── rbac-matrix.md                  # Role-based access control matrix
│   ├── requirements-matrix.md          # Requirements traceability matrix
│   └── security-checklist.md           # Security hardening checklist
│
├── tests/                               # ─── Test suite ───
│   ├── setup.ts                        # Test environment variable defaults
│   ├── unit/
│   │   ├── slot-template.test.ts       # 126-slot matrix generation verification
│   │   ├── analysis-engine.test.ts     # Deterministic analysis coverage tests
│   │   └── paper-generator.test.ts     # Balanced paper generation constraint tests
│   ├── integration/
│   │   ├── question-service.test.ts    # Full question lifecycle integration tests
│   │   └── report-locking.test.ts      # Locked bank immutability behaviour tests
│   └── permission/
│       └── question-permissions.test.ts # RBAC permission enforcement tests
│
├── scripts/
│   └── verify-prisma-client.cjs        # Prisma client integrity checker (pre-launch)
│
└── workers/                             # Background worker directory (reserved)
```

---

## Getting Started

### Prerequisites

- **Node.js** 24 or later
- **npm** 11 or later
- **Docker Desktop** (for MySQL and MinIO services)
- **Ollama** (optional, for AI summary overlay — download from [ollama.com](https://ollama.com))

### Step 1: Clone and Configure

```bash
git clone <repository-url>
cd EMQPGS
cp .env.example .env
```

Edit `.env` and set secure values for all secrets (`AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`). The defaults for MySQL, MinIO, and Ollama work with the provided Docker Compose setup.

### Step 2: Start Infrastructure Services

```bash
docker compose up -d mysql minio minio-init
```

This starts:
- **MySQL 8.4** on port 3306 with database `emqpgs` and credentials `emqpgs:emqpgs`
- **MinIO** on ports 9000 (API) and 9001 (Console)
- **minio-init** — creates the 6 required buckets, then exits

Wait for all services to be healthy:

```bash
docker compose ps
```

### Step 3: Install Dependencies

```bash
npm ci
```

This automatically runs `prisma generate` and `prisma:verify-client` via the `postinstall` script.

### Step 4: Run Database Migrations

```bash
npm run prisma:migrate
```

This applies all pending Prisma migrations to create the database schema (23 tables with relations, indexes, and constraints).

### Step 5: Seed the Database

```bash
npm run prisma:seed
```

Creates initial data:
- 2 departments (Computer Science, Electronics)
- 5 users (one per role) — see [Seed Users](#seed-users) below
- 1 active exam cycle
- 1 subject linked to the cycle
- 1 question bank with all 126 slots initialised

### Step 6: Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Step 7: Log In

Navigate to `http://localhost:3000/login` and sign in using one of the seed credentials (see [Seed Users](#seed-users)).

### Optional: Start Ollama for AI Summaries

```bash
ollama serve
```

In a separate terminal, pull the configured model:

```bash
ollama pull llama3.1
```

---

## Docker & Deployment

### Full Docker Compose Stack

To run the entire application stack (Next.js app + MySQL + MinIO):

```bash
docker compose up -d
```

This builds the Next.js application from the `Dockerfile` and starts all services.

### Docker Compose Services

| Service | Image / Build | Ports | Purpose |
|---------|--------------|-------|---------|
| `app` | Built from `Dockerfile` | 3000 | Next.js application server |
| `mysql` | `mysql:8.4` | 3306 | MySQL database |
| `minio` | `minio/minio` | 9000, 9001 | S3-compatible object storage + web console |
| `minio-init` | `minio/mc` | — | Creates 6 buckets on startup, then exits |

### MinIO Buckets Created by `minio-init`

| Bucket | Purpose |
|--------|---------|
| `question-bank-attachments` | Images, diagrams, and supplementary files attached to questions |
| `signed-reports` | HOD approval reports uploaded by moderators |
| `generated-papers` | AI reports (PDF) and generated exam papers (PDF) |
| `exports` | Final export artifacts (PDF, DOCX, ZIP) |
| `audit-files` | Archived audit logs and related files |
| `system-backups` | Database backup files (mysqldump) |

### Dockerfile

The multi-stage production build:

1. **Stage 1 (deps)**: Installs production dependencies only, with `npm ci --omit=dev`
2. **Stage 2 (builder)**: Copies deps + source, generates Prisma client, runs `next build`
3. **Stage 3 (runner)**: Node 24 Alpine, copies only built assets, exposes port 3000, runs `prisma migrate deploy` then `next start`

### Deployment Guide

Detailed deployment instructions, including environment configuration, SSL termination, reverse proxy setup, database backups, and monitoring integration, are available in `docs/deployment-guide.md`.

A production readiness checklist is available in `docs/production-checklist.md`.

---

## Testing

### Running Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode (for development)
npm run test:watch

# Run a specific test file
npx vitest run tests/unit/slot-template.test.ts

# Run tests matching a pattern
npx vitest run -t "slot generation"
```

### Test Framework

Vitest with Node.js environment, configured in `vitest.config.ts`:
- Path alias resolution (`@/` → `src/`)
- Setup file for environment variable defaults
- Test timeout: 30 seconds

### Test Suite Coverage

| Category | Test File | What It Covers |
|----------|-----------|----------------|
| **Unit: Slot Template** | `tests/unit/slot-template.test.ts` | Verifies the 126-slot matrix generation algorithm: 6 modules × 3 mark categories × 7 slots = 126 unique coordinates. Checks for duplicates, correct module/marks/slotNumber ranges, and total count. |
| **Unit: Analysis Engine** | `tests/unit/analysis-engine.test.ts` | Tests deterministic analysis engine: module coverage calculations, CO distribution mapping, RBT level distribution, duplicate detection logic, missing areas identification, chart data output format, Bloom's balance scoring. |
| **Unit: Paper Generation** | `tests/unit/paper-generator.test.ts` | Tests Paper A/B/C generation with constraint validation: 54 unique questions across 3 variants (18 each), no cross-paper duplicates, module balance enforcement, historical exclusion, usage priority, and inventory warnings. |
| **Integration: Question Service** | `tests/integration/question-service.test.ts` | Full question lifecycle: creation with auto slot reservation, editing, submission for moderation, moderation approval/rejection, revision request handling, attachment management. |
| **Integration: Report Locking** | `tests/integration/report-locking.test.ts` | Bank locking behaviour: immutability after lock (no edits, no new questions, no moderation actions), report generation constraints, paper generation preconditions. |
| **Permission: RBAC** | `tests/permission/question-permissions.test.ts` | Permission enforcement: canView (contributor sees own, moderator sees all), canEdit (only draft + own), canModerate (moderator only, only pending questions), coordinator read-only access. |

### Writing Tests

Test files should:
- Import from `@/` path alias
- Use `describe`/`it` blocks from Vitest
- Mock external dependencies (Prisma, MinIO, Ollama) where appropriate
- Follow existing patterns in the test directory

---

## Security Hardening

### Implemented Security Measures

| Measure | Implementation | Location |
|---------|---------------|----------|
| **JWT Authentication** | Dual access + refresh tokens with HMAC-SHA256 signing | `src/lib/jwt.ts` |
| **Session Idle Timeout** | Refresh token rejected if inactive beyond configurable limit | `src/lib/jwt.ts` |
| **CSRF Protection** | HMAC-SHA256 signed token in cookie + header, verified on all mutations; origin/referer check | `src/lib/csrf.ts` |
| **Rate Limiting** | In-memory rate limiter with SHA-256 hashed client keys, per-IP windowed thresholds | `src/lib/rate-limit.ts` |
| **Role-Based Access Control** | Two-layer RBAC: middleware (route-level) + withApiHandler (operation-level) | `proxy.ts`, `src/lib/api-handler.ts`, `src/modules/questions/permissions.ts` |
| **Object-Level Authorisation** | Export downloads, attachment downloads, and question views verify the requesting user's role and relationship to the resource | `src/lib/api-handler.ts`, individual route handlers |
| **Password Hashing** | bcrypt with 12 salt rounds for all stored passwords | `src/modules/users/service.ts` |
| **Short-Lived Signed URLs** | All MinIO presigned URLs expire after configurable seconds (default: 900) | `src/lib/storage/` |
| **Append-Only Audit Log** | All mutations logged with SHA-256 hash chain for tamper evidence | `src/lib/audit.ts` |
| **Immutable Locked Banks** | Once locked, question banks cannot be modified — no edits, additions, or moderation actions | `src/modules/question-banks/service.ts`, `src/modules/questions/service.ts` |
| **HTTP Security Headers** | Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| **Input Validation** | Zod schemas validate all request bodies, query params, and path params at every API boundary | `src/modules/*/validation.ts` |
| **Error Sanitisation** | Production errors return generic messages; detailed errors only in development | `src/lib/errors.ts`, `src/lib/api-handler.ts` |
| **Environment Variable Validation** | All env vars parsed and validated via Zod at startup; app refuses to start with missing/invalid configuration | `src/lib/env.ts` |
| **Secure Cookie Attributes** | HttpOnly, Secure, SameSite=Lax on all auth cookies | `src/lib/jwt.ts`, `src/lib/csrf.ts` |

### Security Documentation

Comprehensive security hardening guide and checklist: `docs/security-checklist.md`

---

## Documentation Index

| Document | Description |
|----------|-------------|
| `docs/api-documentation.md` | Complete API reference: all endpoints, request/response schemas, authentication requirements, RBAC rules |
| `docs/architecture.md` | Detailed architecture overview: layering, patterns, request lifecycle, data flow, module interactions |
| `docs/architecture-diagram.md` | Visual architecture diagram with component relationships and data flow arrows |
| `docs/deployment-guide.md` | Production deployment instructions: Docker, environment variables, reverse proxy, SSL, backups |
| `docs/monitoring-guide.md` | Monitoring and observability: health endpoint, monitoring API, structured logging, metrics |
| `docs/production-checklist.md` | Pre-production readiness checklist: security, performance, backup, monitoring items |
| `docs/rbac-matrix.md` | Complete role-based access control matrix mapping every capability to every role |
| `docs/requirements-matrix.md` | Requirements traceability matrix: features mapped to implementation components |
| `docs/security-checklist.md` | Security hardening: authentication, authorisation, CSRF, rate limiting, headers, audit, secure defaults |
| `docs/final-audit-report.md` | Final system audit with findings and remediation status |
| `app-flow.md` | Complete application workflow documentation: step-by-step usage guide for each role |
| `AGENTS.md` | AI agent behaviour rules for working with this repository |
| `CLAUDE.md` | Claude-specific assistant instructions for this codebase |

Role-specific documentation:
| Document | Audience |
|----------|----------|
| `role-coe.md` | Controller of Examinations: user guide and workflows |
| `role-coordinator.md` | Coordinator: subject management, bank setup, assignments, AI triggers |
| `role-contributor.md` | Contributor: question drafting, submission, revision handling |
| `role-moderator.md` | Moderator: review queue, approval/rejection/revision, HOD report |
| `role-dean.md` | Dean: paper review, comparison, final selection |

---

## Seed Users

The `prisma/seed.ts` script creates the following users for development and testing:

| Email | Password | Role | Department |
|-------|----------|------|------------|
| `coe@emqpgs.local` | `Password@123` | COE | Computer Science |
| `coordinator@emqpgs.local` | `Password@123` | Coordinator | Computer Science |
| `moderator@emqpgs.local` | `Password@123` | Moderator | Computer Science |
| `contributor@emqpgs.local` | `Password@123` | Contributor | Computer Science |
| `dean@emqpgs.local` | `Password@123` | Dean | Computer Science |

All seed users share the same default password. In production, change these immediately and use strong, unique passwords.

Seed data also includes:
- **Department**: Computer Science (code: `CS`), Electronics (code: `EC`)
- **Exam Cycle**: Academic Year 2025–26, Semester 4, Regular examination, Active
- **Subject**: Data Structures (code: `CS301`), linked to the active exam cycle
- **Question Bank**: Initialised for Data Structures with all 126 slots
- **Coordinator Assignment**: Coordinator user assigned to Computer Science department

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `prisma:generate + prisma:verify-client + next dev` | Start development server with hot reload |
| `build` | `prisma:generate + prisma:verify-client + next build` | Create optimised production build |
| `start` | `prisma:generate + prisma:verify-client + next start` | Start production server |
| `lint` | `eslint .` | Run ESLint across the entire codebase |
| `test` | `vitest run` | Run all tests once and exit |
| `test:watch` | `vitest` | Run tests in watch mode (re-run on file changes) |
| `postinstall` | `prisma:generate + prisma:verify-client` | Auto-generate Prisma client after npm install |
| `prisma:generate` | `prisma generate` | Generate Prisma client from `schema.prisma` |
| `prisma:verify-client` | `node scripts/verify-prisma-client.cjs` | Verify Prisma client integrity before launch |
| `prisma:migrate` | `prisma migrate dev` | Create and apply development migrations |
| `prisma:deploy` | `prisma migrate deploy` | Apply pending migrations (production-safe, no drift) |
| `prisma:seed` | `tsx prisma/seed.ts` | Execute seed script to populate development database |

---

## Design Decisions & Conventions

### Why Feature-Based Modular Architecture?

Each domain concern lives in `src/modules/<feature>/` with its own `service.ts`, `repository.ts`, and `validation.ts`. Benefits:
- **Isolation**: Changes to one feature don't risk breaking another
- **Discoverability**: All code for a feature is in one place
- **Testability**: Services can be tested with mocked repositories
- **Scalability**: New features follow the same pattern without architectural drift

### Why Separate Repository and Service Layers?

- **Repositories** handle raw database queries via Prisma — they know *how* to get data
- **Services** contain business logic — they know *what* to do with data
- This separation allows business rules to be tested independently of database specifics
- Transaction management lives in repositories, orchestration in services

### Why Custom JWT Instead of Auth.js Sessions?

- **Dual token pattern** (access + refresh) allows short-lived access tokens with longer-lived refresh tokens, improving security
- **Session idle timeout** adds a layer of protection against abandoned sessions
- **Direct JWT cookie reading** enables efficient middleware checks without database lookups
- Auth.js handles the credentials provider abstraction and session propagation

### Why Centralised `withApiHandler()`?

Every API route is wrapped in `withApiHandler()` which provides:
- Consistent error handling and response formatting
- Uniform rate limiting and CSRF protection
- Automatic audit logging for all mutations
- Standardised RBAC enforcement
- Structured request/response logging

This eliminates boilerplate from individual route handlers and ensures no security control is accidentally omitted.

### Why 126-Slot Grid?

The 6 modules × 3 mark categories (2, 5, 10 marks) × 7 slots per category = 126 total slots design ensures:
- Complete coverage planning before question authoring begins
- Coordinators can visually assess which areas need questions
- Contributors are assigned specific modules and mark categories
- The paper generator can verify full coverage before attempting assembly

### Why Deterministic Analysis + Ollama Overlay?

- The deterministic engine provides reliable, reproducible metrics that don't depend on external AI availability
- The Ollama overlay adds natural-language executive summaries for non-technical stakeholders
- If Ollama is unreachable, the deterministic report still functions fully
- This hybrid approach balances reliability with AI-enhanced readability

---

## Notes & Operational Considerations

### Database Backups

- Backup execution calls `mysqldump` directly — ensure `mysqldump` is available in the runtime environment
- In Docker, the `app` container installs `mysql-client` to provide `mysqldump`
- Backups are compressed and uploaded to the `system-backups` MinIO bucket
- Backup retention is governed by `BACKUP_RETENTION_DAYS` (default: 30 days)
- Expired backups are cleaned up automatically during workflow execution

### AI Analysis Dependencies

- The deterministic analysis engine (`src/modules/reports/analysis-engine.ts`) runs entirely within the application — no external dependencies
- The Ollama summary overlay requires:
  - Ollama to be running and reachable at `OLLAMA_BASE_URL`
  - The configured model (default: `llama3.1`) to be pulled: `ollama pull llama3.1`
- If Ollama is unavailable, AI reports are still generated with deterministic data only; the summary field will indicate that Ollama was unreachable

### File Storage

- All file operations go through MinIO via the abstraction in `src/lib/storage/`
- The system supports both S3-compatible providers and native MinIO — configured via environment variables
- Presigned URLs are short-lived (configurable via `SIGNED_URL_EXPIRY_SECONDS`, default 15 minutes) to minimise exposure
- Server-side uploads are used for generated artifacts (PDFs, DOCX, ZIP) since these are created server-side

### Immutable Locked Banks

- Once a question bank is locked (`PATCH /api/question-banks/[id]/lock`), the following operations are blocked:
  - Creating new questions
  - Editing existing questions
  - Submitting questions for moderation
  - Approving, rejecting, or requesting revisions on questions
  - Overriding question slots
  - Adding or removing attachments
- The lock is irreversible. Locked banks can only be read.
- Unlock is not supported — if a bank needs changes after locking, a new bank must be created.

### Coordinator Decision Finality

- Once a Coordinator approves a bank and forwards it to the Dean, the decision is final
- Rejection sends the bank back for further work but does not unlock it
- The Dean's paper selection is also final and irrevocable

### Rate Limiting

- Rate limiting is **in-memory** — it does not persist across server restarts or scale across multiple instances
- For multi-instance deployments, consider replacing `src/lib/rate-limit.ts` with a Redis-backed implementation
- Current defaults (120 requests per 60 seconds) are generous for development; tighten for production based on expected load

### Environment Validation

- On startup, `src/lib/env.ts` validates all required environment variables
- If any required variable is missing or malformed, the application will refuse to start with a descriptive error
- This prevents runtime failures from misconfiguration

### Email Notifications

- The email layer (`src/modules/notifications/email-service.ts`) uses a console provider by default (logs emails to stdout)
- To enable actual email delivery, implement a provider using SMTP, SendGrid, SES, or another service and swap it in `email-service.ts`
- The provider interface is defined in `src/modules/notifications/email-provider.ts`

### CI/CD

- GitHub Actions workflows are referenced in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (gitignored; create these based on your CI/CD platform)
- The Dockerfile supports multi-stage builds suitable for any container-based CI/CD pipeline

---

## Verified Build & Lint Commands

The following commands have been verified to pass:

```bash
npm run lint       # ESLint across the entire codebase
npm run build      # Production build (Next.js + Prisma)
npm run test       # All Vitest tests pass
```

Generated commands that must succeed before deployment:

```bash
npx prisma generate --no-engine   # Prisma client generation
node scripts/verify-prisma-client.cjs  # Client integrity check
```

---

## License

This project is proprietary. All rights reserved. Unauthorised copying, distribution, or use of this software is strictly prohibited without prior written permission.
