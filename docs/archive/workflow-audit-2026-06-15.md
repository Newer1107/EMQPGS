# EMQPGS — Workflow Acceptance Audit

**Date:** 2026-06-15
**Method:** Full role-by-role click-path walkthrough, evaluating every workflow as a real user
**Scope:** COE, Coordinator, Contributor, Moderator, Dean — all primary and secondary workflows
**Constraint:** No code changes — pure UX and task-flow evaluation

---

## Classification Legend

| Priority | Meaning |
|---|---|
| **P0** | User cannot complete the task |
| **P1** | Task completion is possible but difficult or confusing |
| **P2** | UX friction, unnecessary steps, missing feedback |
| **P3** | Cosmetic or terminology inconsistency |

---

## Part 1 — Role-by-Role Workflow Maps

### 1.1 COE

```
LOGIN → /dashboard (overview) → click "COE Dashboard"
  │
  ├── SIDEBAR: Academic Years
  │     → Fill code, startDate, endDate → "Create Academic Year"
  │     → Toast "Academic year created" → form resets
  │
  ├── SIDEBAR: Semesters
  │     → Fill number, name, academicYearId → "Create Semester"  
  │     → Toast "Semester created" → form resets
  │
  ├── SIDEBAR: Exam Cycles
  │     → Fill 11 fields + dynamic timetable rows → "Create Cycle"
  │     → Toast + table updates
  │
  ├── SIDEBAR: Users
  │     → Fill 6 fields → "Save" → Toast + form resets
  │
  ├── SIDEBAR: Departments
  │     → Fill 3 fields → "Save" → Toast + form resets
  │
  ├── SIDEBAR: Audit Log
  │     → Read-only table
  │
  ├── [NO SIDEBAR LINK] /dashboard/coe/monitoring
  │     → Read-only health/metrics cards
  │
  └── [NO SIDEBAR LINK] /dashboard/coe/production
        → Bank overview table + ExportConsole form
        → "Generate Export" → full page reload
```

**Clicks to create a full academic structure:** ~7 page navigations + ~30 form interactions across 4 separate pages.

### 1.2 Coordinator

```
LOGIN → /dashboard → click "Coordinator Dashboard"
  │
  ├── SIDEBAR: Subjects
  │     → "Create Subject" button
  │     → Click subject name → Subject Detail
  │         → "Versions" → SubjectVersionForm + version history table
  │         → "Edit" → pre-filled form
  │         → "Deactivate" → confirm dialog
  │         → LinkCycleForm → select cycle → "Link Subject to Cycle"
  │
  ├── SIDEBAR: Question Banks
  │     → SimpleForm (subject + exam cycle picker) → creates bank
  │     → Click "Manage" → Bank Detail page
  │         → BankActionsPanel:
  │             "Generate Papers" (conditional)
  │             "Generate AI Report" 
  │             "Lock Question Bank"
  │             CoordinatorDecisionForm (approve/reject)
  │
  ├── SIDEBAR: Questions
  │     → Read-only "Contribution Monitor" table
  │     → "View" → Question Detail with OwnershipTransferForm
  │
  └── SIDEBAR: Assignments
        → RAW API DOCUMENTATION text — no UI
```

**Clicks from zero to a ready question bank:** 7+ navigations + 4 form fills. Realistically 15-20 minutes.

### 1.3 Contributor

```
LOGIN → /dashboard → click "Contributor Dashboard"
  │
  ├── SIDEBAR: My Subjects
  │     → Single-row table — no actionable controls
  │
  ├── SIDEBAR: Submit Question
  │     → QuestionForm (8 fields) → "Save Question"
  │     → Toast → ALL fields reset → page stays
  │
  └── SIDEBAR: My Submissions
        → Question table with "Edit" and conditional "Submit" buttons
        → Click "Edit" → pre-filled edit form
```

**Clicks to create and submit one question:** 3 navigations + form fill + 1 submit. After save, must manually navigate to submissions list to verify.

### 1.4 Moderator

```
LOGIN → /dashboard → click "Moderator Dashboard"
  │
  ├── SIDEBAR: Review Queue
  │     → Question table → "Review" → Question Detail
  │         → ModeratorActions panel:
  │             "Approve Question"
  │             "Reject Question" (required reason)
  │             "Request Revision" (required instructions)
  │         → After action: page refreshes, STAYS on same question
  │         → Must click back + find next question manually
  │
  └── [NO SIDEBAR LINK] /dashboard/moderator/question-banks/[id]/signed-report
        → SignedReportUpload form
```

**Clicks to moderate one question:** 4 clicks. To moderate 10 questions: ~60 clicks (no auto-advance).

### 1.5 Dean

```
LOGIN → /dashboard → click "Dean Dashboard"
  │
  ├── Dashboard cards: Pending Reviews, Notifications, Completed Reviews
  │     → Click "Review papers"
  │     → /dashboard/dean/review?bank=XXX
  │
  └── DeanReviewWorkspace (client component, API fetch on mount)
        → 3 paper cards with scores + expandable questions
        → Selection form: 3 dropdowns (Regular/Supplementary/KT)
        → "Submit Selection" → API call → redirect to /dashboard/dean
```

**Clicks to review one bank:** 3 navigations + 3 dropdown selections + 1 submit ≈ 8 clicks. Efficient but one-at-a-time.

---

## Part 2 — Bottlenecks

### P0 — User Cannot Complete Task

| # | Bottleneck | Role | Reason |
|---|---|---|---|
| 1 | **Moderator assignment has no UI** | Coordinator | "Assignments" sidebar page shows raw API docs text (`POST /api/question-banks/{id}/assignments/moderator`). No form, no moderator selection, no assignment ability. The entire moderation workflow depends on this step. |
| 2 | **No submit-to-moderation transition UI** | Coordinator | No button to move a bank from `IN_PROGRESS` to `UNDER_MODERATION`. The status machine has 10 states but the UI only exposes lock, generate, and decision actions. |
| 3 | **Signed Report Upload is undiscoverable** | Moderator | No sidebar link. URL path `/dashboard/moderator/question-banks/[id]/signed-report` is not linked from anywhere in the moderator's navigable UI. |

### P1 — Task Completion Is Difficult

| # | Bottleneck | Role | Reason |
|---|---|---|---|
| 4 | **No auto-advance after moderation** | Moderator | After approving/rejecting a question, the user stays on the same detail page. Must manually navigate back to the queue, find the next question, and click "Review" again. ~6 clicks per question when it should be 2. |
| 5 | **Edit → Submit is a two-step process** | Contributor | After editing a revision-requested question, the contributor must separately click "Submit" on the submissions list. The status stays at `EDITED` not `REVISION_SUBMITTED` until the second action. Easy to forget. |
| 6 | **No slot-grid visualization anywhere** | All | The 126-slot grid (6×3×7) is the core domain invariant. No page visualizes it. Contributors pick module/marks blindly. Coordinators see a flat list. No fill-percentage feedback at the slot level. |
| 7 | **Form resets after question create are disorienting** | Contributor | After "Save Question", all fields clear and page stays on blank form. No redirect to submissions list. User must navigate there manually to confirm. |
| 8 | **No sidebar links for critical pages** | COE, Moderator | Monitoring page and Production page have no COE sidebar links. Signed Report Upload has no moderator sidebar link. Users must know the URL. |

### P2 — UX Friction

| # | Bottleneck | Role | Reason |
|---|---|---|---|
| 9 | **No status transition guidance** | All | The bank status machine has 10 states but the UI never shows: current state, next state, required action, or responsible person. The "Workflow Actions" panel has buttons without context. |
| 10 | **Exam Cycle form is monolithic** | COE | 11 fields + dynamic timetable rows all on one form. Should be split into create (core fields) and timetable (secondary step). ~15+ field interactions for one cycle. |
| 11 | **Subject creation and bank creation are disconnected** | Coordinator | Subjects live under one sidebar link, question banks under another. No cross-linking. User must switch sections manually. |
| 12 | **Approved/Rejected pages are dead redirects** | Moderator | Sidebar previously linked to these as separate pages. They now redirect to the main queue. Removed from sidebar but pages still exist. |
| 13 | **Dashboard overview is an unnecessary hop** | All | After login, every user hits `/dashboard` and must click their role card. Should redirect directly to role dashboard. Costs 1 extra click × every login. |
| 14 | **Inconsistent post-submit behavior** | All | 8 different post-submit patterns across the app (form reset, redirect, page refresh, reload). Users must learn different behaviors for every form. |
| 15 | **No "what's next" guidance anywhere** | All | No page tells the user what to do next. After creating a subject: "Next: Link to an exam cycle." After locking a bank: "Next: Dean will review." The UI is reactive, not proactive. |
| 16 | **Dean review workspace has slow loading** | Dean | Client-side API fetch on mount shows a spinner for 2-5 seconds. No skeleton UI or progressive loading. |

### P3 — Cosmetic or Terminology

| # | Bottleneck | Notes |
|---|---|---|
| 17 | Page heading vs sidebar label mismatches | "Submit Question" (sidebar) vs "Create Question" (heading). "My Submissions" (sidebar) vs "My Questions" (heading). "Review Queue" (sidebar) vs "Moderation Queue" (heading). |
| 18 | Raw enum values in user-facing dropdowns | Coordinator Decision form shows "APPROVED" (Prisma enum) instead of "Approve". |
| 19 | "Contribution Monitor" is confusing | Coordinator question page heading doesn't match the sidebar "Questions" and doesn't indicate read-only access. |
| 20 | Exam department column shows blank | The stored cycles table has a "Department" column header but `{/* department name not included */}` is in the cell — literally commented out. |

---

## Part 3 — Suggested Simplifications

### Immediate (P0/P1 Priority)

| # | Suggestion | Fixes |
|---|---|---|
| 1 | **Build moderator assignment UI** on the Assignments page: moderator dropdown + question bank selector + assign button | P0/#1 |
| 2 | **Add sidebar links** for COE Monitoring, COE Production, Moderator Signed Report Upload | P1/#8 |
| 3 | **Add auto-advance after moderation action**: after approve/reject, immediately show the next question in the queue | P1/#4 |
| 4 | **Add slot-grid visualization** to the bank detail page: cards organized by module > marks, showing filled/approved/missing counts per slot | P1/#6 |
| 5 | **Merge edit → submit into one step**: when editing a revision-requested question, auto-submit after save (or add "Save & Submit" button) | P1/#5 |
| 6 | **Redirect after question create** to the submissions list so contributors see confirmation in context | P1/#7 |

### Short-term (P2 Priority)

| # | Suggestion | Fixes |
|---|---|---|
| 7 | **Add "What's Next" callout cards** after every state-changing action: e.g., after creating a subject, show "Now create a question bank for this subject" with a link | P2/#15 |
| 8 | **Standardize post-submit behavior**: all forms should either redirect to a confirmation page OR stay in place with a visual checkmark, not a mix of 8 patterns | P2/#14 |
| 9 | **Split the Exam Cycle form**: first step = core fields (academic year, semester, exam type, department), second step = timetable builder | P2/#10 |
| 10 | **Add status transition timeline** to the bank detail page showing: current state, completed states with checkmarks, next state highlighted, who's responsible for the next action | P2/#9 |
| 11 | **Add next/previous question navigation** to the moderator question detail page | P1/#4 |
| 12 | **Remove or implement dead routes**: moderator/approved, moderator/rejected, dean/reports, dean/readiness-overview | P2/#12 |

### Cleanup (P3 Priority)

| # | Suggestion | Fixes |
|---|---|---|
| 13 | Align sidebar labels with page headings across all roles | P3/#17 |
| 14 | Replace raw enum values in dropdowns with user-friendly labels | P3/#18 |
| 15 | Fix the blank Department column in the exam cycles stored table | P3/#20 |
| 16 | Rename "Contribution Monitor" to something that indicates read-only access, or make it interactive | P3/#19 |

---

## Part 4 — Role-by-Role Usability Score

| Role | Score | Rationale |
|---|---|---|
| **Dean** | **7/10** | Most polished workflow. Selection workspace is functional, clear, and efficient. Deductions: slow client-side loading (P2), no redo after submit (P2), dead routes in sidebar scope (P2). |
| **COE** | **5/10** | Core CRUD workflows (users, departments, exam cycles) work. Deductions: monolithic exam cycle form (P2), no monitoring/production sidebar links (P1), audit log has no search/filter (P2), no user deactivation button (P2). |
| **Contributor** | **4/10** | Create/edit/submit all work, but: form reset is disorienting (P1), edit→submit is two-step (P1), no slot visibility (P1), "My Subjects" is useless (P2), revision instructions not shown on edit page (P2). |
| **Coordinator** | **3/10** | Functional but painful. Deductions: assignments page is non-functional — this is a P0 blocker (P0/#1). No submit-to-moderation button (P0/#2). Subject→bank flow is disconnected (P2). Questions page is read-only (P2). No slot visualization (P1). |
| **Moderator** | **3/10** | Review queue is usable but: no auto-advance (P1) — the biggest UX tax. Signed report upload is hidden (P0/#3). Approved/rejected stubs are dead (P2). No next/previous navigation (P1). Reviewing 100 questions requires ~600 clicks. |

### Overall Average Score: **4.4 / 10**

---

## Part 5 — Overall Readiness Score

| Dimension | Score | Notes |
|---|---|---|
| **Backend completeness** | 9/10 | All APIs exist and work. The single exception is the moderator assignment route (just implemented in the frontend sprint). |
| **Frontend coverage** | 5/10 | All API-backed pages now have some UI, but several critical interfaces are non-functional (assignments) or undiscoverable (signed report). |
| **Workflow continuity** | 4/10 | Individual steps work but no workflow is seamless. Every role hits a dead end, gap, or UX friction point. The coordinator workflow is especially fragmented. |
| **Discoverability** | 3/10 | Users cannot find all features through the UI. Monitoring, production, and signed report upload lack nav links. The assignments page is misleading. |
| **Feedback & guidance** | 2/10 | The UI never tells users what to do next. Post-submit patterns are inconsistent. Status transitions are invisible. Users are left guessing. |
| **Terminology consistency** | 3/10 | Page headings, sidebar labels, and button text use different names for the same concepts. Raw enum values appear in user-facing dropdowns. |

### Overall Readiness: **4.3 / 10**

**Interpretation:** The system is functionally complete at the API layer but the user experience is fragmented. A non-technical user could complete most workflows with guidance, but would frequently get stuck, confused, or frustrated. The system is not ready for self-service use by non-technical staff.

---

## Part 6 — Consolidated Issue Register

| ID | Priority | Issue | Role | Page/Component |
|---|---|---|---|---|
| 1 | P0 | Moderator assignment has no UI — sidebar shows raw API docs | Coordinator | `/dashboard/coordinator/assignments` |
| 2 | P0 | No UI to transition bank from IN_PROGRESS to UNDER_MODERATION | Coordinator | Bank detail page |
| 3 | P0 | Signed Report Upload has no sidebar link or discoverable path | Moderator | `/dashboard/moderator/question-banks/[id]/signed-report` |
| 4 | P1 | No auto-advance after approve/reject — must navigate back manually | Moderator | `/dashboard/moderator/questions/[id]` |
| 5 | P1 | Edit then Submit is two separate steps for contributors | Contributor | `/dashboard/contributor/questions` |
| 6 | P1 | No slot-grid visualization anywhere — users work blind | All | Bank detail, question form |
| 7 | P1 | Question form resets to blank after save, no redirect | Contributor | `/dashboard/contributor/submit-question` |
| 8 | P1 | Monitoring, Production, Signed Report pages have no nav links | COE, Moderator | app-shell sidebar |
| 9 | P2 | No status transition guidance — users don't know what's next | All | Bank detail "Workflow Actions" panel |
| 10 | P2 | Exam Cycle form is monolithic (15+ fields) | COE | `/dashboard/coe/exam-cycles` |
| 11 | P2 | Subject creation and bank creation are disconnected in nav | Coordinator | Separate sidebar sections |
| 12 | P2 | Approved/Rejected pages are dead redirects | Moderator | Dead routes kept in codebase |
| 13 | P2 | Dashboard overview is an unnecessary extra click | All | `/dashboard` page |
| 14 | P2 | 8 different post-submit behaviors across the app | All | All forms |
| 15 | P2 | No "what's next" guidance after any action | All | Every page |
| 16 | P2 | Dean workspace loads via slow client-side fetch | Dean | `/dashboard/dean/review` |
| 17 | P3 | Sidebar labels vs page headings are inconsistent | All | Multiple pages |
| 18 | P3 | Raw enum values in user-facing dropdowns | Coordinator | Coordinator Decision form |
| 19 | P3 | "Contribution Monitor" heading is confusing | Coordinator | `/dashboard/coordinator/questions` |
| 20 | P3 | Department column in exam cycle table shows blank cells | COE | `/dashboard/coe/exam-cycles` |

---

## Part 7 — Workflow Summary by Priority

### P0 Blockers (Cannot Complete Task)

```
1. Coordinator cannot assign moderators
   → Moderation workflow cannot start
   → All downstream flows (review, approve, papers) blocked

2. Coordinator cannot submit bank for moderation
   → Status stuck at IN_PROGRESS
   → No paper generation, no dean review, no export

3. Moderator cannot discover signed report upload
   → HOD sign workflow blocked
   → Bank cannot reach APPROVED status
```

### P1 Blockers (Task Is Painful)

```
4. Moderator: ~600 clicks to review 100 questions (no auto-advance)
5. Contributor: must manually re-submit after revision edits
6. All roles: no slot visualization → blind question creation
7. Contributor: form reset after save → must verify externally
8. COE/Monitor: critical pages have no nav links
```

### P2 Friction (Poor UX)

```
9. All roles: no workflow status guidance
10. COE: exam cycle form is too long
11. Coordinator: subjects and banks are disconnected
12. Moderator: dead approved/rejected page stubs
13. All: extra click on dashboard overview
14. All: 8 different form behaviors
15. All: no next-step guidance
16. Dean: slow workspace loading
```

---

## Summary

The system has reached **functional API completeness** but the **user experience is rated 4.3/10**. The three P0 issues block core workflows entirely. The P1 issues make daily use labor-intensive. The P2/P3 issues create confusion and inconsistency.

**For a non-technical university staff member to use this system independently, the following must be addressed in order:**

1. Build the moderator assignment UI (replaces raw API docs with a form)
2. Add a "Submit for Moderation" button on the bank detail page
3. Link the signed report upload page from the moderator sidebar
4. Add auto-advance after moderation actions
5. Add slot-grid visualization to bank and question-creation pages
6. Standardize post-submit behavior
7. Add "what's next" guidance callouts throughout the UI
