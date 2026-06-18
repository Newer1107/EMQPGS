# Database Reference

> **Part of the EMQPGS engineering handoff set**  
> Companion to: `PROJECT_HANDOFF.md` · `SYSTEM_ARCHITECTURE.md` · `UI_UX_REDESIGN.md` · `PRODUCTION_RUNBOOK.md`

---

## 1. Quick Reference

| Stat | Value |
|---|---|
| Provider | MySQL 8 |
| ORM | Prisma 6.16.2 |
| Models | 41 |
| Enums | 28 |
| Migrations | 11 applied + 1 pending (manual) |
| Schema file | `prisma/schema.prisma` (833 lines) |
| Seed file | `prisma/seed.ts` (741 lines) |

---

## 2. Entity-Relationship Diagram (Text)

```
AcademicYear ──1:N── BatchSemester
Batch ──1:N── BatchSemester
Batch ──1:N── TeachingGroup
Batch ──1:1?── BatchSemester (currentBatchSemesterId)

Programme ──1:N── CurriculumScheme
CurriculumScheme ──1:N── CurriculumSubject
Subject ──1:N── CurriculumSubject
Subject ──1:N── SubjectVersion
Subject ──1:N── QuestionBank
Subject ──1:N── SubjectExamCycleLink

SubjectVersion ──1:N── QuestionLibraryItem
AcademicUnit ──1:N── CurriculumSubject
AcademicUnit ──1:N── BatchSemester
AcademicUnit ──1:N── Programme (home)
AcademicUnit ──1:N── Programme (firstYear)

Department ──1:N── User
Department ──1:N── Subject
Department ──1:N── CoordinatorDepartmentAssignment

User ──1:N── QuestionBank (createdBy)
User ──1:N── QuestionLibraryItem (createdBy)
User ──1:N── QuestionLibraryItem (owner)
User ──1:N── Notification
User ──1:N── AuditLog
User ──1:N── ModerationEvent
User ──1:N── ModeratorBankAssignment
User ──1:N── DeanReview
User ──1:N── ApprovalDecision

BatchSemester ──1:N── ExamCycle

ExamCycle ──1:N── QuestionBank
ExamCycle ──1:N── SubjectExamCycleLink

QuestionBank ──1:N── QuestionSlot
QuestionBank ──1:N── AiReport
QuestionBank ──1:N── GeneratedPaper
QuestionBank ──0:1── DeanReview
QuestionBank ──0:1── ApprovalDecision
QuestionBank ──0:1── PaperPattern
QuestionBank ──1:N── QuestionBankSnapshot
QuestionBank ──1:N── PaperSnapshot
QuestionBank ──1:N── ModeratorBankAssignment
QuestionBank ──1:N── ExportArtifact

QuestionLibraryItem ──1:N── QuestionSlot
QuestionLibraryItem ──1:N── ModerationEvent
QuestionLibraryItem ──1:N── QuestionRevision
QuestionLibraryItem ──1:N── QuestionOwnershipHistory
QuestionLibraryItem ──1:N── QuestionUsageHistory

GeneratedPaper ──1:N── GeneratedPaperItem
```

---

## 3. Model Reference (Complete)

### 3.1 `AcademicYear`
- **Purpose:** Defines a single academic year span
- **Key fields:** `code` (unique, e.g. "2026-2027"), `startDate`, `endDate`, `status` (ACTIVE/CLOSED)
- **Owned by:** COE creates
- **Lifecycle:** Created at start of year. Closed when superseded. Exactly one ACTIVE at a time.
- **Relations:** `BatchSemester[]`, `SubjectVersion[]`

### 3.2 `SubjectVersion`
- **Purpose:** Versioned syllabus for a subject by academic year
- **Key fields:** `subjectId`, `versionNumber`, `title`, `syllabusDescription`, `effectiveFromAcademicYearId`, `status` (ACTIVE/ARCHIVED)
- **Unique:** `@@unique([subjectId, versionNumber])`
- **Lifecycle:** Created when syllabus changes. Only one ACTIVE per subject. Archiving previous version is handled by service.

### 3.3 `Department`
- **Purpose:** HR department (organizational unit)
- **Key fields:** `name`, `code` (unique, e.g. "COMP"), `hodName`, `isActive`
- **Relations:** `User[]`, `Subject[]`, `CoordinatorDepartmentAssignment[]`

### 3.4 `AcademicUnit`
- **Purpose:** Curriculum-ownership unit (ES&H, Computer Engineering, IT, etc.). Distinct from Department (HR).
- **Key fields:** `name`, `code` (unique), `type` (ES_H/DEPARTMENT), `hodName`, `isActive`
- **Relations:** `Programme[]` (home + firstYear), `CurriculumSubject[]`, `BatchSemester[]`

### 3.5 `Programme`
- **Purpose:** Degree programme (e.g., BE Computer Engineering)
- **Key fields:** `name`, `code` (unique), `degreeType` (BE/BTECH/MTECH/PHD/DIPLOMA), `durationYears`, `durationSemesters`, `homeAcademicUnitId`, `firstYearAcademicUnitId`
- **Relations:** `CurriculumScheme[]`, `Batch[]`

### 3.6 `CurriculumScheme`
- **Purpose:** Named curriculum plan for a Programme (e.g., "2025 Scheme")
- **Key fields:** `programmeId`, `name`, `year`, `isActive`
- **Unique:** `@@unique([programmeId, year])`
- **Lifecycle:** Exactly one ACTIVE per programme at a time. Activating a new scheme deactivates the old one.

### 3.7 `CurriculumSubject`
- **Purpose:** Maps Subject → (Scheme, Semester, AcademicUnit). The authoritative home for semester placement.
- **Key fields:** `curriculumSchemeId`, `subjectId`, `semesterNumber`, `academicUnitId`, `groupAssignment` (ALL/GROUP_1/GROUP_2)
- **Unique:** `@@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])`
- **Lifecycle:** Pure curriculum mapping. No operational state.

### 3.8 `Batch`
- **Purpose:** Cohort descriptor (no student records)
- **Key fields:** `name`, `code` (unique), `programmeId`, `curriculumSchemeId`, `admissionYear`, `graduationYear`, `status` (ACTIVE/GRADUATED), `currentSemesterNumber`, `currentBatchSemesterId`
- **Lifecycle:** Created on admission. ACTIVE until graduation.

### 3.9 `BatchSemester`
- **Purpose:** Per-batch instance of a semester
- **Key fields:** `batchId`, `semesterNumber` (1-8), `academicYearId`, `academicUnitId`, `startDate`, `endDate`, `status` (UPCOMING/ACTIVE/COMPLETED)
- **Unique:** `@@unique([batchId, semesterNumber])`
- **Lifecycle:** UPCOMING → (activated by COE) → ACTIVE → (completed by COE) → COMPLETED

### 3.10 `TeachingGroup`
- **Purpose:** Teaching group within a batch (first year split). Max 2 per batch.
- **Key fields:** `batchId`, `groupNumber` (1 or 2), `name`, `description`, `isActive`
- **Unique:** `@@unique([batchId, groupNumber])`

### 3.11 `User` (Authentication)
- **Purpose:** System user (faculty, admin, dean). Not students.
- **Key fields:** `name`, `email` (unique), `passwordHash`, `role` (COE/COORDINATOR/MODERATOR/CONTRIBUTOR/DEAN), `status` (ACTIVE/DISABLED), `departmentId`, `resetTokenHash`, `resetTokenExpiry`, `lastLoginAt`
- **Password:** bcrypt 12 rounds. Two auth systems: NextAuth.js session + custom JWT (15min access + 7d refresh).
- **Lifecycle:** Created by COE. DISABLED (soft-delete) by COE. Never hard-deleted.

### 3.12 `ExamCycle`
- **Purpose:** A specific examination instance for a batch-semester
- **Key fields:** `examType` (ISE_1/ISE_2/ENDSEM/SUPPLEMENTARY/KT), `batchSemesterId`, `status` (DRAFT/ACTIVE/CLOSED), `version`, timetable JSON fields
- **Unique:** `@@unique([batchSemesterId, examType])` — one cycle per exam type per batch-semester
- **Lifecycle:** DRAFT → ACTIVE → CLOSED
- **Note:** Timetable stored as JSON. Unique constraint may have drift (see §8).

### 3.13 `Subject`
- **Purpose:** A course offering
- **Key fields:** `subjectCode`, `subjectName`, `credits`, `semesterNumber` (⚠️ schema drift — in DB but NOT in schema), `status` (ACTIVE/INACTIVE), `questionBankDueDate`, `departmentId`
- **Unique:** `@@unique([subjectCode, departmentId])`
- **Relations:** `ExamCycle` via `SubjectExamCycleLink`, `QuestionBank[]`, `SubjectVersion[]`, `CurriculumSubject[]`
- **Lifecycle:** ACTIVE → INACTIVE (soft-delete by coordinator)

### 3.14 `SubjectExamCycleLink`
- **Purpose:** Many-to-many link between Subject and ExamCycle
- **Unique:** `@@unique([subjectId, examCycleId])`
- **Lifecycle:** Created when linking. No operational state.

### 3.15 `QuestionBank`
- **Purpose:** Container for all questions prepared for a (Subject × ExamCycle)
- **Key fields:** `subjectId`, `examCycleId`, `phase` (DRAFTING/MODERATION/APPROVAL/COMPLETE), `recordStatus` (ACTIVE/LOCKED/ARCHIVED), `createdById`, `version` (optimistic lock), `lockedAt`, `lockedReason`
- **Unique:** `@@unique([subjectId, examCycleId])`
- **Two orthogonal state axes:**
  - **Phase:** DRAFTING → MODERATION → APPROVAL → COMPLETE (workflow progress)
  - **Record status:** ACTIVE → LOCKED (irreversible, blocks mutations)

  ```
  DRAFTING  (ACTIVE)
      │
      ▼
  MODERATION (ACTIVE)
      │
      ▼
  APPROVAL (ACTIVE)
   │       │
   │  ┌────┘  (coordinator rejects → back to MODERATION)
   │  ▼
   └─→ COMPLETE (ACTIVE)
              │
              ▼
          LOCKED (irreversible)
  ```

### 3.16 `QuestionSlot`
- **Purpose:** Position within a bank — links a question to a (module, marks, slot) position
- **Key fields:** `questionBankId`, `moduleNumber` (1-6), `marks` (2/5/10), `slotNumber` (1-7), `assignedQuestionId`, `reservedById`, `reservedAt`, `isLocked`
- **Unique:** `@@unique([questionBankId, moduleNumber, marks, slotNumber])`
- **Lifecycle:** Created with bank init. Can be empty (no question assigned). Question can be reassigned if bank is not LOCKED.

### 3.17 `PaperPattern`
- **Purpose:** Template defining slot structure for a bank
- **Key fields:** `questionBankId` (unique), `examType`, `totalModules`, `marksPattern` (JSON, e.g. [2,5,10]), `slotsPerModule` (7), `totalSlots` (63 for ISE, 126 for ENDSEM)
- **Lifecycle:** Created with bank. Read-only thereafter.

### 3.18 `QuestionLibraryItem`
- **Purpose:** Standalone reusable question
- **Key fields:** `subjectVersionId`, `moduleNumber` (1-6), `marks` (2/5/10), `questionText`, `coMapping` (CO1-CO6), `rbtLevel` (L1-L6), `difficultyLevel` (EASY/MEDIUM/HARD), `teachingIndex`, `status` (DRAFT/PENDING/APPROVED/REJECTED/REVISION_REQUESTED/REVISION_SUBMITTED), `createdById`, `ownerId`, `moderatorRemark`, `submittedAt`, `reviewedAt`
- **Lifecycle:**
  ```
  DRAFT ──submit──► PENDING ──moderate──► APPROVED (terminal)
                               ──moderate──► REJECTED (terminal)
                               ──moderate──► REVISION_REQUESTED ──resubmit──► REVISION_SUBMITTED ──moderate──► APPROVED/REJECTED/REVISION_REQUESTED
  ```
- **Note:** Can be assigned to slots in multiple banks simultaneously, but only one slot per bank.

### 3.19 `QuestionRevision`
- **Purpose:** Immutable revision history for a question
- **Key fields:** `questionId`, `revisionNumber`, snapshots of all question fields, `changedById`, `changeReason`
- **Unique:** `@@unique([questionId, revisionNumber])`
- **Lifecycle:** Created on every content-changing update. Never deleted.

### 3.20 `QuestionOwnershipHistory`
- **Purpose:** Audit trail for ownership transfers
- **Key fields:** `questionId`, `fromUserId`, `toUserId`, `transferredById`, `reason`
- **Lifecycle:** Created on transfer. Immutable.

### 3.21 `QuestionUsageHistory`
- **Purpose:** Track which questions appeared in which papers
- **Key fields:** `questionId`, `sourceType` (GENERATED_PAPER/MANUAL/EXPORT), `sourceId`, `examCycleId`
- **Lifecycle:** Created on paper generation or usage recording.

### 3.22 `ModerationEvent`
- **Purpose:** Record of moderation actions on a question
- **Key fields:** `questionId`, `moderatorId`, `action`, `note`
- **Lifecycle:** Created on every moderate action. Immutable.

### 3.23 `ModeratorBankAssignment`
- **Purpose:** Assigns a moderator to a question bank
- **Unique:** `@@unique([moderatorId, questionBankId])`
- **Lifecycle:** Created by coordinator. No removal endpoint exists.

### 3.24 `ApprovalDecision`
- **Purpose:** Coordinator's final decision on a question bank
- **Key fields:** `questionBankId` (unique), `decision` (APPROVED/REJECTED), `remark`, `decidedById`
- **Unique:** `@@unique([questionBankId])` — exactly one per bank
- **Lifecycle:** Write-once. Immutable after creation.

### 3.25 `AiReport`
- **Purpose:** AI analysis results for a question bank
- **Key fields:** `questionBankId`, `status` (PENDING/PROCESSING/COMPLETED/FAILED), `modelName`, `summary`, `reportJson`, `chartData`, `failureReason`, `jsonFileAssetId`, `pdfFileAssetId`
- **Lifecycle:** Multiple reports can exist per bank (only COMPLETED+latest used by engine).

### 3.26 `GeneratedPaper`
- **Purpose:** A generated paper variant for a question bank
- **Key fields:** `questionBankId`, `variant` (PAPER_A/B/C), `status` (PENDING/PROCESSING/COMPLETED/FAILED), `coverageScore`, `difficultyScore`, `qualityScore`, `duplicateRisk`, `recommendation`, `paperFileAssetId`
- **Unique:** `@@unique([questionBankId, variant])`
- **Lifecycle:** Generated by coordinator. Can be regenerated (upsert).

### 3.27 `GeneratedPaperItem`
- **Purpose:** Links a generated paper to its selected questions
- **Unique:** `@@unique([generatedPaperId, questionId])`
- **Lifecycle:** Created with generated paper.

### 3.28 `DeanReview`
- **Purpose:** Dean's selection of which variant for which exam type
- **Key fields:** `questionBankId` (unique), `regularPaper`, `supplementaryPaper`, `ktPaper` (all PaperVariant), `reviewedById`, `status` (PENDING/SUBMITTED/CONFIRMED)
- **Unique:** `@@unique([questionBankId])` — exactly one per bank
- **Lifecycle:** Write-once. Immutable after creation.

### 3.29 `QuestionBankSnapshot`
- **Purpose:** Point-in-time snapshot of all slot assignments when a bank is locked
- **Key fields:** `questionBankId`, `snapshotType` (LOCKED/APPROVED/EXPORTED), `phase`, `status`, `slotAssignments` (JSON), `paperAssignments` (JSON), `version`
- **Lifecycle:** Created on lock/approve/export events.

### 3.30 `PaperSnapshot`
- **Purpose:** Point-in-time snapshot of generated papers
- **Key fields:** `questionBankId`, `variant`, `paperJson`, `coverageScore`, `difficultyScore`, `qualityScore`
- **Unique:** `@@unique([questionBankId, variant])`
- **Lifecycle:** Created on paper generation.

### 3.31 `ExportArtifact`
- **Purpose:** An export packet (PDF/DOCX/ZIP) of finalized papers
- **Key fields:** `questionBankId`, `format` (PDF/DOCX/ZIP), `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId`, `metadata`, `expiresAt`
- **Lifecycle:** Created by COE. Expires after configurable retention period.

### 3.32 `FileAsset`
- **Purpose:** Metadata for files stored in MinIO
- **Key fields:** `bucket`, `objectKey` (unique), `fileName`, `mimeType`, `size`
- **Buckets:** `question-bank-attachments`, `generated-papers`, `exports`, `audit-files`, `system-backups`

### 3.33 `Notification`
- **Purpose:** In-app notification
- **Key fields:** `recipientId`, `title`, `message`, `type` (INFO/SUCCESS/WARNING/ACTION_REQUIRED), `isRead`, `actionUrl`
- **Lifecycle:** Created by various services. Marked read by user.

### 3.34 `AuditLog`
- **Purpose:** Tamper-evident audit trail with SHA-256 chain linking
- **Key fields:** `actorId`, `action`, `entityType`, `entityId`, `metadata`, `ipAddress`, `previousHash`, `integrityHash`
- **Special:** Uses `Prisma.TransactionIsolationLevel.Serializable` for the chain link. Retries on P2034/P4001 up to 3 times.

### 3.35 `SystemBackup`
- **Purpose:** Database backup record
- **Key fields:** `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId`, `triggeredById`, `metadata`, `failureReason`, `expiresAt`
- **Lifecycle:** Created on backup trigger. Expired by retention policy.

### 3.36 `CoordinatorDepartmentAssignment`
- **Purpose:** Links a coordinator user to a department
- **Unique:** `@@unique([coordinatorId, departmentId])`
- **Lifecycle:** Managed by COE.

### 3.37 `RevokedToken`
- **Purpose:** JWT token blacklist
- **Key fields:** `jti` (unique), `type` (access/refresh), `expiresAt`
- **Lifecycle:** Created on logout. Automatically expired entries can be pruned.

---

## 4. Enums Reference

| Enum | Values | Used By |
|---|---|---|
| `Role` | COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN | User |
| `UserStatus` | ACTIVE, DISABLED | User |
| `SubjectStatus` | ACTIVE, INACTIVE | Subject |
| `ExamType` | ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT | ExamCycle, PaperPattern |
| `ExamCycleStatus` | DRAFT, ACTIVE, CLOSED | ExamCycle |
| `QuestionBankPhase` | DRAFTING, MODERATION, APPROVAL, COMPLETE | QuestionBank |
| `RecordStatus` | ACTIVE, LOCKED, ARCHIVED | QuestionBank |
| `ReviewStatus` | PENDING, SUBMITTED, CONFIRMED | DeanReview |
| `SnapshotType` | LOCKED, APPROVED, EXPORTED | QuestionBankSnapshot |
| `AiReportStatus` | PENDING, PROCESSING, COMPLETED, FAILED | AiReport |
| `PaperGenerationStatus` | PENDING, PROCESSING, COMPLETED, FAILED | GeneratedPaper |
| `PaperVariant` | PAPER_A, PAPER_B, PAPER_C | GeneratedPaper, DeanReview, PaperSnapshot |
| `CoordinatorDecision` | APPROVED, REJECTED | ApprovalDecision |
| `ExportFormat` | PDF, DOCX, ZIP | ExportArtifact |
| `ExportArtifactStatus` | PENDING, COMPLETED, FAILED, EXPIRED | ExportArtifact |
| `BackupStatus` | PENDING, COMPLETED, FAILED, EXPIRED | SystemBackup |
| `NotificationType` | INFO, SUCCESS, WARNING, ACTION_REQUIRED | Notification |
| `CourseOutcome` | CO1-CO6 | QuestionLibraryItem |
| `RbtLevel` | L1-L6 | QuestionLibraryItem |
| `DifficultyLevel` | EASY, MEDIUM, HARD | QuestionLibraryItem |
| `QuestionStatus` | DRAFT, PENDING, APPROVED, REJECTED, REVISION_REQUESTED, REVISION_SUBMITTED | QuestionLibraryItem |
| `AcademicYearStatus` | ACTIVE, CLOSED | AcademicYear |
| `SubjectVersionStatus` | ACTIVE, ARCHIVED | SubjectVersion |
| `AcademicUnitType` | ES_H, DEPARTMENT | AcademicUnit |
| `GroupAssignment` | ALL, GROUP_1, GROUP_2 | CurriculumSubject |
| `BatchStatus` | ACTIVE, GRADUATED | Batch |
| `BatchSemesterStatus` | UPCOMING, ACTIVE, COMPLETED | BatchSemester |
| `DegreeType` | BE, BTECH, MTECH, PHD, DIPLOMA | Programme |

---

## 5. Migration History

| # | Migration ID | Date | Description | State |
|---|---|---|---|---|
| 1 | `20260615184411_init` | 15-Jun | Initial schema — all original tables | ✅ Applied |
| 2 | `20260615200000_drop_timetable_branch` | 15-Jun | Remove timetable branch feature | ✅ Applied |
| 3 | `20260615201000_department_scoped_exam_cycles` | 15-Jun | Add department scope to exam cycles | ✅ Applied |
| 4 | `20260616000001_add_audit_log_actor_action_idx` | 16-Jun | Index for audit log queries | ✅ Applied |
| 5 | `20260616073849_add_active_semester_type` | 16-Jun | Active semester type tracking | ✅ Applied |
| 6 | `20260616120000_subject_semester_number` | 16-Jun | **Adds `semesterNumber` to Subject** | ✅ Applied ⚠️ Drift |
| 7 | `20260617190824_add_academic_domain` | 17-Jun | Adds AcademicUnit, Programme, CurriculumScheme, CurriculumSubject, Batch, BatchSemester | ✅ Applied |
| 8 | `20260617192737_refine_academic_domain` | 17-Jun | Academic unit relation fixes | ✅ Applied |
| 9 | `20260617193717_add_batch_current_semester_and_groups` | 17-Jun | Current semester tracking on Batch | ✅ Applied |
| 10 | `20260617201131_add_batch_fields_to_exam_cycle` | 17-Jun | Batch-aware exam cycles (batchId, groupNumber, semesterNumber, academicUnitId on ExamCycle) | ✅ Applied |
| 11 | `20260617202534_simplify_exam_cycle_domain` | 17-Jun | Removes duplicated batch fields from ExamCycle (academicUnitId, batchId, groupNumber, semesterNumber) — now uses BatchSemester relation | ✅ Applied |

---

## 6. Schema Drift Analysis

**Verified on 18 June 2026.** Comparison of `prisma/schema.prisma` vs migration chain vs database.

### Drift #1 (CONFIRMED): `Subject.semesterNumber`

- **DB has:** `semesterNumber INT NOT NULL` (from migration #6)
- **Schema has:** No `semesterNumber` on Subject model
- **Result:** Prisma client won't include it → `prisma.subject.create()` sends NULL → MySQL rejects with P2011
- **Why:** Schema was refactored to move semester info to `CurriculumSubject`, but no reverse migration was generated
- **Fix:** `ALTER TABLE Subject DROP COLUMN semesterNumber;` + fix code dependencies

### Drift #2 (WARNING from Prisma CLI, UNVERIFIED): `AcademicYear.activeSemesterType`

- Prisma CLI warning: "You are about to drop the column `activeSemesterType` on the `AcademicYear` table, which still contains 3 non-null values."
- This suggests the DB has a column that the schema doesn't, OR the schema has a column the DB doesn't
- **Status:** Not verified — needs `prisma migrate diff` to confirm

### Drift #3 (WARNING from Prisma CLI, UNVERIFIED): `ApprovalDecision` unique constraint

- Prisma CLI warning: "A unique constraint covering the columns `[questionBankId]` on the table `ApprovalDecision` will be added."
- The schema already has `@@unique([questionBankId])` on ApprovalDecision — suggests the migration to add this unique constraint hasn't been applied yet, OR there's a discrepancy
- **Status:** Needs verification against actual DB constraints

### Drift #4 (WARNING from Prisma CLI, UNVERIFIED): `ExamCycle` unique constraint

- Prisma CLI warning: "A unique constraint covering the columns `[batchSemesterId,examType]` on the table `ExamCycle` will be added."
- The schema already has `@@unique([batchSemesterId, examType])` on ExamCycle — same issue as #3

**Bottom line:** Run `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma` to get the authoritative drift report. The known critical drift is #1.

---

## 7. Index Coverage

| Model | Indexes |
|---|---|
| User | `role`, `departmentId` |
| Subject | `departmentId`, `@@unique([subjectCode, departmentId])` |
| QuestionBank | `subjectId`, `[phase, recordStatus]` |
| QuestionLibraryItem | `[subjectVersionId, moduleNumber, marks]`, `[createdById, status]`, `ownerId`, `status` |
| QuestionSlot | `@@unique([questionBankId, moduleNumber, marks, slotNumber])`, `[questionBankId, assignedQuestionId]`, `assignedQuestionId` |
| AuditLog | `[entityType, entityId, createdAt]`, `actorId`, `[actorId, action, createdAt]` |
| Notification | `[recipientId, isRead, createdAt]` |
| ModerationEvent | `[questionId, createdAt]`, `[moderatorId, createdAt]` |
| ModerationEvent | `[questionId, createdAt]`, `[moderatorId, createdAt]` (duplicate — line 559 in schema) |
| CurriculumSubject | `@@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])`, `[curriculumSchemeId, semesterNumber, academicUnitId]`, `subjectId` |
| Batch | `currentBatchSemesterId` |
| BatchSemester | `@@unique([batchId, semesterNumber])`, `academicYearId`, `academicUnitId` |

**(continued from schema — see `prisma/schema.prisma` for full index list.)**

---

*End of DATABASE_REFERENCE.md*
