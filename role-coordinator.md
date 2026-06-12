# COORDINATOR — Role Documentation

## Overview

The COORDINATOR is the **department-level operations manager** in EMQPGS. They bridge the gap between the COE's administrative setup and the day-to-day contribution and moderation workflow. A Coordinator is assigned to one or more departments by the COE and is responsible for managing subjects, question banks, teacher (contributor) assignments, and overseeing the readiness of question banks for paper generation.

Coordinators have **read-only visibility** into all questions within their department's question banks — they cannot modify, approve, or reject questions themselves, but they can see the full picture.

---

## Dashboard

**Route:** `/dashboard/coordinator`

The Coordinator landing dashboard shows:

- Departments assigned to this coordinator
- Active exam cycles across their departments
- Per-subject question bank fill status (how many of the 126 slots are filled, pending, approved, rejected)
- Recent contribution activity (questions submitted, under review, approved)
- Pending teacher assignments
- Notification inbox (moderation completions, coordinator-tagged events)

---

## Pages & Capabilities

### 1. Subject Management

**Route:** `/dashboard/coordinator/subjects`

Subjects are the academic units within a department that map directly to a question bank. The Coordinator creates and manages subjects under their assigned departments.

#### What the Coordinator can do:

- **Create subjects** — define subject name, subject code, department, semester, and credit load
- **Edit subject metadata** — rename, update codes, change semester mapping
- **Deactivate subjects** — prevent new question banks from being created for a subject
- **Link subjects to exam cycles** — associate an active subject with a running exam cycle so question banks can be initialized
- **View subject list** — filterable by department, semester, and active/inactive status
- **View per-subject bank status** — see the fill rate and moderation status of the question bank for each subject in a given exam cycle

#### Constraints:

- Coordinators can only manage subjects under departments they are assigned to
- Subjects cannot be permanently deleted (deactivate-only model)

---

### 2. Question Bank Management

**Route:** `/dashboard/coordinator/question-banks`

A question bank is the container that holds all questions for a specific subject in a specific exam cycle. Each bank has a fixed structure of 126 slot coordinates.

#### Bank Structure:

- **6 modules** per subject
- **Per module:** 7 slots for 2-mark questions + 7 slots for 5-mark questions + 7 slots for 10-mark questions
- **Total:** 6 × 3 × 7 = **126 slots per bank**

#### What the Coordinator can do:

- **Initialize question banks** — create the question bank for a subject-cycle combination; this generates all 126 empty slot coordinates
- **View bank fill status** — see per-slot status (empty, draft, pending moderation, approved, rejected) across all 126 positions
- **Monitor bank readiness** — view the percentage of approved slots and whether the bank meets minimum thresholds for paper generation
- **View all questions in a bank** — full read-only visibility into every question (including contributor-specific questions; the Coordinator sees all)
- **Trigger AI analysis** — request an AI analysis report for a fully or sufficiently filled bank
- **View AI analysis reports** — read the generated reports including module coverage, CO coverage, RBT distribution, Bloom's balance, duplicate detection, and Ollama summary
- **Trigger paper generation** — initiate the generation of `PAPER_A`, `PAPER_B`, `PAPER_C` for a question bank that meets generation criteria
- **View generated papers** — review all three generated papers and their scores before they proceed to Dean review
- **Lock a bank manually** — in coordination with the exam cycle lifecycle, mark a bank as locked when contribution is complete

#### Constraints:

- Cannot approve or reject individual questions
- Cannot modify question content
- Cannot perform the paper selection (Dean's responsibility)
- A bank can only be locked if the exam cycle is moving toward closure; locking is irreversible

---

### 3. Teacher Assignments

**Route:** `/dashboard/coordinator/assignments`

The Coordinator manages which `CONTRIBUTOR` users are assigned to which question bank slots (by module).

#### What the Coordinator can do:

- **Assign contributors to a bank** — specify which contributor(s) are responsible for which modules within a question bank
- **Reassign contributors** — change module ownership before contribution begins
- **Remove assignments** — revoke a contributor's access to a module (they lose the ability to contribute to that module's slots)
- **View assignment matrix** — see a grid of bank modules vs. assigned contributors
- **Notify contributors** — send an in-platform notification to assigned contributors prompting them to begin contributing

#### Constraints:

- Only `CONTRIBUTOR` role users can be assigned
- Assignment changes after a contributor has already submitted questions do not delete those questions; they only affect future access
- Contributors can only be assigned to modules within banks in the Coordinator's departments

---

### 4. Question Visibility (Read-Only)

**Route:** `/dashboard/coordinator/questions`

This view gives the Coordinator comprehensive read-only visibility into all questions across their department's question banks.

#### What the Coordinator can see:

- Every question across all modules, all slot positions, all marks categories
- Question status: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`
- Contributor who submitted the question (name and email)
- Moderator notes and review history
- Attachments linked to a question (images, diagrams) via presigned MinIO URLs
- CO (Course Outcome) tagging and RBT level per question
- Full question text and mark value

#### What the Coordinator cannot do:

- Edit question content
- Change question status (approve/reject/request revision)
- Delete questions
- Create questions

---

## APIs Available to the Coordinator

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `GET` | `/api/auth/csrf` | CSRF token |
| `GET` | `/api/question-banks/[id]/reports` | View AI report |
| `POST` | `/api/question-banks/[id]/reports` | Trigger AI analysis |
| `GET` | `/api/question-banks/[id]/papers` | View generated papers |
| `POST` | `/api/question-banks/[id]/papers` | Trigger paper generation |
| `GET` | `/api/question-banks/[id]/dean-review` | View dean review status |

---

## Notifications Received

The Coordinator receives in-platform notifications for:

- A contributor submits a question (slot filled)
- A moderator approves, rejects, or requests revision on a question in their bank
- An AI analysis report is ready
- Paper generation completes
- Dean review is completed (paper selections are available)
- A question bank approaches its submission deadline

---

## What the Coordinator Cannot Do

- Create or manage user accounts (COE-only)
- Approve or reject questions (MODERATOR-only)
- Contribute questions (CONTRIBUTOR-only)
- Perform dean paper selection (DEAN-only)
- Access the monitoring dashboard (COE-only)
- Access audit logs (COE-only)
- Export final papers (COE-only)
- Access other departments' question banks or subjects

---

## Seed Account

| Field | Value |
|-------|-------|
| Email | `coordinator@emqpgs.local` |
| Password | `Password@123` |
| Role | `COORDINATOR` |