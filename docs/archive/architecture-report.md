# EMQPGS Architecture Report

> **Generated from codebase analysis.** All claims are backed by source code.
> **Date:** June 2026
> **Scope:** Full-stack Next.js 16 + Prisma + MySQL + MinIO application.

---

## 1. Domain Model Inventory

### 1.1 Department (`prisma/schema.prisma:145-157`)

| Aspect | Detail |
|---|---|
| **Purpose** | Academic department container |
| **Key fields** | `id` (String, cuid), `name` (String), `code` (String, unique), `hodName` (String), `isActive` (Boolean, default true) |
| **Relationships** | `users[]`, `coordinatorAssignments[]`, `subjects[]`, `examCycles[]` |
| **Unique constraints** | `code` |
| **Indexes** | None |
| **Current responsibilities** | Department CRUD, user scoping, subject scoping, exam cycle scoping, coordinator assignment scoping |

### 1.2 User (`prisma/schema.prisma:159-191`)

| Aspect | Detail |
|---|---|
| **Purpose** | System user with role-based access |
| **Key fields** | `id`, `name`, `email` (unique), `passwordHash`, `role` (enum), `status` (ACTIVE/DISABLED), `lastLoginAt`, `departmentId` (nullable), `resetTokenHash`, `resetTokenExpiry` |
| **Relationships** | `department`, `coordinatorDepartments[]`, `assignments[]` (as teacher), `assignedBy[]`, `moderatorBankAssignments[]`, `notifications[]`, `auditLogs[]`, `questionBanks[]` (as creator), `questionSlots[]` (as reserving user), `contributedQuestions[]`, `moderationEvents[]`, `submittedRevisions[]`, `uploadedAttachments[]`, `deanReviews[]`, `exportArtifacts[]`, `backupsTriggered[]` |
| **Unique constraints** | `email` |
| **Indexes** | `[role]`, `[departmentId]` |
| **Current responsibilities** | Authentication (login/password-reset), authorization (role gating), ownership of all work products |

### 1.3 ExamCycle (`prisma/schema.prisma:193-218`)

| Aspect | Detail |
|---|---|
| **Purpose** | Represents a single examination event (ISE 1, ISE 2, ENDSEM, etc.) |
| **Key fields** | `id`, `academicYear` (String, `YYYY-YYYY`), `semester` (Int, 1-8), `examType` (enum), `status` (DRAFT/ACTIVE/CLOSED), `version` (Int, optimistic lock), `startDate`?, `endDate`?, `departmentId`?, `timetableDocumentRef`?, `timetableIssueDate`?, `timetableTitle`?, `timetableRows` (Json)?, `timetableSignature`? |
| **Relationships** | `department`?, `subjectLinks[]`, `questionBanks[]` |
| **Unique constraints** | `@@unique([academicYear, semester, examType])` |
| **Indexes** | `[status, departmentId]`, `[departmentId]` |
| **Current responsibilities** | Top-level container for exam workflow; carries timetable metadata; determines which subjects participate via links |

### 1.4 Subject (`prisma/schema.prisma:220-239`)

| Aspect | Detail |
|---|---|
| **Purpose** | A course/subject offered in a department |
| **Key fields** | `id`, `subjectCode` (String), `subjectName` (String), `academicYear` (String), `semester` (Int), `credits` (Int), `status` (ACTIVE/INACTIVE), `questionBankDueDate` (DateTime), `departmentId` |
| **Relationships** | `department`, `examCycleLinks[]`, `questionBanks[]` |
| **Unique constraints** | `@@unique([subjectCode, departmentId])` |
| **Indexes** | `[departmentId]`, `[semester]` |
| **Current responsibilities** | Core entity that question banks are anchored to; carries a due date; can be linked to multiple exam cycles |

### 1.5 QuestionBank (`prisma/schema.prisma:241-272`)

| Aspect | Detail |
|---|---|
| **Purpose** | Container for all work products for one subject+cycle pair |
| **Key fields** | `id`, `subjectId`, `examCycleId`, `status` (10-state enum), `version` (optimistic lock), `createdById`, `lockedAt`?, `signedReportAssetId`?, `signedReportUploadedAt`?, `coordinatorDecision`?, `coordinatorReviewedAt`?, `coordinatorReviewRemark`? |
| **Relationships** | `subject`, `examCycle`, `createdBy`, `assignments[]`, `moderatorAssignments[]`, `questionSlots[]`, `questions[]`, `aiReports[]`, `generatedPapers[]`, `deanReview`?, `signedReportAsset`?, `exportArtifacts[]` |
| **Unique constraints** | `@@unique([subjectId, examCycleId])` |
| **Indexes** | `[status]`, `[subjectId]` |
| **Current responsibilities** | Workflow state machine (10 states), assignment container, question container, report container, paper container, export container, dean review container, signed report container |

### 1.6 QuestionSlot (`prisma/schema.prisma:367-384`)

| Aspect | Detail |
|---|---|
| **Purpose** | Fixed position in the 126-slot grid within a question bank |
| **Key fields** | `id`, `questionBankId`, `moduleNumber` (1-6), `marks` (2/5/10), `slotNumber` (1-7), `version` (optimistic lock), `reservedById`?, `reservedAt`?, `isLocked` (Boolean) |
| **Relationships** | `questionBank`, `reservedBy`?, `question`? |
| **Unique constraints** | `@@unique([questionBankId, moduleNumber, marks, slotNumber])` |
| **Current responsibilities** | Reservation lock, question anchor, grid position for paper generation |

### 1.7 Question (`prisma/schema.prisma:386-422`)

| Aspect | Detail |
|---|---|
| **Purpose** | A single question authored by a contributor |
| **Key fields** | `id`, `questionBankId`, `slotId`? (unique), `version` (optimistic lock), `questionText` (String), `moduleNumber` (1-6), `marks` (2/5/10), `slotNumber` (1-7), `coMapping` (CO1-CO6), `rbtLevel` (L1-L6), `teachingIndex`?, `difficultyLevel`? (EASY/MEDIUM/HARD), `contributorId`, `status` (6-state), `moderatorRemark`?, `submittedAt`?, `reviewedAt`?, `usageCount` (Int, default 0), `lastUsedExam`?, `lastUsedYear`?, `lastUsedSemester`?, `lastUsedType`? |
| **Relationships** | `questionBank`, `slot`?, `contributor`, `moderationEvents[]`, `revisions[]`, `attachments[]`, `generatedPaperItems[]` |
| **Unique constraints** | `slotId` (unique — one-to-one with QuestionSlot) |
| **Indexes** | `[questionBankId, moduleNumber, marks, slotNumber]`, `[contributorId, status]`, `[status]` |
| **Current responsibilities** | Stores question text and metadata; tracks usage history for paper generation avoidance; tracks moderation status; carries version history via revisions |

### 1.8 TeacherAssignment (`prisma/schema.prisma:274-289`)

| Aspect | Detail |
|---|---|
| **Purpose** | Links a user (contributor or moderator) to a question bank with a specific role and optional module |
| **Key fields** | `id`, `questionBankId`, `teacherId`, `assignmentRole` (CONTRIBUTOR/MODERATOR), `moduleNumber`? (Int, null for moderator), `assignedById` |
| **Relationships** | `questionBank`, `teacher`, `assignedBy` |
| **Unique constraints** | `@@unique([questionBankId, teacherId, assignmentRole, moduleNumber])` |
| **Indexes** | `[teacherId]` |
| **Current responsibilities** | Assignment of contributors to modules; assignment of moderators to banks (moduleNumber=null for moderator) |

### 1.9 ModeratorBankAssignment (`prisma/schema.prisma:467-476`)

| Aspect | Detail |
|---|---|
| **Purpose** | Dedicated join table for moderator-to-bank assignments (newer pattern) |
| **Key fields** | `id`, `moderatorId`, `questionBankId` |
| **Relationships** | `moderator`, `questionBank` |
| **Unique constraints** | `@@unique([moderatorId, questionBankId])` |
| **Current responsibilities** | Moderator scoping; used by `ModeratorService.getAssignedBankIds()` and `AssignmentService.assignModerator()` |

### 1.10 CoordinatorDepartmentAssignment (`prisma/schema.prisma:291-300`)

| Aspect | Detail |
|---|---|
| **Purpose** | Links a coordinator to departments they manage |
| **Key fields** | `id`, `coordinatorId`, `departmentId` |
| **Relationships** | `coordinator`, `department` |
| **Unique constraints** | `@@unique([coordinatorId, departmentId])` |
| **Current responsibilities** | Department-scoping for all coordinator operations |

### 1.11 SubjectExamCycleLink (`prisma/schema.prisma:302-311`)

| Aspect | Detail |
|---|---|
| **Purpose** | Join table linking subjects to exam cycles (M:N) |
| **Key fields** | `id`, `subjectId`, `examCycleId`, `linkedAt` |
| **Relationships** | `subject`, `examCycle` |
| **Unique constraints** | `@@unique([subjectId, examCycleId])` |
| **Current responsibilities** | Subject-cycle association; prerequisite for question bank initialization |

### 1.12 AiReport (`prisma/schema.prisma:478-498`)

| Aspect | Detail |
|---|---|
| **Purpose** | Stores AI/deterministic analysis results for a question bank |
| **Key fields** | `id`, `questionBankId`, `status` (PENDING/PROCESSING/COMPLETED/FAILED), `modelName`, `summary`?, `reportJson` (Json)?, `chartData` (Json)?, `failureReason`?, `generatedById`?, `generatedAt`?, `jsonFileAssetId`?, `pdfFileAssetId`? |
| **Relationships** | `questionBank`, `jsonFileAsset`?, `pdfFileAsset`? |
| **Indexes** | `[questionBankId, status]` |
| **Current responsibilities** | Report storage, asset linking, status tracking |

### 1.13 GeneratedPaper (`prisma/schema.prisma:500-522`)

| Aspect | Detail |
|---|---|
| **Purpose** | A generated paper variant (A, B, or C) for a question bank |
| **Key fields** | `id`, `questionBankId`, `variant` (PAPER_A/B/C), `status` (PENDING/PROCESSING/COMPLETED/FAILED), `generatedById`?, `generatedAt`?, `failureReason`?, `paperJson` (Json)?, `paperFileAssetId`?, `coverageScore`?, `difficultyScore`?, `qualityScore`?, `duplicateRisk`?, `recommendation`? |
| **Relationships** | `questionBank`, `paperFileAsset`?, `items[]` |
| **Unique constraints** | `@@unique([questionBankId, variant])` |
| **Current responsibilities** | Paper variant storage, scoring, asset linking |

### 1.14 GeneratedPaperItem (`prisma/schema.prisma:524-533`)

| Aspect | Detail |
|---|---|
| **Purpose** | Individual question within a generated paper |
| **Key fields** | `id`, `generatedPaperId`, `questionId` |
| **Relationships** | `generatedPaper`, `question` |
| **Unique constraints** | `@@unique([generatedPaperId, questionId])` |
| **Current responsibilities** | Question-to-paper mapping |

### 1.15 DeanReview (`prisma/schema.prisma:535-548`)

| Aspect | Detail |
|---|---|
| **Purpose** | Dean's selection of paper variants for exam slots |
| **Key fields** | `id`, `questionBankId` (unique), `regularPaper` (PaperVariant), `supplementaryPaper` (PaperVariant), `ktPaper` (PaperVariant), `reviewedById`, `notes`?, `reviewedAt` |
| **Relationships** | `questionBank`, `reviewedBy` |
| **Unique constraints** | `questionBankId` (one review per bank) |
| **Current responsibilities** | Dean's finalized selections; prerequisite for exports |

### 1.16 ExportArtifact (`prisma/schema.prisma:550-566`)

| Aspect | Detail |
|---|---|
| **Purpose** | Exported exam packet (PDF, DOCX, or ZIP) |
| **Key fields** | `id`, `questionBankId`, `generatedById`?, `format` (PDF/DOCX/ZIP), `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId`?, `metadata` (Json)?, `expiresAt` (DateTime) |
| **Relationships** | `questionBank`, `generatedBy`?, `fileAsset`? |
| **Indexes** | `[questionBankId, format, status]` |
| **Current responsibilities** | Export artifact storage with expiry |

### 1.17 Remaining Support Entities

| Model | Lines | Purpose |
|---|---|---|
| `Notification` | 313-326 | In-app notifications with read tracking |
| `AuditLog` | 328-344 | Append-only audit trail with integrity hash chain |
| `FileAsset` | 346-365 | Universal file reference for MinIO objects |
| `QuestionAttachment` | 424-436 | Links file assets to questions |
| `ModerationEvent` | 438-450 | Individual moderation action records |
| `QuestionRevision` | 452-465 | Version history for question edits |
| `SystemBackup` | 568-582 | MySQL dump backup records |

---

## 2. Academic Structure Analysis

### 2.1 Diagram

```
Department
├── name, code, hodName, isActive
├── Users (role-based)
├── CoordinatorDepartmentAssignment (M:N with User)
├── Subjects
│   ├── subjectCode, subjectName, academicYear, semester, credits
│   ├── status (ACTIVE/INACTIVE)
│   ├── questionBankDueDate
│   ├── Dept ─────────────────────────────────────┐
│   └── SubjectExamCycleLink ─── ExamCycle ────────┤
│       └── ExamCycle (M:N)                       │
│            ├── academicYear, semester, examType  │
│            ├── status (DRAFT/ACTIVE/CLOSED)      │
│            └── QuestionBank ─────────────────────┘
│                 ├── status (10-state)
│                 ├── createdById ── User
│                 └── ...
└── ExamCycles
```

### 2.2 How Department is Modeled

`Department` is a standalone entity (`prisma/schema.prisma:145-157`). It has:
- `id`, `name`, `code` (unique), `hodName`, `isActive`
- One-to-many to: `User`, `Subject`, `ExamCycle`
- Many-to-many to `User` (coordinator role) via `CoordinatorDepartmentAssignment`

### 2.3 How Semester is Modeled

Semester is **not a separate entity**. It is:
- A scalar `Int` field on `Subject` (1-8)
- A scalar `Int` field on `ExamCycle` (1-8)
- A scalar `Int` field on `Question` (via `lastUsedSemester`)

There is **no Semester model, no Semester table, and no semester-level metadata** (start dates, end dates, enrollment data, etc.).

### 2.4 How Subject is Modeled

`Subject` (`prisma/schema.prisma:220-239`) has these academic fields:
- `subjectCode` — e.g., "CS501"
- `subjectName` — e.g., "Advanced Algorithms"
- `academicYear` — String in `YYYY-YYYY` format
- `semester` — Int 1-8
- `credits` — Int
- `questionBankDueDate` — DateTime (deadline for question bank completion)

### 2.5 Subjects Tied to Semesters

Yes, `Subject` has a `semester` field (Int, 1-8). However:
- A subject's semester is a **fixed attribute**, not a relationship to a semester entity
- The same subject code can appear in different semesters if created as separate records
- The `@@unique([subjectCode, departmentId])` constraint means each subject code is unique **per department**, but the same subject code CAN exist with different semesters in different records

### 2.6 Subjects Reused Across Years

Currently, subjects are **recreated per academic year**. The `Subject` model has its own `academicYear` field:
```prisma
model Subject {
  academicYear String
  ...
}
```
And the unique constraint is `@@unique([subjectCode, departmentId])` — NOT including `academicYear`. This means:
- The seed creates one subject "CS501" with `academicYear: "2026-2027"`
- To use CS501 in a future year, a **new Subject record** must be created
- There is no "Subject template" that persists across years

### 2.7 Syllabus Versions

**Syllabus versions do not exist.** There is:
- No `Syllabus` or `Curriculum` entity
- No syllabus version tracking
- No mapping of CO (Course Outcome) definitions to subjects
- The `CourseOutcome` enum (`CO1`-`CO6`) is a flat enum with no subject-specific definitions
- The `RbtLevel` enum (`L1`-`L6`) is a flat Bloom's taxonomy with no subject-specific mapping

---

## 3. Exam Cycle Analysis

### 3.1 The ExamCycle Model

Refer to §1.3 above. Key structural points:
- `academicYear` + `semester` + `examType` form a unique constraint (one cycle per combo)
- `departmentId` is nullable — a cycle can be department-scoped or institution-wide
- `status` transitions: `DRAFT → ACTIVE → CLOSED` (no formal transition table, only guard on `→ACTIVE`)
- Timetable fields are stored directly on the cycle (document ref, issue date, title, rows as JSON, signature)

### 3.2 Lifecycle

```
COE creates (DRAFT)
  → COE activates (ACTIVE)
    → Coordinator links subjects (creates SubjectExamCycleLink)
    → Coordinator initializes question banks
    → Full question bank lifecycle runs (see §5)
    → Coordinator locks all banks
    → Dean reviews
    → COE exports
    → COE closes cycle (CLOSED)
```

### 3.3 Status Transitions

ExamCycleStatus has **no formal transition table** (unlike QuestionBankStatus). Only guard:
- **→ACTIVE**: `activateInTransaction()` checks no other ACTIVE cycle exists for the same department
- **→CLOSED** and all other transitions: no guard

### 3.4 Dependencies

**ExamCycle depends on:**
- `Department` (optional foreign key)
- `Subject` (M:N via `SubjectExamCycleLink`)
- `QuestionBank` (1:M)

**Entities that depend on ExamCycle:**
- `SubjectExamCycleLink` — cascading delete? (Prisma defaults to restrict)
- `QuestionBank` — cascading delete? (Prisma defaults to restrict)

### 3.5 Ownership Boundaries

**What belongs to ExamCycle:**
- The timetable metadata
- The activation guard (only one ACTIVE per department)
- The unique identity (academicYear + semester + examType)
- The department scope

**What should survive after an ExamCycle is closed:**
- `Subject` entities (they exist independently)
- `Question` text and history (reusable across cycles)
- `User` assignments (the users and their roles)
- `Department` structure
- `GeneratedPaper` records (historical)
- `ExportArtifact` records (historical)
- `AiReport` records (historical)
- `DeanReview` records (historical)

**What is tightly coupled to ExamCycle:**
- `QuestionBank` — has `examCycleId` required; `@@unique([subjectId, examCycleId])` means banks are cycle-specific
- `SubjectExamCycleLink` — directly references cycle ID
- `GeneratedPaper` — indirectly via QuestionBank
- `AiReport` — indirectly via QuestionBank
- `ExportArtifact` — indirectly via QuestionBank
- `DeanReview` — indirectly via QuestionBank
- `TeacherAssignment` — indirectly via QuestionBank
- `ModeratorBankAssignment` — indirectly via QuestionBank
- All question data — indirectly via QuestionBank

---

## 4. Question Architecture Analysis

### 4.1 Question Lifecycle

```
CREATE: Contributor reserves a QuestionSlot
          → QuestionService.reserveSlot()
          → marks slot reservedById, isLocked=true

DRAFT:  Contributor writes question text
          → QuestionService.createQuestion()
          → status: DRAFT

EDIT:   Contributor modifies question
          → QuestionService.updateQuestion()
          → status stays DRAFT (or REVISION_REQUESTED if coming from review)

SUBMIT: Contributor submits for moderation
          → QuestionService.submitQuestion()
          → creates QuestionRevision snapshot
          → status: PENDING (or REVISION_SUBMITTED)

MODERATE: Moderator approves/rejects/requests revision
          → ModeratorService.approveQuestion/rejectQuestion/requestRevision
          → creates ModerationEvent
          → status: APPROVED | REJECTED | REVISION_REQUESTED

REVISE: Contributor addresses revision request
          → QuestionService.updateQuestion() + submitQuestion()
          → status: REVISION_SUBMITTED

OVERRIDE: Moderator can override an APPROVED question back to PENDING
          → ModeratorService.overrideQuestion()
```

### 4.2 Where Question Text is Stored

- **Primary**: `Question.questionText` — the current version
- **History**: `QuestionRevision.questionText` — snapshot at each submit
- `QuestionRevision` has `@@unique([questionId, versionNumber])` — versioned history

### 4.3 What Owns a Question

A `Question` is owned by its `QuestionBank` (`questionBankId` required). It cannot exist outside a question bank. The ownership chain is:

```
Question → QuestionBank → (Subject, ExamCycle)
```

The `@@unique([subjectId, examCycleId])` on QuestionBank means every question is indirectly tied to exactly one subject + exam cycle pair.

### 4.4 Can Questions Exist Outside QuestionBank?

**No.** `Question.questionBankId` is required (not optional). There is no standalone question entity, no shared question pool, and no cross-bank question sharing.

### 4.5 How Reuse is Currently Handled

The `Question` model has usage tracking fields:
```prisma
usageCount      Int     @default(0)
lastUsedExam    String?   // ExamType as string
lastUsedYear    String?
lastUsedSemester Int?
lastUsedType    ExamType?
```

These are updated in `ReportService.generatePapers()`:
```typescript
// Updates usage counters after paper generation
prisma.question.update({
  where: { id: questionId },
  data: {
    usageCount: { increment: 1 },
    lastUsedExam: toLastUsedExam(examType),
    lastUsedYear: examCycle.academicYear,
    lastUsedSemester: examCycle.semester,
    lastUsedType: examType,
  },
})
```

The `PaperGenerator.generate()` uses these to avoid reuse:
```typescript
// Build set of recently used questions
const recentlyUsed = new Set(
  questions
    .filter(q => q.lastUsedYear === examCycle.academicYear && q.lastUsedSemester === examCycle.semester && q.lastUsedType === examCycle.examType)
    .map(q => q.id)
);
```

**Limitations of current reuse:**
- No cross-cycle question pool
- Reuse avoidance is only within the same (year, semester, examType) — a question used in ISE_1 could be reused in ENDSEM of the same year
- No explicit "exclude this question permanently" flag
- Usage tracking is on the Question itself, not a separate usage log

### 4.6 How History is Currently Tracked

| History type | Storage | Location |
|---|---|---|
| Question text revisions | `QuestionRevision` model | Separate table, versioned |
| Moderation actions | `ModerationEvent` model | Separate table, each action recorded |
| Paper inclusion | `GeneratedPaperItem` | Links question to paper |
| Usage count | `Question.usageCount` (field) | Directly on question |
| Last used context | `Question.lastUsedExam/Year/Semester/Type` | Directly on question |

**Missing history:**
- No immutable question history (current question text can be edited)
- No paper-level historical archive (papers are regeneratable but old versions are overwritten by upsert)
- No approval chain trace (only most recent moderation event)

---

### 4.7 Question Data Flow Diagram

```
Contributor                     QuestionSlot              Question               ModerationEvent
    │                               │                        │                        │
    ├─ reserveSlot() ──────────────►│                        │                        │
    │◄──── slot reserved ───────────┤                        │                        │
    │                               │                        │                        │
    ├─ createQuestion() ────────────────────────────────────►│                        │
    │                               │       (links to slot)  │                        │
    ├─ updateQuestion() ────────────┼───────────────────────►│                        │
    │                               │                        │                        │
    ├─ submitQuestion() ────────────┼───────────────────────►│                        │
    │                               │          (creates ─────┤──── QuestionRevision ──┤
    │                               │           snapshot)    │                        │
    │                               │                        │                        │
    │                    Moderator  │                        │                        │
    │                               │                        │                        │
    ├───────────────────────────────┼────────────────────────┤◄── approveQuestion()──┤
    │◄── notification ──────────────┼────────────────────────┤    creates event ──────┤
    │                               │                        │                        │
    │                    PaperGenerator                     │                        │
    │                               │                        │                        │
    │                               │                        ├── used in ────────────►│
    │                               │                        │  GeneratedPaperItem    │
    │                               │                        │                        │
    │                    ReportService.generatePapers()      │                        │
    │                               │        updates ───────►│ usageCount             │
    │                               │                        │ lastUsedYear/etc       │
```

---

## 5. Question Bank Analysis

### 5.1 Responsibility Map

```
QUESTION BANK (QuestionBank entity)
│
├── Workflow State Machine
│   ├── 10-state lifecycle
│   ├── Transition validation (isValidTransition)
│   ├── Status advancement (updateStatus)
│   ├── Lock/unlock (lockQuestionBank)
│   └── Immutability enforcement (ensureQuestionBankMutable)
│
├── Content Container
│   ├── Question slots (126 grid, ensureSlotGrid)
│   ├── Questions (CRUD, moderation, submission)
│   ├── Attachments (via FileAsset)
│   └── Slot reservations
│
├── Assignment Container
│   ├── Contributor assignments (per module)
│   ├── Moderator assignments (per bank)
│   └── Assignment notifications
│
├── Reporting
│   ├── AI reports (deterministic + Ollama)
│   ├── Analysis engine (coverage, CO, RBT, difficulty, duplicates)
│   ├── PDF report generation
│   └── Report asset storage (JSON + PDF in MinIO)
│
├── Paper Generation
│   ├── 3 variants (A, B, C)
│   ├── Question selection algorithm
│   ├── PDF generation
│   ├── Scoring (coverage, difficulty, quality, duplicate risk)
│   └── Usage tracking updates
│
├── Dean Review
│   ├── Workspace data provider
│   ├── Selection validation
│   └── Review persistence
│
├── Signed Report
│   ├── HOD signed report upload
│   ├── Moderator upload path
│   └── Coordinator approval/rejection
│
├── Export
│   ├── Export artifact generation (PDF/DOCX/ZIP)
│   ├── Download link generation
│   └── Expiry management
│
└── Monitoring
    ├── Dashboard readiness indicators
    ├── Slot fill status
    └── Approval thresholds (60-question minimum)
```

### 5.2 Workflow Ownership

| Workflow step | Owner (who triggers it) | Via which service |
|---|---|---|
| Create bank | COORDINATOR | `CoordinatorService.initializeQuestionBank` |
| Assign contributors | COORDINATOR | `CoordinatorService.assignContributor` |
| Assign moderator | COORDINATOR | `AssignmentService.assignModerator` |
| Reserve slot | CONTRIBUTOR | `QuestionService.reserveSlot` |
| Create question | CONTRIBUTOR | `QuestionService.createQuestion` |
| Submit question | CONTRIBUTOR | `QuestionService.submitQuestion` |
| Moderate question | MODERATOR | `ModeratorService.*` |
| Override slot | MODERATOR | `QuestionService.reserveSlot(override=true)` |
| Advance bank status | COORDINATOR | `QuestionBankService.updateStatus` |
| Trigger AI report | COORDINATOR | `CoordinatorService.triggerAiAnalysis` → `ReportService.createAiReport` |
| Generate papers | COORDINATOR | `CoordinatorService.triggerPaperGeneration` → `ReportService.generatePapers` |
| Upload signed report | MODERATOR | `ReportService.uploadSignedReport` |
| Approve/reject bank | COORDINATOR | `ReportService.coordinatorDecision` |
| Lock bank | COORDINATOR | `CoordinatorService.lockQuestionBank` |
| Dean review | DEAN | `ProductionService.submitDeanReview` |
| Export | COE | `ProductionService.createExport` |

### 5.3 Ownership Bottlenecks

- **CoordinatorService** (981 lines) owns: dashboard, subjects, question banks, assignments, AI analysis, paper generation, dean review status queries. It is a god-class.
- **QuestionService** (454 lines) owns: slot grid, reservations, question CRUD, submission, attachments, permissions.
- **ReportService** (484 lines) owns: AI reports, paper generation, signed reports, coordinator decisions, scoring.
- **ProductionService** (801 lines) owns: dean dashboard, dean review workspace, dean review submission, COE overview, exports, observability, backups, cleanup.
- **ModeratorService** (492 lines) owns: moderation workspace, question listing/detail, approve/reject/revision, override, notifications.

### 5.4 Reporting Ownership

All reporting is owned by `ReportService` which:
- Calls `AnalysisEngine.buildDeterministicReport()` for metrics
- Calls `OllamaService.analyzeQuestionBank()` for AI overlay
- Calls `PdfService.createAiReportPdf()` for PDF output
- Calls `PaperGenerator.generate()` for paper variants
- Calls `PdfService.createPaperPdf()` for paper PDFs
- Calls `StorageService.uploadServerFile()` for MinIO storage

### 5.5 Paper Generation Ownership

`ReportService.generatePapers()` does:
1. Gets bank and questions
2. Calls `PaperGenerator.generate()` to select questions
3. For each variant: generates PDF via `PdfService`, uploads to MinIO
4. Upserts `GeneratedPaper` records
5. Updates `Question.usageCount` and `lastUsed*` fields
6. Sends notifications

---

## 6. Assignment System Analysis

### 6.1 Assignment Models

There are **two assignment models** that overlap in responsibility:

**TeacherAssignment** (`prisma/schema.prisma:274-289`):
- Used for BOTH contributor and moderator assignments
- `assignmentRole`: CONTRIBUTOR or MODERATOR
- `moduleNumber`: set for contributors (1-6), null for moderators
- Unique constraint: `[questionBankId, teacherId, assignmentRole, moduleNumber]`

**ModeratorBankAssignment** (`prisma/schema.prisma:467-476`):
- Dedicated moderator-to-bank join table (newer pattern)
- Unique constraint: `[moderatorId, questionBankId]`
- Used by `ModeratorService.getAssignedBankIds()` for scoping
- Created by `AssignmentService.assignModerator()` (canonical path)

### 6.2 Duplication: Two Moderator Assignment Paths

The moderator can be assigned via **two different tables**:
1. `TeacherAssignment` with `assignmentRole: MODERATOR` and `moduleNumber: null` (legacy)
2. `ModeratorBankAssignment` (canonical, newer)

The seed creates BOTH:
```typescript
// From prisma/seed.ts
await prisma.teacherAssignment.create({
  data: { teacherId: moderator.id, assignmentRole: AssignmentRole.MODERATOR, moduleNumber: null, ... }
});
await prisma.moderatorBankAssignment.upsert({
  where: { moderatorId_questionBankId: { moderatorId: moderator.id, questionBankId: bank.id } },
  update: {},
  create: { moderatorId: moderator.id, questionBankId: bank.id },
});
```

The `ModeratorService` checks `ModeratorBankAssignment` for access control but NOT `TeacherAssignment`. The `CoordinatorService.listAssignments()` queries `TeacherAssignment` for contributor assignments but NOT for moderator assignments (it only queries CONTRIBUTOR role).

### 6.3 Assignment Workflows

**Contributor assignment:**
1. `CoordinatorService.assignContributor()` → creates `TeacherAssignment` with role=CONTRIBUTOR
2. `CoordinatorService.reassignContributor()` → updates `teacherId` on existing assignment (only if no submitted questions)
3. `CoordinatorService.removeAssignment()` → deletes `TeacherAssignment`

**Moderator assignment (canonical):**
1. `AssignmentService.assignModerator()` → creates `ModeratorBankAssignment`

### 6.4 Are Assignments Reusable?

**No.** Each assignment is tied to a specific `questionBankId`. There is no:
- Template system for common assignment patterns
- Bulk assignment across multiple banks
- Semester/year-based assignment inheritance

### 6.5 Are Templates Possible?

**Not with current architecture.** Each `TeacherAssignment` record is:
- Tied to a specific `QuestionBank` (which is tied to a specific `Subject` + `ExamCycle`)
- Tied to a specific `moduleNumber` (contributor) or null (moderator)
- Tied to a specific `User`

To implement templates, you would need:
- A new `AssignmentTemplate` entity
- A mechanism to instantiate templates when a `QuestionBank` is created
- Changes to `ensureSlotGrid` (which currently auto-creates only slots, not assignments)

### 6.6 Services Affected by Assignment Changes

- `CoordinatorService` — `assignContributor`, `reassignContributor`, `removeAssignment`, `notifyAssignment`, `listAssignments`
- `AssignmentService` — `assign`, `assignModerator`, `list`
- `AssignmentRepository` — `replaceAssignments` (deletes all CONTRIBUTOR then creates new)
- `ModeratorService` — `getAssignedBankIds`, `assertBankAccess` (checks assignments)
- `QuestionService` — `reserveSlot` (checks contributor assignment), `listQuestions` (scopes by moderator assignment)

---

## 7. Reporting & Paper Generation Analysis

### 7.1 Report Generation Flow

```
CoordinatorService.triggerAiAnalysis(questionBankId)
  │
  ├─ Checks: approvedCount >= 60
  │   If < 60: throws AppError("At least 60 approved questions are required...")
  │
  └─ ReportService.createAiReport(questionBankId, actor)
       │
       ├─ Gets question bank with questions + subject + examCycle
       │
       ├─ AnalysisEngine.buildDeterministicReport(questionBank)
       │   ├─ moduleCoverage: 6 modules × target 21 each
       │   ├─ coDistribution, rbtDistribution, difficultyDistribution
       │   ├─ detectDuplicates: O(n²) Jaccard ≥ 0.84
       │   ├─ findMissingAreas: uncovered buckets
       │   ├─ assessQuality: text length ≥ 40, teachingIndex presence
       │   ├─ assessBloomsBalance: L1-3 vs L4-6 counts
       │   └─ returns AiQuestionBankReport
       │
       ├─ buildOllamaPrompt(report) → deterministic JSON as context
       │
       ├─ OllamaService.analyzeQuestionBank(prompt)
       │   ├─ POST /api/generate to Ollama
       │   ├─ Returns Partial<AiQuestionBankReport> | null
       │   └─ If Ollama unavailable → null
       │
       ├─ Merges deterministic + AI results
       │
       ├─ StorageService.uploadServerFile() → JSON to MinIO (exports)
       │
       ├─ PdfService.createAiReportPdf() → PDF buffer
       │
       ├─ StorageService.uploadServerFile() → PDF to MinIO (exports)
       │
       ├─ Creates AiReport record (COMPLETED)
       │
       ├─ QuestionBankService.updateStatus() → REPORT_GENERATED
       │
       ├─ NotificationService.createAndEmail() → coordinators
       │
       └─ Audit log: AI_REPORT_GENERATED
```

### 7.2 Paper Generation Flow

```
CoordinatorService.triggerPaperGeneration(questionBankId)
  │
  └─ ReportService.generatePapers(questionBankId, actor, [PAPER_A, PAPER_B, PAPER_C])
       │
       ├─ Validates: bank.status === LOCKED or REPORT_GENERATED
       │   Otherwise: throws AppError("Papers can only be generated...")
       │
       ├─ Gets bank with: subject, examCycle, questions (approved),
       │   aiReports (completed), generatedPapers with items/questions
       │
       ├─ PaperGenerator.generate(questionBank, variants)
       │   ├─ Builds recentlyUsed set: same year/semester/examType
       │   ├─ Builds historicalExclusion: questions already in any generated paper
       │   ├─ For each variant:
       │   │   └─ For each of 18 slots (6 modules × 3 marks):
       │   │       ├─ Find candidates: approved, unused, NOT in exclusion sets
       │   │       ├─ rankQuestion(candidate): usagePenalty + recencyPenalty + difficultyWeight
       │   │       ├─ Pick best (lowest score)
       │   │       └─ If no candidate: throw AppError("Insufficient approved inventory")
       │   ├─ Returns GeneratedPaperPayload[] (3 variants)
       │   └─ inventoryWarnings() → warns if remaining < 5, < 2, or 0
       │
       ├─ For each variant:
       │   ├─ PdfService.createPaperPdf() → PDF buffer
       │   ├─ StorageService.uploadServerFile() → MinIO (generated-papers)
       │   ├─ GeneratedPaper.upsert() by (questionBankId, variant)
       │   ├─ Calculates: coverageScore, difficultyScore, qualityScore, duplicateRisk, recommendation
       │   └─ Updates Question usageCount, lastUsed*
       │
       ├─ NotificationService.createAndEmail() → coordinators (SUCCESS)
       │
       └─ Audit log: QUESTION_PAPERS_GENERATED
```

### 7.3 Dean Review Flow

```
ProductionService.submitDeanReview(questionBankId, { regularPaper, supplementaryPaper, ktPaper }, actor)
  │
  ├─ Validates: actor is DEAN with departmentId
  ├─ Validates: no existing deanReview (409: DEAN_REVIEW_LOCKED)
  ├─ Validates: 3 selections are distinct (400: INVALID_DEAN_SELECTION)
  ├─ Validates: each paper variant belongs to the bank
  │
  ├─ Creates DeanReview record
  ├─ Notifications:
  │   ├─ COE users (ACTION_REQUIRED)
  │   ├─ Coordinators (SUCCESS)
  │   └─ Self (SUCCESS)
  └─ Audit log: DEAN_SELECTION_SUBMITTED
```

### 7.4 Export Flow

```
ProductionService.createExport(input, actor)
  │
  ├─ Validates: deanReview exists for the bank
  ├─ Creates ExportArtifact (PENDING)
  ├─ buildSelectedPapers(questionBank, input):
  │   └─ Maps dean's 3 selections to paper data with full question details
  │
  ├─ Based on format:
  │   ├─ PDF → DocumentService.createCombinedPdf(papers)
  │   ├─ DOCX → DocumentService.createCombinedDocx(papers)
  │   └─ ZIP → DocumentService.createZipBundle([pdf, docx, manifest.json])
  │
  ├─ StorageService.uploadServerFile() → MinIO (exports)
  ├─ Updates ExportArtifact to COMPLETED
  └─ On failure: updates to FAILED with error message
```

---

## 8. Historical Data Analysis

### 8.1 Question Usage History

**Partially present.**
- `Question.usageCount` — integer counter, incremented on paper generation
- `Question.lastUsedExam`, `Question.lastUsedYear`, `Question.lastUsedSemester`, `Question.lastUsedType` — last use context
- `GeneratedPaperItem` — links questions to specific paper variants

**Missing:**
- No chronological usage log (no `QuestionUsageHistory` table)
- Cannot answer "when exactly was this question used" without parsing generated papers
- Cannot answer "how many times was this question used in ISE_1 vs ENDSEM"
- No immutable usage trail

### 8.2 Paper History

**Partially present.**
- `GeneratedPaper` records exist per variant per bank
- `GeneratedPaperItem` links questions to papers
- Papers are stored as PDFs in MinIO

**Missing:**
- Papers are **overwritten on regeneration** (upsert by `@@unique([questionBankId, variant])`)
- No paper version history (old papers are lost when regenerated)
- No paper archive independent of question bank

### 8.3 Approval History

**Partially present.**
- `ModerationEvent` records each moderation action (approve, reject, request revision, override)
- `QuestionRevision` records each submission snapshot
- `coordinatorDecision` on QuestionBank tracks last coordinator action
- `coordinatorReviewedAt` timestamp

**Missing:**
- No immutable approval chain (only most recent coordinator decision stored)
- No "history of status changes" for QuestionBank (no `QuestionBankStatusChange` log)
- No paper-level approval history

### 8.4 Moderation History

**Present.** Each moderation action creates a `ModerationEvent` record:
```prisma
model ModerationEvent {
  id          String
  questionId  String
  moderatorId String
  action      String
  note        String?
  createdAt   DateTime
}
```
Indexed by `[questionId, createdAt]`. This provides a full audit trail of all moderation actions.

### 8.5 Academic Year History

**Absent.**
- `academicYear` is a string field on `Subject` and `ExamCycle`
- There is no `AcademicYear` entity
- No academic year hierarchy (no semester start/end dates for years)
- No academic year lifecycle management
- The function `currentAcademicYear()` in `CoordinatorService` generates `YYYY-YYYY+1` from the current date, which is fragile (no configurable academic calendar)
- When a new academic year begins, there's no automated mechanism to carry forward subjects, assignments, or templates

### 8.6 Summary Table

| Historical data | Present? | Where | Complete? |
|---|---|---|---|
| Question text revisions | Yes | `QuestionRevision` | ✅ Multiple versions tracked |
| Moderation actions | Yes | `ModerationEvent` | ✅ Full audit trail |
| Question usage | Partial | `Question.usageCount` + `lastUsed*` | ❌ No chronological log |
| Paper versions | Partial | `GeneratedPaper` (overwritten) | ❌ No version history |
| Approval history | Partial | `ModerationEvent` + `coordinatorDecision` | ❌ No status change log |
| Bank status history | **No** | — | ❌ Completely absent |
| Academic year hierarchy | **No** | — | ❌ Completely absent |
| Subject curriculum/syllabus | **No** | — | ❌ Completely absent |
| Export history | Partial | `ExportArtifact` | ⚠️ Has expiry/cleanup |
| Backup history | Partial | `SystemBackup` | ⚠️ Has expiry/cleanup |

---

## 9. API Surface Analysis

### 9.1 Auth Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| POST | `/api/auth/login` | UserService.verifyCredentials | Authenticate user | User |
| POST | `/api/auth/logout` | (cookie deletion) | End session | — |
| POST | `/api/auth/refresh` | UserService.findByEmail | Refresh access token | User |
| GET | `/api/auth/csrf` | getOrCreateCsrfToken | Get CSRF token | — |
| POST | `/api/auth/forgot-password` | (raw prisma) | Send reset token | User |
| POST | `/api/auth/reset-password` | (raw prisma) | Reset password | User |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers | Auth.js catch-all | User |

### 9.2 Exam Cycle Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET | `/api/exam-cycles` | ExamCycleService.list | List all cycles | ExamCycle, Department, QuestionBank |
| POST | `/api/exam-cycles` | ExamCycleService.create | Create cycle | ExamCycle |
| PATCH | `/api/exam-cycles/[id]` | ExamCycleService.update | Update cycle | ExamCycle |

### 9.3 Subject Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET | `/api/subjects` | CoordinatorService.listSubjects | List subjects | Subject, Department, ExamCycle |
| POST | `/api/subjects` | CoordinatorService.createSubject | Create subject | Subject |
| PUT/PATCH | `/api/subjects/[id]` | CoordinatorService.updateSubject | Update subject | Subject |
| PATCH | `/api/subjects/[id]/deactivate` | CoordinatorService.deactivateSubject | Deactivate subject | Subject |
| POST | `/api/subjects/[id]/link-cycle` | CoordinatorService.linkSubjectToExamCycle | Link subject to cycle | SubjectExamCycleLink |

### 9.4 Question Bank Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET | `/api/question-banks` | CoordinatorService.listQuestionBanks | List banks | QuestionBank, Subject, ExamCycle, QuestionSlot, AiReport, GeneratedPaper, DeanReview |
| POST | `/api/question-banks` | CoordinatorService.initializeQuestionBank | Create bank | QuestionBank, QuestionSlot |
| GET | `/api/question-banks/[id]` | CoordinatorService.getQuestionBankDetail | Bank detail | QuestionBank + all children |
| PATCH | `/api/question-banks/[id]/status` | QuestionBankService.updateStatus | Advance status | QuestionBank |
| PATCH | `/api/question-banks/[id]/lock` | CoordinatorService.lockQuestionBank | Lock bank | QuestionBank |
| POST | `/api/question-banks/[id]/coordinator-decision` | ReportService.coordinatorDecision | Approve/reject bank | QuestionBank |
| GET/POST | `/api/question-banks/[id]/reports` | CoordinatorService.listAiReports / triggerAiAnalysis | AI reports | AiReport, QuestionBank |
| GET/POST | `/api/question-banks/[id]/papers` | CoordinatorService.listGeneratedPapers / triggerPaperGeneration | Papers | GeneratedPaper, QuestionBank |
| POST | `/api/question-banks/[id]/signed-report` | ReportService.uploadSignedReport | Upload signed report | QuestionBank, FileAsset |
| POST | `/api/question-banks/[id]/signed-report/presign` | ReportService.createSignedReportUploadUrl | Presign upload URL | FileAsset |
| GET/POST | `/api/question-banks/[id]/dean-review` | ProductionService.getDeanReviewWorkspace / submitDeanReview | Dean review | DeanReview, QuestionBank, GeneratedPaper |
| GET/POST | `/api/question-banks/[id]/assignments` | CoordinatorService.listAssignments / assignContributor | Manage assignments | TeacherAssignment |
| POST | `/api/question-banks/[id]/assignments/moderator` | AssignmentService.assignModerator | Assign moderator | ModeratorBankAssignment |
| PUT/DELETE | `/api/question-banks/[id]/assignments/[aid]` | CoordinatorService.reassignContributor / removeAssignment | Edit assignments | TeacherAssignment |
| POST | `/api/question-banks/[id]/assignments/[aid]/notify` | CoordinatorService.notifyAssignment | Notify assignee | TeacherAssignment, Notification |

### 9.5 Question Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET/POST | `/api/questions` | QuestionService.listQuestions / createQuestion | List/create questions | Question, QuestionSlot |
| GET/PATCH | `/api/questions/[id]` | QuestionService.getQuestion / updateQuestion | Read/edit question | Question |
| POST | `/api/questions/[id]/submit` | QuestionService.submitQuestion | Submit for review | Question, QuestionRevision |
| POST | `/api/questions/[id]/moderate` | ModeratorService.approve/reject/requestRevision | Moderate question | Question, ModerationEvent |
| GET/POST | `/api/questions/[id]/attachments` | QuestionService.listAttachments / addAttachment | Attachments | QuestionAttachment, FileAsset |
| POST | `/api/questions/[id]/attachments/presign` | QuestionService.createAttachmentUploadUrl | Upload URL | FileAsset |
| GET/POST | `/api/question-slots` | QuestionService.listSlots / reserveSlot | Slots | QuestionSlot |
| POST | `/api/question-slots/[id]/override` | QuestionService.reserveSlot (override) | Override slot | QuestionSlot |

### 9.6 Assignment Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET/POST | `/api/assignments` | AssignmentService.list / assign | Legacy assignment | TeacherAssignment |

### 9.7 Moderation Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET | `/api/moderation/questions` | ModeratorService.listQuestions | Moderation queue | Question, QuestionBank, ModeratorBankAssignment |
| GET | `/api/moderation/questions/[id]` | ModeratorService.getQuestionDetail | Question detail | Question, QuestionRevision, ModerationEvent, QuestionAttachment |
| PATCH | `/api/moderation/questions/[id]/approve` | ModeratorService.approveQuestion | Approve | Question, ModerationEvent |
| PATCH | `/api/moderation/questions/[id]/reject` | ModeratorService.rejectQuestion | Reject | Question, QuestionSlot, ModerationEvent |
| PATCH | `/api/moderation/questions/[id]/request-revision` | ModeratorService.requestRevision | Request revision | Question, ModerationEvent |
| PATCH | `/api/moderation/questions/[id]/override` | ModeratorService.overrideQuestion | Override approval | Question, ModerationEvent |

### 9.8 Attachment Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| PATCH/DELETE | `/api/question-attachments/[id]` | QuestionService.replace/deleteAttachment | Edit attachment | QuestionAttachment |
| GET | `/api/question-attachments/[id]/download` | StorageService.createDownloadLink | Download | FileAsset |

### 9.9 Department Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET/POST | `/api/departments` | DepartmentService.list / create | CRUD | Department |
| PATCH/DELETE | `/api/departments/[id]` | DepartmentService.update / delete | CRUD | Department |

### 9.10 User Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET/POST | `/api/users` | UserService.list / create | CRUD | User |
| PATCH/DELETE | `/api/users/[id]` | UserService.update / disable | CRUD | User |

### 9.11 Production Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET/POST | `/api/exports` | ProductionService.listExportArtifacts / createExport | Exports | ExportArtifact, FileAsset, DeanReview |
| GET | `/api/exports/[id]/download` | ProductionService.createExportDownloadLink | Download | ExportArtifact |

### 9.12 System Domain

| Method | Route | Service | Purpose | Models |
|---|---|---|---|---|
| GET | `/api/audit-logs` | (raw prisma) | View audit | AuditLog |
| POST | `/api/backups` | ProductionService.runSystemBackup | Backup | SystemBackup, FileAsset |
| GET | `/api/health` | ProductionService.getObservabilityOverview | Health check | (system probe) |
| GET | `/api/monitoring` | ProductionService.getObservabilityOverview | Monitoring | (system probe) |
| POST | `/api/storage/presign` | StorageService.createUploadLink | Upload URL | FileAsset |
| GET/PATCH | `/api/notifications` | NotificationService.listForUser / markAsRead | Notifications | Notification |
| GET | `/api/dashboard` | DashboardService.getRoleDashboard | Dashboard data | (aggregate) |

---

## 10. Frontend Architecture Analysis

### 10.1 Dashboard Structure

```
app/(protected)/dashboard/
├── page.tsx                          Role selection landing page
├── coe/                              Controller of Examination
│   ├── layout.tsx                    Role gate (COE only)
│   ├── page.tsx                      Stats + pending tasks + notifications
│   ├── users/page.tsx                User CRUD table + form
│   ├── departments/page.tsx          Department CRUD table + form
│   ├── exam-cycles/page.tsx          ExamCycleTimetableManager (client)
│   ├── production/page.tsx           ExportConsole (client) + bank overview
│   ├── audit/page.tsx                Audit log table
│   └── monitoring/page.tsx           System health observability
│
├── coordinator/
│   ├── layout.tsx                    Role gate (COORDINATOR only)
│   ├── page.tsx                      Dashboard with 6 cards
│   ├── subjects/page.tsx             Subject list + SubjectCreateForm
│   ├── question-banks/page.tsx       Bank list + SimpleForm create
│   ├── assignments/page.tsx          AssignmentsManager (client)
│   └── questions/page.tsx            QuestionWorkspace (client, coordinator mode)
│
├── contributor/
│   ├── layout.tsx                    Role gate (CONTRIBUTOR only)
│   ├── page.tsx                      Stats + pending tasks
│   ├── my-subjects/page.tsx          Subject assignments table
│   ├── submit-question/page.tsx      QuestionWorkspace (client, contributor mode)
│   └── questions/page.tsx            QuestionWorkspace (client, contributor mode)
│
├── moderator/
│   ├── layout.tsx                    Role gate (MODERATOR only)
│   ├── page.tsx                      Summary stats + quick access + notifications
│   ├── questions/page.tsx            ModerationWorkspace (client)
│   ├── approved/page.tsx             Redirects to /questions
│   └── rejected/page.tsx             Redirects to /questions
│
└── dean/
    ├── layout.tsx                    Role gate (DEAN only)
    ├── page.tsx                      Pending/completed reviews + notifications
    ├── review/page.tsx               DeanReviewWorkspace (client, by bank param)
    ├── reports/page.tsx              Redirects to /dashboard/dean
    └── readiness-overview/page.tsx   Redirects to /dashboard/dean
```

### 10.2 Feature Modules (Components)

| Component | Type | Owned by | State complexity |
|---|---|---|---|
| `AppShell` | Client | Layout | Low (path-based nav) |
| `ExamCycleTimetableManager` | Client | COE | High (multi-field form + timetable rows) |
| `ExportConsole` | Client | COE | Low (single action) |
| `SimpleForm` | Client | Shared | Low (generic CRUD form) |
| `SubjectCreateForm` | Client | Coordinator | Medium (validation + submit) |
| `AssignmentsManager` | Client | Coordinator | High (banks, assignments, contributors, editors) |
| `QuestionWorkspace` | Client | Contributor/Coordinator | High (slots, questions, attachments, moderation) |
| `ModerationWorkspace` | Client | Moderator | High (filters, list, detail, actions) |
| `DeanReviewWorkspace` | Client | Dean | Medium (paper selection, validation) |
| `DeanNotificationsInbox` | Client | Dean | Low |
| `ModeratorNotificationInbox` | Client | Moderator | Low |
| `DataTableCard` | Server | Shared | None (pure display) |
| `StatCard` | Server | Shared | None (pure display) |

### 10.3 Data Fetching Pattern

```
Server Component (page.tsx)
  ├── getCurrentUserFromCookies()  → Actor
  ├── service.method(actor)         → Data
  │   OR
  ├── getServerData()               → Data
  └── <ClientComponent data={data} />

Client Component (workspace.tsx, etc.)
  ├── useState for local state
  ├── useEffect for initial data load (GET)
  ├── apiFetch for mutations (POST/PATCH/DELETE)
  └── No React Query / SWR / tRPC
```

### 10.4 Tightly Coupled UI Areas

1. **ExamCycleTimetableManager** (545 lines, COE only) — embeds both create and edit forms; inline state management for timetable rows.

2. **QuestionWorkspace** (approx. 500+ lines) — used by both contributor and coordinator; contains `SlotCell` and `FieldSelect` as inline components; conditionally renders different modes.

3. **ModerationWorkspace** — complex state with 5+ filters, detail panel, and async actions; two `useEffect` hooks; all state in single component.

4. **AssignmentsManager** — centralized state for banks, assignments, and contributors; manages inline editors per bank+module.

5. **DeanReviewWorkspace** — uses `useEffect` for initial load; derived state for selection validation.

### 10.5 Cross-cutting Concerns

- **No global state store** (Zustand, Redux, Context) — data is fetched per-page and passed down
- **All pages are server components** except auth pages (login, forgot-password, reset-password) — only client components have interactivity
- **Layout nesting**: 3 levels (root → protected → role) — each role layout does its own role check
- **Server data layer**: `src/lib/server-data.ts` — 8 functions that aggregate data for pages (COE admin data, question workspace, dean dashboard, etc.)

---

## 11. Technical Debt Analysis

### 11.1 Duplicated Concepts

**1. Two moderator assignment models**
- `TeacherAssignment` with `assignmentRole: MODERATOR` and `moduleNumber: null` (legacy)
- `ModeratorBankAssignment` (canonical)
- Both are created in the seed; only `ModeratorBankAssignment` is checked by `ModeratorService`
- The legacy path via `TeacherAssignment` is never cleaned up
- *Evidence:* `prisma/schema.prisma:274-289` vs `prisma/schema.prisma:467-476`, `prisma/seed.ts:143-162` creates both

**2. Two question bank creation paths**
- `QuestionBankService.create()` — creates bank + ensures slot grid
- `CoordinatorService.initializeQuestionBank()` — validates subject link, creates bank with IN_PROGRESS, ensures slot grid
- `QuestionBankService.create()` exists but is never called from any route handler; only `initializeQuestionBank` is used
- *Evidence:* `src/modules/question-banks/service.ts:18-43` vs `src/modules/coordinator/service.ts:423-449`

**3. Two service layers for question banks**
- `QuestionBankService` (43 lines) — thin CRUD + updateStatus
- `CoordinatorService` (981 lines) — contains all the actual business logic for banks
- Most bank operations go through `CoordinatorService`, not `QuestionBankService`
- *Evidence:* Route handlers call `CoordinatorService` for almost everything

**4. Duplicate status advancement paths**
- `QuestionBankService.updateStatus()` — validates transition + optimistic lock
- `CoordinatorService.lockQuestionBank()` — has its own validation (exam cycle check, endDate check) + optimistic lock
- Status advancement via `PATCH /api/question-banks/[id]/status` bypasses coordinator-specific checks
- *Evidence:* Two different routes advancing bank status with different validation sets

### 11.2 Duplicated Entities

**None strictly duplicated**, but:
- `Question.questionBankId` is redundant with `Question.slot.questionBankId` (denormalization for query performance)
- `Question.moduleNumber`, `Question.marks`, `Question.slotNumber` are duplicated from `QuestionSlot` (same reason)

### 11.3 Redundant Workflows

**1. Assignment bulk replace** (`AssignmentRepository.replaceAssignments`):
- Deletes ALL existing CONTRIBUTOR assignments, then creates new ones
- No audit of deleted assignments
- Not used by `assignContributor` (which creates individual assignments)

**2. `ensureSlotGrid` called multiple times:**
- Called in `QuestionBankService.create()`
- Called in `CoordinatorService.initializeQuestionBank()`
- Called in `QuestionService.listSlots()` on every access
- Uses `skipDuplicates: true` so it's idempotent but wasteful

### 11.4 Dead Code

**1. `QuestionBankService.create()`**
- Exists at `src/modules/question-banks/service.ts:18-31`
- Never called from any route handler
- All bank creation goes through `CoordinatorService.initializeQuestionBank()`

**2. `QuestionBankRepository.list()` and `findById()`**
- Defined in `src/modules/question-banks/repository.ts`
- Never used in route handlers — all bank listing/detail goes through `CoordinatorService`

**3. `SubjectService` and `SubjectRepository`**
- `src/modules/subjects/service.ts` (21 lines) and `src/modules/subjects/repository.ts` (23 lines)
- Never used — all subject operations go through `CoordinatorService`

**4. `ExamCycleRepository.findById()`**
- Only used by `ExamCycleService.update()` — could be inlined

**5. `TeacherAssignment` with `assignmentRole: MODERATOR`**
- No code reads this for moderator access control
- Only `ModeratorBankAssignment` is used for moderator scoping

### 11.5 Obsolete Models

**None formally obsolete**, but:
- `TeacherAssignment.assignmentRole: MODERATOR` path is effectively replaced by `ModeratorBankAssignment`
- The `@@unique([questionBankId, teacherId, assignmentRole, moduleNumber])` constraint on `TeacherAssignment` technically allows a moderator-only assignment per bank, but this path is unused

### 11.6 Architectural Bottlenecks

**1. God classes:**
- `CoordinatorService` — 981 lines, 25+ methods, owns subjects, question banks, assignments, AI analysis, paper generation, dean review queries
- `ReportService` — 484 lines, owns AI reports, paper generation, signed reports, coordinator decisions, scoring
- `ProductionService` — 801 lines, owns dean review, exports, monitoring, backups, cleanup
- `QuestionService` — 454 lines, owns slot grid, reservations, question CRUD, attachments, permissions

**2. No event system:**
- All side effects (notifications, audit logs, status updates) are inlined into service methods
- Adding new side effects requires modifying existing service code
- No publish/subscribe, no hooks, no middleware

**3. No background processing:**
- AI analysis, paper generation, exports, backups all run synchronously in the request
- PDF generation for papers is synchronous (100+ questions × 3 variants = 300+ question renders in one request)
- `mysqldump` runs via `execFile` in the request path

**4. Duplicate ORM access patterns:**
- Some routes use `CoordinatorService` for everything
- Some routes use raw Prisma (audit-logs, forgot-password)
- Some routes use `withApiHandler` with service
- Health route doesn't use `withApiHandler` at all

**5. Test isolation difficulty:**
- All repositories extend `BaseRepository` which uses a global Prisma singleton
- No dependency injection framework — services use `new XxxService()` as defaults
- Mocking requires constructor injection (possible but not enforced)

**6. Question-bank coupling:**
- Questions cannot exist without a question bank
- Question banks cannot exist without a subject + exam cycle
- No question reuse across banks (questions are recreated per cycle)
- The 126-slot grid is rigid — adding more slots per module or new mark values requires schema + service + test changes

---

## 12. Refactor Readiness Assessment

### 12.1 Easy Wins

| Item | Affected files | Affected services | Affected DB tables | Risk |
|---|---|---|---|---|
| Remove `QuestionBankService.create()` dead code | 1 service file, ~15 lines | QuestionBankService | None | None |
| Remove `SubjectService` and `SubjectRepository` dead code | 2 files, ~44 lines | None (not used) | None | None |
| Remove `QuestionBankRepository.list()` and `findById()` dead code | 1 file, ~20 lines | None (not used) | None | None |
| Remove `TeacherAssignment` moderator path (assignmentRole: MODERATOR) | `prisma/seed.ts`, `prisma/schema.prisma` (enum remains) | AssignmentService, CoordinatorService (read side) | `TeacherAssignment` (data migration needed) | Low — seed cleanup, no production impact if no live data |
| Consolidate `ensureSlotGrid` to single call point | `questions/service.ts`, `question-banks/service.ts`, `coordinator/service.ts` | QuestionService, QuestionBankService, CoordinatorService | None | None (idempotent) |
| Remove unused route files (approved, rejected, reports, readiness-overview redirects) | 4 page files | None | None | None — these are just redirect pages |
| Remove `ExamCycleRepository.findById()` (inline into service) | 1 file, ~4 lines | ExamCycleService | None | None |

### 12.2 Medium Complexity Refactors

| Item | Affected files | Affected services | Affected DB tables | Risk |
|---|---|---|---|---|
| Extract `QuestionBankWorkflowService` from `CoordinatorService` (moderation, status, locking) | `coordinator/service.ts` split into 2-3 files | CoordinatorService → new services | None | Medium — changes method visibility, may affect route handler imports |
| Extract `ReportOrchestratorService` from `ReportService` | `reports/service.ts` split into orchestration + pure computation | ReportService → new orchestrator | None | Medium — PDF, analysis, paper gen are well-separated already |
| Extract `ProductionOrchestratorService` from `ProductionService` | `production/service.ts` split into dean review, exports, monitoring, backup | ProductionService → 4 smaller services | None | Medium — dean, export, monitoring, backup are separable domains |
| Add `QuestionBankStatusChange` log model | 1 Prisma model + 1 service method | QuestionBankService, all callers | New `QuestionBankStatusChange` table | Low — append-only, no migration pain |
| Add `QuestionUsageHistory` model | 1 Prisma model + 1 service method | ReportService | New `QuestionUsageHistory` table | Low — migrates data from `Question.usageCount` |
| Remove legacy `TeacherAssignment` moderator path (data migration) | 1 data migration script | AssignmentService | `TeacherAssignment` rows with MODERATOR role | Low-Medium — depends on existing data volume |
| Standardize all routes to use `withApiHandler` (health route) | 1 route file | None | None | None |
| Add `Semester` model | 1 Prisma model + seed data | AcademicStructureService (new) | `Department` → `Semester` → `Subject` | Medium — requires migration of existing `semester` fields |

### 12.3 High-Risk Refactors

| Item | Affected files | Affected services | Affected DB tables | Risk |
|---|---|---|---|---|
| Decouple Questions from QuestionBank (shared question pool) | Schema, all question services, repositories, permissions, all routes, all frontend components | QuestionService, ModeratorService, CoordinatorService, ReportService, PaperGenerator | `Question.questionBankId` becomes optional, new `QuestionPool` table, unique constraint changes | **High** — every question-related component touches this |
| Replace all inline `useState` + `useEffect` with React Query or SWR | Every client component (10+ files) | None | None | **High** — requires frontend rewrite of every workspace |
| Add background worker system (BullMQ/Redis) for AI/paper/export | New workers/, new queue config, all report/production services | ReportService, ProductionService | None (or new job tables) | **High** — architecture change, new infrastructure dependency |
| Introduce multi-tenancy (multiple institutions) | Schema, auth, all services, all routes, all components | Every service | New `Institution` or `Tenant` table, all entities get `tenantId` | **High** — cross-cutting concern |
| Add syllabus/curriculum versioning | New models, new services, new routes, COE UI changes | New `CurriculumService` | New `Syllabus`, `CourseOutcomeDefinition`, `SubjectVersion` tables | **High** — new domain, schema migration |
| Decouple ExamCycle from QuestionBank (allow banks to span cycles) | Schema, question bank service, coordinator service, all routes | QuestionBankService, CoordinatorService, all consumers | `QuestionBank.examCycleId` becomes optional, link table | **High** — most coupled relationship |

---

## 13. Future Architecture Mapping

### 13.1 Current → Target Mapping

```
CURRENT                          TARGET
─────────                       ──────

Academic Domain:
  Department                      Department (keep)
  [no Semester entity]            Semester (new — with startDate, endDate, isActive)
  Subject (has academicYear)      Subject (modify — remove academicYear, link to Semester)
  [no Syllabus]                   SyllabusVersion (new — curriculum, CO definitions, RBT mapping)
  [no CourseOutcomeDefinition]    CourseOutcomeDefinition (new — per-subject CO texts)

Exam Cycle Domain:
  ExamCycle (timetable inline)    ExamCycle (keep, but extract timetable to separate entity?)
  SubjectExamCycleLink            SubjectExamCycleLink (keep)
  [no AcademicYear entity]        AcademicYear (new — with start/end dates, configurable)

Question Bank Domain:
  QuestionBank (monolith)         QuestionBank (keep as workflow container)
  QuestionBankService (thin)      QuestionBankWorkflowService (refactored from CoordinatorService)
  [no status change log]          QuestionBankStatusChange (new — immutable log)

Question Domain:
  Question (tied to QuestionBank) Question (modify — allow pool membership)
  QuestionSlot (126 grid)         QuestionSlot (keep — remains per-bank)
  QuestionPool (new — cross-bank question library)
  QuestionUsageHistory (new — replaces usageCount fields)

Assignment Domain:
  TeacherAssignment (dual role)   TeacherAssignment (modify — CONTRIBUTOR only)
  ModeratorBankAssignment         ModeratorBankAssignment (keep — canonical)
  [no template system]            AssignmentTemplate (future — stretch goal)

Report Domain:
  ReportService (orchestrator)    ReportOrchestratorService (refactored)
  AnalysisEngine                  AnalysisEngine (keep)
  PaperGenerator                  PaperGenerator (keep)
  PdfService                      PdfService (keep)
  OllamaService                   OllamaService (keep)

Production Domain:
  ProductionService (monolith)    DeanReviewService (extracted)
                                  ExportService (extracted)
                                  MonitoringService (extracted)
                                  BackupService (extracted)

Infrastructure:
  No background workers           Background Job Queue (future — for AI/paper/export)
  Singleton Prisma                Singleton Prisma (keep, but add tenant context)
  Inline state in components      React Query or SWR (future — for caching + refetch)
  No DI framework                 Simple DI container (keep constructor injection, enforce it)
```

### 13.2 Entities to Keep

| Entity | Reason |
|---|---|
| `Department` | Stable, well-defined, no changes needed |
| `User` | Stable, well-defined |
| `ExamCycle` | Core concept, keep but minor modifications |
| `Subject` | Core concept, modify to remove `academicYear` |
| `SubjectExamCycleLink` | Well-designed join table |
| `QuestionBank` | Keep as workflow container, reduce responsibilities |
| `QuestionSlot` | 126-grid is validated and tested |
| `Question` | Core concept, modify to allow pool membership |
| `ModeratorBankAssignment` | Canonical moderator assignment |
| `ModerationEvent` | Full audit trail, keep |
| `QuestionRevision` | Version history, keep |
| `GeneratedPaper` | Keep but add immutable history |
| `DeanReview` | Well-designed, keep |
| `ExportArtifact` | Keep but improve expiry |
| `Notification` | Keep |
| `AuditLog` | Keep (append-only, integrity hashed) |
| `FileAsset` | Keep (universal file reference) |
| `QuestionAttachment` | Keep |
| `SystemBackup` | Keep |

### 13.3 Entities to Modify

| Entity | Modification |
|---|---|
| `Subject` | Remove `academicYear`, add `semesterId` → `Semester`, make reusable across years |
| `Question` | Add optional `questionPoolId`, make `questionBankId` optional (can exist in pool without a bank), migrate `usageCount` → `QuestionUsageHistory` |
| `QuestionBank` | Optionally reference `QuestionPool` for pre-existing questions |
| `TeacherAssignment` | Remove MODERATOR role usage, keep only CONTRIBUTOR |
| `ExamCycle` | Optionally add `academicYearId` → `AcademicYear` entity |
| `CoordinatorDepartmentAssignment` | Keep, stable |

### 13.4 Entities to Remove

| Entity | Reason | Notes |
|---|---|---|
| `TeacherAssignment` with MODERATOR role | Superseded by `ModeratorBankAssignment` | Data migration required; enum stays |
| `Question.usageCount`, `lastUsed*` | Move to `QuestionUsageHistory` | Data migration required |

### 13.5 Entities to Introduce

| New Entity | Purpose | Priority |
|---|---|---|
| `AcademicYear` | Academic year lifecycle (start/end dates, configurable calendar) | Medium |
| `Semester` | Separate semester entity (start/end dates, term, linked to AcademicYear) | Medium |
| `SyllabusVersion` | Curriculum definition per subject (CO definitions, RBT expectations, module topics) | High |
| `CourseOutcomeDefinition` | Per-subject CO text mapping (CO1 = "...", CO2 = "...", etc.) | High |
| `QuestionPool` | Cross-bank, cross-cycle shared question library | High |
| `QuestionUsageHistory` | Chronological usage log (questionId, paperId, cycleId, date) | Medium |
| `QuestionBankStatusChange` | Immutable log of all status transitions | Low |
| `AssignmentTemplate` | Reusable assignment pattern (which roles to assign per module) | Low |

---

*End of architecture report. All findings are based on source code analysis of the commit at the time of generation.*
