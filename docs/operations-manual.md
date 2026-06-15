# Operations Manual

## Quick Start

**Access:** Open `http://localhost:3000` in a browser. The root page redirects to `/login`.

**Login:** Enter your email and password. Click "Sign in". Successful login sets three cookies: `emqpgs_access_token`, `emqpgs_refresh_token`, `emqpgs_csrf_token`. You are redirected to your role-specific dashboard.

**Seed credentials** (password for all: `Password@123`):
- `coe@emqpgs.local` (COE)
- `coordinator@emqpgs.local` (COORDINATOR)
- `moderator@emqpgs.local` (MODERATOR)
- `contributor@emqpgs.local` (CONTRIBUTOR)
- `dean@emqpgs.local` (DEAN)

**Forgot password:** Click "Forgot password?" on the login page. Enter your email. A reset link is sent via SMTP (if configured). The reset-password page accepts a token and new password.

**Logout:** Click the logout button in the navigation. Cookies are cleared.

## Role Guide

### COE (Controller of Examination)

**Purpose:** System administrator. Manages the institutional structure — users, departments, academic years, semesters, exam cycles, exports, backups, and audit.

**Permissions:** Full read/write on departments, users, academic years, semesters, exam cycles, coordinator-department assignments. Read-only on question banks, subjects, papers, reports. Manage exports and backups.

**Responsibilities:** Create the academic calendar structure, register users, assign coordinators to departments, activate exam cycles, export finalized papers, trigger backups, monitor audit logs.

**Actions available:**

| Action | Page/API | Method |
|---|---|---|
| Create department | `/dashboard/coe/departments` | POST `/api/departments` |
| Edit department | `/dashboard/coe/departments` | PATCH `/api/departments/[id]` |
| Delete department | `/dashboard/coe/departments` | DELETE `/api/departments/[id]` |
| Create user | `/dashboard/coe/users` | POST `/api/users` |
| Edit/disable user | `/dashboard/coe/users` | PATCH `/api/users/[id]` |
| Create academic year | `/dashboard/coe/academic-years` | POST `/api/academic-years` |
| Create semester | `/dashboard/coe/semesters` | POST `/api/semesters` |
| Create exam cycle | `/dashboard/coe/exam-cycles` | POST `/api/exam-cycles` |
| Activate/close exam cycle | `/dashboard/coe/exam-cycles` | PATCH `/api/exam-cycles/[id]` |
| Assign coordinator to department | `/dashboard/coe/coordinator-assignments` | POST `/api/coordinator-departments` |
| Remove coordinator assignment | `/dashboard/coe/coordinator-assignments` | DELETE `/api/coordinator-departments/[id]` |
| View audit logs | `/dashboard/coe/audit` | GET `/api/audit-logs` |
| View monitoring | `/dashboard/coe/monitoring` | GET `/api/monitoring` |
| Export papers | `/dashboard/coe/production` | POST `/api/exports` |
| Trigger backup | `/dashboard/coe/production` | POST `/api/backups` |

**Actions prohibited:** Cannot create or edit subjects, question banks, questions, or moderate. Cannot view per-question details.

### COORDINATOR

**Purpose:** Academic subject owner. Manages subjects, question banks, slot assignments, moderator assignments, phase transitions, AI reports, paper generation, and final approval.

**Permissions:** Full CRUD on subjects and question banks for assigned departments. Manage slot assignments (assign/unassign questions). Assign moderators. Advance phases. Trigger AI reports. Generate papers. Make approve/reject decisions. Lock/unlock banks.

**Responsibilities:** Create subjects linked to exam cycles, initialize question banks, ensure all slots are filled, advance through phases, assign moderators, trigger analysis, generate papers, approve/reject banks, lock finalized banks.

**Actions available:**

| Action | Page/API | Method |
|---|---|---|
| Create subject | `/dashboard/coordinator/subjects/create` | POST `/api/subjects` |
| Edit subject | `/dashboard/coordinator/subjects/[id]/edit` | PATCH `/api/subjects/[id]` |
| Deactivate subject | `/dashboard/coordinator/subjects/[id]` | PATCH `/api/subjects/[id]/deactivate` |
| Link subject to exam cycle | `/dashboard/coordinator/subjects/[id]` | POST `/api/subjects/[id]/link-cycle` |
| Create subject version | `/dashboard/coordinator/subjects/[id]/versions` | POST `/api/subject-versions` |
| Archive subject version | `/dashboard/coordinator/subjects/[id]/versions` | PATCH `/api/subject-versions/[id]/archive` |
| Create question bank | `/dashboard/coordinator/question-banks` | POST `/api/question-banks` |
| View question bank with slots | `/dashboard/coordinator/question-banks/[id]` | GET `/api/question-banks/[id]` |
| Assign question to slot | `/dashboard/coordinator/question-banks/[id]` | PATCH `/api/question-banks/[id]/slots/[slotId]` |
| Unassign question from slot | `/dashboard/coordinator/question-banks/[id]` | DELETE `/api/question-banks/[id]/slots/[slotId]` |
| Advance phase | `/dashboard/coordinator/question-banks/[id]` | PATCH `/api/question-banks/[id]/advance` |
| Check readiness | `/dashboard/coordinator/question-banks/[id]` | GET `/api/question-banks/[id]/readiness` |
| View metrics | `/dashboard/coordinator/question-banks/[id]` | GET `/api/question-banks/[id]/metrics` |
| Assign moderator | `/dashboard/coordinator/question-banks/[id]` | POST `/api/question-banks/[id]/assignments/moderator` |
| Trigger AI report | `/dashboard/coordinator/question-banks/[id]` | POST `/api/question-banks/[id]/reports` |
| Generate papers | `/dashboard/coordinator/question-banks/[id]` | POST `/api/question-banks/[id]/papers` |
| Coordinator decision | `/dashboard/coordinator/question-banks/[id]` | POST `/api/question-banks/[id]/coordinator-decision` |
| Lock bank | `/dashboard/coordinator/question-banks/[id]` | PATCH `/api/question-banks/[id]/lock` |
| Unlock bank | `/dashboard/coordinator/question-banks/[id]` | POST `/api/question-banks/[id]/unlock` |
| View coverage dashboard | `/dashboard/coordinator/coverage` | GET `/api/question-library/coverage` |
| Create question | `/dashboard/coordinator/questions` | POST `/api/question-library` |
| Transfer ownership | `/dashboard/coordinator/questions/[id]` | POST `/api/question-library/[id]/transfer-ownership` |

**Actions prohibited:** Cannot moderate questions. Cannot perform dean review. Cannot export or manage system config (users, departments, academic years).

### CONTRIBUTOR

**Purpose:** Question author. Creates, edits, and submits questions for moderation. Revises questions when revisions are requested.

**Permissions:** Create/edit own questions. Assign own questions to slots in banks. Submit questions for moderation. Revise on feedback.

**Responsibilities:** Create questions for assigned subject versions, fill slots in question banks, submit questions for moderation, respond to revision requests.

**Actions available:**

| Action | Page/API | Method |
|---|---|---|
| Create question | `/dashboard/contributor/submit-question` | POST `/api/question-library` |
| Edit own question | `/dashboard/contributor/questions/[id]/edit` | PATCH `/api/question-library/[id]` |
| Submit for moderation | `/dashboard/contributor/questions` | POST `/api/question-library/[id]` (submit action) |
| Assign to slot | `/dashboard/contributor/my-subjects` | PATCH `/api/question-banks/[id]/slots/[slotId]` |
| Unassign from slot | `/dashboard/contributor/my-subjects` | DELETE `/api/question-banks/[id]/slots/[slotId]` |
| Submit revision | `/dashboard/contributor/questions/[id]/edit` | POST `/api/question-library/[id]` (revise action) |
| View own questions | `/dashboard/contributor/questions` | GET `/api/question-library` |
| View my subjects | `/dashboard/contributor/my-subjects` | GET (subject list) |

**Actions prohibited:** Cannot change question phase or record status. Cannot moderate. Cannot generate papers. Cannot approve banks.

### MODERATOR

**Purpose:** Quality reviewer. Reviews questions assigned to banks they are assigned to. Approves, rejects, or requests revisions.

**Permissions:** Read assigned question banks. Read and moderate questions in those banks. View reports and papers.

**Responsibilities:** Review all questions in assigned banks, ensure quality standards, provide feedback via revision requests.

**Actions available:**

| Action | Page/API | Method |
|---|---|---|
| View assigned banks | `/dashboard/moderator/question-banks` | GET `/api/question-banks` (filtered) |
| View pending questions | `/dashboard/moderator/questions` | GET `/api/moderation/questions` |
| View question detail | `/dashboard/moderator/questions/[id]` | GET `/api/moderation/questions/[id]` |
| Approve question | `/dashboard/moderator/questions/[id]` | PATCH `/api/moderation/questions/[id]/approve` |
| Reject question | `/dashboard/moderator/questions/[id]` | PATCH `/api/moderation/questions/[id]/reject` |
| Request revision | `/dashboard/moderator/questions/[id]` | PATCH `/api/moderation/questions/[id]/request-revision` |
| View approved questions | `/dashboard/moderator/approved` | GET `/api/moderation/questions?status=APPROVED` |
| View rejected questions | `/dashboard/moderator/rejected` | GET `/api/moderation/questions?status=REJECTED` |

**Actions prohibited:** Cannot create or edit questions. Cannot create subjects or banks. Cannot advance phases. Cannot generate papers.

### DEAN

**Purpose:** Final reviewer. Reviews generated paper variants and selects which variant to use for regular, supplementary, and KT exams.

**Permissions:** View question bank details, reports, and papers. Submit dean review (variant selection). Read-only on everything else.

**Responsibilities:** Review generated paper variants for quality and coverage, select distinct variants for each exam slot.

**Actions available:**

| Action | Page/API | Method |
|---|---|---|
| View review workspace | `/dashboard/dean/review` | GET `/api/question-banks/[id]/dean-review` |
| Submit paper selection | `/dashboard/dean/review` | POST `/api/question-banks/[id]/dean-review` |
| View reports | `/dashboard/dean/reports` | GET (reports list) |
| View readiness overview | `/dashboard/dean/readiness-overview` | GET `/api/question-banks/[id]/readiness` |

**Actions prohibited:** Cannot edit questions, banks, or subjects. Cannot create anything. Cannot moderate. Cannot export.

## Screen Guide

### Login Page (`/login`)

| Element | Description |
|---|---|
| Email field | Text input, type=email, placeholder "you@institution.edu", required |
| Password field | Password input, placeholder "Enter your password", required |
| Forgot password link | Links to `/forgot-password` |
| Sign in button | Submit button, shows "Signing in..." while loading |
| Error message | Red alert box shown when credentials are invalid |

Validation: Both fields required. Server returns error for invalid email/password. Three cookies set on success.

### Dashboard (`/dashboard`)

Role-aware landing page. Redirects based on role:
- COE → `/dashboard/coe`
- COORDINATOR → `/dashboard/coordinator`
- CONTRIBUTOR → `/dashboard/contributor`
- MODERATOR → `/dashboard/moderator`
- DEAN → `/dashboard/dean`

### COE Dashboard (`/dashboard/coe`)

**Purpose:** Overview of system statistics. Links to all COE functions.

| Widget | Description |
|---|---|
| Users count | Total registered users |
| Active departments | Departments marked isActive=true |
| Exam cycles | Total and active cycles |
| Question banks | Count of all banks |
| Quick actions | Create user, create department, create exam cycle |

### Departments (`/dashboard/coe/departments`)

**Purpose:** Manage academic departments.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Name | string | Yes | Department name, min 2 chars, no HTML special chars | Computer Science & Engineering |
| Code | string | Yes | Unique code, min 2 max 10 chars, auto-uppercased | CSE |
| HOD Name | string | Yes | Head of department name, min 2 chars | Dr. A. Sharma |
| Is Active | boolean | No | Default true, unchecked to deactivate | true |

Actions: Create, edit (modal), delete (soft-delete with confirmation).

### Users (`/dashboard/coe/users`)

**Purpose:** Manage system users.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Name | string | Yes | Full name, min 2 chars | Rajesh Kumar |
| Email | string | Yes | Valid email, unique | coordinator@emqpgs.local |
| Department | string (select) | No | FK to Department | CSE |
| Role | enum (select) | Yes | COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN | COORDINATOR |
| Password | string | No (on create: yes) | Min 8 chars | |
| Status | enum | No | ACTIVE (default) or DISABLED | ACTIVE |

Actions: Create (form), edit (modal), disable/re-enable (toggle button).

### Academic Years (`/dashboard/coe/academic-years`)

**Purpose:** Define academic year periods.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Code | string | Yes | Must match `/^\d{4}-\d{4}$/` | 2026-2027 |
| Start Date | date | Yes | Year start date | 2026-06-01 |
| End Date | date | Yes | Year end date | 2027-05-31 |
| Status | enum | No | ACTIVE (default) or CLOSED | ACTIVE |

### Semesters (`/dashboard/coe/semesters`)

**Purpose:** Define semesters within academic years.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Number | integer | Yes | 1-8 | 5 |
| Name | string | Yes | Display name | Fifth Semester |
| Academic Year | string (select) | Yes | FK to AcademicYear | 2026-2027 |

Validated: Unique per `(academicYearId, number)`.

### Exam Cycles (`/dashboard/coe/exam-cycles`)

**Purpose:** Create and manage examination cycles.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Academic Year | string (select) | Yes | FK to AcademicYear | 2026-2027 |
| Semester | string (select) | Yes | FK to Semester | 5 |
| Exam Type | enum (select) | Yes | ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT | ENDSEM |
| Department | string (select) | No | FK to Department | CSE |
| Timetable Title | string | Yes | Exam timetable header | End Semester Examination Nov/Dec 2026 |
| Timetable Issue Date | date | Yes | When timetable was issued | 2026-10-01 |
| Timetable Document Ref | string | Yes | Reference number | TTCSE-2026-ENDSEM |
| Timetable Signature | string | Yes | Signatory name | Controller of Examination |
| Timetable Rows | array | Yes (min 1) | Each row: dateDay, time, paper | See below |

Timetable row fields:

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| dateDay | string | Yes | Date or day name | 2026-11-15 |
| time | string | Yes | Exam timing | 10:00 AM - 1:00 PM |
| paper | string | Yes | Paper name | Advanced Algorithms |

Cycle statuses: DRAFT (on create), ACTIVE (activate), CLOSED (close). Activation enables linking subjects.

### Coordinator Assignments (`/dashboard/coe/coordinator-assignments`)

**Purpose:** Link coordinators to departments.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Coordinator | string (select) | Yes | User with role COORDINATOR | coordinator@emqpgs.local |
| Department | string (select) | Yes | Department name | CSE |

Validation: Unique `(coordinatorId, departmentId)`.

### Subject Create (`/dashboard/coordinator/subjects/create`)

**Purpose:** Create a new subject (auto-creates SubjectVersion v1).

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Subject Code | string | Yes | Uppercase, max 20 chars | CS501 |
| Subject Name | string | Yes | Display name, min 1 char | Advanced Algorithms |
| Department | string (select) | Yes | FK to Department (filtered by coordinator assignments) | CSE |
| Semester | string (select) | Yes | FK to Semester | 5 |
| Credits | number | Yes | Positive integer | 4 |

On submit: Creates Subject + SubjectVersion v1 (title=subject name, status=ACTIVE, linked to current academic year).

### Subject Detail (`/dashboard/coordinator/subjects/[id]`)

**Purpose:** View and manage a single subject.

| Section | Contents |
|---|---|
| Subject info | Code, name, credits, status, department, semester, questionBankDueDate |
| Versions | List of SubjectVersions (version number, title, status). Create new version, archive. |
| Exam Cycle Links | Shows linked exam cycles. Click "Link to Exam Cycle" to add. |
| Question Banks | List of banks (phase, record status, exam type). Click to navigate. |

### Question Bank List (`/dashboard/coordinator/question-banks`)

**Purpose:** List all question banks for coordinator's departments.

| Column | Description |
|---|---|
| Subject | Subject name and code |
| Exam Cycle | Exam type and year |
| Phase | DRAFTING, MODERATION, APPROVAL, or COMPLETE |
| Record Status | ACTIVE, LOCKED, or ARCHIVED |
| Slots Filled | X/126 or X/63 |
| Actions | View, delete |

### Question Bank Detail (`/dashboard/coordinator/question-banks/[id]`)

**Purpose:** Central workspace for managing a single question bank.

**Header badges:** Phase badge (color-coded), Record status badge, Exam type.

**Slot Grid:** Matrix showing all slots organized by module and marks. Each slot shows:
- Slot number
- Assigned question text (truncated)
- Question status (DRAFT, PENDING, APPROVED, etc.)
- CO mapping, RBT level
- Assign/Unassign buttons

**Action buttons** (role-dependent):
- DRAFTING phase: Assign Moderator, Check Readiness, Advance Phase
- MODERATION phase: Check Readiness, Advance Phase
- APPROVAL phase: Trigger AI Report, Generate Papers, Coordinator Decision
- COMPLETE phase: Lock Bank, Export
- All phases: View Metrics, View Readiness

**Tabs or sections:** Slots grid, Reports, Papers, Activity log.

### Question Create/Edit (`/dashboard/contributor/submit-question` and edit pages)

**Purpose:** Create or edit a question library item.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| Subject Version | string (select) | Yes | FK to SubjectVersion | Advanced Algorithms v1 |
| Module Number | integer (select) | Yes | 1-6 | 3 |
| Marks | integer (select) | Yes | 2, 5, or 10 | 5 |
| Question Text | textarea | Yes | Min 15 characters | Explain the Dijkstra's shortest path algorithm with an example. |
| CO Mapping | enum (select) | Yes | CO1-CO6 | CO3 |
| RBT Level | enum (select) | Yes | L1-L6 | L4 |
| Difficulty Level | enum (select) | No | EASY, MEDIUM, HARD | MEDIUM |
| Teaching Index | string | No | Max 50 chars | Week 5-6 |
| Question Bank (optional) | string (select) | No | Auto-assigns to matching slot | |

Validation: questionText min 15 chars. Module 1-6. Marks 2, 5, or 10.

### Moderator Questions List (`/dashboard/moderator/questions`)

**Purpose:** View questions pending moderation for assigned banks.

| Column | Description |
|---|---|
| Question | Truncated question text |
| Module/Marks | Module number and mark value |
| CO | CO1-CO6 |
| RBT | L1-L6 |
| Bank | Subject and exam cycle |
| Status | PENDING, REVISION_SUBMITTED |
| Actions | View detail |

### Moderator Question Detail (`/dashboard/moderator/questions/[id]`)

**Purpose:** Review a single question and take moderation action.

| Section | Contents |
|---|---|
| Question info | Full text, module, marks, CO, RBT, difficulty, teaching index, status |
| Subject info | Subject version, bank |
| Moderation history | Previous events (approve/reject/revision requests) |
| Action buttons | Approve, Reject (with note), Request Revision (with note) |

### Dean Review (`/dashboard/dean/review`)

**Purpose:** Review generated papers and select variants.

| Section | Contents |
|---|---|
| Bank info | Subject, exam cycle, phase |
| Generated papers | Three variants (PAPER_A, PAPER_B, PAPER_C) each showing coverage, difficulty, quality scores |
| Paper preview | Questions listed per variant by module |
| Selection form | Regular Paper, Supplementary Paper, KT Paper dropdowns. Must select 3 distinct variants. |
| Submit button | Creates DeanReview record |

### Coverage Dashboard (`/dashboard/coordinator/coverage`)

**Purpose:** Analytics view of question coverage across modules, COs, RBT levels, and difficulty.

| Section | Description |
|---|---|
| Filters | Department, subject, bank, module |
| Module coverage | Bar chart showing questions per module |
| CO coverage | Heatmap showing CO distribution across modules |
| RBT distribution | Bar chart of L1-L6 levels |
| Difficulty spread | EASY/MEDIUM/HARD breakdown |
| Gap detection | Highlights modules or COs with insufficient coverage |

## Field Reference

### Academic Year

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| code | string | Yes | Year code | 2026-2027 | Regex `/^\d{4}-\d{4}$/` |
| startDate | date | Yes | Start of academic year | 2026-06-01 | Valid ISO date |
| endDate | date | Yes | End of academic year | 2027-05-31 | Valid ISO date, should be after startDate |
| status | enum | No (default ACTIVE) | ACTIVE or CLOSED | ACTIVE | AcademicYearStatus enum |

### Semester

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| number | integer | Yes | Semester number | 5 | 1-8, coerced int |
| name | string | Yes | Display name | Fifth Semester | Trimmed, min 1 char |
| academicYearId | string | Yes | FK to AcademicYear | cuid | Min 1 char |

### Department

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| name | string | Yes | Department name | Computer Science & Engineering | Min 2 chars, no HTML special chars (`/^[^<>&"]+$/)` |
| code | string | Yes | Unique short code | CSE | Min 2 max 10, auto `.toUpperCase()` |
| hodName | string | Yes | Head of department | Dr. A. Sharma | Min 2 chars, no HTML special chars |
| isActive | boolean | No (default true) | Active flag | true | Boolean |

### User

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| name | string | Yes | Full name | Rajesh Kumar | Min 2 chars, no HTML special chars |
| email | string | Yes | Login email | coordinator@emqpgs.local | Valid email format (`z.email()`) |
| departmentId | string | No | FK to Department | cuid | Min 1 if provided |
| role | enum | Yes | System role | COORDINATOR | Role enum (COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN) |
| status | enum | No (default ACTIVE) | User status | ACTIVE | UserStatus enum (ACTIVE, DISABLED) |
| password | string | On create: yes | Login password | | Min 8 chars |

### Exam Cycle

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| academicYearId | string | Yes | FK to AcademicYear | cuid | Min 1 char |
| semesterId | string | Yes | FK to Semester | cuid | Min 1 char |
| examType | enum | Yes | Type of exam | ENDSEM | ExamType enum |
| status | enum | No (default DRAFT) | Cycle status | DRAFT | ExamCycleStatus enum |
| departmentId | string | No | FK to Department | cuid | Min 1 if provided |
| timetableDocumentRef | string | Yes | Timetable reference | TTCSE-2026-ENDSEM | Trimmed, min 1 char |
| timetableIssueDate | date | Yes | Issue date | 2026-10-01 | Valid ISO date |
| timetableTitle | string | Yes | Timetable title | End Semester Examination Nov/Dec 2026 | Trimmed, min 1 char |
| timetableRows | array | Yes (min 1) | Timetable entries | | Each row: dateDay, time, paper (all string, min 1) |
| timetableSignature | string | Yes | Signatory | Controller of Examination | Trimmed, min 1 char |

### Subject

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| subjectCode | string | Yes | Unique code within department | CS501 | Min 1 max 20, uppercase transform |
| subjectName | string | Yes | Full name | Advanced Algorithms | Trimmed, min 1 char |
| departmentId | string | Yes | FK to Department | cuid | Min 1 char |
| semesterId | string | Yes | FK to Semester | cuid | Min 1 char |
| credits | number | Yes | Credit load | 4 | Coerced number, positive |
| status | enum | No (default ACTIVE) | Subject status | ACTIVE | SubjectStatus enum |

### Subject Version

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| subjectId | string | Yes | FK to Subject | cuid | Min 1 char |
| title | string | Yes | Version title | Advanced Algorithms | Trimmed, min 1 char |
| syllabusDescription | string | No | Syllabus text | | Optional, nullable |
| effectiveFromAcademicYearId | string | Yes | FK to AcademicYear | cuid | Min 1 char |
| status | enum | No (default ACTIVE) | ACTIVE or ARCHIVED | ACTIVE | SubjectVersionStatus enum |

### Question Bank

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| subjectId | string | Yes | FK to Subject | cuid | Min 1 char |
| examCycleId | string | Yes | FK to ExamCycle | cuid | Min 1 char |
| phase | enum | No (default DRAFTING) | Workflow phase | DRAFTING | QuestionBankPhase enum |
| recordStatus | enum | No (default ACTIVE) | Mutable or frozen | ACTIVE | RecordStatus enum |
| lockedAt | datetime | No | When locked | | Set on lock action |

### Question Library Item

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| subjectVersionId | string | Yes | FK to SubjectVersion | cuid | Min 1 char |
| moduleNumber | integer | Yes | Course module | 3 | Coerced int, 1-6 |
| marks | integer | Yes | Question marks | 5 | Coerced int, must be 2, 5, or 10 |
| questionText | string | Yes | Question body | Explain Dijkstra's algorithm with an example. | Min 15 chars |
| coMapping | enum | Yes | Course outcome | CO3 | CourseOutcome enum (CO1-CO6) |
| rbtLevel | enum | Yes | Bloom's taxonomy level | L4 | RbtLevel enum (L1-L6) |
| difficultyLevel | enum | No | EASY, MEDIUM, or HARD | MEDIUM | DifficultyLevel enum |
| teachingIndex | string | No | Teaching reference | Week 5-6 | Max 50 chars |
| status | enum | No (default DRAFT) | Moderation status | DRAFT | QuestionStatus enum |
| createdById | string | Auto | Creator user ID | | Set server-side |
| ownerId | string | Auto | Current owner user ID | | Set server-side |

### Question Slot

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| questionBankId | string | Yes | FK to QuestionBank | cuid | |
| moduleNumber | integer | Yes | Module position | 3 | 1-6 |
| marks | integer | Yes | Marks position | 5 | 2, 5, or 10 |
| slotNumber | integer | Yes | Slot position within (module, marks) | 4 | 1-7 |
| assignedQuestionId | string | No | FK to QuestionLibraryItem | cuid | Nullable |
| reservedById | string | No | User who reserved | cuid | Nullable |
| isLocked | boolean | No (default false) | Slot locked flag | false | Boolean |

### Moderator Assignment

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| moderatorId | string | Yes | FK to User (role=MODERATOR) | cuid | Min 1 char |
| questionBankId | string | Path param | FK to QuestionBank | | From URL |

### Coordinator Department Assignment

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| coordinatorId | string | Yes | FK to User (role=COORDINATOR) | cuid | Min 1 char |
| departmentId | string | Yes | FK to Department | cuid | Min 1 char |

### Phase Advance

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| targetPhase | enum | Yes | Destination phase | MODERATION | QuestionBankPhase enum |

### Coordinator Decision

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| decision | enum | Yes | APPROVED or REJECTED | APPROVED | CoordinatorDecision enum |
| remark | string | No | Optional note | "All questions meet standards." | Max 500 chars |

### Dean Review

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| regularPaper | enum | Yes | Variant for regular exam | PAPER_A | Must be distinct from others |
| supplementaryPaper | enum | Yes | Variant for supplementary | PAPER_B | Must be distinct from others |
| ktPaper | enum | Yes | Variant for KT exam | PAPER_C | Must be distinct from others |

### Export Request

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| questionBankId | string | Yes | FK to QuestionBank | cuid | Min 1 char |
| format | enum | Yes | PDF, DOCX, or ZIP | PDF | ExportFormat enum |
| examDate | string | Yes | Exam date | 2026-12-15 | Min 1 char |
| duration | string | Yes | Exam duration | 3 hours | Min 1 char |
| maximumMarks | integer | Yes | Total marks | 100 | Coerced int, positive |
| instructions | array of strings | Yes (min 1) | Exam instructions | ["Answer all questions."] | Each min 1 char |
| institutionName | string | No | Institution name | | Optional |

### Paper Generation

| Field | Type | Required | Description | Example | Validation |
|---|---|---|---|---|---|
| variants | array of PaperVariant | No (default [A,B,C]) | Which variants to generate | ["PAPER_A", "PAPER_B", "PAPER_C"] | Array of PaperVariant enum |

## Form Completion Guide

### Login Form

1. Go to `http://localhost:3000`
2. Enter email in the "Email" field (e.g. `coordinator@emqpgs.local`)
3. Enter password in the "Password" field (e.g. `Password@123`)
4. Click "Sign in"
5. On success: redirected to role dashboard
6. On failure: error message shown, check credentials

### Create Department Form

1. Navigate to `/dashboard/coe/departments`
2. Click "Create Department"
3. Fill in:
   - Name: `Computer Science & Engineering` (min 2 chars, no `<>&"`)
   - Code: `CSE` (min 2 max 10 chars, auto-uppercased)
   - HOD Name: `Dr. A. Sharma` (min 2 chars, no `<>&"`)
4. Click "Submit"
5. Success: department appears in list. Failure: validation errors shown.

### Create User Form

1. Navigate to `/dashboard/coe/users`
2. Click "Create User"
3. Fill in:
   - Name: `Rajesh Kumar` (min 2 chars)
   - Email: `coordinator@emqpgs.local` (valid email format)
   - Department: select from dropdown (optional)
   - Role: select from dropdown (COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN)
   - Password: `SecurePass123` (min 8 chars)
4. Click "Submit"
5. Success: user created. User can login immediately.

### Create Academic Year Form

1. Navigate to `/dashboard/coe/academic-years`
2. Click "Create Academic Year"
3. Fill in:
   - Code: `2026-2027` (must match YYYY-YYYY format)
   - Start Date: `2026-06-01`
   - End Date: `2027-05-31`
4. Click "Submit"

### Create Semester Form

1. Navigate to `/dashboard/coe/semesters`
2. Click "Create Semester"
3. Fill in:
   - Number: `5` (1-8)
   - Name: `Fifth Semester`
   - Academic Year: select from dropdown
4. Click "Submit"

### Create Exam Cycle Form

1. Navigate to `/dashboard/coe/exam-cycles`
2. Click "Create Exam Cycle"
3. Fill in:
   - Academic Year: select
   - Semester: select
   - Exam Type: select ENDSEM
   - Department: select CSE
   - Timetable Title: `End Semester Examination Nov/Dec 2026`
   - Timetable Issue Date: `2026-10-01`
   - Timetable Document Ref: `TTCSE-2026-ENDSEM`
   - Timetable Signature: `Controller of Examination`
   - Timetable Rows: Click "Add Row" for each exam:
     - Row 1: dateDay=`2026-11-15`, time=`10:00 AM - 1:00 PM`, paper=`Advanced Algorithms`
     - Add more rows as needed
4. Click "Submit"
5. After creation, click "Activate" to change status from DRAFT to ACTIVE

### Create Subject Form

1. Navigate to `/dashboard/coordinator/subjects/create`
2. Fill in:
   - Subject Code: `CS501` (will be uppercased)
   - Subject Name: `Advanced Algorithms`
   - Department: select `CSE` (only assigned departments shown)
   - Semester: select `5`
   - Credits: `4`
3. Click "Submit"
4. Success: Subject created with SubjectVersion v1. Redirected to subject detail.

### Link Subject to Exam Cycle

1. Navigate to `/dashboard/coordinator/subjects/[id]`
2. Click "Link to Exam Cycle"
3. Select exam cycle from dropdown (must be ACTIVE, same department)
4. Click "Link"
5. Success: SubjectExamCycleLink created

### Create Question Bank Form

1. Navigate to `/dashboard/coordinator/question-banks`
2. Click "Create Question Bank"
3. Fill in:
   - Subject: select `CS501 — Advanced Algorithms`
   - Exam Cycle: select `ENDSEM 2026-2027`
4. Click "Submit"
5. Success: Bank created with 126 QuestionSlots, PaperPattern generated. Phase: DRAFTING.

### Question Submission Form

1. Navigate to `/dashboard/contributor/submit-question`
2. Fill in:
   - Subject Version: select `Advanced Algorithms v1`
   - Module Number: select `3`
   - Marks: select `5`
   - Question Text: `Explain the Dijkstra's shortest path algorithm with an example. Consider a graph with 5 vertices.`
   - CO Mapping: select `CO3`
   - RBT Level: select `L4`
   - Difficulty Level: select `MEDIUM` (optional)
   - Teaching Index: `Week 5-6` (optional, max 50 chars)
3. Click "Submit"
4. Success: Question created with status DRAFT

### Submit Question for Moderation

1. Navigate to `/dashboard/contributor/questions`
2. Find the question (status DRAFT)
3. Click "Submit for Moderation"
4. Status changes to PENDING
5. Moderator can now review

### Assign Question to Slot

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Find the slot matching the question's (module, marks)
3. Click "Assign" on the empty slot
4. Select the question from the dialog
5. Click "Assign"
6. Slot now shows the assigned question

### Assign Moderator Form

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Click "Assign Moderator"
3. Select moderator: `moderator@emqpgs.local`
4. Click "Submit"
5. Success: ModeratorBankAssignment created

### Advance Phase Form

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Click "Advance Phase"
3. Select target phase from dropdown
4. Click "Advance"
5. If readiness check fails: error shown with issues
6. On success: phase badge updates

### Moderator Review — Approve Question

1. Navigate to `/dashboard/moderator/questions/[id]`
2. Review question text, module, marks, CO, RBT
3. Click "Approve"
4. Question status → APPROVED

### Moderator Review — Reject Question

1. Navigate to `/dashboard/moderator/questions/[id]`
2. Review question
3. Click "Reject"
4. Optionally add note explaining reason
5. Confirm
6. Question status → REJECTED

### Moderator Review — Request Revision

1. Navigate to `/dashboard/moderator/questions/[id]`
2. Review question
3. Click "Request Revision"
4. Add note specifying required changes
5. Submit
6. Question status → REVISION_REQUESTED

### Contributor Revision Submission

1. Navigate to `/dashboard/contributor/questions/[id]/edit`
2. View moderator's revision notes
3. Edit question text or fields as needed
4. Click "Submit Revision"
5. Question status → REVISION_SUBMITTED
6. Moderator reviews again

### Trigger AI Report

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Click "Trigger AI Report"
3. Wait for processing (synchronous)
4. Report generated with coverage, RBT, difficulty analysis
5. Note: AI report does NOT auto-advance phase

### Generate Papers Form

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Click "Generate Papers"
3. Default: 3 variants (A, B, C). No configuration needed.
4. Click "Generate"
5. Wait for processing (synchronous — may timeout for large banks)
6. PDFs uploaded to MinIO, GeneratedPaper records created

### Coordinator Decision Form

1. Navigate to `/dashboard/coordinator/question-banks/[id]`
2. Click "Coordinator Decision"
3. Select decision: APPROVED or REJECTED
4. Remark (optional): `All questions meet quality standards.` (max 500 chars)
5. Click "Submit"
6. If APPROVED: phase → COMPLETE
7. If REJECTED: phase → MODERATION (loopback)

### Lock Bank

1. Navigate to `/dashboard/coordinator/question-banks/[id]` (phase must be COMPLETE)
2. Click "Lock Bank"
3. Confirm
4. RecordStatus → LOCKED, lockedAt set
5. QuestionBankSnapshot created
6. All mutations blocked from this point

### Unlock Bank

1. Navigate to `/dashboard/coordinator/question-banks/[id]` (must be LOCKED)
2. Click "Unlock Bank"
3. RecordStatus → ACTIVE

### Dean Review Form

1. Navigate to `/dashboard/dean/review`
2. Select question bank from list
3. Review the three generated paper variants (A, B, C):
   - Check coverage score, difficulty score, quality score
   - Review questions per variant
4. Fill in selection:
   - Regular Paper: select one variant
   - Supplementary Paper: select a different variant
   - KT Paper: select the remaining variant
5. All three must be distinct (validation enforced)
6. Click "Submit"
7. DeanReview record created with status SUBMITTED

### Export Form

1. Navigate to `/dashboard/coe/production` or question bank detail
2. Click "Export"
3. Fill in:
   - Question Bank: selected automatically
   - Format: select PDF, DOCX, or ZIP
   - Exam Date: `2026-12-15`
   - Duration: `3 hours`
   - Maximum Marks: `100`
   - Instructions: click "Add Instruction"
     - `Answer any five questions.`
     - `All questions carry equal marks.`
   - Institution Name (optional): `University of Technology`
4. Click "Export"
5. Export artifact created. Download via link.

## Complete Example Cycle

This section recaps the full cycle from the e2e-workflow guide with all actual values used.

| Step | Actor | Action | Values |
|---|---|---|---|
| 1 | COE | Create Department | CSE, Computer Science & Engineering |
| 2 | COE | Create Academic Year | 2026-2027 |
| 3 | COE | Create Semester | 5, Fifth Semester |
| 4 | COE | Create Exam Cycle | ENDSEM, CSE, timetable rows |
| 5 | COE | Activate Exam Cycle | |
| 6 | COE | Assign Coordinator | coordinator@emqpgs.local → CSE |
| 7 | COE | Create Users (if needed) | coordinator, moderator, contributor, dean |
| 8 | Coordinator | Create Subject | CS501, Advanced Algorithms, CSE, Sem 5, 4 credits |
| 9 | Coordinator | Link Subject to Cycle | CS501 → ENDSEM 2026-2027 |
| 10 | Coordinator | Create Question Bank | CS501, ENDSEM → 126 slots created |
| 11 | Contributor | Create 126 Questions | Fill all (module, marks, slot) combinations |
| 12 | Contributor | Submit for Moderation | Each question status → PENDING |
| 13 | Coordinator | Check Readiness → Advance | DRAFTING → MODERATION |
| 14 | Coordinator | Assign Moderator | moderator@emqpgs.local |
| 15 | Moderator | Review Questions | Approve/Reject/RequestRevision on each |
| 16 | Contributor | Resubmit Revisions | Status → REVISION_SUBMITTED |
| 17 | Moderator | Final Review | Approve remaining |
| 18 | Coordinator | Trigger AI Report | |
| 19 | Coordinator | Check Readiness → Advance | MODERATION → APPROVAL |
| 20 | Coordinator | Generate Papers | 3 variants (A, B, C) |
| 21 | Coordinator | Decision | APPROVED → COMPLETE |
| 22 | Coordinator | Lock Bank | RecordStatus → LOCKED, snapshot created |
| 23 | Dean | Review & Select Variants | Regular=A, Supple=B, KT=C |
| 24 | COE | Export | PDF format |
| 25 | COE | Close Exam Cycle | Status → CLOSED |
