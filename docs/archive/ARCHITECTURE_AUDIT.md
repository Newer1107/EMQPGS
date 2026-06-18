# Architecture & Consistency Audit

> **Date:** 18 June 2026  
> **Method:** Manual codebase inspection + grep searches + schema/migration comparison  
> **Scope:** Prisma schema, database, services, API routes, UI, seed, workflows

---

## Issue Summary

| Sev | Count | Category |
|-----|-------|----------|
| Critical | 2 | Schema drift, seed failure |
| High | 5 | Inconsistent design, dead code paths, incomplete features |
| Medium | 5 | Naming issues, logic gaps, unreachable states |
| Low | 4 | Documentation drift, minor inconsistencies |

---

## 1. Schema Drift (Confirmed)

### 1.1 [CRITICAL] `Subject.semesterNumber` — column exists in DB but not in schema

| Field | Value |
|---|---|
| **Files** | `prisma/schema.prisma`, `prisma/migrations/20260616120000_subject_semester_number/migration.sql` |
| **Root cause** | Migration #6 added `semesterNumber INT NOT NULL` to Subject. Schema was later edited to remove it (semester info moved to `CurriculumSubject`) but no reverse migration was created. The DB column remains. |
| **Evidence** | Migration SQL: `ALTER TABLE Subject ADD COLUMN semesterNumber INT NULL; ... ALTER TABLE Subject MODIFY COLUMN semesterNumber INT NOT NULL;` Current schema: Subject model has no `semesterNumber`. |
| **Impact** | Prisma client omits the field → `prisma.subject.create()` sends NULL → MySQL rejects with P2011. Seed fails. `npm run prisma:generate` produces a client that can't write to Subject. |
| **Fix** | Create migration: `ALTER TABLE Subject DROP COLUMN semesterNumber; DROP INDEX Subject_semesterNumber_idx ON Subject;` Then fix code in `coordinator/subject.service.ts` (see §4.4). |
| **Type** | Schema drift — real bug |

### 1.2 [MEDIUM] `AcademicYear.activeSemesterType` — column exists in DB but not in schema

| Field | Value |
|---|---|
| **Files** | `prisma/migrations/20260616073849_add_active_semester_type/migration.sql` |
| **Root cause** | Migration #5 added the column. Schema was later updated to remove it. No reverse migration created. |
| **Evidence** | Migration SQL: `ALTER TABLE AcademicYear ADD COLUMN activeSemesterType ENUM('ODD', 'EVEN') NOT NULL DEFAULT 'ODD';` Schema has no such field. No code references this field. |
| **Impact** | None — no code reads or writes this field. Dead column taking up space. |
| **Fix** | Create migration: `ALTER TABLE AcademicYear DROP COLUMN activeSemesterType;` |
| **Type** | Schema drift — dead column |

### 1.3 [MEDIUM] Unique constraint drift on `ApprovalDecision` and `ExamCycle` (Prisma CLI warnings)

| Field | Value |
|---|---|
| **Files** | `prisma/schema.prisma` (lines 260, 447), actual DB |
| **Root cause** | Schema declares `@@unique([batchSemesterId, examType])` on ExamCycle and `@@unique([questionBankId])` on ApprovalDecision, but the actual DB does NOT have these unique constraints. Likely caused by schema changes after the last migration was generated. |
| **Evidence** | Prisma CLI warning: "A unique constraint covering the columns `[questionBankId]` on the table `ApprovalDecision` will be added." Similar for ExamCycle. |
| **Impact** | Without unique constraint on `ApprovalDecision`, multiple decisions could exist per bank (violating write-once invariant). Without unique constraint on `ExamCycle`, duplicate exam cycles could exist per batch-semester-exam-type combination. |
| **Fix** | Run `npx prisma migrate dev --name add_unique_constraints` to generate the proper migration. Or write manual SQL: `ALTER TABLE ApprovalDecision ADD UNIQUE INDEX ApprovalDecision_questionBankId_key(questionBankId);` and `ALTER TABLE ExamCycle ADD UNIQUE INDEX ExamCycle_batchSemesterId_examType_key(batchSemesterId, examType);` |
| **Type** | Schema drift — missing constraints |

---

## 2. Codebase Inconsistencies

### 2.1 [HIGH] `isLocked` on `QuestionSlot` is never set to `true`

| Field | Value |
|---|---|
| **Files** | `prisma/schema.prisma:413`, `src/modules/question-slots/service.ts:26,60` |
| **Root cause** | Field `isLocked Boolean @default(false)` exists on QuestionSlot. The slot service checks it on assign/unassign (throws if locked). But **nothing in the entire codebase ever sets `isLocked` to `true`**. |
| **Evidence** | Grep for `isLocked` across all `.ts`/`.tsx` files: only found in schema definition and the two reader sites in question-slots/service.ts. No mutation endpoint or UI toggles it. |
| **Impact** | Slot-level locking is a dead code path. If someone needs to lock individual slots (not the whole bank), they can't. |
| **Fix** | Either: (a) implement slot-locking UI/API, or (b) remove the field and the checks. |
| **Type** | Dead code |

### 2.2 [HIGH] `RecordStatus.ARCHIVED` is unreachable — **RESOLVED**

| Field | Value |
|---|---|
| **Files** | `prisma/schema.prisma:44`, `src/modules/coordinator/service.ts:74,254` |
| **Root cause** | ARCHIVED is a valid RecordStatus enum value, and the coordinator dashboard checks for it, but **no code in the entire codebase ever sets a bank's recordStatus to ARCHIVED**. The only mutation endpoints are lock (sets LOCKED) and unlock (sets ACTIVE). |
| **Evidence** | The `computeNextAction` function handles ARCHIVED (returns "Archived") and the attention items filter skips ARCHIVED. But nothing produces ARCHIVED. |
| **Impact** | Unreachable code path. If a bank needs to be archived (soft-deleted), there's no way to do it. |
| **Fix** | Either implement an archive endpoint, or remove ARCHIVED from the enum and the dead code. |
| **Resolution** | ARCHIVED removed from `RecordStatus` enum (migration `20260618000100`). `RecordStatus` now has only ACTIVE and LOCKED values. |
| **Type** | Dead code |

### 2.3 [MEDIUM] `creditLoad` vs `credits` naming inconsistency

| Field | Value |
|---|---|
| **Files** | `src/modules/coordinator/subject.service.ts:13,20,126,162`, `app/api/subjects/route.ts:40`, `app/api/subjects/[id]/route.ts:23` |
| **Root cause** | The form/API uses `credits`, the intermediate payload type uses `creditLoad`, then the Prisma call maps it back to `credits`. Three names for the same field across the request flow. |
| **Impact** | Confusing for developers. No runtime bug since the mapping is correct at each hop. |
| **Fix** | Normalize to `credits` everywhere: rename `creditLoad` to `credits` in `SubjectPayload` and `SubjectUpdatePayload`. |
| **Type** | Naming inconsistency |

### 2.4 [MEDIUM] `attachments: []` hardcoded empty array

| Field | Value |
|---|---|
| **Files** | `src/modules/coordinator/service.ts:395`, `src/modules/dashboard/service.ts:21` |
| **Root cause** | The coordinator question detail API returns `attachments: []` — a hardcoded empty array. The contributor dashboard mentions "Upload attachments" as a todo item. |
| **Impact** | Feature was planned but never built. The placeholder doesn't break anything but is misleading. |
| **Fix** | Remove the hardcoded empty array from the response. Remove "Upload attachments" from contributor dashboard if not implementing. |
| **Type** | Incomplete feature |

---

## 3. Workflow Validation

### 3.1 [HIGH] Unlock endpoint contradicts "locking is irreversible" design

| Field | Value |
|---|---|
| **Files** | `app/api/question-banks/[id]/unlock/route.ts`, `src/modules/question-banks/mutable-guard.ts`, `docs/WORKFLOW_GUIDE.md`, `PROJECT_HANDOFF.md:§5` |
| **Root cause** | The `mutable-guard.ts` and docs say locking is irreversible. But `POST /api/question-banks/[id]/unlock` exists (COORDINATOR role), sets `recordStatus: ACTIVE, lockedAt: null`, and has audit logging. The unlock route doesn't check if dean review was done or papers were exported. |
| **Impact** | A coordinator can unlock a bank after dean review, potentially replacing approved papers. No safeguards. |
| **Fix** | Either: (a) Remove the unlock endpoint (align with docs), or (b) Add guard: only COE can unlock, require dean review to be re-confirmed after unlock. |
| **Type** | Design contradiction |

### 3.2 [HIGH] `createSubject` validates `semesterNumber` but never writes it

| Field | Value |
|---|---|
| **Files** | `src/modules/coordinator/subject.service.ts:107,122-129` |
| **Root cause** | The `createSubject` method validates `semesterNumber` (line 107, throws if <1 or >8) but the `tx.subject.create()` call at line 122-129 does NOT include `semesterNumber` in the data object. Meanwhile `updateSubject` (line 161) DOES write it. |
| **Evidence** | Line 107: `if (payload.semesterNumber < 1 || payload.semesterNumber > 8) throw ...` — validates. Line 122-129: `tx.subject.create({ data: { subjectCode, subjectName, credits, status, questionBankDueDate, departmentId } })` — no semesterNumber. Line 161: `prisma.subject.update({ data: { ...(semesterNumber !== undefined ? { semesterNumber } : {}) } })` — DOES set it. |
| **Impact** | New subjects have NULL semesterNumber. The `listSubjects` filter by `semesterNumber` (line 51) never matches for newly created subjects. Existing subjects updated via `updateSubject` DO get the value, creating inconsistency. |
| **Fix** | Either: (a) Add `semesterNumber: payload.semesterNumber` to the create data (keep the column), or (b) Remove semesterNumber from the schema + remove all code references (align with CurriculumSubject being the canonical source). |
| **Type** | Real bug |

### 3.3 [MEDIUM] `createSubject` doesn't create a `CurriculumSubject` record

| Field | Value |
|---|---|
| **Files** | `src/modules/coordinator/subject.service.ts:119-148` |
| **Root cause** | Creating a subject creates a Subject record + SubjectVersion record, but does NOT create a CurriculumSubject record. The semester information is stored only on Subject (if written) and not in CurriculumSubject, which is supposed to be the canonical semester mapping. |
| **Impact** | Subjects created through the UI won't appear in curriculum subject listings. The exam cycle creation process queries CurriculumSubject to find subjects for a given semester — newly created subjects won't be found. |
| **Fix** | Create a CurriculumSubject record in the same transaction when creating a Subject. |
| **Type** | Incomplete design — likely a bug |

### 3.4 [LOW] `No cascade delete on QuestionBank → QuestionSlot`

| Field | Value |
|---|---|
| **Files** | `prisma/schema.prisma:282-313` (QuestionBank model), `prisma/schema.prisma:404-422` (QuestionSlot model) |
| **Root cause** | QuestionBank has no `onDelete: Cascade` relation to QuestionSlot. Deleting a bank would cause FK violation if slots reference it. Only 5 out of 37 models have cascade deletes. |
| **Impact** | Cannot delete a question bank without manually deleting all slots first. Not a problem in current workflow (banks are locked, not deleted), but would block any data cleanup. |
| **Fix** | Add `slots QuestionSlot[] @relation(onDelete: Cascade)` or handle in app-layer. |
| **Type** | Missing constraint |

---

## 4. Seed Compatibility

### 4.1 [CRITICAL] Seed fails on `Subject.create` due to schema drift

| Field | Value |
|---|---|
| **Files** | `prisma/seed.ts:278-283` |
| **Root cause** | Schema drift (see §1.1). The seed's `prisma.subject.create()` doesn't include `semesterNumber` because the Prisma client (generated from schema) doesn't have it. But the DB column requires it. |
| **Evidence** | `prisma/seed.ts:278-283`: `prisma.subject.create({ data: { subjectCode, subjectName, credits, questionBankDueDate, departmentId, status } })` — no semesterNumber. |
| **Impact** | Seed fails with P2011 on any database with migration #6 applied. |
| **Fix** | Fix the schema drift first (see §1.1), then seed works. |
| **Type** | Schema drift → seed failure |

### 4.2 [LOW] Seed duplicates `DEFAULT_PATTERNS` from service code

| Field | Value |
|---|---|
| **Files** | `prisma/seed.ts:18-20`, `src/modules/coordinator/question-bank.service.ts:249-255` |
| **Root cause** | Both the coordinator service and the seed define the same slot pattern constants. |
| **Impact** | If slot patterns change in one place but not the other, they diverge. |
| **Fix** | Extract to `src/lib/constants.ts` and import in both places. |
| **Type** | Code duplication |

---

## 5. Migration Integrity

### 5.1 [MEDIUM] Out-of-order migrations

| Field | Value |
|---|---|
| **Files** | `prisma/migrations/20260616000001_add_audit_log_actor_action_idx/` |
| **Root cause** | Migration #4 (`20260616000001`) contains both a `migration.sql` AND a `migration.json` file. All other migrations only have `migration.sql`. This is anomalous — Prisma generates `.json` files only in certain conditions. |
| **Impact** | Atypical but not necessarily broken. Prisma will apply the migration if the SQL is correct. |
| **Fix** | Verify the migration works. Either remove the .json or ensure it's correct. |
| **Type** | Minor inconsistency |

---

## 6. API/Route Issues

### 6.1 [LOW] Moderator assignment API path is deeply nested

| Field | Value |
|---|---|
| **Files** | `app/api/question-banks/[id]/assignments/moderator/route.ts` |
| **Root cause** | URL path: `/api/question-banks/{id}/assignments/moderator`. The `assignments` segment is unnecessary — there's only one assignment type (moderator). Contributors have no assignment endpoints. |
| **Impact** | Cosmetic. Makes the API surface more complex than needed. |
| **Fix** | Simplify to `/api/question-banks/{id}/moderator` or keep as-is for future extensibility. |
| **Type** | API design |

---

## 7. Additional Cleanup (June 2026 — outside original audit scope)

The following dead fields/enums were removed from runtime in migration `20260618000100`:

| Removed | Reason |
|---|---|
| `ReviewStatus` enum (PENDING, SUBMITTED, CONFIRMED) | Never read or updated |
| `DeanReview.status` field | State determined by record existence |
| `SnapshotType.APPROVED` and `SnapshotType.EXPORTED` | Only LOCKED used |
| `QuestionBankSnapshot.metadata` and `paperAssignments` | Never written |
| `PaperSnapshot.metadata` | Never written |

Additionally:
- `ContributorBankAssignment` model added (mirrors `ModeratorBankAssignment`)
- `QuestionLibraryService.update()` now guards against editing moderated questions
- `QuestionSlot.reservedById` deprecated at runtime (column kept, no code reads/writes)

---

## 8. Documentation Drift

### 7.1 [LOW] `docs/database.md` references `SemesterType` enum and `activeSemesterType` field

| Field | Value |
|---|---|
| **Files** | `docs/database.md:119,129,609` |
| **Root cause** | Documentation describes `activeSemesterType` and `SemesterType` enum that no longer exist in the schema or code. The schema was refactored but docs weren't updated. |
| **Impact** | Misleading for new developers. |
| **Fix** | Remove `SemesterType` and `activeSemesterType` references from docs. |
| **Type** | Documentation drift |

---

## 9. Test Coverage Gaps

| # | Issue | Sev | Files | Detail |
|---|---|---|---|---|
| 8.1 | No tests for question-bank lock/unlock | High | `app/api/question-banks/[id]/lock/route.ts`, `app/api/question-banks/[id]/unlock/route.ts` | The lock endpoint is critical exam integrity code. No tests verify it. |
| 8.2 | No tests for dean review | High | `src/modules/production/dean-review.service.ts` (445 lines) | Largest single service file. Zero coverage. |
| 8.3 | No tests for `QuestionSlotService` | Med | `src/modules/question-slots/service.ts` | Slot assignment is core to the question bank workflow. |
| 8.4 | No tests for `ReadinessEngine` | Med | `src/modules/readiness/engine.ts` | Gates all phase transitions. No tests. |
| 8.5 | No tests for paper generation fallback | Med | `src/modules/reports/paper-generator.ts` | The "insufficient inventory" error has no graceful fallback and no test coverage. |

---

## Safe Fix Order

This order ensures no workflow or migration is broken during the process.

### Phase 1: Fix Schema Drift (unblocks seed, fixes 3 critical/high issues)

```
1. Create migration: DROP Subject.semesterNumber + DROP INDEX
   → Fixes §1.1 (schema drift) and §4.1 (seed failure)
   → Run: prisma migrate deploy
   → Verify: npm run prisma:seed succeeds

2. Create migration: DROP AcademicYear.activeSemesterType
   → Fixes §1.2 (dead column)

3. Create migration: ADD UNIQUE constraints on ApprovalDecision + ExamCycle
   → Fixes §1.3 (missing unique constraints)
```

### Phase 2: Fix Subject/WF Code (fixes 3 high issues)

```
4. Fix createSubject: add semesterNumber to create data
   → OR: remove semesterNumber from SubjectPayload/SubjectUpdatePayload/filters
   → Fixes §2.3, §3.2 (creditLoad naming, createSubject bug)
   → Choose based on whether Subject keeps semesterNumber or drops it

5. Fix createSubject: add CurriculumSubject creation in transaction
   → Fixes §3.3 (subjects not appearing in curriculum)
```

### Phase 3: Resolve Design Contradictions (fixes 2 high issues)

```
6. Resolve unlock endpoint:
   → Either remove it (align with "irreversible lock" docs)
   → Or add safeguards (COE-only, dean review re-confirmation)
   → Fixes §3.1 (unlock contradiction)

7. Resolve isLocked on QuestionSlot:
   → Either implement slot locking UI/API
   → Or remove field and checks
   → Fixes §2.1 (dead code path)
```

### Phase 4: Clean Up (fixes 5 medium/low issues)

```
8. [DONE] Remove ARCHIVED from RecordStatus enum                     → §2.2
9. [DONE] Remove dead fields: ReviewStatus, DeanReview.status,
    SnapshotType values, metadata fields                             → §7
10. Remove hardcoded attachments: [] and "Upload attachments"         → §2.4
11. Extract DEFAULT_PATTERNS to shared constants                      → §4.2
12. Add cascade delete on QuestionBank → QuestionSlot                → §3.4
13. Update docs/database.md (remove SemesterType/activeSemesterType)  → §7.1
```

### Phase 5: Testing (adds missing coverage)

```
13. Add tests for: lock/unlock, dean review, slot assignment,
    ReadinessEngine, paper generator fallback
    → Fixes §8.1-8.5
```

---

*End of audit report. 17 issues found: 2 critical, 6 high, 5 medium, 4 low.*
