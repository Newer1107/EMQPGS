# Database Schema

> 34 models, 26 enums. MySQL 8 via Prisma ORM.
> Source of truth: `prisma/schema.prisma`

---

## 1. Academic domain

### CurriculumScheme

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| departmentId | String | FK → Department |
| name | String | e.g. "2025 Scheme" |
| year | Int | |
| durationSemesters | Int | Default 8 |
| isActive | Boolean | Default true |

**Unique:** `@@unique([departmentId, year])` — one scheme per department per year.

### CurriculumSubject

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| curriculumSchemeId | String | FK → CurriculumScheme |
| subjectId | String | FK → Subject |
| semesterNumber | Int | 1-8. Authoritative semester placement. |
| departmentId | String | FK → Department |
| groupAssignment | GroupAssignment | ALL, GROUP_1, or GROUP_2 |

**Unique:** `@@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])`

**Purpose:** Authoritative mapping: "Subject X is in Semester N, offered by Department Y, for Group Z." This entity connects the academic domain to the existing operational pipeline via `subjectId`.

### Batch

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "2024-28" |
| code | String | Unique |
| departmentId | String | FK → Department |
| curriculumSchemeId | String | FK → CurriculumScheme |
| admissionYear | Int | |
| graduationYear | Int | |
| status | BatchStatus | ACTIVE or GRADUATED |

**Auto-creation:** When a Batch is created, `n` BatchSemester records are auto-generated (where `n = curriculumScheme.durationSemesters`).

### BatchSemester

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| batchId | String | FK → Batch |
| semesterNumber | Int | 1-8 |
| academicYearId | String | FK → AcademicYear |
| departmentId | String | FK → Department |
| startDate | DateTime? | Nullable — COE sets dates manually |
| endDate | DateTime? | Nullable |
| status | BatchSemesterStatus | UPCOMING, ACTIVE, or COMPLETED |

**Unique:** `@@unique([batchId, semesterNumber])`
**Status lifecycle:** UPCOMING → ACTIVE → COMPLETED (sequential).

### TeachingGroup

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| batchId | String | FK → Batch |
| groupNumber | Int | 1 or 2 |
| name | String | e.g. "Physics Group" |
| description | String? | Optional |
| isActive | Boolean | Default true |

**Unique:** `@@unique([batchId, groupNumber])`

**Purpose:** Records that a batch has up to two teaching groups. The actual subject-to-group mapping is on `CurriculumSubject.groupAssignment`.

### AcademicYear

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| code | String | Unique. e.g. "2026-2027" |
| startDate | DateTime | |
| endDate | DateTime | |
| status | AcademicYearStatus | ACTIVE or CLOSED |

**Relationships:** Has many SubjectVersions, BatchSemesters, QuestionBanks.

Invariant: Only one ACTIVE academic year at a time (application-enforced).

### Department

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Computer Science & Engineering" |
| code | String | Unique. e.g. "CSE" |
| hodName | String |
| isActive | Boolean | For soft-delete |

**Relationships:** Has many Users (via homeDepartmentId), Subjects, ExamCycles, CurriculumSchemes, Batches, CurriculumSubjects, BatchSemesters.
**Note:** Department is now the single organizational entity — handles both faculty administration and curriculum ownership.

### Subject

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectCode | String | e.g. "CS501" |
| subjectName | String | |
| credits | Int | |
| status | SubjectStatus | ACTIVE or INACTIVE |
| questionBankDueDate | DateTime | Legacy — will be replaced by CurriculumSubject placement |
| departmentId | String | FK → Department (legacy HR field) |
| ~~semesterNumber~~ | (removed) | Column dropped. `CurriculumSubject.semesterNumber` is the sole source of truth. |

**Unique:** `@@unique([subjectCode, departmentId])` — same code can exist in different departments.

### SubjectVersion

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectId | String | FK → Subject |
| versionNumber | Int | Auto-increments per subject |
| title | String | |
| syllabusDescription | String? | Optional |
| effectiveFromAcademicYearId | String | FK → AcademicYear |
| status | SubjectVersionStatus | ACTIVE or ARCHIVED |

**Unique:** `@@unique([subjectId, versionNumber])` — version numbers per subject.

**Ownership:** Contains QuestionLibraryItems. Only one version is ACTIVE per subject at a time.

### SubjectExamCycleLink

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectId | String | FK → Subject |
| examCycleId | String | FK → ExamCycle |

**Unique:** `@@unique([subjectId, examCycleId])` — a subject is linked to a cycle at most once.

---

## 2. User domain

### User

| Field | Type | Notes |
|---|---|---|---|
| id | String (cuid) | PK |
| name | String | |
| email | String | Unique |
| passwordHash | String | bcrypt hash |
| status | UserStatus | ACTIVE or DISABLED |
| lastLoginAt | DateTime? | |
| homeDepartmentId | String? | FK → Department. Informational only — never used for authorization. |
| resetTokenHash | String? | For password reset |
| resetTokenExpiry | DateTime? | |

**Note:** The `Role` enum and `role` field have been removed. Access is determined by `ResponsibilityAssignment` records.

### ResponsibilityAssignment

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| userId | String | FK → User |
| responsibility | ResponsibilityType | COE, DEAN, COORDINATOR, MODERATOR, CONTRIBUTOR |
| scopeType | ScopeType | INSTITUTION, DEPARTMENT, QUESTION_BANK |
| scopeId | String? | Department.id, QuestionBank.id, or null for institution |
| activeFrom | DateTime | Default now. When the assignment takes effect. |
| activeTo | DateTime? | Optional expiry. Null = indefinite. |
| assignedById | String? | FK → User. Who created this assignment. |
| assignedAt | DateTime | Default now |
| deletedAt | DateTime? | Soft-delete timestamp |
| deletedById | String? | FK → User. Who revoked this assignment. |
| deletionReason | String? | Why it was revoked. |

**Unique:** `@@unique([userId, responsibility, scopeType, scopeId])`
**Indexes:** `userId`, `(responsibility, scopeType, scopeId)`, `activeTo`, `deletedAt`

**Purpose:** Single generic table replacing `CoordinatorDepartmentAssignment`, `ModeratorBankAssignment`, and `ContributorBankAssignment`. Every responsibility is an instance of this model. The assignment IS what grants the responsibility — no pre-existing role required.

### Notification

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| recipientId | String | FK → User |
| title | String | |
| message | String | |
| type | NotificationType | INFO, SUCCESS, WARNING, ACTION_REQUIRED |
| isRead | Boolean | Default false |
| actionUrl | String? | Optional deep link |

### AuditLog

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| actorId | String? | FK → User |
| action | String | e.g. "QUESTION_BANK_LOCKED" |
| entityType | String | e.g. "questionBank" |
| entityId | String? | |
| metadata | Json? | Arbitrary key-value |
| ipAddress | String? | |
| userAgent | String? | |
| previousHash | String? | Previous record's integrityHash |
| integrityHash | String? | SHA-256 of current record + previousHash |

**Indexes:** `[entityType, entityId, createdAt]`, `[actorId]`

Invariant: Append-only. SHA-256 hash chain for tamper detection.

---

## 3. Question domain

### QuestionLibraryItem

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectVersionId | String | FK → SubjectVersion |
| moduleNumber | Int | 1-6 |
| marks | Int | 2, 5, or 10 |
| questionText | String | Content |
| coMapping | CourseOutcome | CO1-CO6 |
| rbtLevel | RbtLevel | L1-L6 |
| difficultyLevel | DifficultyLevel? | EASY, MEDIUM, HARD |
| teachingIndex | String? | Optional teaching reference |
| status | QuestionStatus | DRAFT, PENDING, APPROVED, REJECTED, REVISION_REQUESTED, REVISION_SUBMITTED |
| createdById | String | FK → User |
| ownerId | String | FK → User (current owner) |
| moderatorRemark | String? | Latest moderator feedback |
| submittedAt | DateTime? | |
| reviewedAt | DateTime? | |

**Indexes:** `[subjectVersionId, moduleNumber, marks]`, `[createdById, status]`, `[ownerId]`, `[status]`

**Invariants:**
- Belongs to exactly one SubjectVersion
- `moduleNumber` is 1-6, `marks` is 2|5|10, `coMapping` is CO1-CO6, `rbtLevel` is L1-L6
- Can be assigned to slots in multiple banks simultaneously
- Only one slot per bank (application-enforced)

### QuestionSlot

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| moduleNumber | Int | 1-6 |
| marks | Int | 2, 5, or 10 |
| slotNumber | Int | 1-7 |
| assignedQuestionId | String? | FK → QuestionLibraryItem (nullable = empty slot) |
| reservedById | String? | FK → User |
| reservedAt | DateTime? | |
| isLocked | Boolean | Default false (individual slot lock) |

**Unique:** `@@unique([questionBankId, moduleNumber, marks, slotNumber])`

**Notes:**
- `reservedById` is deprecated at runtime (schema column kept, no code reads or writes it)

**Invariants:**
- One question per slot (by position key)
- One slot per question per bank (application-enforced in service)
- Assigned question can be null (slot is empty)
- Slots created at bank initialization based on PaperPattern

### QuestionRevision

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionId | String | FK → QuestionLibraryItem |
| revisionNumber | Int | Auto-increments |
| snapshotQuestionText | String | Immutable copy |
| snapshotModule | Int | |
| snapshotMarks | Int | |
| snapshotCo | CourseOutcome | |
| snapshotRbt | RbtLevel | |
| snapshotDifficulty | DifficultyLevel? | |
| snapshotTeachingIndex | String? | |
| changedById | String | FK → User |
| changeReason | String? | |

**Unique:** `@@unique([questionId, revisionNumber])`

Invariant: Append-only. Captures full question state on every content/metadata change.

### QuestionOwnershipHistory

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionId | String | FK → QuestionLibraryItem |
| fromUserId | String | FK → User |
| toUserId | String | FK → User |
| transferredById | String | FK → User |
| reason | String? | |
| transferredAt | DateTime | |

Invariant: Append-only. Immutable record of all ownership transfers.

### QuestionUsageHistory

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionId | String | FK → QuestionLibraryItem |
| sourceType | String | "GENERATED_PAPER", "MANUAL", "EXPORT" |
| sourceId | String | ID of the source record |
| examCycleId | String? | FK → ExamCycle |
| usedAt | DateTime | |

**Indexes:** `[questionId, usedAt]`, `[sourceType, sourceId]`

Invariant: Append-only. Records every time a question is included in a paper or export.

### ModerationEvent

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionId | String | FK → QuestionLibraryItem |
| moderatorId | String | FK → User |
| action | String | "APPROVED", "REJECTED", "REVISION_REQUESTED" |
| note | String? | |
| createdAt | DateTime | |

---

## 4. Exam domain

### ExamCycle

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| examType | ExamType | ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT |
| status | ExamCycleStatus | DRAFT, ACTIVE, CLOSED |
| version | Int | For optimistic locking |
| startDate | DateTime? | |
| endDate | DateTime? | |
| batchSemesterId | String | FK → BatchSemester |
| timetable* | various | Timetable data (JSON) |

**Unique:** `@@unique([batchSemesterId, examType])`
* Each batch semester gets its own cycle per examType.

**Note:** ExamCycles no longer own QuestionBanks. They consume existing banks during paper generation. See QuestionBank below for the new ownership model.

### QuestionBank

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectId | String | FK → Subject |
| batchSemesterId | String | FK → BatchSemester |
| academicYearId | String | FK → AcademicYear (denormalized) |
| phase | QuestionBankPhase | DRAFTING, MODERATION, APPROVAL, COMPLETE |
| recordStatus | RecordStatus | ACTIVE, LOCKED |
| version | Int | Optimistic locking counter |
| createdById | String | FK → User (COE, auto-set during initialization) |
| lockedAt | DateTime? | |
| lockedReason | String? | |

**Unique:** `@@unique([batchSemesterId, subjectId])` — one bank per batch semester per subject.

**Ownership:** QuestionBank is an **annual academic asset** owned by (BatchSemester, Subject). It is NOT owned by ExamCycle. Instead, ExamCycles consume the bank via QuestionUsageHistory during paper generation.

**Lifecycle:**
- Auto-created when BatchSemester → ACTIVE (via AutoInitializeService)
- Contains 126 QuestionSlots (6 modules × 3 marks × 7 slots) — identical for all banks
- Reused across ISE-1, ISE-2, ENDSEM, and any future exam types
- Locked when BatchSemester → COMPLETED
- QuestionUsageHistory tracks which questions were used in which exam cycle — the bank itself is never consumed

**Relationships:** Has slots, pattern, snapshots, aiReports, generatedPapers, deanReview, exportArtifacts, approvalDecisions, moderatorAssignments, batchSemester, academicYear.

### PaperPattern

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | Unique FK → QuestionBank |
| examType | ExamType | Always ENDSEM (all banks use the 6-module pattern) |
| totalModules | Int | 6 (always — bank is annual, covers all modules) |
| marksPattern | Json | e.g. [2, 5, 10] |
| slotsPerModule | Int | 7 |
| totalSlots | Int | 126 |

**Unique:** `questionBankId` is unique — one pattern per bank.

### ApprovalDecision

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| decision | CoordinatorDecision | APPROVED or REJECTED |
| remark | String? | |
| decidedById | String | FK → User |
| decidedAt | DateTime | |

**Indexes:** `[questionBankId]`

Invariant: Write-once per bank (application-enforced — transaction creates both the decision and the phase update).

### QuestionBankSnapshot

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| snapshotType | SnapshotType | LOCKED |
| phase | QuestionBankPhase | Phase at snapshot time |
| status | RecordStatus | Status at snapshot time |
| slotAssignments | Json | Full slot array |
| version | Int | Bank version at snapshot time |
| createdAt | DateTime | |

### PaperSnapshot

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| variant | PaperVariant | PAPER_A, PAPER_B, PAPER_C |
| paperJson | Json | The generated paper |
| coverageScore | Float? | |
| difficultyScore | Float? | |
| qualityScore | Float? | |

**Unique:** `@@unique([questionBankId, variant])` — one snapshot per variant per bank.

### GeneratedPaper

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| variant | PaperVariant | PAPER_A, PAPER_B, PAPER_C |
| status | PaperGenerationStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| generatedById | String? | FK → User |
| generatedAt | DateTime? | |
| failureReason | String? | |
| paperJson | Json? | |
| paperFileAssetId | String? | FK → FileAsset |
| coverageScore | Float? | |
| difficultyScore | Float? | |
| qualityScore | Float? | |
| duplicateRisk | Float? | |
| recommendation | String? | |

**Unique:** `@@unique([questionBankId, variant])`

### GeneratedPaperItem

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| generatedPaperId | String | FK → GeneratedPaper |
| questionId | String | FK → QuestionLibraryItem |

**Unique:** `@@unique([generatedPaperId, questionId])`

---

## 5. Production domain

### DeanReview

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | Unique FK → QuestionBank |
| regularPaper | PaperVariant | |
| supplementaryPaper | PaperVariant | |
| ktPaper | PaperVariant | |
| reviewedById | String | FK → User |
| notes | String? | |
| reviewedAt | DateTime | |

Invariant: One dean review per bank. Write-once (no update path). State is determined by record existence (not a status field).

### ExportArtifact

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| generatedById | String? | FK → User |
| format | ExportFormat | PDF, DOCX, ZIP |
| status | ExportArtifactStatus | PENDING, COMPLETED, FAILED, EXPIRED |
| fileAssetId | String? | FK → FileAsset |
| metadata | Json? | |
| expiresAt | DateTime | |

### SystemBackup

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| status | BackupStatus | PENDING, COMPLETED, FAILED, EXPIRED |
| fileAssetId | String? | FK → FileAsset |
| triggeredById | String? | FK → User |
| metadata | Json? | |
| failureReason | String? | |
| expiresAt | DateTime | |

### AiReport

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | FK → QuestionBank |
| status | AiReportStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| modelName | String | |
| summary | String? | |
| reportJson | Json? | |
| chartData | Json? | |
| failureReason | String? | |
| generatedById | String? | |
| generatedAt | DateTime? | |
| jsonFileAssetId | String? | FK → FileAsset |
| pdfFileAssetId | String? | FK → FileAsset |

### FileAsset

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| bucket | String | MinIO bucket name |
| objectKey | String | Unique. MinIO path |
| fileName | String | Original filename |
| mimeType | String | |
| size | Int | Bytes |
| uploadedById | String? | |

---

## 6. Enum reference

| Enum | Values | Used by |
|---|---|---|
| ResponsibilityType | COE, DEAN, COORDINATOR, MODERATOR, CONTRIBUTOR | ResponsibilityAssignment |
| UserStatus | ACTIVE, DISABLED | User |
| SubjectStatus | ACTIVE, INACTIVE | Subject |
| ExamType | ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT | ExamCycle, PaperPattern |
| ExamCycleStatus | DRAFT, ACTIVE, CLOSED | ExamCycle |
| QuestionBankPhase | DRAFTING, MODERATION, APPROVAL, COMPLETE | QuestionBank, QuestionBankSnapshot |
| RecordStatus | ACTIVE, LOCKED | QuestionBank, QuestionBankSnapshot |
| SnapshotType | LOCKED | QuestionBankSnapshot |
| AiReportStatus | PENDING, PROCESSING, COMPLETED, FAILED | AiReport |
| PaperGenerationStatus | PENDING, PROCESSING, COMPLETED, FAILED | GeneratedPaper |
| PaperVariant | PAPER_A, PAPER_B, PAPER_C | GeneratedPaper, PaperSnapshot, DeanReview |
| CoordinatorDecision | APPROVED, REJECTED | ApprovalDecision |
| ExportFormat | PDF, DOCX, ZIP | ExportArtifact |
| ExportArtifactStatus | PENDING, COMPLETED, FAILED, EXPIRED | ExportArtifact |
| SemesterType | ODD, EVEN | AcademicYear (activeSemesterType) |
| BackupStatus | PENDING, COMPLETED, FAILED, EXPIRED | SystemBackup |
| NotificationType | INFO, SUCCESS, WARNING, ACTION_REQUIRED | Notification |
| CourseOutcome | CO1-CO6 | QuestionLibraryItem, QuestionRevision |
| RbtLevel | L1-L6 | QuestionLibraryItem, QuestionRevision |
| DifficultyLevel | EASY, MEDIUM, HARD | QuestionLibraryItem |
| QuestionStatus | DRAFT, PENDING, APPROVED, REJECTED, REVISION_REQUESTED, REVISION_SUBMITTED | QuestionLibraryItem |
| AcademicYearStatus | ACTIVE, CLOSED | AcademicYear |
| SubjectVersionStatus | ACTIVE, ARCHIVED | SubjectVersion |
| GroupAssignment | ALL, GROUP_1, GROUP_2 | CurriculumSubject |
| BatchStatus | ACTIVE, GRADUATED | Batch |
| BatchSemesterStatus | UPCOMING, ACTIVE, COMPLETED | BatchSemester |

---

## Cross-References

| Topic | Document |
|---|---|
| Architecture & domain model | `docs/architecture.md` |
| Workflow guide | `docs/workflow.md` |
| API reference | `docs/api.md` |
| Developer guide | `docs/developer-guide.md` |
| Deployment guide | `docs/deployment.md` |
| Glossary | `docs/glossary.md` |
