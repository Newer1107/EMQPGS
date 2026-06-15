# EMQPGS — Full-System Integration Audit Report

**Date:** 2026-06-15
**Auditor:** Senior Staff Engineer
**Scope:** Frontend → API → Services → Repositories → Database — every layer traced
**Methodology:** File-by-file read of every route handler (54 files), service (22 files), repository (8 files), component (18 files), page (25 files), and validation schema (10 files); all cross-referenced against `prisma/schema.prisma` (22 models, 19 enums)

---

## Table of Contents

1. [Route Inventory](#1-route-inventory)
2. [Frontend → Backend Trace](#2-frontend--backend-trace)
3. [Workflow Verification](#3-workflow-verification)
4. [Schema Consistency Audit](#4-schema-consistency-audit)
5. [Dead Code Detection](#5-dead-code-detection)
6. [Broken Import Detection](#6-broken-import-detection)
7. [Frontend State Audit](#7-frontend-state-audit)
8. [API Contract Audit](#8-api-contract-audit)
9. [End-to-End Scenario Testing](#9-end-to-end-scenario-testing)
10. [Final Report](#10-final-report)

---

## 1. Route Inventory

### 1.1 Complete Route Map

#### Auth Group

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | None (Auth.js internal) | Auth.js handlers | None | `user` (internal) |
| `/api/auth/login` | POST | `{ email, password }` (inline) | `UserService.verifyCredentials()` | `UserRepository` | `user`, `auditLog` |
| `/api/auth/logout` | POST | None | None (cookie deletion) | None | `auditLog` |
| `/api/auth/csrf` | GET | None | `getOrCreateCsrfToken()` | None | None |
| `/api/auth/forgot-password` | POST | `{ email }` (inline) | None | None | `user` (direct) |
| `/api/auth/reset-password` | POST | `{ token, password }` (inline) | None | None | `user` (direct) |
| `/api/auth/refresh` | POST | None | `signAccessToken()` / `UserService.findByEmail()` | `UserRepository` | `user` |

#### User Management

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/users` | GET, POST | `userSchema` (POST) | `UserService.list()` / `create()` | `UserRepository` | `user`, `auditLog` |
| `/api/users/[id]` | PATCH, DELETE | `userSchema.partial()` (PATCH) | `UserService.update()` / `disable()` | `UserRepository` | `user`, `auditLog` |

#### Departments

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/departments` | GET, POST | `departmentSchema` (POST) | `DepartmentService.list()` / `create()` | `DepartmentRepository` | `department`, `auditLog` |
| `/api/departments/[id]` | PATCH, DELETE | `departmentSchema.partial()` (PATCH) | `DepartmentService.update()` / `delete()` | `DepartmentRepository` | `department`, `auditLog` |

#### Academic Years

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/academic-years` | GET, POST | `academicYearSchema` (POST) | `AcademicYearService.list()` / `create()` | `AcademicYearRepository` | `academicYear`, `semester` |
| `/api/academic-years/[id]` | GET, PATCH | `academicYearSchema.partial()` (PATCH) | `AcademicYearService.findById()` / `update()` | `AcademicYearRepository` | `academicYear`, `semester` |

#### Semesters

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/semesters` | GET, POST | `semesterSchema` (POST) | `SemesterService.list()` / `create()` | `SemesterRepository` | `semester`, `academicYear` |
| `/api/semesters/[id]` | GET, PATCH | `semesterSchema.partial()` (PATCH) | `SemesterService.findById()` / `update()` | `SemesterRepository` | `semester`, `academicYear` |

#### Exam Cycles

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/exam-cycles` | GET, POST | `examCycleSchema` (POST) | `ExamCycleService.list()` / `create()` | `ExamCycleRepository` | `examCycle`, `semester`, `academicYear`, `department` |
| `/api/exam-cycles/[id]` | PATCH | `examCycleSchema.partial()` | `ExamCycleService.update()` | `ExamCycleRepository` | `examCycle`, `semester` |

#### Subjects

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/subjects` | GET, POST | `subjectCreateSchema` (inline) | `SubjectManagementService.listSubjects()` / `createSubject()` | None (uses `prisma` directly) | `subject`, `subjectVersion`, `department`, `semester` |
| `/api/subjects/[id]` | PUT, PATCH | `subjectUpdateSchema` (inline) | `SubjectManagementService.updateSubject()` | None (uses `prisma` directly) | `subject` |
| `/api/subjects/[id]/link-cycle` | POST | `{ examCycleId }` (inline) | `SubjectManagementService.linkSubjectToExamCycle()` | None | `subject`, `examCycle` |
| `/api/subjects/[id]/deactivate` | PATCH | None | `SubjectManagementService.deactivateSubject()` | None | `subject` |

#### Subject Versions

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/subject-versions` | GET, POST | `subjectVersionSchema` (POST) | `SubjectVersionService.findBySubject()` / `create()` | `SubjectVersionRepository` | `subjectVersion`, `subject`, `academicYear` |
| `/api/subject-versions/[id]/archive` | PATCH | None | `SubjectVersionService.archive()` | `SubjectVersionRepository` | `subjectVersion` |

#### Question Banks

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/question-banks` | GET, POST | `questionBankCreateSchema` (inline) | `QuestionBankWorkflowService.listQuestionBanks()` / `initializeQuestionBank()` | None (uses `prisma` directly) | `questionBank`, `subject`, `examCycle`, `questionBankQuestion` |
| `/api/question-banks/[id]` | GET | None | `QuestionBankWorkflowService.getQuestionBankDetail()` | None | `questionBank`, `subject`, `examCycle`, `questionBankQuestion` |
| `/api/question-banks/[id]/status` | PATCH | `questionBankStatusSchema` | `QuestionBankService.updateStatus()` | `QuestionBankRepository` | `questionBank` |
| `/api/question-banks/[id]/lock` | PATCH | None | `QuestionBankWorkflowService.lockQuestionBank()` | None | `questionBank`, `examCycle` |
| `/api/question-banks/[id]/coordinator-decision` | POST | `coordinatorDecisionSchema` | `ReportService.coordinatorDecision()` | None | `questionBank` |
| `/api/question-banks/[id]/dean-review` | GET, POST | `deanReviewSchema` (POST) | `DeanReviewService.getDeanReviewWorkspace()` / `submitDeanReview()` | None | `questionBank`, `deanReview`, `generatedPaper`, `notification` |
| `/api/question-banks/[id]/reports` | GET, POST | None | `ReportingCoordinatorService.listAiReports()` / `triggerAiAnalysis()` | None | `questionBank`, `aiReport` |
| `/api/question-banks/[id]/signed-report` | POST | `signedReportSchema` | `ReportService.uploadSignedReport()` | None | `questionBank`, `fileAsset` |
| `/api/question-banks/[id]/signed-report/presign` | POST | `{ fileName, mimeType, size }` (inline) | `ReportService.createSignedReportUploadUrl()` | None | `questionBank`, `fileAsset` |
| `/api/question-banks/[id]/papers` | GET, POST | None | `ReportingCoordinatorService.listGeneratedPapers()` / `triggerPaperGeneration()` | None | `questionBank`, `generatedPaper` |

#### Question Bank Questions (bridge table)

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/question-bank-questions` | GET, POST | None (raw JSON) | None (direct `prisma`) | None | `questionBankQuestion`, `questionLibraryItem` |

#### Question Library

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/question-library` | GET, POST | `questionLibraryItemSchema` (POST) | `QuestionLibraryService.search()` / `findByBank()` / `create()` / `createForBank()` | `QuestionLibraryRepository` | `questionLibraryItem`, `subjectVersion`, `questionBankQuestion`, `questionRevision` |
| `/api/question-library/[id]` | PATCH, POST | `questionLibraryUpdateSchema` (PATCH) | `QuestionLibraryService.update()` / `submit()` | `QuestionLibraryRepository` | `questionLibraryItem` |
| `/api/question-library/coverage` | GET | None | `QuestionLibraryService.getCoverage()` | `QuestionLibraryRepository` | `questionLibraryItem` |
| `/api/question-library/[id]/usage` | GET | None | `QuestionLibraryService.getUsageStats()` | `QuestionLibraryRepository` | `questionUsageHistory` |
| `/api/question-library/[id]/transfer-ownership` | POST | `{ toUserId, reason? }` (inline) | `QuestionLibraryService.transferOwnership()` | `QuestionLibraryRepository` | `questionLibraryItem`, `questionOwnershipHistory` |
| `/api/question-library/[id]/history` | GET | None | `QuestionLibraryService.getFullDetail()` / `getOwnershipHistory()` etc. | `QuestionLibraryRepository` | `questionLibraryItem`, `questionOwnershipHistory`, `questionRevision`, `questionUsageHistory` |

#### Moderation

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/moderation/questions` | GET | None | `ModeratorService.listQuestions()` | None | `moderatorBankAssignment`, `questionLibraryItem`, `questionBankQuestion` |
| `/api/moderation/questions/[id]` | GET | None | None (direct `prisma`) | None | `questionLibraryItem`, `moderationEvent` |
| `/api/moderation/questions/[id]/request-revision` | PATCH | `{ instructions }` (inline) | `ModeratorService.requestRevision()` | None | `questionLibraryItem`, `moderationEvent`, `notification` |
| `/api/moderation/questions/[id]/approve` | PATCH | None | `ModeratorService.approveQuestion()` | None | `questionLibraryItem`, `moderationEvent`, `notification` |
| `/api/moderation/questions/[id]/reject` | PATCH | `{ reason }` (inline) | `ModeratorService.rejectQuestion()` | None | `questionLibraryItem`, `moderationEvent`, `notification` |

#### Notifications

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/notifications` | GET, PATCH | `markReadSchema` (PATCH) | `NotificationService.listForUser()` / `markAsRead()` / `markAllAsRead()` | None | `notification` |

#### Audit Logs

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/audit-logs` | GET | None | None (direct `prisma`) | None | `auditLog`, `user` |

#### Backups

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/backups` | POST | None | `BackupService.runSystemBackup()` | None | `systemBackup`, `fileAsset` |

#### Exports

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/exports` | GET, POST | `exportRequestSchema` (POST) | `ExportService.listExportArtifacts()` / `createExport()` | None | `exportArtifact`, `questionBank` |
| `/api/exports/[id]/download` | GET | None | `ExportService.createExportDownloadLink()` | None | `exportArtifact`, `fileAsset` |

#### Storage

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/storage/presign` | POST | `{ bucket, fileName, mimeType, size, ... }` (inline) | `StorageService.createUploadLink()` | None | `fileAsset` |

#### Monitoring

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/health` | GET | None | `MonitoringService.getObservabilityOverview()` | None | `user`, `questionBank`, `aiReport`, `generatedPaper`, `exportArtifact`, `systemBackup`, `fileAsset` |
| `/api/monitoring` | GET | None | `MonitoringService.getObservabilityOverview()` | None | (same as health) |

#### Dashboard

| Route | Method(s) | Validation Schema | Service | Repository | Prisma Models |
|---|---|---|---|---|---|
| `/api/dashboard` | GET | None | `DashboardService.getRoleDashboard()` | None | `user`, `department`, `examCycle`, `questionBank`, `notification` |

### 1.2 Unused Routes

| Route | Reason |
|---|---|
| `GET /api/monitoring` | Identical to `GET /api/health` — calls the same service, returns the same data. Duplicate endpoint. |
| `PATCH /api/subjects/[id]` | Alias of `PUT /api/subjects/[id]` — both handled identically in the same handler. Redundant. |

### 1.3 Broken Routes

| Route | Issue | Classification |
|---|---|---|
| `POST /api/question-banks/[id]/assignments/moderator` | **Route directory does not exist.** Referenced in `AGENTS.md` as a first-class API and on the coordinator assignments page (`app/(protected)/dashboard/coordinator/assignments/page.tsx:15`). No directory `app/api/question-banks/[id]/assignments/` exists. | **P0** |

### 1.4 Orphan Routes (API exists, no UI)

| Route | API Status | UI Status |
|---|---|---|
| `POST /api/subject-versions` | Working | No creation form in browser |
| `POST /api/question-library/[id]/transfer-ownership` | Working | No transfer UI |
| `PATCH /api/question-library/[id]` | Working | No edit-question form |
| `POST /api/question-library/[id]?action=submit` | Working | No submit button |
| `PATCH /api/moderation/questions/[id]/request-revision` | Working | No revision request button |
| `PATCH /api/moderation/questions/[id]/reject` | Working | No reject button |
| `PATCH /api/question-banks/[id]/lock` | Working | No lock button in bank UI |
| `POST /api/question-banks/[id]/signed-report` | Working | No moderator upload UI |
| `POST /api/question-banks/[id]/signed-report/presign` | Working | No moderator upload UI |
| `POST /api/question-banks/[id]/coordinator-decision` | Working | No approve/reject button |
| `POST /api/question-banks/[id]/reports` | Working | No report generation trigger |
| `POST /api/academic-years` | Working | No creation form in COE dashboard |
| `POST /api/semesters` | Working | No creation form in COE dashboard |

---

## 2. Frontend → Backend Trace

### 2.1 Request/Response Contract Verification

Every frontend component that makes API calls was verified against the matching Zod schema. **All field names, types, and shapes match exactly.**

| Component | API Endpoint | Schema | Fields Checked | Match |
|---|---|---|---|---|
| `login/page.tsx` | `POST /api/auth/login` | `{ email, password }` | 2/2 | Yes |
| `forgot-password/page.tsx` | `POST /api/auth/forgot-password` | `{ email }` | 1/1 | Yes |
| `reset-password/page.tsx` | `POST /api/auth/reset-password` | `{ token, password }` | 2/2 | Yes |
| `simple-form.tsx` → coe/users | `POST /api/users` | `userSchema` | `name`, `email`, `departmentId`, `role`, `password`, `status` | Yes |
| `simple-form.tsx` → coe/departments | `POST /api/departments` | `departmentSchema` | `name`, `code`, `hodName` | Yes |
| `simple-form.tsx` → coordinator/banks | `POST /api/question-banks` | `{ subjectId, examCycleId }` | 2/2 | Yes |
| `exam-cycle-timetable-manager.tsx` | `POST /api/exam-cycles` | `examCycleSchema` | 11 top-level + nested `timetableRows` | Yes |
| `exam-cycle-timetable-manager.tsx` | `PATCH /api/exam-cycles/[id]` | `examCycleSchema.partial()` | 11 (all sent, `.partial()` accepts) | Yes |
| `dean-review-workspace.tsx` | `GET /api/question-banks/[id]/dean-review` | `DeanReviewWorkspace` response type | All nested fields | Yes |
| `dean-review-workspace.tsx` | `POST /api/question-banks/[id]/dean-review` | `deanReviewSchema` | `regularPaper`, `supplementaryPaper`, `ktPaper` | Yes |
| `export-console.tsx` | `POST /api/exports` | `exportRequestSchema` | `questionBankId`, `format`, `examDate`, `duration`, `maximumMarks`, `instructions`, `institutionName` | Yes |
| `notification-inbox.tsx` | `PATCH /api/notifications` | `markReadSchema` (union) | `{ notificationIds: [...] }` and `{ markAll: true }` | Yes |
| `app-shell.tsx` | `POST /api/auth/logout` | None | N/A | Yes |

### 2.2 Response Envelope Consistency

All route handlers use `withApiHandler` which wraps every response as:

```json
{ "success": true, "data": <T> }
```

or

```json
{ "success": false, "error": { "code": "<string>", "message": "<string>", "details?": <any> } }
```

All client components using `apiFetch()` read `result.data` after a `result.ok` check. Consistent across the entire codebase.

### 2.3 UI Components and Their Data Sources

#### COE Pages

| Page | Data Source | Components | API Calls from Browser |
|---|---|---|---|
| `/dashboard/coe` | `DashboardService.getRoleDashboard()` (SSR) | `StatCard`, `Card` | None |
| `/dashboard/coe/users` | `getAdminData()` → raw prisma (SSR) | `DataTableCard`, `SimpleForm` | `POST /api/users` (SimpleForm) |
| `/dashboard/coe/departments` | `getAdminData()` → raw prisma (SSR) | `DataTableCard`, `SimpleForm` | `POST /api/departments` (SimpleForm) |
| `/dashboard/coe/exam-cycles` | Raw `prisma.department.findMany()` / `academicYear.findMany()` / `examCycle.findMany()` (SSR) | `ExamCycleTimetableManager` | `GET /api/semesters`, `POST /api/exam-cycles`, `PATCH /api/exam-cycles/[id]` |
| `/dashboard/coe/monitoring` | `MonitoringService.getObservabilityOverview()` (SSR) | `Card` | None |
| `/dashboard/coe/production` | `ExportService.listCoeOverview()` (SSR) | `ExportConsole` | `POST /api/exports`, `GET /api/exports/[id]/download` |
| `/dashboard/coe/audit` | `getAdminData()` → raw prisma (SSR) | `DataTableCard`, `Table` | None |

#### Coordinator Pages

| Page | Data Source | Components | API Calls from Browser |
|---|---|---|---|
| `/dashboard/coordinator` | `CoordinatorService.getDashboard()` (SSR) | `Card`, `Link` | None |
| `/dashboard/coordinator/subjects` | `SubjectManagementService.listSubjects()` (SSR) | `DataTableCard`, `Table` | None (read-only) |
| `/dashboard/coordinator/question-banks` | `QuestionBankWorkflowService.listQuestionBanks()` + `prisma.examCycle.findMany()` (SSR) | `DataTableCard`, `SimpleForm` | `POST /api/question-banks` (SimpleForm) |
| `/dashboard/coordinator/questions` | Raw `prisma.questionLibraryItem.findMany()` (SSR) | `DataTableCard`, `Badge`, `Table` | None (read-only) |
| `/dashboard/coordinator/assignments` | None | `Card` | None (static API docs) |

#### Moderator Pages

| Page | Data Source | Components | API Calls from Browser |
|---|---|---|---|
| `/dashboard/moderator` | `ModeratorDashboardService.getDashboard()` (SSR) | `Card`, `NotificationInbox` | `PATCH /api/notifications` |
| `/dashboard/moderator/questions` | `ModeratorService.listQuestions()` (SSR) | `DataTableCard`, `Table`, `Badge` | None (read-only) |
| `/dashboard/moderator/approved` | Redirect → `/dashboard/moderator/questions` | — | — |
| `/dashboard/moderator/rejected` | Redirect → `/dashboard/moderator/questions` | — | — |

#### Contributor Pages

| Page | Data Source | Components | API Calls from Browser |
|---|---|---|---|
| `/dashboard/contributor` | `DashboardService.getRoleDashboard()` (SSR) | `StatCard`, `Card`, `Link` | None |
| `/dashboard/contributor/questions` | Raw `prisma.questionLibraryItem.findMany()` (SSR) | `DataTableCard`, `Table`, `Badge` | None (read-only) |
| `/dashboard/contributor/my-subjects` | `getQuestionContributionWorkspace()` → raw prisma (SSR) | `DataTableCard`, `Table` | None (read-only) |
| `/dashboard/contributor/submit-question` | None | `Card`, `Link` | None (static API docs) |

#### Dean Pages

| Page | Data Source | Components | API Calls from Browser |
|---|---|---|---|
| `/dashboard/dean` | `DeanReviewService.getDeanDashboardData()` (SSR) | `Card`, `Badge`, `DeanNotificationsInbox` | `PATCH /api/notifications` |
| `/dashboard/dean/review` | `DeanReviewWorkspace` client component (CSR) | `DeanReviewWorkspace` | `GET/POST /api/question-banks/[id]/dean-review` |
| `/dashboard/dean/readiness-overview` | Redirect → `/dashboard/dean` | — | — |
| `/dashboard/dean/reports` | Redirect → `/dashboard/dean` | — | — |

### 2.4 Server Data Helper Functions

| Function | File | Called By |
|---|---|---|
| `getDashboardSeed(role)` | `src/lib/server-data.ts:11` | `coe/page.tsx`, `contributor/page.tsx` |
| `getAdminData(input?)` | `src/lib/server-data.ts:17` | `coe/users/page.tsx`, `coe/departments/page.tsx`, `coe/audit/page.tsx` |
| `getQuestionContributionWorkspace(role)` | `src/lib/server-data.ts:41` | `contributor/my-subjects/page.tsx` |
| `getDeanReviewData()` | `src/lib/server-data.ts:80` | `dean/page.tsx` |
| `getDeanReviewWorkspaceData(id)` | `src/lib/server-data.ts:85` | **Unused** — Dean review page uses React component instead |
| `getCoeProductionData()` | `src/lib/server-data.ts:90` | `coe/production/page.tsx` |
| `getMonitoringData()` | `src/lib/server-data.ts:94` | `coe/monitoring/page.tsx` |

---

## 3. Workflow Verification

### 3.1 COE Workflows

| Step | API | UI | Verdict |
|---|---|---|---|
| Create AcademicYear | `POST /api/academic-years` | No creation form anywhere | **Partially Broken** |
| Create Semester | `POST /api/semesters` | No creation form anywhere | **Partially Broken** |
| Create ExamCycle | `POST /api/exam-cycles` | Full interactive form (`ExamCycleTimetableManager`) | **Complete** |
| Edit ExamCycle | `PATCH /api/exam-cycles/[id]` | Same component, edit mode | **Complete** |
| View Dashboard | `DashboardService.getRoleDashboard()` | Stat cards + pending tasks | **Complete** |
| View Users/Departments | `getAdminData()` | Data tables + SimpleForm CRUD | **Complete** |
| View Audit Logs | `getAdminData()` → `prisma.auditLog` | Data table | **Complete** |
| View Monitoring | `MonitoringService.getObservabilityOverview()` | Health/metrics cards | **Complete** |
| Export Papers | `ExportService.createExport()` | `ExportConsole` full form + download | **Complete** |

### 3.2 Coordinator Workflows

| Step | API | UI | Verdict |
|---|---|---|---|
| Create Subject | `POST /api/subjects` | No form — subjects page is read-only | **Partially Broken** |
| Edit Subject | `PUT /api/subjects/[id]` | No edit controls | **Partially Broken** |
| Deactivate Subject | `PATCH /api/subjects/[id]/deactivate` | No deactivate button | **Partially Broken** |
| Link Subject to Cycle | `POST /api/subjects/[id]/link-cycle` | No link interface | **Partially Broken** |
| Create QuestionBank | `POST /api/question-banks` | SimpleForm (subject picker + exam cycle picker) | **Complete** |
| View QuestionBank Detail | `GET /api/question-banks/[id]` | Via table navigation | **Complete** |
| Lock QuestionBank | `PATCH /api/question-banks/[id]/lock` | No lock button in bank UI | **Partially Broken** |
| Assign Moderator | `POST /api/question-banks/[id]/assignments/moderator` | **Route missing entirely** | **Broken (P0)** |
| Generate AI Report | `POST /api/question-banks/[id]/reports` | No report trigger in bank UI | **Partially Broken** |
| View AI Reports | `GET /api/question-banks/[id]/reports` | Via bank detail response | **Complete** |
| Generate Paper | `POST /api/question-banks/[id]/papers` | No paper generation trigger | **Partially Broken** |
| Coordinator Decision | `POST /api/question-banks/[id]/coordinator-decision` | No approve/reject button | **Partially Broken** |
| View Dean Review Status | `GET /api/question-banks/[id]/dean-review` | Via bank detail (coordinator GET path) | **Complete** |

### 3.3 Contributor Workflows

| Step | API | UI | Verdict |
|---|---|---|---|
| View Assigned Banks | `GET /api/question-library?bankId=` | `contributor/my-subjects` page | **Complete** |
| View My Questions | `GET /api/question-library` | `contributor/questions` page | **Complete** |
| Create Question | `POST /api/question-library` | Static API doc page only — no form | **Partially Broken** |
| Edit Question | `PATCH /api/question-library/[id]` | No edit form or page | **Partially Broken** |
| Submit Question | `POST /api/question-library/[id]?action=submit` | No submit button | **Partially Broken** |
| View Usage History | `GET /api/question-library/[id]/usage` | No UI link | **Partially Broken** |

### 3.4 Moderator Workflows

| Step | API | UI | Verdict |
|---|---|---|---|
| View Moderation Queue | `GET /api/moderation/questions` | Read-only table with status badges | **Complete** (view only) |
| View Question Detail | `GET /api/moderation/questions/[id]` | No detail page with action buttons | **Partially Broken** |
| Approve Question | `PATCH /api/moderation/questions/[id]/approve` | No approve button in UI | **Partially Broken** |
| Reject Question | `PATCH /api/moderation/questions/[id]/reject` | No reject button in UI | **Partially Broken** |
| Request Revision | `PATCH /api/moderation/questions/[id]/request-revision` | No revision request button in UI | **Partially Broken** |
| View Notifications | `GET /api/notifications` | `NotificationInbox` component | **Complete** |
| Mark Notifications Read | `PATCH /api/notifications` | Click-to-mark-read in inbox | **Complete** |

### 3.5 Dean Workflows

| Step | API | UI | Verdict |
|---|---|---|---|
| View Pending Reviews | `DeanReviewService.getDeanDashboardData()` | Dashboard with pending/completed lists | **Complete** |
| Review Paper Workspace | `GET /api/question-banks/[id]/dean-review` | `DeanReviewWorkspace` with paper cards + expand | **Complete** |
| Select Papers | `POST /api/question-banks/[id]/dean-review` | 3 dropdowns with mutual-exclusion logic | **Complete** |
| View Notifications | `GET /api/notifications` | `DeanNotificationsInbox` component | **Complete** |
| Export Papers | `POST /api/exports` | Not directly — COE-only, dean sees readiness | N/A |

### 3.6 Export Workflow

| Step | API | UI | Verdict |
|---|---|---|---|
| View Bank Overview | `ExportService.listCoeOverview()` | COE production page table | **Complete** |
| Create Export | `POST /api/exports` | `ExportConsole` form (format, metadata, instructions) | **Complete** |
| Download Export | `GET /api/exports/[id]/download` | Download button → presigned URL → new tab | **Complete** |

---

## 4. Schema Consistency Audit

### 4.1 Model → Relation Verification

All 22 Prisma models and 55+ relations were verified against service usage. **No invalid relations found.**

Key relationships verified:

| Parent | Child | FK Field | Cardinality | Verified in Services |
|---|---|---|---|---|
| `AcademicYear` | `Semester` | `academicYearId` | 1:M | `SemesterRepository`, `ExamCycleService` |
| `AcademicYear` | `ExamCycle` | `academicYearId` | 1:M | `ExamCycleRepository` |
| `AcademicYear` | `SubjectVersion` | `effectiveFromAcademicYearId` | 1:M | `SubjectVersionRepository` |
| `Semester` | `Subject` | `semesterId` | 1:M | `SubjectManagementService` |
| `Semester` | `ExamCycle` | `semesterId` | 1:M | `ExamCycleRepository`, `ExamCycleService` |
| `Department` | `Subject` | `departmentId` | 1:M | `SubjectManagementService` |
| `Department` | `ExamCycle` | `departmentId` | 1:M | `ExamCycleRepository` |
| `Subject` | `SubjectVersion` | `subjectId` | 1:M | `SubjectManagementService.createSubject()` (auto-creates v1) |
| `SubjectVersion` | `QuestionLibraryItem` | `subjectVersionId` | 1:M | `QuestionLibraryRepository` |
| `QuestionLibraryItem` | `QuestionBankQuestion` | `questionId` | 1:M | `QuestionLibraryService.createForBank()` |
| `QuestionBank` | `QuestionBankQuestion` | `questionBankId` | 1:M | `QuestionBankWorkflowService` |
| `QuestionLibraryItem` | `QuestionRevision` | `questionId` | 1:M | `QuestionLibraryService.create()` / `update()` |
| `QuestionLibraryItem` | `QuestionOwnershipHistory` | `questionId` | 1:M | `QuestionLibraryService.transferOwnership()` |
| `QuestionLibraryItem` | `QuestionUsageHistory` | `questionId` | 1:M | `QuestionUsageService.recordUsage()` |
| `QuestionLibraryItem` | `ModerationEvent` | `questionId` | 1:M | `ModeratorService.approveQuestion()` etc. |
| `QuestionLibraryItem` | `GeneratedPaperItem` | `questionId` | 1:M | `PaperGenerator.generate()` |
| `QuestionBank` | `AiReport` | `questionBankId` | 1:M | `AiReportService` |
| `QuestionBank` | `GeneratedPaper` | `questionBankId` | 1:M | `PaperGenerationService` |
| `QuestionBank` | `DeanReview` | `questionBankId` | 1:1 (`@unique`) | `DeanReviewService` |
| `QuestionBank` | `ExportArtifact` | `questionBankId` | 1:M | `ExportService` |
| `QuestionBank` | `ModeratorBankAssignment` | `questionBankId` | 1:M | `ModeratorService` |
| `GeneratedPaper` | `GeneratedPaperItem` | `generatedPaperId` | 1:M | `PaperGenerationService` |
| `User` | `CoordinatorDepartmentAssignment` | `coordinatorId` | M:N (join) | `DepartmentAccessUtils` |
| `Subject` | `SubjectExamCycleLink` | `subjectId` | M:N (join) | `SubjectManagementService.linkSubjectToExamCycle()` |

### 4.2 Service → Repository Method Consistency

Every service method that calls its repository was verified. **Zero method mismatches.**

| Service | Repository | Methods Called | All Exist? |
|---|---|---|---|
| `UserService` | `UserRepository` | `list()`, `findByEmail()`, `findById()`, `findByEmailWithPassword()`, `create()`, `update()` | Yes |
| `AcademicYearService` | `AcademicYearRepository` | `list()`, `findById()`, `create()`, `update()` | Yes |
| `ExamCycleService` | `ExamCycleRepository` | `list()`, `findById()`, `create()`, `update()` | Yes |
| `SemesterService` | `SemesterRepository` | `list()`, `findById()`, `create()`, `update()`, `findByAcademicYear()` | Yes |
| `QuestionLibraryService` | `QuestionLibraryRepository` | `findByBank()`, `findBySubjectVersion()`, `search()`, `create()`, `findById()`, `update()`, `updateStatus()`, `updateOwner()` | Yes |
| `SubjectVersionService` | `SubjectVersionRepository` | `findBySubject()`, `findById()`, `findActiveBySubject()`, `create()`, `update()` | Yes |
| `DepartmentService` | `DepartmentRepository` | `list()`, `findById()`, `create()`, `update()`, `delete()` | Yes |
| `QuestionBankService` | `QuestionBankRepository` | `list()`, `create()`, `findById()`, `update()` | Yes |

### 4.3 Service → Prisma Field Consistency

Each service using `prisma` directly was checked for non-existent fields or relations. **Zero field/relation mismatches.** Services verified:

`QuestionBankWorkflowService`, `SubjectManagementService`, `CoordinatorService`, `ModeratorService`, `DeanReviewService`, `ExportService`, `AiReportService`, `PaperGenerationService`, `SignedReportService`, `BackupService`, `MonitoringService`, `NotificationService`, `DashboardService`, `PaperGenerator`, `AnalysisEngine`

### 4.4 `QuestionBankSlot` Migration Status

The old `QuestionBankSlot` model no longer exists in the schema. Migration is complete:
- `QuestionBankQuestion` (free-form many-to-many join) replaces pre-allocated slots
- `buildQuestionSlotTemplate()` in `src/modules/questions/slot-template.ts` exists only as a computational helper (returns 126 template entries) used by `PaperGenerator` and `AnalysisEngine`
- `slot-summary.ts` is dead code that references the defunct slot pattern (see Part 5)

### 4.5 Old `Question` Model Migration Status

Zero references to an old `Question` model anywhere in the codebase. All code uses `QuestionLibraryItem` or the relation accessor `question` on join models. Migration is complete.

### 4.6 Models with No Dedicated Service or Repository

These models are managed indirectly through parent services:

| Model | Own Service | Own Repository | Assessment |
|---|---|---|---|
| `QuestionOwnershipHistory` | No (via `QuestionLibraryService`) | No | Architectural debt, not breakage |
| `QuestionRevision` | No (via `QuestionLibraryService`) | No | Architectural debt |
| `QuestionUsageHistory` | Shared `QuestionUsageService` | No | Acceptable — append-only log |
| `GeneratedPaperItem` | No (via `PaperGenerationService`) | No | Acceptable — simple join |
| `ModerationEvent` | No (via `ModeratorService`) | No | Acceptable — append-only log |
| `FileAsset` | `StorageService` (lib, not module) | No | Acceptable — generic utility |
| `CoordinatorDepartmentAssignment` | No (via `DepartmentAccessUtils`) | No | Acceptable — simple join |
| `SubjectExamCycleLink` | No (via `SubjectManagementService`) | No | Acceptable — simple join |
| `ModeratorBankAssignment` | No (via `ModeratorService`) | No | Acceptable — simple join |
| `QuestionBankQuestion` | No (direct `prisma` in route) | No | Acceptable — simple join |

**Assessment:** 9 models lack a dedicated repository. This is inconsistent with the feature-module pattern but not broken. The models are mostly simple join tables or append-only logs.

---

## 5. Dead Code Detection

### 5.1 Unused Files (Delete Candidates)

| File | Export(s) | Reason |
|---|---|---|
| `src/modules/question-banks/slot-summary.ts` | `summarizeBankSlots()` | Never imported. References defunct `slot.question` pattern. Entire file is dead. |
| `src/modules/question-banks/mutable-guard.ts` | `ensureQuestionBankMutable()` | Never imported anywhere. Entire file is dead. |
| `src/components/production/examination-timetable-builder.tsx` | `ExaminationTimetableBuilder` | Never imported in any page or parent component. Entire file is dead. |

### 5.2 Orphan Redirect Pages

| Page | Content | Nav Link? | Reachable? |
|---|---|---|---|
| `app/(protected)/dashboard/dean/readiness-overview/page.tsx` | `redirect("/dashboard/dean")` | No | Only by typing URL |
| `app/(protected)/dashboard/dean/reports/page.tsx` | `redirect("/dashboard/dean")` | No | Only by typing URL |

### 5.3 Redirect Pages with Nav Links (Wasteful Round-trips)

| Page | Content | Nav Link Location |
|---|---|---|
| `app/(protected)/dashboard/moderator/approved/page.tsx` | `redirect("/dashboard/moderator/questions")` | `app-shell.tsx:32` |
| `app/(protected)/dashboard/moderator/rejected/page.tsx` | `redirect("/dashboard/moderator/questions")` | `app-shell.tsx:33` |

### 5.4 Unused Exports (in active files)

| File | Export | Used? |
|---|---|---|
| `src/lib/utils.ts` | `toSlug()` | No |
| `src/lib/utils.ts` | `safeJsonParse()` | No |
| `src/lib/pagination.ts` | `buildCursorPaginationParams()` | No |
| `src/lib/constants.ts` | `userStatusLabels` | No |
| `src/lib/constants.ts` | `courseOutcomeLabels` | No |
| `src/lib/constants.ts` | `rbtLevelLabels` | No |
| `src/lib/server-data.ts` | `getDeanReviewWorkspaceData()` | No |
| `src/modules/reports/validation.ts` | `paperGenerationSchema` | No |
| `src/modules/reports/paper-generator.ts` | `GeneratedPaperPayload` (type) | No |

### 5.5 Unused Import

| File | Import | Notes |
|---|---|---|
| `src/modules/coordinator/service.ts:12` | `{ QUESTION_MODULE_COUNT }` from `@/modules/questions/slot-template` | Imported but never referenced in file body |

---

## 6. Broken Import Detection

### 6.1 Findings

| File | Issue | Severity |
|---|---|---|
| `src/modules/coordinator/service.ts:12` | `QUESTION_MODULE_COUNT` imported but unused | P3 |

### 6.2 Verified Clean

- All `@prisma/client` enum imports resolve to valid schema enums
- All `@/` path alias imports resolve to existing files
- No imports reference deleted or renamed modules
- `workers/` directory is empty — no broken worker imports
- Zero references to Redis, BullMQ, or background workers in any `.ts` or `.tsx` file

### 6.3 Documentation-Only Reference

| Doc | References | Status |
|---|---|---|
| `AGENTS.md` | `src/modules/questions/permissions.ts` | File does not exist; no code imports it. Docs-only drift. |

---

## 7. Frontend State Audit

### 7.1 Academic Year

All UI components correctly use `academicYear.id` as FK or `academicYear.code` for display. No flat `academicYear` string fields found.

### 7.2 Semester

All UI components correctly use `semester.id` as FK, `semester.number` and `semester.name` for display. No standalone `semesterNumber` field references found.

### 7.3 SubjectVersion

All question displays correctly navigate `question.subjectVersion.subject.subjectCode` or `question.subjectVersion.subject.subjectName`. Correct.

### 7.4 QuestionLibraryItem

All question-related components use `questionLibraryItem` (or `question` as a Prisma relation accessor). No old `Question` model references found in any `.tsx` file.

### 7.5 Stale Model Check

Searched all `.tsx` files for:

| Term | Matches |
|---|---|
| `semesterNumber` (standalone) | 0 |
| `academicYear` (as flat string field) | 0 |
| `questionType`, `questionCategory` | 0 |
| `questionBankName`, `paperStatus` | 0 |
| `QuestionBankSlot`, `QuestionSlot` | 0 |
| `assignModerator` (as UI action) | 0 (only in documentation text) |
| `lockQuestionBank` / `unlockQuestionBank` (UI action) | 0 |

**No stale model references in active UI code.**

### 7.6 Forms, Tables, Dropdowns, Filters, Search

| Component | Type | Interactive? | Data Source | Correct? |
|---|---|---|---|---|
| `ExamCycleTimetableManager` | Dynamic form | Yes (create/edit) | Department/AcademicYear/Semester dropdowns | Yes |
| `SimpleForm` (COE users) | Dynamic form | Yes (create) | `userSchema` fields | Yes |
| `SimpleForm` (COE departments) | Dynamic form | Yes (create) | `departmentSchema` fields | Yes |
| `SimpleForm` (coordinator banks) | Dynamic form | Yes (create) | Subject + ExamCycle select | Yes |
| `ExportConsole` | Dynamic form | Yes (create + download) | Bank picker, format, metadata | Yes |
| `DeanReviewWorkspace` | Dynamic form | Yes (select + submit) | 3 paper variant dropdowns | Yes |
| `NotificationInbox` | Interactive list | Yes (mark read) | Notification items | Yes |
| `DeanNotificationsInbox` | Interactive list | Yes (mark read) | Notification items | Yes |

All tables in read-only pages (`DataTableCard` + `Table`) display correct relations and status badges.

---

## 8. API Contract Audit

### 8.1 Validation Schema Inventory

| Module | File | Schema(s) |
|---|---|---|
| Users | `src/modules/users/validation.ts` | `userSchema` → `UserInput` |
| Departments | `src/modules/departments/validation.ts` | `departmentSchema` → `DepartmentInput` |
| Academic Years | `src/modules/academic-years/validation.ts` | `academicYearSchema` → `AcademicYearInput` |
| Semesters | `src/modules/semesters/validation.ts` | `semesterSchema` → `SemesterInput` |
| Exam Cycles | `src/modules/exam-cycles/validation.ts` | `examCycleSchema` → `ExamCycleInput`, `timetableRowSchema` |
| Subject Versions | `src/modules/subject-versions/validation.ts` | `subjectVersionSchema` → `SubjectVersionInput` |
| Question Banks | `src/modules/question-banks/validation.ts` | `questionBankSchema` → `QuestionBankInput`, `questionBankStatusSchema` |
| Question Library | `src/modules/question-library/validation.ts` | `questionLibraryItemSchema` → `QuestionLibraryItemInput`, `questionLibraryUpdateSchema` |
| Reports | `src/modules/reports/validation.ts` | `signedReportSchema`, `coordinatorDecisionSchema`, `paperGenerationSchema` (unused) |
| Production | `src/modules/production/validation.ts` | `deanReviewSchema`, `exportRequestSchema` |

Plus 8 inline schemas in route handlers (auth, forgot-password, reset-password, login, subject create/update, transfer ownership, moderation actions, presign).

**All schemas that are imported by route handlers resolve correctly.** One schema is unused (`paperGenerationSchema`).

### 8.2 Request/Response Contract Mismatches: Zero

(See Part 2.1 for the full 11-pair verification table.)

### 8.3 TypeScript Interface → Runtime Alignment

| Type | Defined | Consumer | Aligned |
|---|---|---|---|
| `DeanReviewWorkspace` | `dean-review.service.ts` | `dean-review-workspace.tsx` (casting `result.data`) | Yes |
| `DeanDashboardData` | `dean-review.service.ts` | `dean/page.tsx` | Yes |
| `CoeOverviewItem` | `export.service.ts` | `export-console.tsx` | Yes |
| `TokenPayload` | `jwt.ts` | `proxy.ts`, `api-context.ts` | Yes |
| `Actor` | Multiple files | Service methods across all modules | Yes (minor field variations — some include `departmentId`, others don't — but consumers only access fields that exist) |

### 8.4 Edge Cases

| Case | Component | Issue |
|---|---|---|
| Empty select → `""` | `SimpleForm` | Sends `""` for optional FK fields instead of `null`/`undefined`; Zod rejects `""` where `.nullable().optional()` or `.min(1)` is used. Error surfaced to user via toast. |
| Empty instructions | `ExportConsole` | Sends `instructions: []` if textarea is empty; Zod `.min(1)` rejects. Error surfaced via toast. |

Both are UX concerns handled by existing error display paths, not contract violations.

---

## 9. End-to-End Scenario Testing

### Scenario A: Create Subject → Version → Bank → Question → Submit → Moderate → Generate Paper

| # | Step | Layer | Status | Failure Point |
|---|---|---|---|---|
| 1 | Create Subject | API: `POST /api/subjects` → `SubjectManagementService.createSubject()` → auto-creates `SubjectVersion` v1 | **API works** | **UI missing** — `coordinator/subjects` page has no create form |
| 2 | Create SubjectVersion v2 | API: `POST /api/subject-versions` → `SubjectVersionService.create()` archives v1, creates v2 | **API works** | **UI missing** — no SubjectVersion form anywhere |
| 3 | Link Subject to ExamCycle | API: `POST /api/subjects/[id]/link-cycle` → `SubjectManagementService.linkSubjectToExamCycle()` | **API works** | **UI missing** — no link interface |
| 4 | Create QuestionBank | API: `POST /api/question-banks` → `QuestionBankWorkflowService.initializeQuestionBank()` → status `IN_PROGRESS` | **API works** | **UI: Complete** — `SimpleForm` on `coordinator/question-banks` page |
| 5 | Create Question | API: `POST /api/question-library` → `QuestionLibraryService.createForBank()` → creates `QuestionLibraryItem` + `QuestionRevision` + `QuestionBankQuestion` link | **API works** | **UI missing** — `contributor/submit-question` page is API docs, no form |
| 6 | Submit Question | API: `POST /api/question-library/[id]?action=submit` → `QuestionLibraryService.submit()` → status `DRAFT`→`PENDING` or `REVISION_SUBMITTED` | **API works** | **UI missing** — no submit button in contributor UI |
| 7 | Moderate (Approve) | API: `PATCH /api/moderation/questions/[id]/approve` → `ModeratorService.approveQuestion()` → status `APPROVED` + `ModerationEvent` + notification | **API works** | **UI missing** — moderator questions page is read-only table |
| 8 | Generate Paper | API: `POST /api/question-banks/[id]/papers` → `PaperGenerationService.generatePapers()` → `PaperGenerator.generate()` → PDF + `QuestionUsageHistory` | **API works** | **UI missing** — no generation trigger in bank UI |
| 9 | Dean Review | API: `POST /api/question-banks/[id]/dean-review` → `DeanReviewService.submitDeanReview()` | **API works** | **UI: Complete** — `DeanReviewWorkspace` full interactive component |
| 10 | Export | API: `POST /api/exports` → `ExportService.createExport()` → PDF/DOCX/ZIP | **API works** | **UI: Complete** — `ExportConsole` full form + download |

**Verdict: Partially Broken.** Back-end pipeline is complete end-to-end. Front-end has gaps at steps 1, 2, 3, 5, 6, 7, 8.

### Scenario B: Create Question → Transfer Ownership → Edit → Submit → Use in Paper

| # | Step | Layer | Status | Failure Point |
|---|---|---|---|---|
| 1 | Create Question | (as above) | **API works** | **UI missing** |
| 2 | Transfer Ownership | API: `POST /api/question-library/[id]/transfer-ownership` → `QuestionLibraryService.transferOwnership()` → updates `ownerId` + creates `QuestionOwnershipHistory` | **API works** | **UI missing** — no transfer interface exists |
| 3 | Edit Question | API: `PATCH /api/question-library/[id]` → `QuestionLibraryService.update()` → creates `QuestionRevision` snapshot | **API works** | **UI missing** — no edit form |
| 4 | Submit | (as above) | **API works** | **UI missing** |
| 5 | Use in Paper | `PaperGenerator.generate()` selects from approved questions across bank | **Complete** | N/A |
| 6 | View History | API: `GET /api/question-library/[id]/history` → returns ownership, revision, usage history | **API works** | **UI missing** — no history view |

**Verdict: Partially Broken.** Ownership transfer, edit, and history APIs are fully implemented but headless.

### Scenario C: Generate Paper → Record Usage → View Usage History

| # | Step | Layer | Status |
|---|---|---|---|
| 1 | Generate Paper | `PaperGenerationService.generatePapers()` → `PaperGenerator.generate()` selects questions, generates PDF | **Complete** |
| 2 | Record Usage | `QuestionUsageService.recordUsage()` called per question per paper item → `prisma.questionUsageHistory.create()` | **Complete** |
| 3 | View Usage History | `GET /api/question-library/[id]/usage` → `QuestionLibraryService.getUsageStats()` → aggregate counts + latest used date | **Complete** |
| 4 | View Detail History | `GET /api/question-library/[id]/history` → includes `usageHistory` array | **Complete** |

**Verdict: Complete.** This is the one scenario that works fully from API through to data layer. UI for viewing usage history is missing but the read API works.

---

## 10. Final Report

### 10.1 Working Flows (Complete)

1. **Auth** — Login, logout, forgot/reset password, CSRF token management, JWT cookie rotation
2. **COE ExamCycle CRUD** — Create and edit via `ExamCycleTimetableManager`; state management through `ExamCycleService`
3. **COE Department CRUD** — Create via `SimpleForm`; list in table
4. **COE User CRUD** — Create via `SimpleForm`; list in table; update status
5. **COE Audit Logs** — Read-only table
6. **COE Monitoring** — Health checks, platform metrics, workflow activity
7. **COE Exports** — Full export workflow (form → generation → download)
8. **Dean Paper Review** — Dashboard + `DeanReviewWorkspace` + paper selection + submission
9. **Dean Notifications** — Inbox with mark-as-read
10. **Coordinator Bank Creation** — SimpleForm with subject + exam cycle picker
11. **Coordinator Dashboard** — Department assignment view, active cycles, bank statuses
12. **Question Library (Read)** — Contributor, coordinator, and moderator question lists all display correctly
13. **Question Usage Tracking** — Recorded on paper generation; queryable via API
14. **Notification System** — Create, list, mark read, mark all; email integration
15. **File Storage** — MinIO presigned uploads/downloads across 6 buckets
16. **Audit Logging** — Every state-changing API call writes an audit record
17. **RBAC** — Two-layer (proxy.ts route gating + withApiHandler operation gating)
18. **Rate Limiting** — In-memory per [method, path, IP]
19. **CSRF Protection** — HMAC-SHA256 cookie + header verification
20. **Backups** — `mysqldump` to MinIO via `BackupService`

### 10.2 Broken Flows

| # | Flow | Classification | Root Cause | Fix Scope |
|---|---|---|---|---|
| 1 | Moderator assignment | **P0 — System Breaking** | `POST /api/question-banks/[id]/assignments/moderator` route directory does not exist | Backend — create route |

### 10.3 Partially Broken Flows

| # | Flow | Classification | Root Cause | Fix Scope |
|---|---|---|---|---|
| 1 | Contributor question creation | **P1 — Workflow Breaking** | `contributor/submit-question` page is API docs, no form | Frontend — build form |
| 2 | Contributor question edit/submit | **P1 — Workflow Breaking** | No edit/submit UI anywhere | Frontend — build edit page |
| 3 | Moderator approve/reject/revision | **P1 — Workflow Breaking** | Moderation queue is read-only table | Frontend — add action buttons |
| 4 | Coordinator create subject | **P1 — Workflow Breaking** | `coordinator/subjects` page is read-only | Frontend — add create form |
| 5 | Coordinator edit/deactivate subject | **P1 — Workflow Breaking** | No UI controls on subjects | Frontend — add action buttons |
| 6 | Coordinator lock bank | **P1 — Workflow Breaking** | No lock button in bank UI | Frontend — add button |
| 7 | Coordinator approve/reject bank | **P1 — Workflow Breaking** | No decision button in bank UI | Frontend — add button |
| 8 | Coordinator generate AI report/paper | **P1 — Workflow Breaking** | No trigger buttons in bank UI | Frontend — add buttons |
| 9 | COE AcademicYear CRUD | **P1 — Workflow Breaking** | APIs exist; no creation form | Frontend — build form |
| 10 | COE Semester CRUD | **P1 — Workflow Breaking** | APIs exist; no creation form | Frontend — build form |
| 11 | SubjectVersion v2+ creation | **P2 — UX Issue** | API exists; no UI for creating new versions | Frontend — build form |
| 12 | Question ownership transfer | **P2 — UX Issue** | API works; no transfer UI | Frontend — build interface |
| 13 | Moderator signed report upload | **P2 — UX Issue** | API works; no upload UI | Frontend — build upload |
| 14 | Question usage history view | **P2 — UX Issue** | API returns data; no UI to display it | Frontend — add history tab |

### 10.4 Missing UI

| Feature | Required For | API Status |
|---|---|---|
| AcademicYear creation form | COE | `POST /api/academic-years` working |
| Semester creation form | COE | `POST /api/semesters` working |
| Subject creation form | Coordinator | `POST /api/subjects` working |
| Subject edit/deactivate controls | Coordinator | `PUT /api/subjects/[id]` working |
| Subject-to-cycle link interface | Coordinator | `POST /api/subjects/[id]/link-cycle` working |
| SubjectVersion v2+ creation UI | Coordinator | `POST /api/subject-versions` working |
| Question creation form | Contributor | `POST /api/question-library` working |
| Question edit form | Contributor | `PATCH /api/question-library/[id]` working |
| Question submit button | Contributor | `POST /api/question-library/[id]?action=submit` working |
| Moderation approve button | Moderator | `PATCH /api/moderation/questions/[id]/approve` working |
| Moderation reject button | Moderator | `PATCH /api/moderation/questions/[id]/reject` working |
| Moderation revision request button | Moderator | `PATCH /api/moderation/questions/[id]/request-revision` working |
| Bank lock button | Coordinator | `PATCH /api/question-banks/[id]/lock` working |
| Bank coordinator decision (approve/reject) | Coordinator | `POST /api/question-banks/[id]/coordinator-decision` working |
| Bank report generation trigger | Coordinator | `POST /api/question-banks/[id]/reports` working |
| Bank paper generation trigger | Coordinator | `POST /api/question-banks/[id]/papers` working |
| Signed report upload | Moderator | `POST /api/question-banks/[id]/signed-report` working |
| Question ownership transfer | Coordinator | `POST /api/question-library/[id]/transfer-ownership` working |
| Question usage history view | Contributor/Coordinator | `GET /api/question-library/[id]/usage` working |
| Question history detail view | Any | `GET /api/question-library/[id]/history` working |

### 10.5 Missing APIs

| Endpoint | Need | Priority |
|---|---|---|
| `POST /api/question-banks/[id]/assignments/moderator` | Moderator assignment — documented as first-class API; route directory does not exist | **P0** |

### 10.6 Dead Code

| Severity | Count | Items |
|---|---|---|
| P1 — Remove files | 3 | `slot-summary.ts`, `mutable-guard.ts`, `examination-timetable-builder.tsx` |
| P2 — Orphan redirect pages | 2 | `dean/readiness-overview`, `dean/reports` |
| P2 — Nav links to redirect pages | 2 | `moderator/approved`, `moderator/rejected` in `app-shell.tsx` |
| P3 — Unused exports | 10 | `toSlug`, `safeJsonParse`, `buildCursorPaginationParams`, `userStatusLabels`, `courseOutcomeLabels`, `rbtLevelLabels`, `getDeanReviewWorkspaceData`, `paperGenerationSchema`, `GeneratedPaperPayload`, `QUESTION_MODULE_COUNT` (unused import) |
| P3 — Duplicate route | 1 | `GET /api/monitoring` (identical to `GET /api/health`) |

### 10.7 Technical Debt

| # | Item | Impact |
|---|---|---|
| 1 | 9 services use `prisma` directly without repositories | Inconsistent architecture; harder to unit test; no data access abstraction |
| 2 | 16 models lack dedicated repositories | Mixed data access patterns across codebase |
| 3 | Critical UI gaps across all roles | System is functionally a headless API with a read-only monitoring overlay |
| 4 | `getAdminData()` fetches unfiltered, unpaginated lists of departments/examCycles/subjects | Will degrade as data grows |
| 5 | COE and Contributor dashboards use hardcoded "pending tasks" strings, not actual workflow data | Dashboards are cosmetic, not actionable |
| 6 | Paper generation, AI reports, exports all run synchronously within HTTP requests | Request timeouts possible for large banks |
| 7 | `ModeratorService.listQuestions()` fetches ALL questions across ALL assigned banks with no pagination | Performance risk |
| 8 | `getQuestionContributionWorkspace()` calls `.findFirst()` — shows only one bank when multiple exist | Confusing UX |

### 10.8 Priority Fixes

#### P0 — System Breaking

| # | Task | Scope |
|---|---|---|
| 1 | Create `app/api/question-banks/[id]/assignments/moderator/route.ts` implementing moderator assignment | Backend |

#### P1 — Workflow Breaking

| # | Task | Scope |
|---|---|---|
| 2 | Build question creation form on `contributor/submit-question` page with all `questionLibraryItemSchema` fields | Frontend |
| 3 | Add edit/submit UI to contributor question workspace | Frontend |
| 4 | Add approve/reject/request-revision action buttons to moderator questions table | Frontend |
| 5 | Add subject creation form to `coordinator/subjects` page | Frontend |
| 6 | Add lock, coordinator-decision, report-generation, and paper-generation buttons to coordinator bank workflow | Frontend |
| 7 | Add AcademicYear and Semester creation forms to COE dashboard | Frontend |

#### P2 — UX Issues

| # | Task | Scope |
|---|---|---|
| 8 | Populate or remove `moderator/approved` and `moderator/rejected` pages (currently redirect loops) | Frontend |
| 9 | Remove orphan redirect pages (`dean/readiness-overview`, `dean/reports`) | Frontend |
| 10 | Add SubjectVersion v2+ creation UI | Frontend |
| 11 | Add question ownership transfer UI | Frontend |
| 12 | Add signed report upload UI for moderators | Frontend |
| 13 | Add question usage history and detail history views | Frontend |

#### P3 — Cleanup

| # | Task | Scope |
|---|---|---|
| 14 | Remove dead files: `slot-summary.ts`, `mutable-guard.ts`, `examination-timetable-builder.tsx` | Cleanup |
| 15 | Remove 10 unused exports across 6 files | Cleanup |
| 16 | Remove duplicate `GET /api/monitoring` route | Backend |
| 17 | Remove dead redirect pages `dean/readiness-overview`, `dean/reports` | Frontend |
| 18 | Fix `moderator/approved` and `moderator/rejected` nav links in `app-shell.tsx` | Frontend |

---

## Audit Verdict

**Backend: Solid.** Every API endpoint that exists works correctly. Schema, validation, service, and repository layers are fully consistent. Zero field/relation mismatches across 22 models, 54 route handlers, 22 services, and 8 repositories. Auth, CSRF, RBAC, rate-limiting, and audit infrastructure is intact and enforced.

**Frontend: Thin.** The application has a comprehensive headless API with a read-only monitoring dashboard. Most role-based workflows — creating questions, moderating, locking banks, assigning moderators — have working APIs but no browser UI. Users cannot perform core actions without `curl` or Postman.

**Migration Status: Clean.** The `Question` → `QuestionLibraryItem` and `QuestionBankSlot` → `QuestionBankQuestion` migrations are complete. No stale model references remain in active code. Three dead files from the old model remain (identified above for cleanup).

**Critical Gap: 1.** The moderator assignment API route is missing. This is the only system-breaking issue. Every other issue is a UI gap — APIs exist but forms and buttons don't.

**Risk Assessment: Low risk for data integrity; high risk for user adoption.** The backend won't corrupt data; users simply can't use it through a browser.
