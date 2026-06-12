# MODERATOR — Role Documentation

## Overview

The MODERATOR is the **quality gatekeeper** of EMQPGS. Their sole but critical responsibility is reviewing questions submitted by Contributors and making the moderation decision: approve, reject, or request revision. Moderators have **full visibility** into all questions in every question bank assigned to them — unlike Contributors who can only see their own questions.

A Moderator does not create users, manage subjects, generate papers, or perform any administrative tasks. They are a focused, content-review role.

---

## Dashboard

**Route:** `/dashboard/moderator`

The Moderator landing dashboard shows:

- Count of questions pending review across all assigned banks
- Count of approved, rejected, and revision-requested questions
- Questions awaiting revision resubmission
- Recent moderation activity (last 20 actions by this moderator)
- Notification inbox (new submissions, revision resubmissions)
- Quick-access list of question banks with pending items, sorted by urgency

---

## Pages & Capabilities

### 1. Question Moderation

**Route:** `/dashboard/moderator/questions`

This is the Moderator's primary workspace. It provides access to all questions across every question bank they have been assigned to review.

#### Question Visibility:

Unlike Contributors (who only see their own questions), the Moderator sees **everything** in their assigned banks:

- All questions across all 126 slot positions
- Questions in any status: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `REVISION_SUBMITTED`
- The name and email of the Contributor who submitted each question
- The full question text, mark value, module number, CO tag, and RBT level
- All attachments (images, diagrams, reference material) linked to the question, accessible via presigned MinIO download URLs
- The full revision history of a question (all previous versions and moderator comments)
- Any prior rejection notes or revision request messages from previous review cycles

#### Moderation Actions:

For each question in `PENDING` or `REVISION_SUBMITTED` status, the Moderator can perform one of three actions:

---

**1. Approve**

- Marks the question as `APPROVED`
- The slot is counted as filled and valid for paper generation
- The Contributor receives a notification that their question was approved
- The approval is recorded in the audit trail with timestamp and moderator identity

---

**2. Reject**

- Marks the question as `REJECTED`
- The slot returns to an empty/available state (the rejected question is archived but not deleted)
- The Moderator **must** provide a rejection reason (free text, required field)
- The Contributor receives a notification with the rejection reason
- Rejected questions are visible to the Moderator in history but do not count toward bank fill rate

---

**3. Request Revision**

- Marks the question as `REVISION_REQUESTED`
- The slot is temporarily held by the Contributor for correction
- The Moderator **must** provide specific revision instructions (free text, required field)
- The Contributor receives a notification with the revision instructions
- The Contributor can resubmit, changing status to `REVISION_SUBMITTED`
- The Moderator then reviews again and can approve, reject, or request another revision

---

#### Filtering and Navigation:

The Moderator can filter questions by:

- Status (`PENDING`, `REVISION_SUBMITTED`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`)
- Module number (1–6)
- Mark type (2-mark, 5-mark, 10-mark)
- Question bank (subject + exam cycle)
- Contributor name

Sorting options:

- Submission date (oldest first — to prioritize backlog)
- Submission date (newest first)
- Mark value
- Module

---

#### Moderation Override:

Moderators have **override capability** — they can change a previously approved question back to pending review if an issue is discovered after approval, as long as the question bank has not yet been locked. This override is logged in the audit trail.

---

### 2. Attachment Viewing

Attachments submitted with questions (uploaded to MinIO `question-bank-attachments` bucket) are accessible to the Moderator via **presigned download URLs**. These URLs are:

- Short-lived (configured by `SIGNED_URL_EXPIRY_SECONDS`)
- Generated server-side on demand
- Not cached or shareable beyond the session

The Moderator can view images and diagrams inline in the question review panel.

---

### 3. Notification Management

Moderators receive in-platform notifications for:

- A new question is submitted (`PENDING`) in a bank assigned to them
- A Contributor resubmits a revised question (`REVISION_SUBMITTED`)
- A question bank is approaching its moderation deadline
- A coordinator has flagged a bank for urgent review

Moderators can mark notifications as read individually or bulk-clear them from the dashboard.

---

## The Moderation Lifecycle

Understanding how a question moves through moderation:

```
Contributor submits
        ↓
    [PENDING]
        ↓
  Moderator reviews
        ↓
  ┌─────┼─────────┐
APPROVE  REJECT  REQUEST REVISION
  ↓       ↓          ↓
[APPROVED] [REJECTED] [REVISION_REQUESTED]
                           ↓
                  Contributor resubmits
                           ↓
                  [REVISION_SUBMITTED]
                           ↓
                  Moderator reviews again
                  (cycle repeats until APPROVED or REJECTED)
```

---

## What the Moderator Can See vs. Cannot Touch

| Capability | Can See | Can Do |
|------------|---------|--------|
| All questions in assigned banks | ✅ | — |
| Contributor identity per question | ✅ | — |
| Revision history and comments | ✅ | — |
| Attachments (via signed URL) | ✅ | — |
| AI analysis reports | ✅ | — |
| Generated papers | ✅ | — |
| User accounts | ❌ | ❌ |
| Subject or bank creation | ❌ | ❌ |
| Paper generation trigger | ❌ | ❌ |
| Dean review | ❌ | ❌ |
| Exports | ❌ | ❌ |
| Audit logs | ❌ | ❌ |
| Monitoring | ❌ | ❌ |

---

## APIs Available to the Moderator

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `GET` | `/api/auth/csrf` | CSRF token |
| `GET` | `/api/question-banks/[id]/reports` | View AI report |

All moderation actions (approve, reject, request revision) are performed through the moderation UI which calls protected internal API routes — these are CSRF-protected and role-verified at the route handler level.

---

## Security Model

- Moderators can only review questions in banks explicitly assigned to them
- Object-level authorization prevents cross-department question access
- All moderation decisions are recorded in the append-only audit trail
- Moderators cannot delete questions — only approve or reject (soft state transitions)
- Session idle timeout applies; inactive sessions are terminated per `SESSION_IDLE_TIMEOUT_MINUTES`

---

## What the Moderator Cannot Do

- Create, edit, or deactivate user accounts (COE-only)
- Create subjects, question banks, or exam cycles (Coordinator/COE)
- Contribute or submit new questions (CONTRIBUTOR-only)
- Trigger AI analysis or paper generation (Coordinator)
- Perform dean paper selection (DEAN-only)
- Export papers (COE-only)
- View the audit log (COE-only)
- View system monitoring (COE-only)

---

## Seed Account

| Field | Value |
|-------|-------|
| Email | `moderator@emqpgs.local` |
| Password | `Password@123` |
| Role | `MODERATOR` |