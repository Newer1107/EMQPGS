# Database Schema

> 36 models, 28 enums. MySQL 8 via Prisma ORM.
> Source of truth: `prisma/schema.prisma`

---

## 1. Academic domain

### AcademicUnit

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Full name |
| code | String | Unique short code |
| type | AcademicUnitType | ES_H or DEPARTMENT |
| hodName | String | Head of unit |
| isActive | Boolean | Default true |

**Purpose:** Represents a curriculum-offering body (ES&H, COMP, IT). Distinct from `Department` (faculty HR).

### Programme

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "BE Computer Engineering" |
| code | String | Unique |
| degreeType | DegreeType | BE, BTECH, MTECH, PHD, DIPLOMA |
| durationYears | Int | Default 4 |
| durationSemesters | Int | Default 8 |
| homeAcademicUnitId | String | FK → AcademicUnit |
| firstYearAcademicUnitId | String? | FK → AcademicUnit (optional) |
| isActive | Boolean | Default true |

### CurriculumScheme

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| programmeId | String | FK → Programme |
| name | String | e.g. "2025 Scheme" |
| year | Int | |
| isActive | Boolean | Default true |

**Unique:** `@@unique([programmeId, year])` — one scheme per programme per year.

### CurriculumSubject

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| curriculumSchemeId | String | FK → CurriculumScheme |
| subjectId | String | FK → Subject |
| semesterNumber | Int | 1-8. Authoritative semester placement. |
| academicUnitId | String | FK → AcademicUnit |
| groupAssignment | GroupAssignment | ALL, GROUP_1, or GROUP_2 |

**Unique:** `@@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])`

**Purpose:** Authoritative mapping: "Subject X is in Semester N, offered by Unit Y, for Group Z." This entity connects the academic domain to the existing operational pipeline via `subjectId`.

### Batch

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "2024-28" |
| code | String | Unique |
| programmeId | String | FK → Programme |
| curriculumSchemeId | String | FK → CurriculumScheme |
| admissionYear | Int | |
| graduationYear | Int | |
| status | BatchStatus | ACTIVE or GRADUATED |

**Auto-creation:** When a Batch is created, `n` BatchSemester records are auto-generated (where `n = programme.durationSemesters`).

### BatchSemester

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| batchId | String | FK → Batch |
| semesterNumber | Int | 1-8 |
| academicYearId | String | FK → AcademicYear |
| academicUnitId | String | FK → AcademicUnit |
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
| activeSemesterType | SemesterType | ODD or EVEN. Determines default operational semester filter. |

**Relationships:** Has many Semesters, ExamCycles, SubjectVersions, BatchSemesters.

Invariant: Only one ACTIVE academic year at a time (application-enforced).

**SemesterType** — operational filter, not a replacement for Semester.
- `ODD`: Semesters 1, 3, 5, 7
- `EVEN`: Semesters 2, 4, 6, 8

When an AcademicYear is created, all 8 semesters (1–8) are auto-generated. The `activeSemesterType` field controls which semesters are shown by default in dropdowns and filters. Users may override to view all semesters.

### Semester

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| number | Int | 1-8 |
| name | String | e.g. "Semester 5" |
| academicYearId | String | FK → AcademicYear |

**Unique:** `@@unique([academicYearId, number])` — one semester number per year.

### Department

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Computer Science & Engineering" |
| code | String | Unique. e.g. "CSE" |
| hodName | String | |
| isActive | Boolean | For soft-delete |

**Relationships:** Has many Users, CoordinatorDepartmentAssignments, Subjects, ExamCycles.

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
| semesterNumber | Int | 1-8. Legacy — authoritative placement is now `CurriculumSubject.semesterNumber`. |

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
|---|---|---|
| id | String (cuid) | PK |
| name | String | |
| email | String | Unique |
| passwordHash | String | bcrypt hash |
| role | Role | COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN |
| status | UserStatus | ACTIVE or DISABLED |
| lastLoginAt | DateTime? | |
| departmentId | String? | FK → Department |
| resetTokenHash | String? | For password reset |
| resetTokenExpiry | DateTime? | |

**Indexes:** `@unique([role])`, `@unique([departmentId])`

### CoordinatorDepartmentAssignment

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| coordinatorId | String | FK → User |
| departmentId | String | FK → Department |

**Unique:** `@@unique([coordinatorId, departmentId])` — one assignment per coordinator per department.

### ModeratorBankAssignment

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| moderatorId | String | FK → User |
| questionBankId | String | FK → QuestionBank |

**Unique:** `@@unique([moderatorId, questionBankId])` — one assignment per moderator per bank.

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
| endDate | DateTime? | Required before banks can be locked |
| departmentId | String | FK → Department (required) |
| academicYearId | String | FK → AcademicYear |
| semesterId | String | FK → Semester |
| timetable* | various | Timetable data (JSON) |

**Unique:** `@@unique([batchSemesterId, examType])`
* Each batch semester gets its own cycle per examType.

Invariant: Only ACTIVE cycles can have question bank initialization or locking.

### QuestionBank

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| subjectId | String | FK → Subject |
| examCycleId | String | FK → ExamCycle |
| phase | QuestionBankPhase | DRAFTING, MODERATION, APPROVAL, COMPLETE |
| recordStatus | RecordStatus | ACTIVE, LOCKED, ARCHIVED |
| version | Int | Optimistic locking counter |
| createdById | String | FK → User |
| lockedAt | DateTime? | |
| lockedReason | String? | |

**Unique:** `@@unique([subjectId, examCycleId])` — one bank per subject per cycle.

**Relationships:** Has slots, pattern, snapshots, aiReports, generatedPapers, deanReview, exportArtifacts, approvalDecisions, moderatorAssignments.

### PaperPattern

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| questionBankId | String | Unique FK → QuestionBank |
| examType | ExamType | |
| totalModules | Int | 3 for ISE, 6 for ENDSEM |
| marksPattern | Json | e.g. [2, 5, 10] |
| slotsPerModule | Int | 7 |
| totalSlots | Int | 63 or 126 |

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
| snapshotType | SnapshotType | LOCKED, APPROVED, EXPORTED |
| phase | QuestionBankPhase | Phase at snapshot time |
| status | RecordStatus | Status at snapshot time |
| slotAssignments | Json | Full slot array |
| paperAssignments | Json? | Paper variant data |
| metadata | Json? | |
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
| metadata | Json? | |

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
| status | ReviewStatus | PENDING, SUBMITTED, CONFIRMED |
| reviewedAt | DateTime | |

Invariant: One dean review per bank. Write-once (no update path).

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
| Role | COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN | User |
| UserStatus | ACTIVE, DISABLED | User |
| SubjectStatus | ACTIVE, INACTIVE | Subject |
| ExamType | ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT | ExamCycle, PaperPattern |
| ExamCycleStatus | DRAFT, ACTIVE, CLOSED | ExamCycle |
| QuestionBankPhase | DRAFTING, MODERATION, APPROVAL, COMPLETE | QuestionBank, QuestionBankSnapshot |
| RecordStatus | ACTIVE, LOCKED, ARCHIVED | QuestionBank, QuestionBankSnapshot |
| ReviewStatus | PENDING, SUBMITTED, CONFIRMED | DeanReview |
| SnapshotType | LOCKED, APPROVED, EXPORTED | QuestionBankSnapshot |
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
| AcademicUnitType | ES_H, DEPARTMENT | AcademicUnit |
| DegreeType | BE, BTECH, MTECH, PHD, DIPLOMA | Programme |
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
