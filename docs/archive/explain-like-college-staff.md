# Examination Management System — Explained for College Staff

---

## Section 1: What problem does this system solve?

### Before this software

Making a question paper was a messy, manual process.

A coordinator would call a few faculty members and ask them to submit questions. Some would email Word documents. Some would handwrite. Some would send whatever they had from last year. The coordinator would sit with a stack of papers, scissors, and glue — cutting questions from different submissions and pasting them together to make a paper.

Then they would send the draft to a moderator. The moderator would read it, mark corrections, and send it back. The coordinator would fix it. Maybe send it again. Sometimes the back-and-forth took weeks.

Then the paper would go to the Controller of Examinations (COE) for final approval. The COE had no way to check whether the paper covered all modules, all course outcomes, or all difficulty levels. They just trusted that someone had done that work.

At the end, someone typed the final question paper into a Word file and printed it.

Problems with this approach:

- **No visibility.** The COE had no idea whether the paper was ready until someone told them.
- **No tracking.** If a faculty member did not submit questions, nobody knew until the deadline passed.
- **No coverage checks.** Nobody could prove that all topics were covered equally.
- **No version control.** The final paper could be edited after approval with no record.
- **Manual assembly.** Someone had to physically arrange questions into a paper format.
- **No backups.** If the coordinator's laptop crashed, everything was lost.

### How this software changes it

This system turns the entire process into a structured, trackable workflow that lives online.

Instead of emailing documents, everyone works inside the same system. Instead of cutting and pasting, the system handles the paper assembly automatically. Instead of blind trust, the system checks coverage — every module, every course outcome, every difficulty level — and reports gaps.

The COE can open a dashboard and see exactly where every department stands. The coordinator can see whether contributors have submitted their questions. The moderator can review questions one by one without chasing anyone for files.

When the time comes to make the final paper, the system generates it in three variants (A, B, and C) so that students sitting next to each other get different papers. The final paper is locked — nobody can change it after approval.

---

## Section 2: Who uses the system?

### COE — Controller of Examinations

The COE is the system administrator for the whole college.

**What they do:**

- Create the academic calendar (academic years and exam cycles)
- Add departments and users
- Assign coordinators to departments
- Activate exam cycles
- Monitor progress across all departments
- Trigger backups and exports

**What they can see:**

Everything. All departments, all subjects, all question banks, all papers.

**What they cannot do:**

Write questions, review questions, or approve question banks. Those tasks belong to other roles.

---

### Dean

The Dean has a supervisory role.

**What they do:**

- Review completed question banks
- Give final sign-off on generated papers
- View readiness across departments

**What they can see:**

All question banks and papers across all departments.

**What they cannot do:**

Write questions, moderate, create subjects, or manage users.

---

### Coordinator

Each department has at least one coordinator. This is the person who drives the process for their department.

**What they do:**

- Create subjects for their department
- Link subjects to exam cycles
- Initialize question banks
- Assign contributors to fill question slots
- Assign a moderator to review questions
- Check readiness before advancing the bank
- Advance the bank through stages (Drafting → Moderation → Approval → Complete)
- Make the final approve/reject decision

**What they can see:**

Only their own department's data. They cannot see other departments' question banks.

**What they cannot do:**

Change other departments' data, approve their own questions, or skip stages.

---

### Moderator

Each question bank needs a moderator. This is a faculty member who reviews questions for quality.

**What they do:**

- Review questions submitted by contributors
- Approve questions that meet standards
- Reject questions that do not
- Request revisions with specific feedback

**What they can see:**

All questions in the question banks assigned to them.

**What they cannot do:**

Submit their own questions to the same bank they moderate, approve banks, or generate papers.

---

### Contributor

Contributors are faculty members who write questions.

**What they do:**

- Write questions and submit them to the question bank
- Revise and resubmit questions when a moderator requests changes

**What they can see:**

The subjects and question banks assigned to them. They can see which slots need questions.

**What they cannot do:**

Approve or reject other people's questions, view other departments, or see the final paper before it is generated.

---

## Section 3: What happens in one academic year?

### Academic year

An academic year runs from June to May. For example:

- **2026-2027**: starts June 2026, ends May 2027

### Odd and Even semesters

Each academic year has two halves:

- **Odd semester** — includes Semesters 1, 3, 5, and 7
- **Even semester** — includes Semesters 2, 4, 6, and 8

The COE sets which half is active for the current period.

**Why only some semesters are active at a time?**

Because students in a 4-year engineering program advance through all eight semesters. In any given academic year, the college runs either the odd-numbered semesters or the even-numbered ones. For example:

In **2026-2027 (Odd)**:

- Third-year students are in Semester 5 (odd → active)
- Fourth-year students are in Semester 7 (odd → active)
- First-year students are in Semester 1 (odd → active)
- Second-year students are in Semester 3 (odd → active)
- Semesters 2, 4, 6, and 8 (even) are not currently running

The system uses this setting as a default filter. When a coordinator creates subjects or exam cycles, the system suggests the active semesters first. But if needed, you can still see and work with the other semesters.

---

## Section 4: Real example

Throughout this document, we will follow one specific case:

| Detail | Value |
|---|---|
| Department | Cyber Security (CSEC) |
| Subject | Cryptography |
| Subject code | CSE101 |
| Semester | 5 |
| Academic year | 2026-2027 |
| Exam type | ENDSEM (End Semester Examination) |

This is a real course from the seed data. A third-year Cyber Security student takes Cryptography in Semester 5, and at the end of the semester, they sit for an end-semester exam. This system manages how that exam paper is created.

---

## Section 5: Step-by-step story

### Step 1 — COE creates the academic year

**What happens:**

The COE logs in and creates the academic year "2026-2027" with a start date of June 1, 2026, and an end date of May 31, 2027. The COE sets the active semester type to "Odd" because the first half of the year covers odd-numbered semesters.

**Why this matters:**

Without an academic year, nothing else can be created. Exam cycles, subjects, question banks — all of them need to know which year they belong to. The system automatically creates all eight semesters (1 through 8) so nobody has to add them manually.

---

### Step 2 — COE creates an exam cycle

**What happens:**

The COE creates an exam cycle for the Computer Engineering (COMP) department. This is an ENDSEM (end semester) exam for Semester 5. The COE picks the academic year (2026-2027), the semester (Semester 5), the department (COMP), and the exam type (ENDSEM). They also fill in a timetable reference number and basic details.

**Why this matters:**

An exam cycle is the container for everything that follows. It says: "In November 2026, the Computer Engineering department will conduct an end-semester examination for Semester 5." The question banks, subjects, and papers all hang off this cycle.

---

### Step 3 — Coordinator creates a subject

**What happens:**

The CSEC coordinator logs in and creates the subject "Cryptography" with code CSE101. They select their department (CSEC), set the semester number to 5 (because Cryptography is a Semester 5 subject), assign 4 credits, and save.

**Why this matters:**

The subject is the academic entity that will have a question bank. You cannot have a question bank without a subject — the bank exists to hold questions FOR that subject. The coordinator also needs to link this subject to an exam cycle so the system knows which exam this subject belongs to.

---

### Step 4 — Question bank appears

**What happens:**

Once a subject exists and is linked to an exam cycle, the coordinator initializes the question bank. The system creates a bank with slots — empty positions where questions will go.

The bank is organized by a pattern. For an ENDSEM exam (full semester), the pattern has:

- **6 modules** (the subject is taught in 6 units)
- **3 mark levels** (2-mark, 5-mark, and 10-mark questions)
- **7 slots per mark level per module**

So for Module 1 alone:

- Seven 2-mark questions (you need 7 of these)
- Seven 5-mark questions (you need 7 of these)
- Seven 10-mark questions (you need 7 of these)

Multiply by 6 modules: **126 total slots**. This is the standard pattern.

**Why 126 slots?**

Because a well-designed question paper needs enough questions to cover all modules at all difficulty levels. The 126-slot template ensures that the question bank is comprehensive before the paper is generated. If there are empty slots, the paper will have gaps.

---

### Step 5 — Contributors submit questions

**What happens:**

The coordinator assigns contributors (faculty members) to fill the slots. Each contributor can see which slots need questions. They write questions and submit them into the bank.

A question includes:

- The question text
- Which module it belongs to (1-6)
- How many marks it is worth (2, 5, or 10)
- Which course outcome it maps to (CO1-CO6)
- Which RBT level it targets (L1-L6 — Bloom's taxonomy levels)
- Difficulty level (Easy, Medium, Hard)

**Why this matters:**

Instead of emailing Word documents, contributors submit questions directly into the structured bank. The coordinator can see exactly how many slots are filled at any time. If someone has not submitted, it is visible immediately.

---

### Step 6 — Moderator reviews questions

**What happens:**

Once a contributor submits a question, the moderator can review it. The moderator sees the question alongside its metadata (module, marks, outcomes, etc.).

The moderator has three options:

- **Approve** — the question meets standards and is accepted into the bank
- **Reject** — the question has serious issues and is removed
- **Request Revision** — the question is close but needs changes; the system sends it back to the contributor with specific feedback

If revision is requested, the contributor fixes the question and resubmits. The moderator reviews it again.

**Why this matters:**

This is the quality gate. A moderator catches errors before they reach the final paper. They check:

- Is the question correct?
- Is it appropriate for the mark value?
- Does it actually test the intended outcome?
- Is the wording clear?

Without this step, incorrect or unclear questions end up on the exam paper.

---

### Step 7 — Coordinator checks readiness

**What happens:**

Before the coordinator can advance the bank to the next stage, they check readiness. The system tells them:

- How many slots are filled vs. empty
- How many questions are approved vs. pending
- How many questions are still under review
- Whether each module has minimum coverage

**What "ready" means:**

A bank is ready when enough slots are filled with approved questions and no critical gaps remain.

**What can block readiness:**

- Empty slots (not enough questions submitted)
- Too many pending reviews (moderator has not finished)
- Modules with zero coverage (no questions for a particular module)
- Missing AI report (if applicable)

---

### Step 8 — Coordinator advances the bank

**What happens:**

The coordinator moves the bank from one phase to the next. The phases go in order:

Drafting → Moderation → Approval → Complete

1. **Drafting** → **Moderation**: The coordinator has initialized the bank and contributions are happening. Moving to Moderation means it is time for the moderator to start reviewing.

2. **Moderation** → **Approval**: All questions have been moderated. Enough are approved. The bank is ready for final review.

3. **Approval** → **Complete**: The coordinator makes a final decision. If approved, the process is done.

**Why this matters:**

Each phase is a formal checkpoint. Nobody can skip ahead. This ensures that each step is completed properly before the next one starts.

---

### Step 9 — AI report is generated

**What happens:**

When the bank reaches the Approval phase, the system generates an AI report. This report analyzes the question bank and checks:

- Are all modules covered? (No module left empty)
- Are all course outcomes covered? (CO1 through CO6)
- Are all RBT levels represented? (L1 through L6)
- Is difficulty distributed reasonably? (Mix of Easy, Medium, Hard)
- Are any questions too similar to each other?

The report flags issues. For example: "Module 4 has no approved questions" or "No questions at L5 (Evaluate) level."

**Why this matters:**

The AI report is an objective check. It catches gaps that a human reviewer might miss. The coordinator and moderator can use it to fix problems before the final paper is generated.

---

### Step 10 — Approval

**What happens:**

The coordinator makes the final decision. There are two options:

**Approve:**

The bank is marked as Complete. All questions are now final. The system can generate the question paper.

**Reject:**

The bank goes back to Moderation. The coordinator adds a reason. The moderator and contributors need to fix the issues and resubmit. The bank must come through Moderation again before it can be approved.

**Why this matters:**

The coordinator is ultimately responsible for the quality of the question paper. Approval is the official sign-off. Rejection sends the bank back for corrections — the system automatically handles the loopback so nothing falls through the cracks.

---

### Step 11 — Paper generation

**What happens:**

Once the bank is Complete, the coordinator triggers paper generation. The system produces three variants of the question paper:

- **Paper A**
- **Paper B**
- **Paper C**

All three papers cover the same syllabus but have different questions selected from the bank. A student sitting next to another student will get a different set of questions.

**Why multiple papers exist:**

To prevent copying during exams. With three variants, neighboring students cannot copy from each other because the questions are different (even though they test the same topics). This is a standard academic practice.

---

### Step 12 — Locking

**What happens:**

After the paper is generated, the bank is locked. Nobody can make changes — no questions can be added, removed, or modified. The papers are final.

**Why this matters:**

Locking is the security seal. Once the exam paper is finalized, it must not change. Locking prevents:

- Accidental edits
- Last-minute changes without approval
- Anyone modifying the paper after it has been approved

If changes are absolutely necessary, the bank can be unlocked (only by the COE), but this is an exceptional action that is tracked.

---

## Section 6: One complete example

Let us follow Cryptography (CSE101) in the CSEC department from start to finish.

**Who is involved:**

- COE (Dr. Mahesh Kulkarni)
- CSEC Coordinator (Dr. Rucha Deshpande)
- CSEC Moderator (Prof. Manoj Tiwari)
- CSEC Contributors (Ms. Tanvi Shah, Mr. Varun Saxena, Ms. Neelam Mishra)

---

**Step 1 — COE creates the year**

Dr. Kulkarni logs in and creates academic year 2026-2027, semester type ODD. The system automatically creates all 8 semesters.

**Step 2 — COE creates exam cycles**

Dr. Kulkarni creates an ENDSEM exam cycle for CSEC, Semester 5, with a November 2026 timetable.

**Step 3 — Coordinator creates Cryptography**

Dr. Deshpande (CSEC coordinator) creates subject "Cryptography" (CSE101), credits 4, semester 5. She links it to the CSEC ENDSEM exam cycle.

**Step 4 — Question bank initialized**

Dr. Deshpande initializes the question bank. The system creates 126 empty slots (6 modules × 3 mark levels × 7 slots).

**Step 5 — Contributors submit questions**

Dr. Deshpande assigns three contributors. Tanvi fills Module 1 questions. Varun fills Module 2 and 3. Neelam fills Modules 4, 5, and 6. They write questions: each specifying module number, mark value, course outcome, RBT level, and difficulty.

**Step 6 — Moderator reviews**

Prof. Tiwari (moderator) reviews each question. He approves most. He rejects two that have incorrect answers. He requests revision on three that need clearer wording. Tanvi and Neelam fix those and resubmit. Prof. Tiwari approves them.

**Step 7 — Readiness check**

Dr. Deshpande checks readiness. The system shows 124 of 126 slots filled with approved questions. Two Module 6 slots are empty. She asks Varun to fill them.

**Step 8 — Advance to Moderation → Approval**

All 126 slots are filled. Dr. Deshpande advances the bank through Moderation (all questions reviewed) to Approval.

**Step 9 — AI report**

The system generates an AI report. It shows good coverage across all modules and outcomes. It flags that no questions target RBT level L6 (Create). Dr. Deshpande decides this is acceptable for Cryptography and proceeds.

**Step 10 — Approval**

Dr. Deshpande approves the bank. The bank status changes to Complete.

**Step 11 — Paper generation**

Dr. Deshpande clicks "Generate Papers." The system produces three variants (A, B, C) with different question selections. She downloads all three.

**Step 12 — Locking**

The system automatically locks the bank. No further changes allowed. The papers are ready for printing.

---

## Section 7: Common questions

**Why do we need question banks?**

Without a question bank, someone has to assemble a paper from scratch every time. With a bank, questions are collected, reviewed, and stored in one place. The paper is generated from approved questions. It saves time and improves quality.

**Why do we need moderation?**

Because a single person can miss errors. A moderator is a second set of eyes. They check for correctness, clarity, and fairness. Without moderation, incorrect questions could reach students.

**Why can't contributors approve questions?**

Because that would be like marking your own homework. The contributor writes the question; the moderator checks it. Separation of duties ensures quality. If contributors could approve their own questions, there would be no quality gate.

**Why are there 126 slots?**

An ENDSEM exam covers 6 modules. For each module, you need 2-mark, 5-mark, and 10-mark questions. And for each mark value, you need enough questions to allow the paper generator to pick a good selection. 7 slots per mark level per module gives the generator enough options. This is a standard template that works well in practice.

**What does readiness mean?**

Readiness means the bank has enough approved questions to generate a good paper. The system checks: Are enough slots filled? Are all modules covered? Have all reviews been done? If any of these are missing, the bank is not ready.

**What happens if approval is rejected?**

The bank goes back to Moderation. The coordinator explains why. The moderator and contributors fix the issues and the bank comes back through Moderation again for re-approval. This loopback ensures that problems are actually fixed before the paper is finalized.

**Why are papers locked?**

To prevent tampering. Once the exam paper is finalized, it must be exactly what was approved. Locking makes it immutable — no accidental changes, no last-minute edits, no unauthorized modifications.

---

## Section 8: If I am a new coordinator

Here is your checklist for your first question bank.

### First week

- [ ] Find out which academic year is active (check with COE)
- [ ] Check which semesters are active (ODD or EVEN)
- [ ] Find out which subjects are assigned to your department
- [ ] Make sure subjects are linked to exam cycles (if not, create the links)

### Before contributions start

- [ ] Initialize question banks for each subject
- [ ] Assign contributors to each bank (who fills which module)
- [ ] Assign a moderator to each bank
- [ ] Set deadlines (the system has a due date field)

### During contribution

- [ ] Check progress weekly — how many slots are filled?
- [ ] Remind contributors who are behind
- [ ] Make sure the moderator is reviewing submitted questions

### When contributions are done

- [ ] Check readiness — the system will tell you if anything is missing
- [ ] Advance the bank through the phases (Drafting → Moderation → Approval)
- [ ] Review the AI report and address any gaps
- [ ] Make the final approve/reject decision

### After approval

- [ ] Generate the papers (A, B, and C variants)
- [ ] Download and print
- [ ] Confirm the bank is locked (the system does this automatically)

---

*This document is for college staff. It intentionally avoids technical terminology. If something is unclear, ask your coordinator or COE for a walkthrough.*
