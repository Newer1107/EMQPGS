# DEAN — Role Documentation

## Overview

The DEAN is the **final academic authority** in the exam paper selection process within EMQPGS. After the COE and Coordinators have set up the system, Contributors have filled question banks, Moderators have reviewed every question, and the AI has generated three candidate exam papers (A, B, C) with analysis scores — the Dean steps in to make the **binding selection decision**.

The Dean's role is narrow but carries high responsibility. They review three fully generated and AI-scored papers and select which paper will be used for the regular exam, the supplementary exam, and the KT (Keep Term / Arrear) exam.

---

## Dashboard

**Route:** `/dashboard/dean`

The Dean landing dashboard shows:

- List of question banks pending Dean review (papers generated, awaiting selection)
- List of completed Dean reviews (selections already made)
- Per-bank summary: subject name, exam cycle, and generation timestamp
- Notification inbox (new review requests from coordinators/COE)

---

## Pages & Capabilities

### 1. Dean Review

**Route:** `/dashboard/dean/review`

**API:** `GET/POST /api/question-banks/[id]/dean-review`

This is the Dean's only operational page. It presents the three generated papers for each question bank and facilitates the selection.

---

#### What the Dean Sees Per Paper

For each of `PAPER_A`, `PAPER_B`, and `PAPER_C`, the Dean is presented with:

**AI Scores and Metrics:**

| Metric | Description |
|--------|-------------|
| **Coverage Score** | How well the paper covers all 6 modules proportionally |
| **Difficulty Score** | Balance of Easy / Medium / Hard questions across mark types |
| **Quality Score** | Aggregate quality signal from moderator-approved questions and AI findings |
| **Duplicate Risk** | Probability that the paper contains questions similar to recently used papers |
| **AI Recommendation** | Natural language recommendation from the Ollama-generated summary (e.g., "Best suited for regular exam due to balanced module coverage and low duplicate risk") |

**Paper Content (Read-Only):**

The Dean can expand each paper to view:
- All selected questions organized by module
- Mark type (2, 5, 10 marks) and module number per question
- CO coverage per question
- RBT level per question
- Difficulty level per question

The Dean reads question content to make an informed selection — they do not modify any questions.

---

#### Selection Decision

The Dean **must** make three selections from the three papers:

| Selection | Description |
|-----------|-------------|
| **Regular Exam Paper** | The main exam paper for all regular students in the exam cycle |
| **Supplementary Exam Paper** | For students re-appearing after a failed exam |
| **KT (Keep Term) Paper** | For students with attendance shortfalls or special cases |

**Rules:**
- Each paper (A, B, C) can be assigned to **only one** of the three slots
- All three slots must be filled before the selection can be submitted
- A paper can only be selected once — no two slots can map to the same paper
- Example valid selection: Regular → PAPER_B, Supplementary → PAPER_A, KT → PAPER_C

---

#### Submitting the Selection

Once the Dean has reviewed all three papers and made their three selections:

1. They click **Submit Selection**
2. The system validates that all three slots are assigned to distinct papers
3. On success, the dean review record is saved with:
   - `regularPaper`: the selected paper ID
   - `supplementaryPaper`: the selected paper ID
   - `ktPaper`: the selected paper ID
   - `reviewedBy`: Dean's user ID
   - `reviewedAt`: timestamp
4. The COE receives a notification that Dean review is complete
5. The COE can now proceed to export the selected papers

**The selection is final.** Once submitted, the Dean cannot change the selection (any amendments require COE intervention at the administrative level).

---

#### Review Metrics — Deeper Explanation

**Coverage Score:**

Calculated from how many of the 6 modules are represented in the paper and whether the question count per module is within the target distribution range. A score of 100 means all modules are equally represented.

**Difficulty Score:**

Assesses whether the paper has an appropriate mix of difficulty levels. A well-balanced paper typically has ~40% Easy, ~40% Medium, ~20% Hard questions. The difficulty score penalizes skewed distributions.

**Quality Score:**

Derived from:
- The proportion of questions that passed moderation on the first attempt (no revisions or rejections in their history)
- AI-flagged quality issues (e.g., ambiguous wording, duplicate phrasing, insufficient rigor for the mark value)
- RBT level appropriateness per mark type

**Duplicate Risk:**

Compares selected questions against the historical usage database. Questions used in the last 1–2 exam cycles carry a higher duplicate risk penalty. A score near 0% means the paper is entirely fresh; above 20% is flagged as concerning.

**AI Recommendation:**

Generated by the Ollama model as a free-text summary overlay on the quantitative scores. The recommendation synthesizes all four scores and may include specific notes such as: "Module 3 is underrepresented" or "High concentration of L2-level questions; limited higher-order thinking coverage."

---

### 2. Notification Management

The Dean receives in-platform notifications for:

- A new question bank's papers are ready for Dean review
- A reminder if a review has been pending for more than N days (configurable)
- Confirmation when their selection is successfully submitted

---

## Complete Dean Workflow

```
1. Dean logs in → lands on /dashboard/dean
2. Sees list of banks pending review
3. Opens a bank → lands on /dashboard/dean/review?bank=[id]
4. Reads PAPER_A scores and content
5. Reads PAPER_B scores and content
6. Reads PAPER_C scores and content
7. Assigns:
   - Regular Exam Paper = PAPER_[X]
   - Supplementary Paper = PAPER_[Y]
   - KT Paper            = PAPER_[Z]
8. Clicks Submit Selection
9. System validates and persists selection
10. COE is notified → proceeds to export
```

---

## What the Dean Can See vs. Cannot Touch

| Content | Can See | Can Do |
|---------|---------|--------|
| Generated papers (A, B, C) | ✅ | Read-only |
| AI scores per paper | ✅ | Read-only |
| Ollama recommendation | ✅ | Read-only |
| Question content in each paper | ✅ | Read-only |
| CO and RBT metadata per question | ✅ | Read-only |
| Full AI analysis report | ✅ | Read-only |
| Select regular/supplementary/KT paper | ✅ | ✅ |
| Individual questions (edit/approve/reject) | ❌ | ❌ |
| User accounts | ❌ | ❌ |
| Subject or bank management | ❌ | ❌ |
| Paper generation trigger | ❌ | ❌ |
| Exports | ❌ | ❌ |
| Audit logs | ❌ | ❌ |
| Monitoring | ❌ | ❌ |

---

## APIs Available to the Dean

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `GET` | `/api/auth/csrf` | CSRF token |
| `GET` | `/api/question-banks/[id]/dean-review` | Fetch papers and scores for review |
| `POST` | `/api/question-banks/[id]/dean-review` | Submit paper selection |

---

## Security Model

- The Dean can only review banks that have been explicitly flagged as ready for Dean review (papers generated and scores computed)
- Object-level authorization ensures the Dean cannot access banks from institutions they are not associated with
- The selection submission is CSRF-protected
- All selection actions are recorded in the append-only audit trail with the Dean's identity and timestamp
- The Dean's review is a one-way door — once submitted, selections cannot be self-reversed (COE-level action required for any corrections)

---

## What the Dean Cannot Do

- Create, edit, or deactivate user accounts
- Create subjects, question banks, or exam cycles
- Contribute questions
- Approve or reject individual questions
- Trigger AI analysis or paper generation
- Export papers (COE-only)
- Access the audit log
- Access system monitoring
- Change a selection after it has been submitted

---

## Seed Account

| Field | Value |
|-------|-------|
| Email | `dean@emqpgs.local` |
| Password | `Password@123` |
| Role | `DEAN` |