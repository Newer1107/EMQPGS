# API Reference

All active API endpoints. Generated from implementation; verified against route handlers and Zod schemas.

All authenticated routes use `withApiHandler({ roles: [...] })` which enforces RBAC, CSRF, rate limiting, and audit logging. All mutating routes require CSRF protection via `x-csrf-token` header.

---

## Auth

### POST /api/auth/login
- **Roles:** None (public)
- **Body:** `{ email, password }`
- **Response:** Sets access + refresh cookies, redirects to role dashboard
- **Service:** `UserService.verifyCredentials()`

### POST /api/auth/logout
- **Roles:** None (authenticated)
- **Body:** None
- **Response:** Clears cookies

### POST /api/auth/refresh
- **Roles:** None (authenticated)
- **Body:** None
- **Response:** Issues new access + refresh tokens
- **Service:** `UserService.findByEmail()`

### GET /api/auth/csrf
- **Roles:** None (public)
- **Response:** `{ token }` — sets `emqpgs_csrf_token` cookie

### POST /api/auth/forgot-password
- **Roles:** None (public)
- **Body:** `{ email }`
- **Response:** Sends password reset email (or silent success if email unknown)

### POST /api/auth/reset-password
- **Roles:** None (public)
- **Body:** `{ token, password }`
- **Response:** Resets password, invalidates token

### GET, POST /api/auth/[...nextauth]
- **Roles:** Mixed (Auth.js internal)
- **Purpose:** Auth.js catch-all handler

---

## Academic Years

### GET /api/academic-years
- **Roles:** COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN
- **Response:** `AcademicYear[]`
- **Service:** `AcademicYearService.list()`

### POST /api/academic-years
- **Roles:** COE
- **Body:** `{ code, startDate, endDate, status? }`
- **Response:** `AcademicYear`
- **Service:** `AcademicYearService.create()`

### GET /api/academic-years/[id]
- **Roles:** COE, COORDINATOR, DEAN
- **Response:** `AcademicYear` with `semesters[]`
- **Service:** `AcademicYearService.findById()`

### PATCH /api/academic-years/[id]
- **Roles:** COE
- **Body:** `{ code?, startDate?, endDate?, status? }`
- **Service:** `AcademicYearService.update()`

---

## Semesters

### GET /api/semesters
- **Roles:** COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN
- **Query:** `?academicYearId=`
- **Response:** `Semester[]`
- **Service:** `SemesterService.list()` or `findByAcademicYear()`

### POST /api/semesters
- **Roles:** COE
- **Body:** `{ number, name, academicYearId }`
- **Service:** `SemesterService.create()`

### GET /api/semesters/[id]
- **Roles:** COE, COORDINATOR
- **Service:** `SemesterService.findById()`

### PATCH /api/semesters/[id]
- **Roles:** COE
- **Body:** `{ number?, name?, academicYearId? }`
- **Service:** `SemesterService.update()`

---

## Departments

### GET /api/departments
- **Roles:** COE, COORDINATOR
- **Response:** `Department[]`
- **Service:** `DepartmentService.list()`

### POST /api/departments
- **Roles:** COE
- **Body:** `{ name, code, hodName }`
- **Service:** `DepartmentService.create()`

### PATCH /api/departments/[id]
- **Roles:** COE
- **Body:** `{ name?, code?, hodName?, isActive? }`
- **Service:** `DepartmentService.update()`

### DELETE /api/departments/[id]
- **Roles:** COE
- **Service:** `DepartmentService.delete()`

---

## Users

### GET /api/users
- **Roles:** COE
- **Response:** `User[]`
- **Service:** `UserService.list()`

### POST /api/users
- **Roles:** COE
- **Body:** `{ name, email, role, password, departmentId?, status? }`
- **Service:** `UserService.create()`

### PATCH /api/users/[id]
- **Roles:** COE
- **Body:** `{ name?, email?, role?, password?, departmentId?, status? }`
- **Service:** `UserService.update()`

### DELETE /api/users/[id]
- **Roles:** COE
- **Service:** `UserService.disable()` (soft-disable)

---

## Exam Cycles

### GET /api/exam-cycles
- **Roles:** COE, COORDINATOR
- **Response:** `ExamCycle[]` with academicYear, semester, department relations
- **Service:** `ExamCycleService.list()`

### POST /api/exam-cycles
- **Roles:** COE
- **Body:** `{ examType, status?, academicYearId, semesterId, departmentId?, startDate?, endDate?, timetable*? }`
- **Service:** `ExamCycleService.create()`

### PATCH /api/exam-cycles/[id]
- **Roles:** COE
- **Body:** Partial of create schema
- **Service:** `ExamCycleService.update()`

---

## Coordinator Department Assignments

### GET /api/coordinator-departments
- **Roles:** COE
- **Response:** `CoordinatorDepartmentAssignment[]` with coordinator and department relations
- **Service:** `CoordinatorDepartmentAssignmentService.list()`

### POST /api/coordinator-departments
- **Roles:** COE
- **Body:** `{ coordinatorId, departmentId }`
- **Validation:** `coordinatorDepartmentAssignmentSchema` — validates coordinator role is COORDINATOR, department exists, no duplicate
- **Service:** `CoordinatorDepartmentAssignmentService.create()`

### DELETE /api/coordinator-departments/[id]
- **Roles:** COE
- **Service:** `CoordinatorDepartmentAssignmentService.delete()`

---

## Subjects

### GET /api/subjects
- **Roles:** COE, COORDINATOR
- **Response:** `Subject[]` with department, semester, versions, examCycleLinks
- **Service:** `SubjectManagementService.listSubjects()`

### POST /api/subjects
- **Roles:** COORDINATOR
- **Body:** `{ subjectCode, subjectName, credits, semesterId, departmentId, questionBankDueDate }`
- **Response:** Subject + auto-created SubjectVersion v1
- **Service:** `SubjectManagementService.createSubject()`

### PUT /api/subjects/[id]
- **Roles:** COORDINATOR
- **Body:** Partial create schema
- **Service:** `SubjectManagementService.updateSubject()`

### PATCH /api/subjects/[id]
- **Roles:** COORDINATOR
- **Body:** Partial create schema (alias of PUT)
- **Service:** `SubjectManagementService.updateSubject()`

### PATCH /api/subjects/[id]/deactivate
- **Roles:** COORDINATOR
- **Body:** None
- **Service:** `SubjectManagementService.deactivateSubject()`

### POST /api/subjects/[id]/link-cycle
- **Roles:** COORDINATOR
- **Body:** `{ examCycleId }`
- **Service:** `SubjectManagementService.linkSubjectToExamCycle()`

---

## Subject Versions

### GET /api/subject-versions
- **Roles:** COE, COORDINATOR
- **Query:** `?subjectId=`
- **Response:** `SubjectVersion[]`
- **Service:** `SubjectVersionService.findBySubject()`

### POST /api/subject-versions
- **Roles:** COORDINATOR
- **Body:** `{ subjectId, title, effectiveFromAcademicYearId }`
- **Response:** New SubjectVersion (auto-archives current active version)
- **Service:** `SubjectVersionService.create()`

### PATCH /api/subject-versions/[id]/archive
- **Roles:** COORDINATOR
- **Body:** None
- **Service:** `SubjectVersionService.archive()`

---

## Question Banks

### GET /api/question-banks
- **Roles:** COORDINATOR
- **Response:** `QuestionBank[]` with subject, examCycle, bankQuestions, DeanReview, AiReport, GeneratedPaper
- **Service:** `QuestionBankWorkflowService.listQuestionBanks()`

### POST /api/question-banks
- **Roles:** COORDINATOR
- **Body:** `{ subjectId, examCycleId }`
- **Response:** QuestionBank (status IN_PROGRESS)
- **Service:** `QuestionBankWorkflowService.initializeQuestionBank()`

### GET /api/question-banks/[id]
- **Roles:** COE, COORDINATOR, MODERATOR, DEAN
- **Response:** Full bank detail with all relations
- **Service:** `QuestionBankWorkflowService.getQuestionBankDetail()`

### PATCH /api/question-banks/[id]/status
- **Roles:** COORDINATOR, MODERATOR
- **Body:** `{ status }` (QuestionBankStatus enum value)
- **Validates:** `isValidTransition()` — returns 409 on invalid
- **Service:** `QuestionBankService.updateStatus()`

### PATCH /api/question-banks/[id]/lock
- **Roles:** COORDINATOR
- **Body:** None
- **Validates:** Exam cycle ACTIVE + endDate set, optimistic lock
- **Service:** `QuestionBankWorkflowService.lockQuestionBank()`

### POST /api/question-banks/[id]/coordinator-decision
- **Roles:** COORDINATOR
- **Body:** `{ decision: "APPROVED" | "REJECTED", remark? }`
- **Service:** `ReportService.coordinatorDecision()`

---

## Question Bank — Assignments

### GET /api/question-banks/[id]/assignments
- **Roles:** COORDINATOR
- **Response:** Contributor assignments for the bank
- **Service:** `CoordinatorService.listAssignments()`

### POST /api/question-banks/[id]/assignments
- **Roles:** COORDINATOR
- **Body:** `{ teacherId, moduleNumber }`
- **Service:** `CoordinatorService.assignContributor()`

### PUT /api/question-banks/[id]/assignments/[aid]
- **Roles:** COORDINATOR
- **Body:** `{ teacherId }`
- **Service:** `CoordinatorService.reassignContributor()`

### DELETE /api/question-banks/[id]/assignments/[aid]
- **Roles:** COORDINATOR
- **Service:** `CoordinatorService.removeAssignment()`

### POST /api/question-banks/[id]/assignments/moderator
- **Roles:** COORDINATOR
- **Body:** `{ moderatorId }`
- **Validation:** `assignmentSchema` — validates moderator role, bank existence, no duplicate
- **Service:** `ModeratorAssignmentService.assignModerator()`

---

## Question Bank — Reports & Papers

### GET /api/question-banks/[id]/reports
- **Roles:** COORDINATOR, COE
- **Response:** `AiReport[]`
- **Service:** `ReportService.listAiReports()`

### POST /api/question-banks/[id]/reports
- **Roles:** COORDINATOR
- **Prerequisite:** ≥ 60 approved questions
- **Service:** `ReportService.createAiReport()`

### GET /api/question-banks/[id]/papers
- **Roles:** COORDINATOR, COE, DEAN
- **Response:** `GeneratedPaper[]` with items
- **Service:** `ReportService.listGeneratedPapers()`

### POST /api/question-banks/[id]/papers
- **Roles:** COORDINATOR
- **Prerequisite:** Bank status REPORT_GENERATED or LOCKED
- **Service:** `ReportService.generatePapers()`

### POST /api/question-banks/[id]/signed-report
- **Roles:** MODERATOR
- **Body:** `{ fileAssetId }`
- **Service:** `ReportService.uploadSignedReport()`

### POST /api/question-banks/[id]/signed-report/presign
- **Roles:** MODERATOR
- **Body:** `{ fileName, mimeType, size }`
- **Service:** `ReportService.createSignedReportUploadUrl()`

---

## Question Bank — Dean Review

### GET /api/question-banks/[id]/dean-review
- **Roles:** DEAN, COE, COORDINATOR
- **Response:** DeanReviewWorkspace (bank + papers + existing review if any)
- **Service:** `DeanReviewService.getDeanReviewWorkspace()`

### POST /api/question-banks/[id]/dean-review
- **Roles:** DEAN
- **Body:** `{ regularPaper, supplementaryPaper, ktPaper }` (PaperVariant values)
- **Validates:** 3 distinct variants, all belong to the bank
- **Write-once:** Returns 409 if review already exists
- **Service:** `DeanReviewService.submitDeanReview()`

---

## Question Library

### GET /api/question-library
- **Roles:** COORDINATOR, CONTRIBUTOR, MODERATOR, COE, DEAN
- **Query:** `?bankId=` or `?subjectVersionId=` or `?q=`
- **Response:** `QuestionLibraryItem[]`
- **Service:** `QuestionLibraryService.search()` / `findByBank()` / `findBySubjectVersion()`

### POST /api/question-library
- **Roles:** CONTRIBUTOR
- **Body:** `{ subjectVersionId, moduleNumber, marks, questionText, coMapping, rbtLevel, difficultyLevel?, teachingIndex? }`
- **Query:** `?bankId=` — auto-creates QuestionBankQuestion link
- **Service:** `QuestionLibraryService.create()` / `createForBank()`

### PATCH /api/question-library/[id]
- **Roles:** CONTRIBUTOR (own), COORDINATOR
- **Body:** Partial create schema
- **Service:** `QuestionLibraryService.update()`

### POST /api/question-library/[id]?action=submit
- **Roles:** CONTRIBUTOR (own)
- **Body:** None
- **Service:** `QuestionLibraryService.submit()`

### POST /api/question-library/[id]/transfer-ownership
- **Roles:** COORDINATOR
- **Body:** `{ toUserId, reason? }`
- **Service:** `QuestionLibraryService.transferOwnership()`

### GET /api/question-library/[id]/usage
- **Roles:** COORDINATOR, CONTRIBUTOR
- **Service:** `QuestionLibraryService.getUsageStats()`

### GET /api/question-library/[id]/history
- **Roles:** COORDINATOR, CONTRIBUTOR
- **Response:** Full detail with revisionHistory, ownershipHistory, usageHistory, moderationEvents
- **Service:** `QuestionLibraryService.getFullDetail()`

### GET /api/question-library/coverage
- **Roles:** COE, COORDINATOR, DEAN
- **Query:** `?subjectVersionId=`
- **Response:** Coverage analytics per module/CO/RBT/difficulty
- **Service:** `QuestionLibraryService.getCoverage()`

---

## Question Bank Questions (bridge)

### GET /api/question-bank-questions
- **Roles:** COE, COORDINATOR, MODERATOR, CONTRIBUTOR
- **Query:** `?questionBankId=`
- **Response:** `QuestionBankQuestion[]`
- **Service:** `QuestionBankQuestionService.list()`

### POST /api/question-bank-questions
- **Roles:** COORDINATOR
- **Body:** `{ questionBankId, questionId }`
- **Validation:** `questionBankQuestionSchema` — validates bank exists, question exists, no duplicate
- **Service:** `QuestionBankQuestionService.create()`

---

## Moderation

### GET /api/moderation/questions
- **Roles:** MODERATOR
- **Query:** `?status=`, `?bankId=`
- **Response:** Questions scoped to moderator's assigned banks
- **Service:** `ModeratorService.listQuestions()`

### GET /api/moderation/questions/[id]
- **Roles:** MODERATOR
- **Response:** Full question detail with moderation history
- **Handler:** Direct Prisma

### PATCH /api/moderation/questions/[id]/approve
- **Roles:** MODERATOR
- **Body:** None
- **Service:** `ModeratorService.approveQuestion()`

### PATCH /api/moderation/questions/[id]/reject
- **Roles:** MODERATOR
- **Body:** `{ reason }`
- **Service:** `ModeratorService.rejectQuestion()`

### PATCH /api/moderation/questions/[id]/request-revision
- **Roles:** MODERATOR
- **Body:** `{ instructions }`
- **Service:** `ModeratorService.requestRevision()`

---

## Notifications

### GET /api/notifications
- **Roles:** All authenticated
- **Response:** `Notification[]` for current user
- **Service:** `NotificationService.listForUser()`

### PATCH /api/notifications
- **Roles:** All authenticated
- **Body:** `{ notificationIds: [...] }` or `{ markAll: true }`
- **Service:** `NotificationService.markAsRead()` / `markAllAsRead()`

---

## Exports

### GET /api/exports
- **Roles:** COE
- **Response:** `ExportArtifact[]`
- **Service:** `ExportService.listExportArtifacts()`

### POST /api/exports
- **Roles:** COE
- **Body:** `{ questionBankId, format, examDate, duration, maximumMarks, instructions, institutionName }`
- **Service:** `ExportService.createExport()`

### GET /api/exports/[id]/download
- **Roles:** COE
- **Response:** Redirect to presigned download URL
- **Service:** `ExportService.createExportDownloadLink()`

---

## System

### GET /api/health
- **Roles:** None (optionally protected by `x-health-token` header)
- **Response:** System health + metrics
- **Service:** `MonitoringService.getObservabilityOverview()`

### GET /api/monitoring
- **Roles:** COE
- **Response:** System health + metrics (same data as health)
- **Service:** `MonitoringService.getObservabilityOverview()`

### GET /api/audit-logs
- **Roles:** COE
- **Response:** `AuditLog[]` (latest 25)
- **Handler:** Direct Prisma

### GET /api/dashboard
- **Roles:** All authenticated
- **Response:** Role-specific dashboard data
- **Service:** `DashboardService.getRoleDashboard()`

### POST /api/backups
- **Roles:** COE
- **Body:** None
- **Service:** `BackupService.runSystemBackup()`

### POST /api/storage/presign
- **Roles:** CONTRIBUTOR, MODERATOR
- **Body:** `{ bucket, fileName, mimeType, size, ... }`
- **Service:** `StorageService.createUploadLink()`
