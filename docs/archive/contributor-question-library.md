# Contributor-Based Question Library — Migration Report

---

## Summary

Replaced the module-assignment / slot-reservation question workflow with a contributor-based Question Library model. Faculty no longer need module-level ownership tracking — the system asks "who can contribute questions?" instead of "who owns Module 3?".

---

## Models Removed

| Model | Reason |
|---|---|
| `QuestionSlot` | 126-slot grid concept eliminated |
| `TeacherAssignment` | Module-level contributor assignments removed; moderator assignment retained via `ModeratorBankAssignment` |
| `Question` | Replaced by `QuestionLibraryItem` — decoupled from QuestionBank |
| `QuestionAttachment` | File attachment model simplified |
| `QuestionRevision` | Version history concept removed |

**Enum removed:** `AssignmentRole` (MODERATOR/CONTRIBUTOR)

---

## Models Added

### QuestionLibraryItem
Standalone question entity linked to `SubjectVersion`, not tied to any specific QuestionBank.

| Field | Type | Notes |
|---|---|---|
| `id` | String | cuid |
| `subjectVersionId` | String | FK → SubjectVersion |
| `moduleNumber` | Int | 1-6 |
| `marks` | Int | 2, 5, or 10 |
| `questionText` | String | |
| `coMapping` | CourseOutcome | CO1-CO6 |
| `rbtLevel` | RbtLevel | L1-L6 |
| `difficultyLevel` | DifficultyLevel? | EASY/MEDIUM/HARD |
| `teachingIndex` | String? | |
| `status` | QuestionStatus | DRAFT/PENDING/APPROVED/... |
| `contributorId` | String | FK → User |
| `usageCount` | Int | Paper generation tracking |
| `lastUsedExam/Year/Semester/Type` | various | Paper generation reuse avoidance |

### QuestionBankQuestion
Join table linking a `QuestionLibraryItem` to a `QuestionBank`.

| Field | Type | Notes |
|---|---|---|
| `id` | String | cuid |
| `questionBankId` | String | FK → QuestionBank |
| `questionId` | String | FK → QuestionLibraryItem |
| `linkedAt` | DateTime | |

**Unique constraint:** `@@unique([questionBankId, questionId])`

---

## Models Modified

### QuestionBank
**Removed relations:** `assignments`, `questionSlots`, `questions`  
**Added relation:** `bankQuestions` → `QuestionBankQuestion[]`

### User  
**Removed relations:** `assignments`, `questionSlots`, `contributedQuestions`, `submittedRevisions`, `uploadedAttachments`  
**Updated:** `contributedQuestions` now points to `QuestionLibraryItem[]`

### ModerationEvent
**Updated:** `question` relation now points to `QuestionLibraryItem` instead of `Question`

### GeneratedPaperItem
**Updated:** `question` relation now points to `QuestionLibraryItem` instead of `Question`

### SubjectVersion
**Added relation:** `libraryItems` → `QuestionLibraryItem[]`

---

## Removed API Routes

| Method | Route | Reason |
|---|---|---|
| GET/POST | `/api/questions` | Replaced by `/api/question-library` |
| GET/PATCH | `/api/questions/[id]` | Replaced |
| POST | `/api/questions/[id]/submit` | Replaced |
| POST | `/api/questions/[id]/moderate` | Replaced |
| GET/POST | `/api/questions/[id]/attachments` | Replaced |
| POST | `/api/questions/[id]/attachments/presign` | Replaced |
| GET/POST | `/api/question-slots` | Slot concept removed |
| POST | `/api/question-slots/[id]/override` | Slot concept removed |
| PATCH/DELETE | `/api/question-attachments/[id]` | Attachment model removed |
| GET | `/api/question-attachments/[id]/download` | Attachment model removed |
| GET/POST | `/api/assignments` | Module assignment concept removed |
| GET/POST | `/api/question-banks/[id]/assignments` | Removed |
| PUT/DELETE | `/api/question-banks/[id]/assignments/[aid]` | Removed |
| POST | `/api/question-banks/[id]/assignments/[aid]/notify` | Removed |
| PATCH | `/api/moderation/questions/[id]/override` | Override concept removed |

---

## New API Routes

| Method | Route | Service | Purpose |
|---|---|---|---|
| GET | `/api/question-library` | QuestionLibraryService | List/search questions by bank, subjectVersion, or query |
| POST | `/api/question-library` | QuestionLibraryService | Create question (optionally link to bank via ?bankId=) |
| PATCH | `/api/question-library/[id]` | QuestionLibraryService | Edit question |
| POST | `/api/question-library/[id]?action=submit` | QuestionLibraryService | Submit for moderation |
| GET | `/api/question-library/coverage` | QuestionLibraryService | Coverage analytics dashboard |
| GET | `/api/question-bank-questions` | (direct Prisma) | List links between banks and questions |
| POST | `/api/question-bank-questions` | (direct Prisma) | Link a question to a bank |

---

## Deprecated UI Components Removed

| Component | File | Reason |
|---|---|---|
| `QuestionWorkspace` | `src/components/questions/workspace.tsx` | Built on slot/grid UI |
| `ModerationWorkspace` | `src/components/moderator/moderation-workspace.tsx` | Built on old question model |
| `AssignmentsManager` | `src/components/coordinator/assignments-manager.tsx` | Module assignment UI |
| `SubjectCreateForm` | `src/components/coordinator/subject-create-form.tsx` | Replaced by inline form |

---

## Removed Service Modules

| Module | Files | Reason |
|---|---|---|
| `src/modules/questions/` | service.ts, repository.ts, permissions.ts, validation.ts | Old question workflow |
| `src/modules/assignments/` | service.ts, repository.ts, validation.ts | Module assignments |
| `src/modules/moderation/` | (old) service.ts | Replaced by simplified version |
| `src/modules/coordinator/assignments/` | service.ts | Module assignment coordinator ops |

---

## New Service Modules

| Module | Files | Purpose |
|---|---|---|
| `src/modules/question-library/` | service.ts, repository.ts, validation.ts | Question creation, search, coverage, linking |

---

## Architecture Shift

```
Before:
  TeacherAssignment (module N) → Reserve QuestionSlot → Create Question → Moderation

After:
  Contributor → POST /api/question-library?bankId=X → QuestionLibraryItem + QuestionBankQuestion (auto-linked)
  Coverage Dashboard → GET /api/question-library/coverage?subjectVersionId=X
  Search → GET /api/question-library?q=search+terms
```

### Key behavioral changes:
1. **No slot grid** — 126-slot template removed entirely
2. **No module assignments** — contributors create questions freely; no module ownership tracking
3. **Auto-linking** — when a question is created with `?bankId=X`, the join record is created automatically
4. **Coverage analytics** — live view of module/CO/RBT/difficulty coverage per subject version
5. **Question reuse** — search existing questions across the library; reuse without slot conflicts

---

## Build & Test Results

| Check | Result |
|---|---|
| Build (TypeScript + Turbopack) | Compiled successfully |
| Test files | 14/14 passing |
| Tests | 106/106 passing |
| Seed | Ran successfully |
