# Question Domain

## Entities

### QuestionLibraryItem
- **Fields:** `id`, `subjectVersionId`, `moduleNumber` (1-6), `marks` (2/5/10), `questionText`, `coMapping` (CO1-CO6), `rbtLevel` (L1-L6), `difficultyLevel?` (EASY/MEDIUM/HARD), `teachingIndex?`, `status` (6-state), `createdById`, `ownerId`, `moderatorRemark?`, `submittedAt?`, `reviewedAt?`
- **Status machine:** `DRAFT → PENDING → APPROVED | REJECTED | REVISION_REQUESTED → REVISION_SUBMITTED`
- **Relationships:** `subjectVersion`, `creator`, `owner`, `moderationEvents[]`, `bankLinks[]`, `generatedPaperItems[]`, `revisionHistory[]`, `ownershipHistory[]`, `usageHistory[]`
- **Responsibilities:** The central question entity. Owned by a User, scoped to a SubjectVersion. Tracks its own status lifecycle. Is NOT directly owned by a QuestionBank — linking to a bank creates a `QuestionBankQuestion` join record.

### QuestionOwnershipHistory
- **Fields:** `id`, `questionId`, `fromUserId`, `toUserId`, `transferredById`, `reason?`, `transferredAt`
- **Unique:** indexed by `[questionId, transferredAt]`
- **Responsibilities:** Immutable log of every ownership transfer. `fromUserId` is non-nullable (enforced by schema and code).

### QuestionRevision
- **Fields:** `id`, `questionId`, `revisionNumber`, `snapshotQuestionText`, `snapshotModule`, `snapshotMarks`, `snapshotCo`, `snapshotRbt`, `snapshotDifficulty?`, `snapshotTeachingIndex?`, `changedById`, `changeReason?`, `createdAt`
- **Unique:** `@@unique([questionId, revisionNumber])`
- **Responsibilities:** Immutable snapshot of question content at each change. Created when ANY of these fields change: `questionText`, `moduleNumber`, `marks`, `coMapping`, `rbtLevel`, `difficultyLevel`, `teachingIndex`. Status-only changes through `submit()` do NOT create a revision.

### QuestionUsageHistory
- **Fields:** `id`, `questionId`, `examCycleId?`, `generatedPaperId?`, `generatedPaperItemId?`, `academicYearId?`, `semesterId?`, `examType?`, `usedAt`
- **Indexes:** `[questionId, usedAt]`, `[academicYearId]`
- **Responsibilities:** Immutable log of each time a question is included in a generated paper. Provides forensics for paper composition analysis.

### ModerationEvent
- **Fields:** `id`, `questionId`, `moderatorId`, `action`, `note?`, `createdAt`
- **Responsibilities:** Immutable record of each moderation action (approve, reject, request revision). Provides full audit trail per question.

### QuestionBankQuestion
- **Fields:** `id`, `questionBankId`, `questionId`, `linkedAt`
- **Unique:** `@@unique([questionBankId, questionId])`
- **Responsibilities:** Join table linking a QuestionLibraryItem to a QuestionBank. A question can be linked to multiple banks over time, but only once per bank.

## Relationships

```
SubjectVersion 1──N QuestionLibraryItem
                           1──N QuestionOwnershipHistory
                           1──N QuestionRevision
                           1──N QuestionUsageHistory
                           1──N ModerationEvent
                           1──N QuestionBankQuestion N──1 QuestionBank
```

## Responsibilities

- **Contributors** create, own, edit, and submit questions
- **Moderators** review and moderate questions (approve, reject, request revision)
- **Coordinators** can transfer ownership of questions
- **Coordinators** can view coverage analytics per subject version
- **Question status** tracks the moderation lifecycle
- **QuestionRevision** provides immutable history of content changes
- **QuestionUsageHistory** records every paper inclusion event

## Workflows

### Creating a Question
```
Contributor → POST /api/question-library { subjectVersionId, moduleNumber, marks, questionText, ... }
  → QuestionLibraryService.create()
    → Creates QuestionLibraryItem (status DRAFT)
    → Creates initial QuestionRevision (changeReason: "Initial creation")
    → Returns item
```

### Linking to a Bank
```
Contributor → POST /api/question-library?bankId=X { ... }
  → QuestionLibraryService.createForBank()
    → Creates QuestionLibraryItem + QuestionBankQuestion in one call
```

### Manually Linking Question to Bank
```
Coordinator → POST /api/question-bank-questions { questionBankId, questionId }
  → QuestionBankQuestionService.create()
    → Validates via questionBankQuestionSchema (Zod)
    → Validates bank exists
    → Validates question exists
    → Validates no duplicate (unique constraint on questionBankId + questionId)
    → Creates QuestionBankQuestion
```

### Submitting for Moderation
```
Contributor → POST /api/question-library/[id]?action=submit
  → QuestionLibraryService.submit()
    → If status is DRAFT → status → PENDING
    → If status is REVISION_REQUESTED → status → REVISION_SUBMITTED
    → Sets submittedAt
    → Does NOT create a QuestionRevision (status-only change)
```

### Moderating
```
Moderator → PATCH /api/moderation/questions/[id]/approve (or /reject, /request-revision)
  → ModeratorService.approveQuestion() / rejectQuestion() / requestRevision()
    → Validates moderator has bank assignment
    → Updates QuestionLibraryItem status
    → Creates ModerationEvent
    → Creates Notification
```

### Transferring Ownership
```
Coordinator → POST /api/question-library/[id]/transfer-ownership { toUserId, reason? }
  → QuestionLibraryService.transferOwnership()
    → Updates QuestionLibraryItem.ownerId
    → Creates QuestionOwnershipHistory record
```

### Coverage Analytics
```
Coordinator → GET /api/question-library/coverage?subjectVersionId=X
  → QuestionLibraryService.getCoverage()
    → Fetches all questions for subject version
    → Filters to APPROVED questions only
    → Groups by module (1-6), CO (CO1-CO6), RBT (L1-L6), difficulty (EASY/MEDIUM/HARD)
    → Returns coverage status per group (adequate/partial/missing or covered/missing)
    → Frontend: /dashboard/coordinator/coverage
```

## Invariants

- Each QuestionLibraryItem belongs to exactly one SubjectVersion
- Questions are linked to QuestionBanks via QuestionBankQuestion join table (not directly)
- A question can be linked to multiple QuestionBanks over its lifetime, but only once per bank
- Ownership transfers create immutable history records
- Usage records are append-only — never updated or deleted
- QuestionRevision captures changes to 7 tracked fields; status-only changes do not create revisions
- `moduleNumber` is 1-6, `marks` is 2/5/10, `coMapping` is CO1-CO6, `rbtLevel` is L1-L6 (all Prisma enums)
