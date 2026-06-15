# EMQPGS Complete Operational Workflow

> Examination Management & Question Paper Generation System
> Generated: 2026-06-15
> Audience: Non-technical product owner

---

## TABLE OF CONTENTS

- [PART 1 — System Entry (Empty Database → Operational)](#part-1--system-entry)
- [PART 2 — COE Workflow](#part-2--coe-workflow)
- [PART 3 — Coordinator Workflow](#part-3--coordinator-workflow)
- [PART 4 — Contributor Workflow](#part-4--contributor-workflow)
- [PART 5 — Moderator Workflow](#part-5--moderator-workflow)
- [PART 6 — Question Bank Lifecycle (All Statuses)](#part-6--question-bank-lifecycle)
- [PART 7 — Reports & Paper Generation](#part-7--reports--paper-generation)
- [PART 8 — Dean Workflow](#part-8--dean-workflow)
- [PART 9 — Export Workflow](#part-9--export-workflow)
- [PART 10 — Complete Data Flow Example](#part-10--complete-data-flow-example)
- [PART 11 — Gaps](#part-11--gaps)

---

## PART 1 — SYSTEM ENTRY

### Starting Point

Database is empty. No users, no departments, no academic structure exists.

**The first person must register as COE (Controller of Examination)**. There is no public registration — the first user is seeded directly into the database.

#### Step 1: COE Login

| Item | Detail |
|------|--------|
| **URL** | `/login` |
| **Form** | Sign-in form |
| **Email field** | type=email, required, placeholder="you@institution.edu" |
| **Password field** | type=password, required, placeholder="Enter your password" |
| **Submit button** | "Sign in" (shows "Signing in..." while busy) |
| **API** | `POST /api/auth/login` |
| **Request body** | `{ email: string, password: string }` |
| **Called service** | `UserService.verifyCredentials(email, password)` |
| **Database reads** | `User` — find by email, compare bcrypt hash |
| **Database writes** | `User.lastLoginAt` updated to current time |
| **Cookie set** | `emqpgs_access_token` (JWT, httpOnly) |
| **Cookie set** | `emqpgs_refresh_token` (JWT, httpOnly) |
| **Cookie set** | `emqpgs_csrf_token` |
| **Audit log** | `AuditLog` created: action="LOGIN", entityType="AUTH" |
| **On success** | Redirect to `/dashboard` |
| **On failure** | "Invalid email or password" error message displayed |

#### Step 2: Create Department

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coe/departments` |
| **Form name** | "Create Department" |
| **Field: Department Name** | type=text, required, min=2 chars |
| **Field: Department Code** | type=text, required, min=2, max=10, auto-uppercased |
| **Field: HOD Name** | type=text, required, min=2 chars |
| **Submit button** | "Create Department" |
| **API** | `POST /api/departments` |
| **Request body** | `{ name: "Computer Engineering", code: "CE", hodName: "Dr. Sharma" }` |
| **Service** | `DepartmentService.create(data)` |
| **Validation** | Checks for duplicate code (returns 409 "Department code already exists") |
| **Database writes (new record)** | `Department { id, name, code, hodName, isActive: true, createdAt, updatedAt }` |
| **Audit log** | action="DEPARTMENT_CREATED", entityType="DEPARTMENT" |
| **Next steps** | Repeat for each department (e.g., "Information Technology", "Electronics") |

#### Step 3: Create Users (All Roles)

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coe/users` |
| **Form name** | "Create User" |
| **Field: Name** | type=text, required, min=2 chars, no HTML special chars |
| **Field: Email** | type=email, required |
| **Field: Department** | select, optional, options auto-populated from `Department` table |
| **Field: Role** | select, required, options: COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN |
| **Field: Status** | select, required, options: ACTIVE, DISABLED |
| **Field: Password** | type=text, required, min=8 chars |
| **Submit button** | "Create User" |
| **API** | `POST /api/users` |
| **Service** | `UserService.create(data)` |
| **Validation** | Checks for duplicate email (returns 409 "Email already exists") |
| **Database writes** | `User { id, name, email, passwordHash (bcrypt 12 rounds), role, status, departmentId, createdAt, updatedAt }` |
| **Audit log** | action="USER_CREATED", entityType="USER" |
| **Who to create** | At minimum: 1 COORDINATOR, 1 MODERATOR, 1 CONTRIBUTOR, 1 DEAN, each in a department |

#### Step 4: Create Academic Year

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coe/academic-years` |
| **Form name** | "Create Academic Year" |
| **Field: Year Code** | type=text, required, pattern="YYYY-YYYY" (e.g., "2026-2027") |
| **Field: Start Date** | type=date, required |
| **Field: End Date** | type=date, required (must be after start date) |
| **Submit button** | "Create Academic Year" |
| **API** | `POST /api/academic-years` |
| **Service** | `AcademicYearService.create(data)` |
| **Validation** | End date must be after start date. Code must be unique. |
| **Database writes** | `AcademicYear { id, code, startDate, endDate, status: ACTIVE, createdAt }` |
| **Audit log** | action="ACADEMIC_YEAR_CREATED", entityType="ACADEMIC_YEAR" |

#### Step 5: Create Semesters

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coe/semesters` |
| **Form name** | "Create Semester" |
| **Field: Semester Number** | type=number, required, min=1, max=8 |
| **Field: Semester Name** | type=text, required, e.g., "Semester V" |
| **Field: Academic Year** | select, required, auto-populated from AcademicYear table |
| **Submit button** | "Create Semester" |
| **API** | `POST /api/semesters` |
| **Service** | `SemesterService.create(data)` |
| **Validation** | Unique semester number per academic year (returns 409 on duplicate) |
| **Database writes** | `Semester { id, number, name, academicYearId, createdAt }` |
| **Audit log** | action="SEMESTER_CREATED", entityType="SEMESTER" |

**Repeat** for all semesters (e.g., Semester I through Semester VIII) under the academic year.

#### Step 6: Create Exam Cycle

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coe/exam-cycles` |
| **Component** | `ExamCycleTimetableManager` (client component) |
| **Field: Academic Year** | select, required, auto-populated. On change, fetches semesters via `GET /api/semesters?academicYearId=X` |
| **Field: Semester** | select, required, populated after academic year selected |
| **Field: Exam Type** | select, required, options: ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT |
| **Field: Status** | select, options: DRAFT, ACTIVE, CLOSED. Default: DRAFT |
| **Field: Department (Optional)** | select, optional, "No linked department" or specific department |
| **Field: Timetable Document Ref** | text, optional, default: "TCET/EXAM/ ___ of 2026" |
| **Field: Timetable Issue Date** | date, optional |
| **Field: Timetable Title** | text, optional, default: "END SEMESTER EXAMINATIONS (Regular Students) MAY 2026" |
| **Field: Signature** | textarea, optional, default: "Controller of Examinations" |
| **Field: Timetable Rows** | dynamic rows, each with 3 text fields: Date/Day, Time, Paper |
| **Buttons** | "+ Add Row" to add a timetable row. "x" to remove a row (disabled if only 1 left) |
| **Submit button** | "Create Cycle" (or "Update Cycle" if editing) |
| **API** | `POST /api/exam-cycles` |
| **Service** | `ExamCycleService.create(data)` |
| **Validation** | Semester must belong to the specified academic year. If status=ACTIVE, only one active exam cycle per department allowed (serializable transaction) |
| **Database writes** | `ExamCycle { id, examType, status, startDate, endDate, departmentId?, academicYearId, semesterId, timetableDocumentRef?, timetableIssueDate?, timetableTitle?, timetableRows? (JSON), timetableSignature?, version: 0, createdAt }` |
| **Audit log** | action="EXAM_CYCLE_CREATED", entityType="EXAM_CYCLE" |

#### Step 7: Activate Exam Cycle

Edit the exam cycle: Change status from "DRAFT" to "ACTIVE".

| Item | Detail |
|------|--------|
| **Button** | "Edit Stored Cycle" in the exam cycles table — select the cycle, change status dropdown to "ACTIVE", click "Update Cycle" |
| **API** | `PATCH /api/exam-cycles/:id` |
| **Service** | `ExamCycleService.update(id, { status: ACTIVE })` |
| **Validation** | Enforces singleton constraint: only one ACTIVE exam cycle per department at a time |
| **Database writes** | `ExamCycle.status` changed to `ACTIVE` |

**The system is now operational.** Coordinators can log in and begin working.

---

## PART 2 — COE WORKFLOW

### COE Pages

#### `/dashboard/coe` — COE Dashboard

| Aspect | Detail |
|--------|--------|
| **Purpose** | Overview of system-wide statistics |
| **Stats shown** | Users count, Departments count, Active Cycles count, Question Banks count |
| **Pending tasks** | Static text: "Review user provisioning", "Monitor audit events", "Approve cycle readiness" |
| **Notifications** | Latest notification titles from database |
| **API** | Server-side: `DashboardService.getRoleDashboard(COE, userId)` |
| **Data source** | `User.count()`, `Department.count()`, `ExamCycle.count(ACTIVE)`, `QuestionBank.count()`, `Notification.listForUser()` |

#### `/dashboard/coe/users` — User Management

| Aspect | Detail |
|--------|--------|
| **Purpose** | View all users, create new users |
| **Table** | All users with columns: Name, Email, Department, Role (badge), Status, Actions |
| **Form** | "Create User" with fields: Name, Email, Department (select), Role (select), Status (select), Password (text) |
| **Actions per row** | "Edit" button opens modal with prefilled fields (name, email, role, department, status, optional new password). "Disable" button with confirmation dialog (or "Re-enable" for disabled users). |
| **API (read)** | Server-side: `prisma.user.findMany()` via `getAdminData()` |
| **API (edit)** | `PATCH /api/users/:id` — updates name, email, role, department, status, password |
| **API (disable)** | `DELETE /api/users/:id` — sets status to DISABLED |
| **API (re-enable)** | `PATCH /api/users/:id` with `{ status: ACTIVE }` — re-enables disabled user |
| **Record created** | `User` with bcrypt-hashed password |

#### `/dashboard/coe/departments` — Department Management

| Aspect | Detail |
|--------|--------|
| **Purpose** | View all departments, create new departments |
| **Table** | All departments: Name, Code, HOD, Active (Yes/No), Actions |
| **Form** | "Create Department" with fields: Department Name, Department Code, HOD Name |
| **Actions per row** | "Edit" button opens modal with prefilled fields (name, code, hodName, isActive). "Delete" button with confirmation dialog. |
| **API (write)** | `POST /api/departments`, `PATCH /api/departments/:id`, `DELETE /api/departments/:id` |
| **Record created/updated/deleted** | `Department` |

#### `/dashboard/coe/academic-years` — Academic Year Management

| Aspect | Detail |
|--------|--------|
| **Purpose** | View and create academic years |
| **Table** | All academic years: Code, Start Date, End Date, Status, Semesters |
| **Form** | "Create Academic Year" with fields: Year Code (YYYY-YYYY), Start Date, End Date |
| **API (write)** | `POST /api/academic-years` |

#### `/dashboard/coe/semesters` — Semester Management

| Aspect | Detail |
|--------|--------|
| **Purpose** | View and create semesters |
| **Form** | "Create Semester" with fields: Semester Number, Semester Name, Academic Year (select) |
| **API (write)** | `POST /api/semesters` |

#### `/dashboard/coe/exam-cycles` — Exam Cycle Management

| Aspect | Detail |
|--------|--------|
| **Purpose** | Create and manage exam cycles with timetables |
| **Form** | Complex form with timetable rows. See Part 1 Step 6 for full details. |
| **Table** | All exam cycles: Academic Year, Semester, Exam Type, Status, Edit button |
| **API (write)** | `POST /api/exam-cycles`, `PATCH /api/exam-cycles/:id` |

#### `/dashboard/coe/production` — Production Control

| Aspect | Detail |
|--------|--------|
| **Purpose** | COE overview of final papers, dean selections, and exports |
| **Table** | All question banks showing: Subject, AI Report status, Generated Papers badges, Dean Selection (Regular/Supplementary/KT), Export Artifacts |
| **Export Console** | Form to generate final documents (see Part 9) |
| **API (read)** | Server-side: `ExportService.listCoeOverview()` |
| **Data includes** | Subject, Exam Cycle, AI Reports (latest), Generated Papers (all variants), Dean Review status, Export Artifacts (5 most recent) |

#### `/dashboard/coe/monitoring` — Observability

| Aspect | Detail |
|--------|--------|
| **Purpose** | System health monitoring |
| **Cards** | Health Checks (Database latency, MinIO status), Platform Metrics (counts), Workflow Activity (in-progress counts) |
| **API** | Server-side: `MonitoringService.getObservabilityOverview()` |

#### `/dashboard/coe/audit` — Audit Log

| Aspect | Detail |
|--------|--------|
| **Purpose** | View audit trail of all system actions |
| **Table** | 25 most recent audit logs: Action, Entity Type, Actor, Timestamp |

#### `/dashboard/coe/coordinator-assignments` — Coordinator Department Assignments

| Aspect | Detail |
|--------|--------|
| **Purpose** | Assign coordinators to departments and manage existing assignments |
| **Table** | All assignments: Coordinator Name, Email, Department (badge), Assigned Date, Remove button |
| **Form** | "Assign Coordinator" with two selects: Coordinator (select from all ACTIVE coordinators), Department (select from all active departments) |
| **Remove button** | "Remove" button with confirmation dialog — removes the assignment |
| **API (read)** | Server-side direct Prisma: `coordinatorDepartmentAssignment.findMany` with coordinator + department includes |
| **API (create)** | `POST /api/coordinator-departments` with `{ coordinatorId, departmentId }` |
| **API (delete)** | `DELETE /api/coordinator-departments/:id` |
| **Audit log** | action="COORDINATOR_DEPARTMENT_ASSIGNED" or "COORDINATOR_DEPARTMENT_ASSIGNMENT_REMOVED" |

### COE Setup Journey (Complete)

```
Start empty DB
  → Step 1: COE logs in at /login (User.lastLoginAt updated, AuditLog created)
  → Step 2: /dashboard/coe/departments — Create "Computer Engineering" (Department created)
  → Step 3: /dashboard/coe/users — Create Coordinator John (User created)
             /dashboard/coe/users — Create Contributor Alice (User created)
             /dashboard/coe/users — Create Moderator Bob (User created)
             /dashboard/coe/users — Create Dean Carol (User created)
  → Step 4: /dashboard/coe/academic-years — Create "2026-2027" (AcademicYear created)
  → Step 5: /dashboard/coe/semesters — Create Sem I through Sem VIII (Semester records created)
  → Step 6: /dashboard/coe/exam-cycles — Create ENDSEM cycle (ExamCycle created, status=DRAFT)
  → Step 7: Edit cycle, set status=ACTIVE (ExamCycle.status changed to ACTIVE)

System ready. Coordinator can now log in.
```

---

## PART 3 — COORDINATOR WORKFLOW

### Prerequisites

An ACTIVE exam cycle must exist (created by COE in Part 2).

### Coordinator Setup

The COE must:
1. Create a Coordinator user account (done in Part 1)
2. Assign the Coordinator to departments via the "Coordinator Department Assignments" page (see COE section).

### Step 1: Coordinator Login

**Same as COE login.** Coordinator navigates to `/login`, enters credentials.

### Step 2: Coordinator Dashboard

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/coordinator` |
| **Data shown** | Assigned departments with active subject/question bank counts, active exam cycles, question bank statuses, recent contribution activity (last 12 questions submitted), notifications |
| **API** | Server-side: `CoordinatorService.getDashboard(actor)` |
| **Department access** | Filtered by `CoordinatorDepartmentAssignment` records |

### Step 3: Create Subject

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/subjects` (list view) → click "Create Subject" |
| **Or URL** | `/dashboard/coordinator/subjects/create` |
| **Form fields** | Subject Name, Subject Code, Credits, Department (select, auto-populated from assigned departments), Semester (select) |
| **Submit button** | "Create Subject" |
| **API** | `POST /api/subjects` |
| **Service** | `SubjectManagementService.createSubject(actor, payload)` |
| **Validation** | Unique subject code per department. Coordinator must have department access. |
| **Database writes (in transaction)** | |
| **→ Record 1** | `Subject { id, subjectCode, subjectName, credits, status: ACTIVE, questionBankDueDate: 30 days from now, departmentId, semesterId }` |
| **→ Record 2** | `SubjectVersion { id, subjectId, versionNumber: 1, title: subjectName, status: ACTIVE, effectiveFromAcademicYearId }` |
| **Audit log** | action="SUBJECT_CREATED" |

### Step 4: Create Additional Subject Versions (Optional)

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/subjects/:id/versions` |
| **API** | `POST /api/subject-versions` |
| **Service** | `SubjectVersionService.create(input)` |
| **Behavior** | Automatically archives the previous ACTIVE version. Auto-increments version number. |
| **Database writes** | Previous version: `SubjectVersion.status` → ARCHIVED. New: `SubjectVersion { versionNumber: N+1, status: ACTIVE }` |

### Step 5: Link Subject to Exam Cycle

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/subjects/:id` (subject detail page) |
| **Button** | "Link to Exam Cycle" (or handled via subject detail UI) |
| **API** | `POST /api/subjects/:id/link-cycle` |
| **Request body** | `{ examCycleId: string }` |
| **Service** | `SubjectManagementService.linkSubjectToExamCycle(actor, subjectId, examCycleId)` |
| **Validation** | Exam cycle must exist, must be ACTIVE, must belong to same department as subject |
| **Database writes (upsert)** | `SubjectExamCycleLink { id, subjectId, examCycleId }` (unique constraint prevents duplicates) |
| **Audit log** | action="SUBJECT_LINKED_TO_EXAM_CYCLE" |

### Step 6: Create (Initialize) Question Bank

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/question-banks` |
| **Button** | "Initialize Question Bank" |
| **API** | `POST /api/question-banks` |
| **Request body** | `{ subjectId, examCycleId }` |
| **Service** | `QuestionBankWorkflowService.initializeQuestionBank(actor, subjectId, examCycleId)` |
| **Validation** | Subject must exist, must be ACTIVE, must be linked to exam cycle via `SubjectExamCycleLink` |
| **Database writes** | `QuestionBank { id, subjectId, examCycleId, status: IN_PROGRESS, version: 0, createdById, createdAt }` |
| **Audit log** | action="QUESTION_BANK_CREATED" |

### Step 7: Assign Moderator to Question Bank

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/question-banks/:id` (question bank detail) |
| **Or URL** | `/dashboard/coordinator/assignments` |
| **API** | `POST /api/question-banks/:id/assignments/moderator` |
| **Request body** | `{ moderatorId: string }` |
| **Validation** | Target user must exist and have MODERATOR role. No duplicate assignments allowed (unique constraint on moderatorId+questionBankId). |
| **Database writes** | `ModeratorBankAssignment { id, moderatorId, questionBankId }` |
| **Notification** | Created for the moderator: "You have been assigned to moderate a question bank." |
| **Audit log** | action="MODERATOR_ASSIGNED" |

### Step 8: Add Questions to Question Bank

Questions are added by Contributors (see Part 4). The Coordinator can:

- View the question bank detail at `/dashboard/coordinator/question-banks/:id`
- See all linked questions with their statuses
- Transfer question ownership: `POST /api/question-library/:id/transfer-ownership`
- Manually create questions: `POST /api/question-library?bankId=X` (with data)

### Step 9: Advance Question Bank Status

| Item | Detail |
|------|--------|
| **API** | `PATCH /api/question-banks/:id/status` |
| **Request body** | `{ status: QuestionBankStatus }` |
| **Service** | `QuestionBankService.updateStatus(id, status)` |
| **Validation** | Must be a valid transition per `QUESTION_BANK_TRANSITIONS` map |
| **Database writes** | `QuestionBank.status` updated. If LOCKED, also sets `lockedAt` timestamp. |

The Coordinator advances the bank through:
1. `IN_PROGRESS` → `UNDER_MODERATION` (when questions are ready for review)
2. `MODERATED` → `REPORT_GENERATED` (after moderation is complete)

### Step 10: Trigger AI Analysis

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/question-banks/:id` |
| **Button** | "Generate AI Report" |
| **API** | `POST /api/question-banks/:id/reports` |
| **Service** | `ReportingCoordinatorService.triggerAiAnalysis(actor, questionBankId)` |
| **Validation** | Bank must have ≥3 questions linked |
| **Full flow** | See Part 7 — Reports & Paper Generation |
| **Notification** | Created for coordinator: "AI analysis report is ready for [SubjectName]" |
| **Audit log** | action="AI_REPORT_REQUESTED" |

### Step 11: Move to AWAITING_HOD_SIGN

After AI report is generated, the Coordinator advances the status:
- `REPORT_GENERATED` → `AWAITING_HOD_SIGN`
- This signals that the bank is ready for HOD to sign off.

### Step 12: Approve Signed Report (Coordinator Decision)

When the signed report is uploaded (by Moderator), the bank status becomes `SIGNED_REPORT_UPLOADED`. The Coordinator then receives a notification.

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/question-banks/:id` |
| **API** | `POST /api/question-banks/:id/coordinator-decision` |
| **Request body** | `{ decision: "APPROVED" | "REJECTED", remark?: string }` |
| **Service** | `ReportService.coordinatorDecision(questionBankId, decision, remark, actor)` |
| **On APPROVED** | `QuestionBank.status` → `APPROVED`. `coordinatorDecision` = APPROVED |
| **On REJECTED** | `QuestionBank.status` → `AWAITING_HOD_SIGN`. `coordinatorDecision` = REJECTED |
| **Database writes** | `QuestionBank { coordinatorDecision, coordinatorReviewedAt, coordinatorReviewRemark, status, lockedAt: null }` |
| **Audit log** | action="QUESTION_BANK_APPROVED" or "QUESTION_BANK_REJECTED" |

### Step 13: Lock Question Bank

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/question-banks/:id` |
| **Button** | "Lock Question Bank" |
| **API** | `PATCH /api/question-banks/:id/lock` |
| **Service** | `QuestionBankWorkflowService.lockQuestionBank(actor, questionBankId)` |
| **Validation** | Bank must not already be LOCKED. Exam cycle must be ACTIVE. Exam cycle must have endDate. |
| **Database writes** | `QuestionBank.status` → LOCKED. `lockedAt` = now. Uses optimistic locking (version increment). |
| **Audit log** | action="QUESTION_BANK_LOCKED" |

### Unlock (if needed)

| Item | Detail |
|------|--------|
| **API** | `POST /api/question-banks/:id/unlock` |
| **Request body** | `{ reason: string }` |
| **Service** | `QuestionBankService.updateStatus(id, IN_PROGRESS)` |
| **Database writes** | `QuestionBank.status` → `IN_PROGRESS` |
| **Audit log** | action="QUESTION_BANK_UNLOCKED" |

### Step 11a: Coverage Dashboard

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/coordinator/coverage` |
| **Purpose** | View question coverage analytics for approved questions across subject versions |
| **Filters** | Academic Year (select), Semester (select, filtered by year), Subject (select, filtered by semester), Subject Version (select, filtered by subject), Question Bank (select) |
| **Analytics displayed** | Module Coverage (modules 1-6 with question counts and status badges), CO Coverage (CO1-CO6), RBT Coverage (L1-L6), Difficulty Distribution (EASY/MEDIUM/HARD) |
| **Gap detection** | Actionable warnings for missing modules, uncovered COs, missing RBT levels, missing difficulty levels |
| **API** | `GET /api/question-library/coverage?subjectVersionId=X` |
| **Service** | `QuestionLibraryService.getCoverage(subjectVersionId)` — counts only APPROVED questions |

### Coordinator Pages Summary

| Page | URL | Purpose |
|------|-----|---------|
| Coordinator Dashboard | `/dashboard/coordinator` | Overview: departments, cycles, recent activity, notifications |
| Subjects | `/dashboard/coordinator/subjects` | List, create, update, deactivate subjects |
| Subject Detail | `/dashboard/coordinator/subjects/:id` | View subject info, versions, linked cycles |
| Subject Edit | `/dashboard/coordinator/subjects/:id/edit` | Edit subject metadata |
| Subject Versions | `/dashboard/coordinator/subjects/:id/versions` | Manage subject versions |
| Create Subject | `/dashboard/coordinator/subjects/create` | Create new subject |
| Question Banks | `/dashboard/coordinator/question-banks` | List all question banks with statuses |
| Question Bank Detail | `/dashboard/coordinator/question-banks/:id` | Full bank view: questions, AI reports, generated papers, dean review, exports |
| Questions | `/dashboard/coordinator/questions` | List all questions across assigned subjects |
| Question Detail | `/dashboard/coordinator/questions/:id` | View question with status history |
| Assignments | `/dashboard/coordinator/assignments` | Moderator assignments |
| Coverage Dashboard | `/dashboard/coordinator/coverage` | Question coverage analytics with gap detection |

---

## PART 4 — CONTRIBUTOR WORKFLOW

### Prerequisites

- User account with CONTRIBUTOR role exists
- Coordinator has created a Question Bank (status = IN_PROGRESS or UNDER_MODERATION)
- Questions can be linked to the bank

### Step 1: Contributor Login

Same login flow as all other roles.

### Step 2: Contributor Dashboard

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/contributor` |
| **Stats** | Users count, Departments count, Active Cycles count, Question Banks count (system-wide) |
| **Pending tasks** | Static: "Draft questions", "Upload attachments", "Respond to moderation" |
| **Notifications** | Latest notifications |

### Step 3: My Subjects

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/contributor/my-subjects` |
| **Purpose** | View subject versions available for question contribution (*note: this page may redirect or be sparse — see Gaps*) |

### Step 4: Create Question

#### Via Submit Question Page

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/contributor/submit-question` |
| **Form fields** | |
| **Subject Version** | select, populated from SubjectVersion records |
| **Module Number** | select or number, min=1, max=6 |
| **Marks** | select, allowed values: 2, 5, or 10 |
| **Question Text** | textarea, required, min 15 characters |
| **CO Mapping** | select, options: CO1-CO6 |
| **RBT Level** | select, options: L1-L6 |
| **Difficulty** | select, optional: EASY, MEDIUM, HARD |
| **Teaching Index** | text, optional, max 50 chars |
| **Submit button** | "Submit Question" or "Save as Draft" |
| **API** | `POST /api/question-library?bankId=X` (if linked to a bank) or `POST /api/question-library` (standalone) |
| **Request body** | `{ subjectVersionId, moduleNumber, marks, questionText, coMapping, rbtLevel, difficultyLevel?, teachingIndex? }` |
| **Service** | `QuestionLibraryService.createForBank(input, actor)` or `create(input, actor)` |

#### Database Records Created (for `createForBank`)

| Table | Fields |
|-------|--------|
| **QuestionLibraryItem** | `{ id, subjectVersionId, moduleNumber, marks, questionText, coMapping, rbtLevel, difficultyLevel, teachingIndex, status: DRAFT, createdById, ownerId, submittedAt: null, reviewedAt: null, moderatorRemark: null }` |
| **QuestionRevision** | `{ id, questionId, revisionNumber: 1, snapshot* (all fields), changedById, changeReason: "Initial creation" }` |
| **QuestionBankQuestion** | `{ id, questionBankId, questionId }` (only if bankId provided) |

### Step 5: Submit Question for Review

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/contributor/questions/:id/edit` (edit page) |
| **Or URL** | `/dashboard/contributor/questions` (list view, has submit action) |
| **Button** | "Submit for Review" |
| **API** | `POST /api/question-library/:id?action=submit` |
| **Service** | `QuestionLibraryService.submit(id, actor)` |
| **Validation** | Must be the question owner. Status must be DRAFT or REVISION_REQUESTED |
| **Database writes** | `QuestionLibraryItem.status` → `PENDING` (from DRAFT) or `REVISION_SUBMITTED` (from REVISION_REQUESTED). Sets `submittedAt` to current time. |
| **Audit log** | action="QUESTION_SUBMITTED" |

### Step 6: View My Submissions

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/contributor/questions` |
| **Table** | All questions by this contributor: Subject, Module, Marks, Status (badge), Submitted At |
| **Actions** | View/edit each question |

### Step 7: Edit Question

| Item | Detail |
|------|--------|
| **URL** | `/dashboard/contributor/questions/:id/edit` |
| **API** | `PATCH /api/question-library/:id` |
| **Service** | `QuestionLibraryService.update(id, input, actor)` |
| **Validation** | Owner check or COORDINATOR override. |
| **On content change** | Creates new `QuestionRevision` with auto-incremented `revisionNumber` |
| **Database writes** | `QuestionLibraryItem` updated. New `QuestionRevision` created if tracked fields changed. |

### Step 8: Respond to Revision Request

When a moderator requests revision, the contributor sees:

- Notification: "Revision requested" with actionUrl `/dashboard/contributor/questions`
- The question status becomes `REVISION_REQUESTED`
- Contributor edits the question (Step 7) and resubmits (Step 5)
- On resubmission: status goes from `REVISION_REQUESTED` → `REVISION_SUBMITTED`

### Contributor Pages Summary

| Page | URL | Purpose |
|------|-----|---------|
| Contributor Dashboard | `/dashboard/contributor` | Overview stats and notifications |
| My Subjects | `/dashboard/contributor/my-subjects` | View available subjects (*may be incomplete*) |
| Submit Question | `/dashboard/contributor/submit-question` | Create new question |
| My Submissions | `/dashboard/contributor/questions` | List all my questions |
| Edit Question | `/dashboard/contributor/questions/:id/edit` | Edit a question |

### Question Status Lifecycle (Contributor View)

```
DRAFT → (submit) → PENDING → (moderator approves) → APPROVED
                    PENDING → (moderator rejects) → REJECTED
                    PENDING → (moderator requests revision) → REVISION_REQUESTED
REVISION_REQUESTED → (edit + resubmit) → REVISION_SUBMITTED
REVISION_SUBMITTED → (moderator approves) → APPROVED
REVISION_SUBMITTED → (moderator rejects) → REJECTED
REVISION_SUBMITTED → (moderator requests revision) → REVISION_REQUESTED
```

---

## PART 5 — MODERATOR WORKFLOW

### Prerequisites

- User account with MODERATOR role exists
- Coordinator has assigned the moderator to a Question Bank
- Coordinator has advanced the bank status to `UNDER_MODERATION`
- Contributors have submitted questions (status = PENDING)

### Step 1: Moderator Login

Same login flow.

### Step 2: Moderator Dashboard

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/moderator` |
| **Summary counts** | Pending review count, Approved count, Rejected count, Revision requested count, Awaiting revision resubmission count |
| **Awaiting Revision Resubmission** | List of questions with status REVISION_REQUESTED, showing subject name, module, marks, contributor name, days waiting — sourced from database |
| **Recent Moderation Activity** | Last 20 moderation actions by this moderator, showing subject name, action type, timestamp |
| **Quick-Access Bank List** | All assigned question banks with subject name, exam cycle, pending and revision-submitted counts |
| **Notifications** | Notification inbox with mark-as-read functionality |

### Step 3: Review Queue

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/moderator/questions` |
| **Data** | All questions from assigned banks, filtered to show questions the moderator can act on |
| **Table** | Subject, Module, Marks, Status (badge), Contributor, Actions (Review button) |
| **API** | `GET /api/moderation/questions` (server call via `ModeratorService.listQuestions(actor)`) |

### Step 4: Review Question Detail

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/moderator/questions/:id` |
| **Displays** | Question text, metadata (Subject, Department, Module, Marks, CO, RBT, Difficulty, Status, Creator, Owner), linked question banks, moderation history |
| **Actions panel** | Three actions available (only when status is PENDING or REVISION_SUBMITTED) |

### Step 5: Approve Question

| Item | Detail |
|------|--------|
| **Button** | "Approve Question" |
| **API** | `PATCH /api/moderation/questions/:id/approve` |
| **Service** | `ModeratorService.approveQuestion(actor, questionId)` → calls `moderate()` |
| **Validation** | Question status must be PENDING or REVISION_SUBMITTED |
| **Database writes** | |
| **→ QuestionLibraryItem** | `status` → `APPROVED`, `reviewedAt` = now, `moderatorRemark` = null |
| **→ ModerationEvent** | `{ id, questionId, moderatorId, action: "QUESTION_APPROVED", note: null }` |
| **→ Notification** | Created for question owner: title="Question approved", type=SUCCESS, actionUrl="/dashboard/contributor/questions" |
| **Audit log** | action="QUESTION_APPROVED" |

### Step 6: Reject Question

| Item | Detail |
|------|--------|
| **Button** | "Reject Question" |
| **Pre-requisite** | Must provide rejection reason in textarea (min 1 char) |
| **API** | `PATCH /api/moderation/questions/:id/reject` |
| **Request body** | `{ reason: string }` |
| **Service** | `ModeratorService.rejectQuestion(actor, questionId, reason)` → calls `moderate()` |
| **Database writes** | |
| **→ QuestionLibraryItem** | `status` → `REJECTED`, `reviewedAt` = now, `moderatorRemark` = reason |
| **→ ModerationEvent** | `action: "QUESTION_REJECTED"`, `note: reason` |
| **→ Notification** | Created for owner: title="Question rejected", type=ACTION_REQUIRED |
| **Audit log** | action="QUESTION_REJECTED" |

### Step 7: Request Revision

| Item | Detail |
|------|--------|
| **Button** | "Request Revision" |
| **Pre-requisite** | Must provide revision instructions in textarea (min 1 char) |
| **API** | `PATCH /api/moderation/questions/:id/request-revision` |
| **Request body** | `{ instructions: string }` |
| **Service** | `ModeratorService.requestRevision(actor, questionId, instructions)` |
| **Database writes** | |
| **→ QuestionLibraryItem** | `status` → `REVISION_REQUESTED`, `reviewedAt` = now, `moderatorRemark` = instructions |
| **→ ModerationEvent** | `action: "REVISION_REQUESTED"`, `note: instructions` |
| **→ Notification** | Created for owner: title="Revision requested", type=ACTION_REQUIRED |
| **Audit log** | action="QUESTION_REVISION_REQUESTED" |

### Step 8: Upload Signed Report (HOD Sign-off)

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/moderator/question-banks/:id/signed-report` |
| **Precondition** | Bank status must be `AWAITING_HOD_SIGN` |
| **Step 8a** | Upload the signed PDF: `POST /api/question-banks/:id/signed-report/presign` (get presigned URL + fileAssetId) |
| **Step 8b** | PUT file to presigned URL (browser uploads PDF) |
| **Step 8c** | Confirm upload: `POST /api/question-banks/:id/signed-report` with `{ fileAssetId }` |
| **Service** | `SignedReportService.uploadSignedReport(questionBankId, fileAssetId, actor)` |
| **Validation** | Moderator must be assigned to the bank (or have MODERATOR role) |
| **Database writes** | |
| **→ FileAsset** | (created during presign step) `{ id, bucket: "signed-reports", objectKey, fileName, mimeType, size }` |
| **→ QuestionBank** | `status` → `SIGNED_REPORT_UPLOADED`, `signedReportAssetId` = fileAssetId, `signedReportUploadedAt` = now |
| **→ Notification** | Created for ALL coordinators assigned to the department: "Signed HOD report uploaded — ready for coordinator review" (type=ACTION_REQUIRED) |
| **Audit log** | action="SIGNED_REPORT_UPLOADED" |

### Moderator Pages Summary

| Page | URL | Purpose |
|------|-----|---------|
| Moderator Dashboard | `/dashboard/moderator` | Summary counts, notifications (*some sections incomplete*) |
| Review Queue | `/dashboard/moderator/questions` | List of questions awaiting moderation |
| Question Detail | `/dashboard/moderator/questions/:id` | Full question with Approve/Reject/Request Revision actions |
| Approved Questions | `/dashboard/moderator/approved` | Redirects to Review Queue |
| Rejected Questions | `/dashboard/moderator/rejected` | Redirects to Review Queue |
| Signed Reports | `/dashboard/moderator/signed-reports` | Banks awaiting signed report upload |
| Upload Signed Report | `/dashboard/moderator/question-banks/:id/signed-report` | File upload form for HOD-signed PDF |

---

## PART 6 — QUESTION BANK LIFECYCLE

### Status Model

A `QuestionBank` moves through the following states. The allowed transitions are defined in `QUESTION_BANK_TRANSITIONS`.

```
DRAFT
  │
  ▼
IN_PROGRESS  ◄──────────────────────────────────┐
  │                                              │
  ▼                                              │
UNDER_MODERATION                                 │
  │                                              │
  ▼                                              │
MODERATED                                        │
  │                                              │
  ▼                                              │
REPORT_GENERATED                                 │
  │                                              │
  ▼                                              │
AWAITING_HOD_SIGN  ◄──── (coordinator rejects) ──┤
  │                                              │
  ▼                                              │
SIGNED_REPORT_UPLOADED                           │
  │                                              │
  ▼                                              │
AWAITING_COORDINATOR_APPROVAL                    │
  │              │                               │
  ▼              ▼                               │
APPROVED      AWAITING_HOD_SIGN (rejected) ──────┤
  │                                              │
  ▼                                              │
LOCKED ── (unlock) ──► IN_PROGRESS ─────────────┘
  │
  └── (unlock) ──► DRAFT

Note: Every state also allows direct transition to LOCKED.
```

### Who Can Move Each Status

| From | To | Who | Button/Trigger |
|------|----|-----|----------------|
| DRAFT | IN_PROGRESS | Coordinator | Update status API |
| DRAFT | LOCKED | Coordinator | Update status API |
| IN_PROGRESS | UNDER_MODERATION | Coordinator | Update status |
| IN_PROGRESS | LOCKED | Coordinator | Update status or Lock |
| UNDER_MODERATION | MODERATED | Coordinator | Update status (after all moderator actions complete) |
| UNDER_MODERATION | LOCKED | Coordinator | Update status |
| MODERATED | REPORT_GENERATED | Coordinator → AI Report | Trigger AI report generation (this auto-advances the status) |
| MODERATED | LOCKED | Coordinator | Update status |
| REPORT_GENERATED | AWAITING_HOD_SIGN | Coordinator | Update status |
| REPORT_GENERATED | LOCKED | Coordinator | Update status |
| AWAITING_HOD_SIGN | SIGNED_REPORT_UPLOADED | Moderator | Upload signed report (this auto-advances status) |
| AWAITING_HOD_SIGN | LOCKED | Coordinator | Update status |
| SIGNED_REPORT_UPLOADED | AWAITING_COORDINATOR_APPROVAL | Coordinator | This appears to be a gap — no automatic transition found |
| SIGNED_REPORT_UPLOADED | LOCKED | Coordinator | Update status |
| AWAITING_COORDINATOR_APPROVAL | APPROVED | Coordinator | Coordinator decision: APPROVED |
| AWAITING_COORDINATOR_APPROVAL | AWAITING_HOD_SIGN | Coordinator | Coordinator decision: REJECTED (sends back) |
| AWAITING_COORDINATOR_APPROVAL | LOCKED | Coordinator | Update status |
| APPROVED | LOCKED | Coordinator | Lock operation |
| LOCKED | IN_PROGRESS | Coordinator | Unlock operation (requires reason) |
| LOCKED | DRAFT | Coordinator | Unlock operation (via status update) |

### Validation at Each Transition

The `isValidTransition()` function enforces the state machine. If an invalid transition is attempted, the API returns 409 with message "Cannot transition from X to Y".

### Special: Auto-Status-Advancing Actions

These actions automatically advance the QuestionBank status without a separate status-update API call:

1. **AI Report Generated** (`AiReportService.createAiReport`): After creating the AI report, it updates `QuestionBank.status` to `REPORT_GENERATED`
2. **Signed Report Uploaded** (`SignedReportService.uploadSignedReport`): After uploading, updates `QuestionBank.status` to `SIGNED_REPORT_UPLOADED`
3. **Coordinator Decision** (`ReportService.coordinatorDecision`): Sets status to `APPROVED` (if approved) or `AWAITING_HOD_SIGN` (if rejected)

---

## PART 7 — REPORTS & PAPER GENERATION

### AI Report Generation

#### Trigger

| Item | Detail |
|------|--------|
| **Who** | Coordinator |
| **Prerequisite** | Question bank has ≥3 questions |
| **Button** | "Generate AI Report" on bank detail page |
| **API** | `POST /api/question-banks/:id/reports` |

#### Process

1. **Service**: `ReportingCoordinatorService.triggerAiAnalysis(actor, questionBankId)`
2. **Validates**: Bank exists, department access, minimum 3 questions
3. **Calls**: `AiReportService.createAiReport(questionBankId, actor)`
4. **Creates AiReport record**: `{ questionBankId, status: PROCESSING, modelName, generatedById }`
5. **Runs analysis engine**: `AnalysisEngine.buildDeterministicReport(questionBank)`
   - Counts approved questions
   - Builds module coverage (6 modules × 21 slots each)
   - CO distribution (CO1-CO6)
   - RBT level distribution (L1-L6)
   - Difficulty distribution (EASY/MEDIUM/HARD)
   - Detects duplicate questions (text similarity ≥ 84%)
   - Finds missing areas (modules/COs/RBTs/difficulties with 0 approved questions)
   - Assesses quality (short text, missing teaching index)
   - Assesses Bloom's balance (higher-order vs lower-order ratio)
6. **Calls Ollama AI**: Asks local LLM for executive summary, quality findings, Bloom's balance
7. **Combines results**: Deterministic report + AI overlay
8. **Generates JSON file**: Uploaded to storage bucket `exports` as `.json`
9. **Generates PDF report**: Via `PdfService.createAiReportPdf()`, uploaded to `exports` bucket
10. **Updates AiReport record**: `status: COMPLETED`, links JSON and PDF file assets
11. **Auto-advances bank status**: `QuestionBank.status` → `REPORT_GENERATED`
12. **Notifies coordinators**: "AI analysis report is ready for [SubjectName]"
13. **Audit log**: action="AI_REPORT_GENERATED"

#### Files Created

| File | Location | Format |
|------|----------|--------|
| Analysis JSON | Storage bucket `exports` | `.json` |
| Analysis PDF | Storage bucket `exports` | `.pdf` |

### Paper Generation

#### Trigger

| Item | Detail |
|------|--------|
| **Who** | Coordinator |
| **Prerequisite** | Bank status is LOCKED or REPORT_GENERATED |
| **Button** | "Generate Papers" on bank detail page |
| **API** | `POST /api/question-banks/:id/papers` |

#### Process

1. **Service**: `ReportingCoordinatorService.triggerPaperGeneration(actor, questionBankId)`
2. **Calls**: `PaperGenerationService.generatePapers(questionBankId, actor, [PAPER_A, PAPER_B, PAPER_C])`

#### Question Selection Algorithm

Within `PaperGenerator.generate(questionBank, variants)`:

1. Get all `APPROVED` questions from the bank's `bankQuestions` links
2. Build `historicalExclusion` set: questions already used in previously generated papers (prevents reuse across generations)
3. For each variant (PAPER_A, PAPER_B, PAPER_C), in order:
   - For each module (1-6):
     - For each marks value (2, 5, 10):
       - Filter approved questions: matching module + marks
       - Exclude already-consumed questions (`consumed` set)
       - Exclude historically used questions (`historicalExclusion` set)
       - Sort by rank: MEDIUM difficulty = 0 (preferred), EASY = 2, HARD = 4
       - Pick the first (best-ranked) question
   - If at any slot no question passes filters → throws 409 "Insufficient approved inventory"
4. All 3 variants × 6 modules × 3 marks types = 54 questions per variant = **162 questions total across 3 papers**

#### Score Calculation

| Score | Formula |
|-------|---------|
| **Coverage Score** | (Unique modules covered / 6) × 100 |
| **Difficulty Score** | Based on spread across EASY/MEDIUM/HARD buckets; max(0, 100 - spread × 10) |
| **Quality Score** | avg(question text length) + (teaching index coverage × 30), capped at 100 |
| **Duplicate Risk** | Count of similar question pairs (similarity ≥ 84%) × 25, capped at 100 |

#### Database Records Created Per Paper Variant

| Table | Fields |
|-------|--------|
| **GeneratedPaper** | `{ id, questionBankId, variant, status: COMPLETED, generatedById, generatedAt, coverageScore, difficultyScore, qualityScore, duplicateRisk, recommendation, paperJson, paperFileAssetId }` |
| **GeneratedPaperItem** (×54 per paper) | `{ id, generatedPaperId, questionId }` |
| **QuestionUsageHistory** (×54 per paper) | `{ questionId, examCycleId, generatedPaperId, generatedPaperItemId, academicYearId, semesterId, examType }` |
| **FileAsset** | `{ bucket: "generated-papers", fileName, mimeType: "application/pdf" }` (the PDF file) |

#### Notifications

- All coordinators in the department receive: "Paper generation complete — Papers A, B, C have been generated for [SubjectName]"
- Audit log: action="QUESTION_PAPERS_GENERATED"

---

## PART 8 — DEAN WORKFLOW

### Prerequisites

- User account with DEAN role exists
- Question bank is LOCKED
- Generated papers exist (PAPER_A, PAPER_B, PAPER_C)
- Dean is in same department as the subject

### Step 1: Dean Dashboard

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/dean` |
| **API** | Server-side: `DeanReviewService.getDeanDashboardData(actor)` |
| **Pending reviews** | Question banks with LOCKED status + completed papers, no dean review yet |
| **Completed reviews** | Banks where dean has already submitted selection |
| **Notifications** | Auto-created: "Papers ready for review" (type=ACTION_REQUIRED). After 3 days: "Pending review reminder" (type=WARNING) |

### Step 2: Review Workspace

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/dean/review?bank=:bankId` |
| **API** | `GET /api/question-banks/:id/dean-review` → loads: bank info, all 3 generated papers with questions, metrics, AI recommendations |

#### Displays for Each Paper (PAPER_A, PAPER_B, PAPER_C)

| Section | Content |
|---------|---------|
| Metrics card | Coverage Score, Difficulty Score, Quality Score (values or "N/A"), Duplicate Risk % |
| Duplicate risk badge | "Duplicate risk flagged" (red) if score ≥ 20, else "Duplicate risk ok" |
| AI recommendation | Text from paper generator |
| Expandable content | Questions grouped by module, each showing: text, marks, CO, RBT, difficulty |

### Step 3: Submit Dean Selection

| Item | Detail |
|------|--------|
| **Form** | 3 dropdown selectors: |
| **Regular Exam Paper** | select: PAPER_A, PAPER_B, PAPER_C (one cannot be same as others) |
| **Supplementary Paper** | select: PAPER_A, PAPER_B, PAPER_C |
| **KT Paper** | select: PAPER_A, PAPER_B, PAPER_C |
| **Validation** | All 3 must be distinct. Each must be an existing generated paper variant. |
| **Button** | "Submit Selection" (enabled only when all 3 are distinct and not already submitted) |
| **API** | `POST /api/question-banks/:id/dean-review` |
| **Service** | `DeanReviewService.submitDeanReview(questionBankId, payload, actor)` |

#### Database Records Created

| Table | Fields |
|-------|--------|
| **DeanReview** | `{ id, questionBankId, regularPaper, supplementaryPaper, ktPaper, reviewedById, reviewedAt }` |

#### Notifications Created

| Recipient | Title | Type | Action URL |
|-----------|-------|------|------------|
| All COE users in department | "Dean review complete — [SubjectName] ready for export" | ACTION_REQUIRED | `/dashboard/coe/production` |
| All coordinators in department | "Dean review complete — Papers have been assigned" | SUCCESS | `/dashboard/coordinator/question-banks?bank=X` |
| Dean themselves | "Selection confirmed" | SUCCESS | `/dashboard/dean/review?bank=X` |

#### Audit Log

action="DEAN_SELECTION_SUBMITTED", entityType="DEAN_REVIEW"

### Step 4: Post-Submission

- Dean dashboard shows the bank under "Completed Reviews"
- Dean can view the workspace but can no longer modify the selection
- COE and Coordinators receive notifications

### Dean Pages Summary

| Page | URL | Purpose |
|------|-----|---------|
| Dean Dashboard | `/dashboard/dean` | Pending/completed review lists, notifications |
| Review Workspace | `/dashboard/dean/review?bank=:id` | View papers, metrics, submit paper assignment |
| Readiness Overview | `/dashboard/dean/readiness-overview` | Redirects to dean dashboard |
| Reports | `/dashboard/dean/reports` | Redirects to dean dashboard |

---

## PART 9 — EXPORT WORKFLOW

### Prerequisites

- Dean review has been submitted (DeanReview record exists)
- Question Bank status is LOCKED

### Step 1: COE Production Overview

| Aspect | Detail |
|--------|--------|
| **URL** | `/dashboard/coe/production` |
| **Data** | All question banks with subject, AI report status, generated papers, dean selection status, export history |
| **Dean selection column** | Shows "Regular: X, Supplementary: Y, KT: Z" or "Pending dean review" |
| **Export history** | 5 most recent export artifacts per bank |

### Step 2: Configure and Generate Export

| Item | Detail |
|------|--------|
| **Component** | "Export Console" section |
| **Field: Question Bank** | select, filtered to banks where `deanReview` exists |
| **Field: Format** | select: PDF, DOCX, ZIP |
| **Field: Institution Name** | text, default: "EMQPGS Institution" |
| **Field: Exam Date** | date |
| **Field: Duration** | text, placeholder "3 Hours" |
| **Field: Maximum Marks** | number, default 100 |
| **Field: Instructions** | textarea, multi-line default |
| **Button** | "Generate Export" |

#### Export Creation Process

| Item | Detail |
|------|--------|
| **API** | `POST /api/exports` |
| **Service** | `ExportService.createExport(input, actor)` |

Step-by-step:

1. **Creates `ExportArtifact`** record: `{ questionBankId, format, status: PENDING, metadata: { examDate, duration, maximumMarks, instructions, institutionName }, expiresAt: now + EXPORT_RETENTION_DAYS }`

2. **Builds selected papers**: Looks up dean review → retrieves regular, supplementary, and KT papers

3. **Generates output** based on format:
   - **PDF**: Single combined PDF with all 3 papers
   - **DOCX**: Single combined DOCX
   - **ZIP**: Contains PDF + DOCX + manifest.json

4. **Uploads file** to storage bucket `exports` via `uploadServerFile()`

5. **Updates `ExportArtifact`**: `status → COMPLETED`, `fileAssetId` linked to uploaded file

6. **On failure**: Status set to `FAILED`, failure reason stored in metadata

#### Database Records

| Table | Fields |
|-------|--------|
| **ExportArtifact** | `{ id, questionBankId, generatedById, format, status, metadata (JSON), fileAssetId (nullable), expiresAt }` |
| **FileAsset** | `{ bucket: "exports", fileName, mimeType, size, linkedEntityType: "EXPORT_ARTIFACT" }` |

### Step 3: Download Export

| Aspect | Detail |
|--------|--------|
| **Button** | "Download" in the exports table |
| **API** | `GET /api/exports/:id/download` |
| **Service** | `ExportService.createExportDownloadLink(exportArtifactId, actor)` |
| **Returns** | Presigned download URL |

### Export Formats

| Format | Content |
|--------|---------|
| PDF | Single PDF with all 3 papers (regular, supplementary, KT) with headers, exam info, questions, instructions |
| DOCX | Single DOCX with the same content |
| ZIP | `{subjectCode}-final-papers.pdf` + `{subjectCode}-final-papers.docx` + `manifest.json` |

---

## PART 10 — COMPLETE DATA FLOW EXAMPLE

### Setup

```
Academic Year: 2026-2027
Semester: Semester V
Subject: CS501 — Advanced Algorithms
Exam Cycle: ENDSEM
Coordinator: John (COORDINATOR)
Contributor: Alice (CONTRIBUTOR)
Moderator: Bob (MODERATOR)
Dean: Carol (DEAN)
Department: Computer Engineering
```

### Phase 1: System Setup (COE)

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 1 | COE logs in | `User(COE).lastLoginAt` updated |
| 2 | Create "Computer Engineering" dept | `Department{ name: "CE", hodName: "Dr. Sharma" }` |
| 3 | Create John (COORDINATOR) | `User{ name:"John", role:COORDINATOR, deptId:CE }` |
| 3 | Create Alice (CONTRIBUTOR) | `User{ name:"Alice", role:CONTRIBUTOR, deptId:CE }` |
| 3 | Create Bob (MODERATOR) | `User{ name:"Bob", role:MODERATOR, deptId:CE }` |
| 3 | Create Carol (DEAN) | `User{ name:"Carol", role:DEAN, deptId:CE }` |
| 4 | Create Academic Year 2026-2027 | `AcademicYear{ code:"2026-2027", status:ACTIVE }` |
| 5 | Create Semester V | `Semester{ number:5, name:"Semester V", academicYearId:2026-2027 }` |
| 6 | Create ENDSEM exam cycle | `ExamCycle{ examType:ENDSEM, status:DRAFT, deptId:CE }` |
| 7 | Activate exam cycle | `ExamCycle.status → ACTIVE` |
| — | Assign John to CE department | `CoordinatorDepartmentAssignment{ coordinatorId:John, deptId:CE }` (via DB seed/admin) |

### Phase 2: Coordinator Prepares

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 8 | John logs in | `User(John).lastLoginAt` updated |
| 9 | John creates "Advanced Algorithms" | `Subject{ code:"CS501", name:"Advanced Algorithms", deptId:CE, semId:SemV }` + `SubjectVersion{ versionNumber:1, title:"Advanced Algorithms" }` |
| 10 | John links CS501 to ENDSEM | `SubjectExamCycleLink{ subjectId:CS501, examCycleId:ENDSEM }` |
| 11 | John initializes Question Bank | `QuestionBank{ subjectId:CS501, examCycleId:ENDSEM, status:IN_PROGRESS }` |
| 12 | John assigns Bob as moderator | `ModeratorBankAssignment{ moderatorId:Bob, questionBankId:QB }` + Notification to Bob |

### Phase 3: Contributor Creates Questions

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 13 | Alice logs in | `User(Alice).lastLoginAt` updated |
| 14 | Alice creates 6 questions (Module 1-6) | For each: `QuestionLibraryItem{ status:DRAFT, ownerId:Alice }` + `QuestionRevision{ revisionNumber:1 }` + `QuestionBankQuestion{ questionBankId:QB }` |
| 15 | Alice submits each question | Each: `QuestionLibraryItem.status → PENDING`, `submittedAt` set |

### Phase 4: Moderator Reviews

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 16 | John advances bank to UNDER_MODERATION | `QuestionBank.status → UNDER_MODERATION` |
| 17 | Bob logs in, sees 6 pending questions | Notification inbox shows review requests |
| 18 | Bob approves 4 questions | Each: `QuestionLibraryItem.status → APPROVED`, `ModerationEvent{ action:QUESTION_APPROVED }`, Notification to Alice |
| 19 | Bob rejects 1 question | `QuestionLibraryItem.status → REJECTED`, `ModerationEvent{ action:QUESTION_REJECTED }`, Notification to Alice |
| 20 | Bob requests revision on 1 question | `QuestionLibraryItem.status → REVISION_REQUESTED`, `ModerationEvent{ action:REVISION_REQUESTED }`, Notification to Alice |
| 21 | Alice edits and resubmits the revision | `QuestionLibraryItem.status → REVISION_SUBMITTED` |
| 22 | Bob approves the resubmitted question | `QuestionLibraryItem.status → APPROVED`, `ModerationEvent{ action:QUESTION_APPROVED }` |

### Phase 5: AI Report & Paper Generation

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 23 | John advances bank to MODERATED | `QuestionBank.status → MODERATED` |
| 24 | John triggers AI Analysis | `AiReport{ status:COMPLETED, modelName }` + JSON file + PDF file |
| 25 | **Auto**: Bank status → REPORT_GENERATED | `QuestionBank.status → REPORT_GENERATED` |
| 26 | John advances to AWAITING_HOD_SIGN | `QuestionBank.status → AWAITING_HOD_SIGN` |

### Phase 6: Signed Report

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 27 | Bob uploads signed HOD PDF | `FileAsset{ bucket:"signed-reports" }` |
| 28 | **Auto**: Bank status → SIGNED_REPORT_UPLOADED | `QuestionBank.status → SIGNED_REPORT_UPLOADED`, `signedReportAssetId` set |
| 29 | Notification sent to John | "Signed HOD report uploaded — ready for coordinator review" |

### Phase 7: Coordinator Approves

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 30 | John approves the signed report | `QuestionBank{ status:APPROVED, coordinatorDecision:APPROVED, coordinatorReviewedAt }` |
| 31 | John locks the bank | `QuestionBank{ status:LOCKED, lockedAt }` |

### Phase 8: Paper Generation

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 32 | John triggers paper generation | `GeneratedPaper{ variant:PAPER_A, status:COMPLETED }` + 54 items + 54 usage records |
| 32 | | `GeneratedPaper{ variant:PAPER_B, status:COMPLETED }` + 54 items + 54 usage records |
| 32 | | `GeneratedPaper{ variant:PAPER_C, status:COMPLETED }` + 54 items + 54 usage records |
| 32 | | 3 PDF files uploaded to `generated-papers` bucket |
| 32 | | Notification: "Paper generation complete" to John and other coordinators |

### Phase 9: Dean Review

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 33 | Carol logs in | Dashboard shows "Papers ready for review — Advanced Algorithms" |
| 34 | Carol reviews papers | Metrics, questions, AI recommendations displayed |
| 35 | Carol selects: Regular=PAPER_A, Supplementary=PAPER_B, KT=PAPER_C | `DeanReview{ regularPaper:PAPER_A, supplementaryPaper:PAPER_B, ktPaper:PAPER_C, reviewedById:Carol }` |
| 36 | Notifications sent | COE: "Dean review complete — ready for export" + Coordinators: "Dean review complete" |

### Phase 10: Export

| Step | Action | Records Created/Updated |
|------|--------|------------------------|
| 37 | COE goes to Production | `/dashboard/coe/production` shows bank with dean selection |
| 38 | COE configures export: PDF, exam date, 3 hours, 100 marks | |
| 39 | COE clicks "Generate Export" | `ExportArtifact{ format:PDF, status:COMPLETED }` |
| 40 | PDF combined document generated | 3 papers in single PDF → uploaded to `exports` bucket |
| 41 | COE downloads the PDF | Presigned download URL generated |

### Database State After Full Lifecycle

| Table | Records Created |
|-------|-----------------|
| Department | 1 |
| User | 5 (COE, John, Alice, Bob, Carol) |
| AcademicYear | 1 (2026-2027) |
| Semester | 1 (Semester V) |
| ExamCycle | 1 (ENDSEM, status=ACTIVE) |
| Subject | 1 (CS501 Advanced Algorithms) |
| SubjectVersion | 1 (version 1) |
| SubjectExamCycleLink | 1 |
| QuestionBank | 1 (status=LOCKED) |
| QuestionLibraryItem | 6 (5 approved, 1 rejected) |
| QuestionRevision | 7 (6 initial + 1 resubmission) |
| QuestionBankQuestion | 6 (all linked) |
| ModerationEvent | 4 (approves, reject, revision request, final approve) |
| ModeratorBankAssignment | 1 (Bob assigned) |
| CoordinatorDepartmentAssignment | 1 (John assigned) |
| AiReport | 1 (COMPLETED) |
| FileAsset | 5 (AI JSON, AI PDF, 3 generated paper PDFs) |
| GeneratedPaper | 3 (PAPER_A, PAPER_B, PAPER_C) |
| GeneratedPaperItem | 162 (54 per paper) |
| QuestionUsageHistory | 162 (one per item) |
| DeanReview | 1 (Carol's selection) |
| ExportArtifact | 1 (COMPLETED, PDF) |
| Notification | ~10 (various status updates) |
| AuditLog | ~20+ (every action tracked) |

---

## PART 11 — REMAINING GAPS

### 1. Pages with No Backend

| Page | Issue |
|------|-------|
| `/dashboard/coordinator/subjects` | The `subjects/` module directory in `src/modules/` is completely empty — all subject logic lives in the coordinator module |
| `/dashboard/contributor/my-subjects` | Exists as a page route but its content/behavior is unclear — may have no data to display if not properly connected |
| `/dashboard/contributor/submit-question` | Depends on subject version data being available; if no active subject versions exist for the contributor, the form will be empty |

### 2. APIs with No Frontend

| API Endpoint | Usage | Frontend Page |
|-------------|-------|---------------|
| `GET /api/subject-versions?subjectId=X` | List versions | Depends on subject detail page wiring |
| `PATCH /api/subject-versions/:id/archive` | Archive version | No frontend button found |
| `POST /api/question-bank-questions` | Link question to bank | Used by `createForBank` flow but also callable standalone — no dedicated UI |
| `GET /api/question-library/:id/history` | Get question history | No frontend page displays revision history |
| `GET /api/question-library/:id/usage` | Get usage stats | No frontend page displays usage statistics |
| `PATCH /api/notifications` | Mark notifications | Notifications only shown inside role dashboards |
| `GET /api/exports?questionBankId=X` | List exports | Used only in `/dashboard/coe/production` |
| `POST /api/storage/presign` | Create upload URL | Used internally by signed report upload |
| `POST /api/auth/logout` | Logout | Frontend button exists in AppShell sidebar |
| `POST /api/auth/refresh` | Refresh token | No frontend usage |
| `GET /api/audit-logs` | List audit logs | Used by COE audit page |
| `POST /api/backups` | Create backup | No frontend button |
| `POST /api/auth/forgot-password` | Forgot password | Frontend page exists at `/forgot-password` |
| `POST /api/auth/reset-password` | Reset password | Frontend page exists at `/reset-password` |

### 3. Remaining Workflow Path Issues

| Path | Issue |
|------|-------|
| `IN_PROGRESS → UNDER_MODERATION` | While the status API allows this, there is no validation that the bank actually has enough questions submitted or that moderators are assigned before allowing the transition |

### 4. Dead-End States

| State | Issue |
|-------|-------|
| `DRAFT` | Question banks can be created but there is no way to delete them. They can only move forward through the lifecycle. |
| `REJECTED` (QuestionStatus) | A rejected question can never be resubmitted. The transition map for `QuestionStatus` shows no outgoing transitions from REJECTED. |
| `LOCKED` → `DRAFT` | While the transition map allows LOCKED → DRAFT, the unlock API (`POST /api/question-banks/:id/unlock`) always unlocks to `IN_PROGRESS`, not `DRAFT`. |

### 5. Missing Buttons

| Location | Missing Button |
|----------|---------------|
| Question bank detail page | No "Upload Signed Report" button for moderators (they navigate to a separate page instead) |
| Review Queue | No bulk approve/reject — each question must be reviewed individually |
| Question bank list | No "Archive" or "Delete" for banks |
| Paper generation page | No option to select which variants to generate — always generates all 3 (PAPER_A, PAPER_B, PAPER_C) |

### 6. Features Still Partially Implemented

| Feature | Status |
|---------|--------|
| **Question Ownership Transfer** | API and service exist (`POST /api/question-library/:id/transfer-ownership`) but there is no UI for coordinators to transfer question ownership — only API accessible |
| **Question History/Usage Stats** | Full backend support (revision history, ownership history, usage history, usage stats) but no frontend page displays this data |
| **Coordinators able to create questions directly** | API allows it (`POST /api/question-library` with COORDINATOR role) but the UI path for this is unclear |
| **Forgot/Reset Password** | Pages exist at `/forgot-password` and `/reset-password` with API routes, but the actual email delivery depends on SMTP configuration |
| **System Backups** | `SystemBackup` model exists in schema, service exists (`BackupService`), API route exists (`POST /api/backups`), but no UI trigger anywhere |
| **Email notifications** | `NotificationService.createAndEmail()` exists and is called in some places (dean review, signed report upload), but email delivery depends on SMTP configuration and silently logs failures |
| **Timetable on Exam Cycles** | Full schema support (timetableRows JSON, timetableDocumentRef, etc.) and form UI, but the timetable is never displayed anywhere else in the system — it's only stored |

### 7. Fixed Gaps (June 2026)

| Gap | Fix |
|-----|-----|
| **Coordinator → Department assignment UI** | New page at `/dashboard/coe/coordinator-assignments` with create, list, and remove using new API `POST/DELETE /api/coordinator-departments/:id` |
| **User Edit/Disable/Re-enable** | Added edit modal and disable/re-enable buttons to `/dashboard/coe/users` |
| **Department Edit/Delete** | Added edit modal and delete button with confirmation to `/dashboard/coe/departments` |
| **Question Coverage Dashboard** | New page at `/dashboard/coordinator/coverage` with filters and full analytics |
| **Moderator Dashboard hardcoded arrays** | All three sections (awaiting revision resubmission, recent moderation activity, quick-access banks) now query real data |
| **SIGNED_REPORT_UPLOADED → AWAITING_COORDINATOR_APPROVAL** | Signed report upload now auto-advances to `AWAITING_COORDINATOR_APPROVAL`. Coordinator decision validates bank is in this status. |
| **POST /api/question-bank-questions — no validation** | Added QuestionBankQuestionService, Repository, and Zod validation schema |
| **Moderator assignment — direct Prisma in route** | Refactored into ModeratorAssignmentService with Repository layer |
| **Documentation conflicts** | docs/api/reference.md, docs/domains/exam-domain.md, etc. updated to match code |

---

*End of Document — EMQPGS Complete Operational Workflow*
