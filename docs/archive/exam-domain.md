# Exam Domain

## Entities

### ExamCycle
- **Fields:** `id`, `examType` (ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT), `status` (DRAFT/ACTIVE/CLOSED), `version` (optimistic lock), `startDate?`, `endDate?`, `departmentId?`, `academicYearId`, `semesterId`, `timetable*` (documentRef, issueDate, title, branch, rows as JSON, signature)
- **Unique:** `@@unique([semesterId, examType])` — one exam of each type per semester
- **Relationships:** `department?`, `academicYear`, `semester`, `subjectLinks[]`, `questionBanks[]`
- **Status transitions:** `DRAFT → ACTIVE → CLOSED` (no formal transition table — only activation guard on →ACTIVE)

### QuestionBank
- **Fields:** `id`, `subjectId`, `examCycleId`, `status` (10-state enum), `version` (optimistic lock), `createdById`, `lockedAt?`, `signedReportAssetId?`, `signedReportUploadedAt?`, `coordinatorDecision?` (APPROVED/REJECTED), `coordinatorReviewedAt?`, `coordinatorReviewRemark?`
- **Unique:** `@@unique([subjectId, examCycleId])` — one bank per subject per cycle
- **Status machine:** 10 states enforced by `transitions.ts` (see below)
- **Relationships:** `subject`, `examCycle`, `createdBy`, `moderatorAssignments[]`, `bankQuestions[]`, `aiReports[]`, `generatedPapers[]`, `deanReview?`, `signedReportAsset?`, `exportArtifacts[]`

### QuestionBankQuestion (bridge)
- See [question-domain.md](./question-domain.md) — join table between QuestionLibraryItem and QuestionBank

### GeneratedPaper
- **Fields:** `id`, `questionBankId`, `variant` (PAPER_A/B/C), `status` (PENDING/PROCESSING/COMPLETED/FAILED), `generatedById?`, `generatedAt?`, `failureReason?`, `paperJson?`, `paperFileAssetId?`, `coverageScore?`, `difficultyScore?`, `qualityScore?`, `duplicateRisk?`, `recommendation?`
- **Unique:** `@@unique([questionBankId, variant])`
- **Relationships:** `questionBank`, `paperFileAsset?`, `items[]`, `usageHistoryRecords[]`

### GeneratedPaperItem
- **Fields:** `id`, `generatedPaperId`, `questionId`
- **Unique:** `@@unique([generatedPaperId, questionId])` — no duplicate questions per paper
- **Relationships:** `generatedPaper`, `question`, `usageHistoryRecords[]`

### DeanReview
- **Fields:** `id`, `questionBankId` (unique), `regularPaper` (PaperVariant), `supplementaryPaper` (PaperVariant), `ktPaper` (PaperVariant), `reviewedById`, `notes?`, `reviewedAt`
- **Unique:** `questionBankId` — one review per bank, write-once
- **Relationships:** `questionBank`, `reviewedBy`

### ExportArtifact
- **Fields:** `id`, `questionBankId`, `generatedById?`, `format` (PDF/DOCX/ZIP), `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId?`, `metadata?`, `expiresAt`
- **Relationships:** `questionBank`, `generatedBy?`, `fileAsset?`

## Relationships

```
ExamCycle 1──N QuestionBank 1──N GeneratedPaper (3: A, B, C)
                             1──N GeneratedPaperItem N──1 QuestionLibraryItem
                             1──1  DeanReview
                             1──N ExportArtifact
                             1──N ModeratorBankAssignment
                             1──N AiReport
```

## Responsibilities

- **ExamCycle** is the top-level container tying together subjects, banks, and the examination timeline
- **QuestionBank** is the workflow container that owns the 10-state lifecycle
- **GeneratedPaper** holds paper variants with scoring metadata
- **DeanReview** stores the dean's selection of variants for exam slots
- **ExportArtifact** stores generated export files with expiry

## Workflows

### Creating and Activating an Exam Cycle
```
COE → POST /api/exam-cycles { examType, academicYearId, semesterId, status, ... }
  → ExamCycleService.create()
    → If status == ACTIVE: activatesInTransaction() guards against duplicate ACTIVE cycles per department
    → Creates cycle
```

### Initializing a Question Bank
```
Coordinator → POST /api/question-banks { subjectId, examCycleId }
  → CoordinatorService.initializeQuestionBank()
    → Validates: subject is ACTIVE, coordinator has department access
    → Validates: SubjectExamCycleLink exists
    → Creates QuestionBank (status = IN_PROGRESS, skips DRAFT)
```

### Question Bank Status Lifecycle (10 states)

```
DRAFT → IN_PROGRESS → UNDER_MODERATION → MODERATED → REPORT_GENERATED
        → AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED
        → AWAITING_COORDINATOR_APPROVAL → APPROVED → LOCKED
```

**Transition table** (from `question-banks/transitions.ts`):

| From | To |
|---|---|
| DRAFT | IN_PROGRESS, LOCKED |
| IN_PROGRESS | UNDER_MODERATION, LOCKED |
| UNDER_MODERATION | MODERATED, LOCKED |
| MODERATED | REPORT_GENERATED, LOCKED |
| REPORT_GENERATED | AWAITING_HOD_SIGN, LOCKED |
| AWAITING_HOD_SIGN | SIGNED_REPORT_UPLOADED, LOCKED |
| SIGNED_REPORT_UPLOADED | AWAITING_COORDINATOR_APPROVAL, LOCKED |
| AWAITING_COORDINATOR_APPROVAL | APPROVED, LOCKED, AWAITING_HOD_SIGN (loopback on rejection) |
| APPROVED | LOCKED |
| LOCKED | (terminal — no outgoing transitions) |

**Status advancement:**
- `PATCH /api/question-banks/[id]/status` — validates via `isValidTransition()`, uses optimistic lock
- `PATCH /api/question-banks/[id]/lock` — canonical lock path (validates exam cycle ACTIVE + endDate, optimistic lock)
- Coordinator decision APPROVED sets status to `APPROVED` (not LOCKED) — lock is a separate step
- Signed report upload sets status to `AWAITING_COORDINATOR_APPROVAL` (auto-advances through `SIGNED_REPORT_UPLOADED`)

### Paper Generation
```
Coordinator → POST /api/question-banks/[id]/papers
  → PaperGenerationService.generatePapers()
    → Validates bank.status is LOCKED or REPORT_GENERATED
    → PaperGenerator.generate() selects 18 questions per variant
    → PdfService generates PDF for each variant
    → Uploads to MinIO (generated-papers bucket)
    → Updates QuestionUsageHistory for each question
```

### Dean Review
```
Dean → POST /api/question-banks/[id]/dean-review { regularPaper, supplementaryPaper, ktPaper }
  → DeanReviewService.submitDeanReview()
    → Validates: 3 selections are distinct
    → Validates: each paper variant belongs to the bank
    → Creates DeanReview record (write-once — no update)
    → Notifications to COE + coordinators
```

### Export
```
COE → POST /api/exports { questionBankId, format, ... }
  → ExportService.createExport()
    → Validates: DeanReview exists for the bank
    → Builds selected papers per dean's choices
    → DocumentService generates PDF/DOCX/ZIP
    → Uploads to MinIO (exports bucket)
    → Creates ExportArtifact with expiry
```

## Invariants

- One ExamCycle per (semester, examType) combination
- One ACTIVE exam cycle per department at a time
- One QuestionBank per (subject, examCycle) pair
- One DeanReview per QuestionBank (write-once, no update/delete)
- One GeneratedPaper per (bank, variant) — 3 variants max per bank
- LOCKED is not terminal — unlock API (`POST /api/question-banks/:id/unlock`) allows transition back to `IN_PROGRESS` with a required reason
- `lockQuestionBank` requires exam cycle status ACTIVE and endDate set
- APPROVED status does NOT automatically lock the bank — lock is explicit
