# CONTRIBUTOR — Role Documentation

## Overview

The CONTRIBUTOR is the **content creator** of EMQPGS — typically a faculty member or teacher assigned to contribute exam questions for specific subjects and modules. Their work forms the raw material that the entire system processes: questions they submit are moderated, analyzed by AI, and ultimately assembled into exam papers.

Contributors have the **narrowest access scope** in the system. They can only see and interact with question slots assigned to them. They cannot see other contributors' questions, access reports, view generated papers, or perform any administrative actions.

---

## Dashboard

**Route:** `/dashboard/contributor`

The Contributor landing dashboard shows:

- Assigned question banks with fill progress per module
- Slot-level breakdown: how many of the contributor's assigned slots are empty, draft, pending, approved, rejected, or revision-requested
- Notifications inbox (approval confirmations, rejection notices, revision requests)
- Recent activity timeline (last submissions and their outcomes)
- Quick-access links to unfilled or revision-requested slots

---

## Pages & Capabilities

### 1. Question Contribution

**Route:** `/dashboard/contributor/questions`

This is the Contributor's primary workspace. It shows only the question slots assigned to this contributor in their assigned question banks.

---

#### Understanding Slots

Each question bank has **126 slots** organized as:

- 6 modules
- Per module: 7 slots × 3 mark types (2-mark, 5-mark, 10-mark)

A Contributor is assigned to specific **modules** within a bank. They can only interact with the slots within those modules. For example, if assigned to Module 2 and Module 4 of a subject, the Contributor sees and fills only the 42 slots (21 per module) in those two modules.

**Slot coordinate format:** `MODULE_NUMBER.MARK_TYPE.SLOT_INDEX`  
Example: `2.5.3` = Module 2, 5-mark question, slot 3

---

#### Submitting a New Question

For each empty slot, the Contributor can submit a new question:

**Required fields:**
- **Question text** — the full question statement
- **Mark value** — pre-determined by the slot type (2, 5, or 10 marks); not editable
- **Module number** — pre-determined by the slot; not editable
- **CO (Course Outcome) tag** — must select the relevant CO this question addresses
- **RBT level** — must select the Revised Bloom's Taxonomy level:
  - L1: Remember
  - L2: Understand
  - L3: Apply
  - L4: Analyze
  - L5: Evaluate
  - L6: Create
- **Difficulty level** — Easy, Medium, Hard

**Optional fields:**
- **Attachments** — upload images or diagrams (e.g., circuit diagrams, data tables, figures)
  - Uploaded to MinIO `question-bank-attachments` bucket via presigned upload URL
  - Supported file types: PNG, JPEG, PDF
  - Maximum attachment size: configured per deployment

**On submission:**
- Question status changes from empty → `PENDING`
- The slot is marked as pending moderation
- The Coordinator and assigned Moderator receive a notification
- The Contributor can no longer edit the question until a moderator responds

---

#### Saving as Draft

Before formally submitting, a Contributor can save a question as `DRAFT`:

- Draft questions are only visible to the Contributor
- Drafts are not visible to Moderators or Coordinators
- Drafts do not count toward bank fill rate
- A Contributor can edit drafts freely before submitting
- Submitting a draft promotes it to `PENDING`

---

#### Question Statuses the Contributor Sees

| Status | Meaning | Contributor Action |
|--------|---------|-------------------|
| `DRAFT` | Saved locally, not submitted | Can edit and submit |
| `PENDING` | Submitted, awaiting moderation | Read-only; cannot edit |
| `APPROVED` | Accepted by moderator | Read-only; cannot edit |
| `REJECTED` | Declined by moderator | Can view rejection reason; slot is freed for a new submission |
| `REVISION_REQUESTED` | Moderator asked for changes | Must revise and resubmit |
| `REVISION_SUBMITTED` | Revised version submitted | Read-only; awaiting moderator re-review |

---

#### Handling Revision Requests

When a Moderator requests a revision:

1. The Contributor receives a notification with the moderator's revision instructions
2. The question status changes to `REVISION_REQUESTED`
3. The Contributor opens the question in edit mode
4. They can read the moderator's specific feedback
5. They update the question content (text, CO tag, RBT level, difficulty, attachments)
6. On resubmission, the status changes to `REVISION_SUBMITTED`
7. The Moderator is notified to re-review

The Contributor **can go through multiple revision cycles** until the question is either approved or rejected.

---

#### Handling Rejections

When a Moderator rejects a question:

1. The Contributor receives a notification with the rejection reason
2. The slot is freed — it returns to an empty state
3. The Contributor can submit a new, entirely different question to that slot
4. The rejected question is archived and visible in the Contributor's history (read-only)

---

### 2. Visibility Boundary

The Contributor's visibility is **strictly scoped** to their own work:

| Content | Visible to Contributor |
|---------|----------------------|
| Their own questions (all statuses) | ✅ |
| Other contributors' questions | ❌ |
| Full bank question list | ❌ |
| Moderator identity for their reviews | ✅ (name shown) |
| AI analysis reports | ❌ |
| Generated papers | ❌ |
| Dean selections | ❌ |
| User accounts | ❌ |
| Subject/bank structure (read-only own modules) | ✅ |

---

### 3. Attachments

- Attachments are uploaded via **presigned upload URLs** generated server-side
- The file goes directly from the Contributor's browser to MinIO (no server proxy)
- After upload, the MinIO object key is saved with the question record
- Presigned download URLs are generated on-demand when the Contributor or Moderator views the question
- If a question is rejected and a new submission is made, old attachments are retained in storage (associated with the archived question) but not carried over to the new submission

---

### 4. Notification Management

Contributors receive in-platform notifications for:

- Their question is approved
- Their question is rejected (with rejection reason)
- A revision is requested (with revision instructions)
- The submission deadline for their assigned bank is approaching
- Their module assignment is changed or revoked by the Coordinator

Notifications can be dismissed individually or bulk-cleared from the dashboard.

---

## Usage Priority and Question Reuse

When the paper generation engine runs, it tracks each question's usage history:

- `usageCount` — how many times the question has appeared in a generated paper
- `lastUsedExam`, `lastUsedYear`, `lastUsedSemester`, `lastUsedType`

Questions with lower usage counts are **prioritized** for selection in new papers, and questions used in recent exams may be excluded entirely per the historical exclusion rules. Contributors do not see these metrics directly, but this system ensures their questions are used fairly and rotated appropriately.

---

## APIs Available to the Contributor

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `GET` | `/api/auth/csrf` | CSRF token |

All question submission, draft, revision, and attachment actions are performed through the question UI which calls protected internal API routes — CSRF-protected and role-verified.

---

## Security and Privacy

- Object-level authorization ensures a Contributor can only access their own questions
- Attempting to access another contributor's question (via direct URL manipulation) returns a 403 Forbidden response
- Attachment presigned URLs are short-lived and scoped to authenticated sessions
- Audit trail records every submission, resubmission, draft save, and attachment upload
- Session idle timeout terminates inactive sessions per `SESSION_IDLE_TIMEOUT_MINUTES`

---

## What the Contributor Cannot Do

- View other contributors' questions
- Approve or reject any question (including their own)
- Create or manage user accounts
- Create subjects, question banks, or exam cycles
- Trigger AI analysis or paper generation
- View AI reports or generated papers
- Perform dean review
- Export papers
- Access audit logs or system monitoring

---

## Seed Account

| Field | Value |
|-------|-------|
| Email | `contributor@emqpgs.local` |
| Password | `Password@123` |
| Role | `CONTRIBUTOR` |