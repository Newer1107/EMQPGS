# API Reference

> 70 route files, ~100 endpoints.
> All endpoints return `{ success: boolean, data?: T, error?: { code, message, details? }, correlationId: string }`.
> CSRF header `x-csrf-token` required on all non-GET requests.

---

## Auth

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login, returns JWT cookies |
| POST | `/api/auth/logout` | Public | Clears JWT cookies |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/forgot-password` | Public | Send reset email |
| POST | `/api/auth/reset-password` | Public | Reset password with token |
| GET | `/api/auth/csrf` | Public | Get CSRF token |
| GET,POST | `/api/auth/[...nextauth]` | Public | Auth.js handler (mostly unused) |

### POST /api/auth/login

```json
// Request
{ "email": "coordinator@emqpgs.local", "password": "Password@123" }
// Response
{ "success": true, "data": { "user": { "id", "name", "email", "role" } } }
```

Sets three cookies: `emqpgs_access_token`, `emqpgs_refresh_token`, `emqpgs_csrf_token`.

---

## Academic domain

### Curriculum schemes

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/curriculum-schemes` | COE, COORDINATOR | List (filter by `?departmentId=`) |
| POST | `/api/curriculum-schemes` | COE | Create |
| GET | `/api/curriculum-schemes/[id]` | COE, COORDINATOR | Get detail with subjects |
| PATCH | `/api/curriculum-schemes/[id]` | COE | Update |
| DELETE | `/api/curriculum-schemes/[id]` | COE | Delete (if no references) |

### Curriculum subjects

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/curriculum-subjects` | COE, COORDINATOR | List (filter by `?curriculumSchemeId=`, `?semesterNumber=`, etc.) |
| POST | `/api/curriculum-subjects` | COE | Create |
| GET | `/api/curriculum-subjects/[id]` | COE, COORDINATOR | Get detail |
| PATCH | `/api/curriculum-subjects/[id]` | COE | Update |
| DELETE | `/api/curriculum-subjects/[id]` | COE | Delete |

### Batches

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/batches` | COE, COORDINATOR | List (filter by `?departmentId=`) |
| POST | `/api/batches` | COE | Create (auto-creates BatchSemesters) |
| GET | `/api/batches/[id]` | COE, COORDINATOR | Get detail with semesters and groups |
| PATCH | `/api/batches/[id]` | COE | Update |
| DELETE | `/api/batches/[id]` | COE | Delete |

### Batch semesters

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/batch-semesters` | COE, COORDINATOR | List by `?batchId=` or active by `?departmentId=` |
| GET | `/api/batch-semesters/[id]` | COE, COORDINATOR | Get detail |
| PATCH | `/api/batch-semesters/[id]` | COE | Update dates/status/unit |
| POST | `/api/batch-semesters/[id]?action=activate` | COE | Activate semester |
| POST | `/api/batch-semesters/[id]?action=complete` | COE | Complete semester |

### Teaching groups

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/teaching-groups?batchId=` | COE, COORDINATOR | List groups for a batch |
| POST | `/api/teaching-groups` | COE | Create one or both groups |
| GET | `/api/teaching-groups/[id]` | COE, COORDINATOR | Get detail |
| DELETE | `/api/teaching-groups/[id]` | COE | Delete |

---

## Academic years

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/academic-years` | COE, COORDINATOR | List all |
| POST | `/api/academic-years` | COE | Create |
| GET | `/api/academic-years/[id]` | COE, COORDINATOR | Get by ID |
| PATCH | `/api/academic-years/[id]` | COE | Update |

---

## Semesters

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/semesters` | COE, COORDINATOR | List all |
| POST | `/api/semesters` | COE | Create |
| GET | `/api/semesters/[id]` | COE, COORDINATOR | Get by ID |
| PATCH | `/api/semesters/[id]` | COE | Update |

---

## Departments

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/departments` | COE, COORDINATOR | List all |
| POST | `/api/departments` | COE | Create |
| PATCH | `/api/departments/[id]` | COE | Update |
| DELETE | `/api/departments/[id]` | COE | Soft-delete |

---

## Users

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/users` | COE | List all users |
| POST | `/api/users` | COE | Create user |
| PATCH | `/api/users/[id]` | COE | Update/disable user |

---

## Exam cycles

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/exam-cycles` | COE, COORDINATOR | List all |
| POST | `/api/exam-cycles` | COE | Create (`departmentId` required) |
| PATCH | `/api/exam-cycles/[id]` | COE | Update (activate/close) |

---

## Coordinator department assignments

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/coordinator-departments` | COE | List assignments |
| POST | `/api/coordinator-departments` | COE | Create assignment |
| DELETE | `/api/coordinator-departments/[id]` | COE | Remove assignment |

---

## Subjects

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/subjects` | COORDINATOR, COE | List all |
| POST | `/api/subjects` | COORDINATOR | Create (auto-creates SubjectVersion v1) |
| PATCH | `/api/subjects/[id]` | COORDINATOR | Update |
| PATCH | `/api/subjects/[id]/deactivate` | COORDINATOR | Deactivate |
| POST | `/api/subjects/[id]/link-cycle` | COORDINATOR | Link to exam cycle |

---

## Subject versions

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/subject-versions` | COORDINATOR, COE | List |
| POST | `/api/subject-versions` | COORDINATOR | Create new version |
| PATCH | `/api/subject-versions/[id]/archive` | COORDINATOR | Archive version |

---

## Question banks

### Core CRUD

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/question-banks` | COORDINATOR | List banks (filtered by department) |
| POST | `/api/question-banks` | COORDINATOR | Create (alias for initialize) |
| GET | `/api/question-banks/[id]` | COORDINATOR, MODERATOR | Get bank detail with slots |

### Workflow

| Method | Path | Roles | Purpose |
|---|---|---|---|
| PATCH | `/api/question-banks/[id]/advance` | COORDINATOR | Advance phase (validated via transitions.ts) |
| PATCH | `/api/question-banks/[id]/lock` | COORDINATOR | Lock (creates QuestionBankSnapshot) |
| POST | `/api/question-banks/[id]/unlock` | COORDINATOR | Unlock (reversible) |
| GET | `/api/question-banks/[id]/readiness` | COORDINATOR, MODERATOR | ReadinessEngine check |
| GET | `/api/question-banks/[id]/metrics` | COORDINATOR, MODERATOR, COE, DEAN | QuestionBankMetrics |

### Moderator assignment

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/question-banks/[id]/assignments/moderator` | COORDINATOR | Assign moderator (validates role, prevents duplicates) |

### Reports & papers

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/question-banks/[id]/reports` | COORDINATOR | List AI reports |
| POST | `/api/question-banks/[id]/reports` | COORDINATOR | Trigger AI analysis |
| GET | `/api/question-banks/[id]/papers` | COORDINATOR | List generated papers |
| POST | `/api/question-banks/[id]/papers` | COORDINATOR | Generate 3 paper variants (A, B, C) |

### Coordinator decision

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/question-banks/[id]/coordinator-decision` | COORDINATOR | Approve (→COMPLETE) or reject (→MODERATION) |

### Dean review

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/question-banks/[id]/dean-review` | DEAN, COORDINATOR | Get review workspace |
| POST | `/api/question-banks/[id]/dean-review` | DEAN | Submit paper selection |

### Slot management

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/question-banks/[id]/slots` | COORDINATOR, MODERATOR, CONTRIBUTOR | List all slots |
| PATCH | `/api/question-banks/[id]/slots/[slotId]` | CONTRIBUTOR, COORDINATOR | Assign question to slot |
| DELETE | `/api/question-banks/[id]/slots/[slotId]` | COORDINATOR | Unassign question from slot |

---

## Question library

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/question-library` | COORDINATOR, CONTRIBUTOR, MODERATOR | Search/filter questions |
| POST | `/api/question-library` | CONTRIBUTOR, COORDINATOR | Create question |
| PATCH | `/api/question-library/[id]` | CONTRIBUTOR, COORDINATOR | Update question |
| POST | `/api/question-library/[id]` | CONTRIBUTOR, COORDINATOR | Submit for moderation |
| POST | `/api/question-library/[id]/transfer-ownership` | COORDINATOR | Transfer ownership |
| GET | `/api/question-library/[id]/history` | All roles | Revision/ownership/usage history |
| GET | `/api/question-library/[id]/usage` | COE, COORDINATOR, DEAN | Usage statistics |
| GET | `/api/question-library/coverage` | COORDINATOR, COE, DEAN | Coverage analytics |

### POST /api/question-library

```json
// Request (via questionBankId)
{ "subjectVersionId": "...", "moduleNumber": 1, "marks": 5, "questionText": "...", "coMapping": "CO1", "rbtLevel": "L3", "questionBankId": "..." }
// Response
{ "success": true, "data": { "id", "moduleNumber", "marks", "questionText", "status": "DRAFT", ... } }
```

If `questionBankId` is provided, the service auto-assigns the question to the first empty slot matching the question's `(moduleNumber, marks)`.

---

## Moderation

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/moderation/questions` | MODERATOR | List assigned questions |
| GET | `/api/moderation/questions/[id]` | MODERATOR | Get question detail |
| PATCH | `/api/moderation/questions/[id]/approve` | MODERATOR | Approve question |
| PATCH | `/api/moderation/questions/[id]/reject` | MODERATOR | Reject question |
| PATCH | `/api/moderation/questions/[id]/request-revision` | MODERATOR | Request revision |

Moderators can only moderate questions assigned to banks they are assigned to (via `ModeratorBankAssignment`).

---

## Exports

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/exports` | COE | List export artifacts |
| POST | `/api/exports` | COE | Create export (PDF/DOCX/ZIP) |
| GET | `/api/exports/[id]/download` | COE | Download signed URL |

---

## Production

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check (token-gated) |
| GET | `/api/monitoring` | COE | Monitoring dashboard |
| GET | `/api/audit-logs` | COE | Audit log listing |
| GET | `/api/dashboard` | COE, COORDINATOR, MODERATOR, CONTRIBUTOR | Role-based dashboard data |
| POST | `/api/backups` | COE | Trigger system backup |

## Storage

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/storage/presign` | COORDINATOR, CONTRIBUTOR, MODERATOR, COE | Get presigned upload URL |

---

## Common response shapes

### Success
```json
{ "success": true, "data": { ... }, "correlationId": "uuid" }
```

### Validation error
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [...] }, "correlationId": "uuid" }
```

### Not found
```json
{ "success": false, "error": { "code": "RECORD_NOT_FOUND", "message": "Question bank not found" }, "correlationId": "uuid" }
```

### Conflict
```json
{ "success": false, "error": { "code": "DUPLICATE_RECORD", "message": "Cannot transition from DRAFTING to COMPLETE", "details": { "fields": [...] } }, "correlationId": "uuid" }
```

### Forbidden
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Access denied" }, "correlationId": "uuid" }
```

---

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Zod schema validation failed |
| FK_VIOLATION | 400 | Referenced record does not exist |
| QUERY_ERROR | 400 | Data inconsistency detected |
| RECORD_NOT_FOUND | 404 | Entity not found in DB |
| DUPLICATE_RECORD | 409 | Unique constraint violation |
| CONFLICT | 409 | Business rule violation (e.g. invalid transition) |
| FORBIDDEN | 403 | Role lacks permission |
| UNAUTHORIZED | 401 | Not authenticated |
| DATABASE_ERROR | 500 | Prisma error (unexpected code) |
| INTERNAL_SERVER_ERROR | 500 | Unhandled exception |
