# Question Governance Audit

Audited: 2026-06-15

## Scope

- `QuestionLibraryItem` (model + service + repository + validation + 6 route files)
- `QuestionOwnershipHistory` (model + service reads/writes)
- `QuestionRevision` (model + service reads/writes)
- `QuestionUsageHistory` (model + service + paper generation usage)
- `ModeratorService.moderate()` (bypass path)
- `PaperGenerationService.generatePapers()` (usage recording path)

---

## Verifications

### 1. Summary fields removed

**PASS** — no duplicate summary fields remain.

`QuestionLibraryItem` has no `usageCount`, `lastUsedYear`, `lastUsedExam`, `lastUsedSemester`, or `lastUsedType`. All usage statistics are derived at query time from `QuestionUsageHistory` in `getUsageStats()` (`src/modules/question-library/service.ts:186`).

### 2. Ownership duplication

**PASS** — no duplication.

- Current ownership: `QuestionLibraryItem.ownerId` + `.createdById`
- Past transfers: `QuestionOwnershipHistory` (exclusive)
- `getOwnershipHistory()` reads from the history model only
- `getFullDetail()` assembles from all three history models with no redundant storage

### 3. Revision duplication

**PARTIAL FAIL** — incomplete revision coverage.

- Current content: `QuestionLibraryItem` (questionText, moduleNumber, marks, coMapping, rbtLevel, difficultyLevel, teachingIndex)
- Past snapshots: `QuestionRevision`
- **Gap:** `QuestionLibraryService.update()` (`service.ts:110`) creates revision records **only** when `questionText`, `coMapping`, or `rbtLevel` changes. Changes to `moduleNumber`, `marks`, `difficultyLevel`, or `teachingIndex` produce **no snapshot**.

These are semantically significant — a question moved from module 3 to 4, or changed from 5 to 10 marks, has no audit trail.

### 4. History record mutability

**PASS** — all history models are immutable.

- `QuestionOwnershipHistory`: no `updatedAt`, no `@@updatedAt`, no `.update()` calls exist
- `QuestionRevision`: no `updatedAt`, no `@@updatedAt`, no `.update()` calls exist
- `QuestionUsageHistory`: no `updatedAt`, no `@@updatedAt`, no `.update()` calls exist

### 5. Ownership transfers create history records

**PASS** — every transfer creates a history record.

`transferOwnership()` (`service.ts:143`):
1. Updates `QuestionLibraryItem.ownerId` via repository
2. **Always** creates a `QuestionOwnershipHistory` record with `fromUserId`, `toUserId`, `transferredById`, `reason`

`ownerId` is excluded from `questionLibraryUpdateSchema` — the PATCH endpoint cannot set it.

### 6. Question updates create revision records

**FAIL** — three bypass paths.

| Path | Revision Created? | Risk |
|------|-------------------|------|
| `QuestionLibraryService.update()` (PATCH) | ✅ Yes, but only for text/co/rbt changes (see #3) | Medium |
| `QuestionLibraryService.submit()` (`service.ts:131`) | ❌ No — calls `repository.update()` with `as any`, no revision | Low — only changes `status`/`submittedAt` (not in `QuestionRevision` snapshot) |
| `ModeratorService.moderate()` (`moderation/service.ts:70`) | ❌ No — calls `prisma.questionLibraryItem.update` directly | Low — only changes `status`/`reviewedAt`/`moderatorRemark`, tracked via `ModerationEvent` |

### 7. Paper generation creates usage records

**FAIL** — usage records missing `generatedPaperItemId`.

`PaperGenerationService.generatePapers()` (`paper.service.ts:111`) calls `prisma.questionUsageHistory.create` directly instead of `QuestionUsageService.recordUsage()`. The direct call omits `generatedPaperItemId` — usage records cannot be traced to a specific `GeneratedPaperItem`.

The `recordUsage()` method (`service.ts:222`) does accept and set `generatedPaperItemId`, but the paper generation path never calls it.

### 8. Bypass routes

**FAIL** — two service bypasses.

**Bypass 1: `ModeratorService.moderate()`** (`moderation/service.ts:70`)

Calls `prisma.questionLibraryItem.update` directly instead of `QuestionLibraryService.update()` or `QuestionLibraryRepository.update()`. Bypasses:
- Ownership validation (moderate uses a different access model via moderator assignments — may be intentional, but makes enforcement inconsistent)
- Revision history creation (if a moderator ever needed to edit question content)
- Repository abstraction layer

**Bypass 2: `PaperGenerationService.generatePapers()`** (`paper.service.ts:113`)

Calls `prisma.questionUsageHistory.create` directly instead of `QuestionUsageService.recordUsage()`. Bypasses:
- `generatedPaperItemId` never populated (forensics loss)
- Single-responsibility principle: PaperGenerationService now owns usage recording logic

### 9. Orphan history records

**MODERATE RISK** — two concerns.

**A. Denormalized fields without FK constraints.** `QuestionUsageHistory.academicYearId` and `.semesterId` are `String?` columns with `@@index([academicYearId])` but **no foreign key relation** to `AcademicYear` or `Semester`. Can store dangling IDs.

**B. `QuestionOwnershipHistory.fromUserId` is nullable.** The column is `String?`. Code always sets it (to `question.ownerId`), but the schema permits null — future code paths could leave it empty.

**Protection:** All history models have FKs to `QuestionLibraryItem.id` with no `onDelete: Cascade` — MySQL prevents deleting a question that has history records. This correctly prevents full orphans.

### 10. Foreign key enforcement

**PASS** with minor exception.

All three history models have proper FK relations to `QuestionLibraryItem` and `User`. `QuestionUsageHistory` has FKs to `ExamCycle`, `GeneratedPaper`, and `GeneratedPaperItem` (all nullable — appropriate for the use case).

**Exception** (same as 9A): `academicYearId`/`semesterId` on `QuestionUsageHistory` are plain `String?` columns without FK relations.

---

## Risks

| ID | Risk | Severity | Impact |
|----|------|----------|--------|
| R1 | `update()` skips revision for `moduleNumber`, `marks`, `difficultyLevel`, `teachingIndex` changes | Medium | Audit trail gaps; cannot prove when/why question metadata changed |
| R2 | `PaperGenerationService` creates usage records without `generatedPaperItemId` | Medium | Usage records untraceable to specific `GeneratedPaperItem` — forensics loss |
| R3 | `PaperGenerationService` bypasses `QuestionUsageService.recordUsage()` | Low | Encapsulation violation; future usage recording changes must be duplicated |
| R4 | `ModeratorService.moderate()` calls Prisma directly | Low–Med | Skips revision + ownership checks if moderator ever edits content; breaks repository pattern |
| R5 | `academicYearId`/`semesterId` have no FK | Low | Dangling IDs possible; no DB-level integrity for year/semester queries |
| R6 | `QuestionOwnershipHistory.fromUserId` nullable but always populated | Low | Schema misrepresents invariant; future code could omit it |
| R7 | `submit()` and `transferOwnership()` use `as any` | Low | Masks type errors; bypasses Zod validation for `submittedAt`/`ownerId` |

---

## Architectural Smells

| Smell | Location | Detail |
|-------|----------|--------|
| Duplicated usage recording logic | `paper.service.ts:113` vs `service.ts:222` | Two places create `QuestionUsageHistory` records with different field coverage |
| Repository bypass | `moderation/service.ts:70` | Calls `prisma.questionLibraryItem.update` directly instead of `QuestionLibraryRepository` |
| Type lie with `as any` | `service.ts:140`, `service.ts:148` | `submit()` passes `submittedAt`, `transferOwnership()` passes `ownerId` outside Zod schema |
| Denormalized query fields without FK | `QuestionUsageHistory.academicYearId`, `.semesterId` | Fast queries, no referential integrity |

---

## Suggested Cleanup

### Critical

1. **Extend revision snapshot coverage** (`service.ts:110`). Change the condition from:
   ```
   if (input.questionText !== undefined || input.coMapping !== undefined || input.rbtLevel !== undefined)
   ```
   To fire on *any* tracked field change (add `moduleNumber`, `marks`, `difficultyLevel`, `teachingIndex`). Fixes R1.

### Medium

2. **Delegate usage recording in `PaperGenerationService`** to `QuestionUsageService.recordUsage()`. Wire `generatedPaperItemId` from the upserted `GeneratedPaperItem` records. Fixes R2, R3.

3. **Add `generatedPaperItemId` to the usage create call** in `generatePapers()`. The upsert response includes `items` — match each question to its item by `question.id`.

### Low

4. **Make `QuestionOwnershipHistory.fromUserId` non-nullable** (`String` not `String?`). Code always provides this value. Fixes R6.

5. **Replace `as any`** in `submit()` and `transferOwnership()` with a broader `repository.update()` parameter type, or use dedicated repository methods. Fixes R7.

6. **Remove or FK-constrain denormalized fields.** Either join through `examCycleId → ExamCycle → AcademicYear/Semester`, or add explicit FK relationships for `academicYearId`/`semesterId`. Fixes R5.

### Deferred (design decision)

7. **ModeratorService bypass.** Current design uses a separate access model (moderator assignments). If moderators will *never* edit question content (only status), the bypass is acceptable. If moderators may ever change content, route through `QuestionLibraryService.update()`.
