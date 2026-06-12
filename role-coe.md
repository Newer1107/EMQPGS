# COE (Controller of Examinations) — Role Documentation

## Overview

The COE is the **highest-authority role** in EMQPGS. This account owns the entire administrative lifecycle of the platform: from onboarding users and structuring departments, to overseeing production-ready exam papers and managing system health. The COE has read and write access to virtually every part of the system.

---

## Dashboard

**Route:** `/dashboard/coe`

The COE landing dashboard provides a bird's-eye summary of the entire platform state:

- Total active users across all roles
- Active departments and their subject counts
- Open exam cycles and their current phase
- Question bank fill rates (approved vs. pending vs. empty slots)
- Recent audit events
- System health indicators (queue status, storage usage, service availability)
- Pending dean reviews awaiting selection
- Export jobs in progress or recently completed

---

## Pages & Capabilities

### 1. User Management

**Route:** `/dashboard/coe/users`

The COE is the **sole role** that can create, update, and deactivate user accounts across all roles.

#### What the COE can do:

- **Create users** — provide name, email, role (`COE`, `COORDINATOR`, `MODERATOR`, `CONTRIBUTOR`, `DEAN`), and department assignment
- **Edit users** — update names, email addresses, role assignments, and department memberships
- **Deactivate / reactivate users** — soft-delete accounts (does not purge data); deactivated users lose session access immediately
- **Reset passwords** — trigger a password reset email for any user
- **View all users** — filterable by role, department, and active/inactive status
- **Audit per user** — view the audit trail scoped to a specific user's actions

#### What the COE cannot do:

- Hard-delete users (append-only model; accounts are only deactivated)
- Impersonate other users

---

### 2. Department Management

**Route:** `/dashboard/coe/departments`

Departments are the top-level organizational unit beneath the institution. Every subject, question bank, and exam cycle is scoped to a department.

#### What the COE can do:

- **Create departments** — name, code, and optional description
- **Edit department metadata** — rename, update codes
- **Deactivate departments** — prevents new subjects and question banks from being created under a department; does not delete existing data
- **Assign coordinators to departments** — link one or more `COORDINATOR` users to a department
- **View department dashboards** — see per-department fill rate summaries, active subjects, and open exam cycles

---

### 3. Exam Cycle Management

**Route:** `/dashboard/coe/exam-cycles`

An exam cycle represents a specific examination period (e.g., "Even Semester 2025", "KT March 2025"). All question banks, papers, and exports are scoped within an exam cycle.

#### What the COE can do:

- **Create exam cycles** — name, academic year, semester type (`ODD`, `EVEN`), and status
- **Transition cycle status** — move a cycle through: `DRAFT` → `ACTIVE` → `CLOSED`
- **Close exam cycles** — closing locks all associated question banks; no further contributions or moderations are permitted
- **View all exam cycles** — sorted by recency; view per-cycle statistics (banks filled, papers generated, dean reviews completed)
- **Associate subjects to a cycle** — link existing subjects (managed by coordinators) into a specific cycle

#### Constraints:

- Only one exam cycle per semester type can be `ACTIVE` at a time per department
- Closing a cycle is irreversible; it transitions all associated question banks to `LOCKED`

---

### 4. Audit Log

**Route:** `/dashboard/coe/audit`

The COE has full read access to the platform-wide, append-only audit trail.

#### What the COE can see:

- Every create, update, delete, approve, reject, generate, export, and login event
- Actor (user who performed the action), timestamp, IP address, and affected entity
- Hash chain for integrity verification (each audit entry includes a hash of the previous entry)
- Filter by: date range, role, user, action type, entity type
- Export audit log as CSV for compliance/reporting

#### What the COE cannot do:

- Modify or delete audit entries (append-only; integrity-protected)

---

### 5. Production Controls

**Route:** `/dashboard/coe/production`

This is the COE's primary operational workspace after question banks are fully moderated and dean review is complete. It is the **final stage** before exam papers are dispatched.

#### What the COE can do:

**View Generated Papers:**
- View `PAPER_A`, `PAPER_B`, `PAPER_C` for any question bank that has completed generation
- See per-paper scores: coverage score, difficulty score, quality score, duplicate risk, and AI recommendation
- View which paper the Dean selected as regular, supplementary, and KT exam

**View AI Analysis Reports:**
- View the full AI analysis report for each question bank:
  - Module coverage breakdown
  - Course Outcome (CO) coverage
  - RBT (Revised Bloom's Taxonomy) distribution
  - Difficulty distribution
  - Duplicate detection results
  - Missing coverage areas
  - Quality findings
  - Bloom's balance assessment
  - Ollama-generated natural language summary overlay

**Export Paper — PDF:**
- Generate and download a formatted PDF of the dean-selected paper
- PDF is generated via `pdf-lib` and stored in MinIO `generated-papers` bucket
- Signed URL is generated (short-lived) for secure download

**Export Paper — DOCX:**
- Generate and download a `.docx` formatted exam paper
- DOCX is generated via the `docx` library and stored in MinIO `exports` bucket
- Signed URL for download

**Export ZIP Bundle:**
- Export a ZIP archive containing:
  - All three papers (A, B, C) as PDFs
  - AI analysis report as PDF
  - Dean review summary
  - Question metadata JSON
- ZIP is stored in MinIO `exports` bucket with a signed download URL

**Print Flow:**
- Triggers a PDF download of the selected paper formatted for print layout
- Uses the same PDF generation pipeline; download prompts the browser print dialog

#### Access constraints:

- Exports require dean review to be **completed** (a paper must be selected for each of regular, supplementary, and KT)
- Each export is tracked in the audit trail
- Object-level authorization ensures a COE can only export papers from their institution's question banks
- Signed URLs expire per `SIGNED_URL_EXPIRY_SECONDS` configuration

---

### 6. Monitoring

**Route:** `/dashboard/coe/monitoring`

**APIs:** `GET /api/health`, `GET /api/monitoring`

The COE has exclusive access to the system monitoring dashboard.

#### What the COE can see:

- **Service health:** MySQL, Redis, MinIO, Ollama reachability and latency
- **Queue status:** BullMQ job queue depths, active jobs, failed jobs, retry counts for all queues (AI analysis, paper generation, export, backup, retention cleanup)
- **Storage usage:** per-bucket object count and storage size across all MinIO buckets
- **Background workers:** worker process health and last heartbeat
- **Nightly backup status:** last backup timestamp, size, success/failure
- **Retention cleanup:** last run timestamp and objects purged
- **Rate limiting:** current rate limit counters and window resets
- **Session metrics:** active session count, idle timeout events

#### Programmatic access:

- `GET /api/health` — lightweight liveness probe (requires `HEALTHCHECK_TOKEN` header in production)
- `GET /api/monitoring` — full system metrics payload (COE-authenticated only)

---

## APIs Available to the COE

The COE has access to **all** API routes. Key ones specific to COE authority:

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `GET` | `/api/auth/csrf` | CSRF token fetch |
| `GET/POST` | `/api/question-banks/[id]/reports` | View / trigger AI report |
| `GET/POST` | `/api/question-banks/[id]/papers` | View / trigger paper generation |
| `GET/POST` | `/api/question-banks/[id]/dean-review` | View dean review status |
| `GET/POST` | `/api/exports` | List / create export jobs |
| `GET` | `/api/exports/[id]/download` | Download export (signed URL) |
| `POST` | `/api/backups` | Trigger manual backup |
| `GET` | `/api/monitoring` | System metrics |
| `GET` | `/api/health` | Health probe |

---

## Security Responsibilities

The COE is the security administrator of the platform:

- Must rotate `CSRF_SECRET` and `HEALTHCHECK_TOKEN` in production
- Responsible for reviewing the audit log for anomalies
- Can deactivate accounts suspected of misuse
- Must configure `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS` appropriately
- Must ensure `SESSION_IDLE_TIMEOUT_MINUTES` is set per institutional policy
- Should verify `SIGNED_URL_EXPIRY_SECONDS` is short enough to prevent URL leakage

---

## What the COE Cannot Do

- Directly approve or reject individual questions (that is MODERATOR territory)
- Contribute questions (that is CONTRIBUTOR territory)
- Perform the dean paper selection (that is DEAN territory)
- Bypass the locked-bank constraint (once a bank is `LOCKED`, no content changes are possible, even for COE)

---

## Seed Account

| Field | Value |
|-------|-------|
| Email | `coe@emqpgs.local` |
| Password | `Password@123` |
| Role | `COE` |