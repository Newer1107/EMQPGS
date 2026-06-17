# Domain Refinement — Architecture Changes

> Last updated: 2026-06-18
> Migration: `20260617192737_refine_academic_domain`

---

## 1. What Changed and Why

### 1.1 BatchSemester: Removed Hardcoded Date Generation

**Before:** Batch creation automatically computed semester dates:
```typescript
// Fixed June/January assumptions
startDate = odd semesters ? June 1 : January 1
endDate = startDate + 6 months
```

**After:** BatchSemesters are created with `startDate: null, endDate: null`. The COE manually configures dates later.

**Why:** Not all colleges follow a June–May academic calendar. Some start in July, August, or September. Hardcoding calendar assumptions makes the system unusable for those colleges.

**Validation added:**
- `endDate > startDate` (when both are set)
- No overlap between semesters of the same batch (when dates are set)

### 1.2 TeachingGroup: Became a Real Entity

**Before:**
```prisma
model TeachingGroup {
  id          String
  batchId     String
  groupNumber Int      // 1 or 2
}
```

**After:**
```prisma
model TeachingGroup {
  id          String
  batchId     String
  groupNumber Int      // 1 or 2
  name        String   // e.g. "Physics Group"
  description String?  // optional notes
  isActive    Boolean  // default true
}
```

**Why:** Groups have real names in colleges ("Physics Group", "Chemistry Lab Group"). Naming is batch-specific. Hardcoding "Group 1" and "Group 2" makes the UI confusing for staff.

### 1.3 CurriculumSubject: Removed Operational Data

**Before:**
```prisma
model CurriculumSubject {
  ...
  questionBankDueDate DateTime?   // ← removed
}
```

**After:** CurriculumSubject contains only curriculum placement data (subject, semester, academic unit, group). No operational deadlines.

**Why:** "Curriculum should describe the curriculum, not operational scheduling." Due dates are an operational concern that belongs closer to the execution layer.

**Future home for questionBankDueDate:** When ExamCycle becomes batch-aware, add the due date to `SubjectExamCycleLink` or to a future `ExamCycle.subjectConfiguration` JSON field. The existing `Subject.questionBankDueDate` (legacy) still exists as a fallback.

### 1.4 Programme: Added isActive

**Before:** Programme had no active/inactive state.

**After:**
```prisma
model Programme {
  ...
  isActive Boolean @default(true)
}
```

**Why:** Allows deactivating old programmes without deleting them. Prevents creating batches/curriculum schemes for retired programmes.

### 1.5 BatchSemester: Navigation Helpers

Added centralized progression methods to `BatchSemesterService`:

| Method | Description |
|--------|-------------|
| `getPrevious(batchId, semesterNumber)` | Returns the semester before this one |
| `getNext(batchId, semesterNumber)` | Returns the semester after this one |
| `getFirst(batchId)` | Returns semester 1 for the batch |
| `getLast(batchId)` | Returns the last semester for the batch |

**Why:** Prevents duplication of "find the next semester" logic across coordinators, COE dashboards, and future ExamCycle auto-generation code.

### 1.6 Domain Validation Rules Added

| Rule | Location | Trigger |
|------|----------|---------|
| Inactive AcademicUnit → reject Programme creation | `ProgrammeService.create()` | Checks `homeAcademicUnit.isActive` and `firstYearAcademicUnit.isActive` |
| Inactive Programme → reject Batch creation | `BatchService.create()` | Checks `programme.isActive` |
| Inactive CurriculumScheme → reject Batch creation | `BatchService.create()` | Checks `curriculumScheme.isActive` |
| Inactive CurriculumScheme → reject CurriculumSubject creation | `CurriculumSubjectService.create()` | Checks `scheme.isActive` |
| Inactive AcademicUnit → reject CurriculumSubject creation | `CurriculumSubjectService.create()` | Checks `academicUnit.isActive` |
| Invalid semester progression (UPCOMING → COMPLETED) | `BatchSemesterService.activate()` | Rejects activation of completed semesters |
| Overlapping semester dates | `BatchSemesterService.update()` / `updateDates()` | Checks all other semesters of same batch |
| Duplicate teaching groups | `TeachingGroupService.create()` | Unique constraint + service check |

---

## 2. Schema Changes (Migration Summary)

**Migration:** `20260617192737_refine_academic_domain`

| Table | Change | Type |
|-------|--------|------|
| `BatchSemester` | `startDate` DateTime → nullable | ALTER |
| `BatchSemester` | `endDate` DateTime → nullable | ALTER |
| `CurriculumSubject` | Removed `questionBankDueDate` column | DROP |
| `Programme` | Added `isActive` boolean (default true) | ADD |
| `TeachingGroup` | Added `name` string (required) | ADD |
| `TeachingGroup` | Added `description` string? (optional) | ADD |
| `TeachingGroup` | Added `isActive` boolean (default true) | ADD |

No existing data is modified (except the dropped column on CurriculumSubject, which had no data in practice).

---

## 3. Before vs After Diagrams

### BatchSemester Date Flow (Before)

```
Batch Create
  → computeStartDate(admissionYear, sem) → June 1 or January 1
  → computeEndDate(startDate) → startDate + 6 months
  → Create BatchSemester with hardcoded dates
```

### BatchSemester Date Flow (After)

```
Batch Create
  → Create BatchSemester with startDate: null, endDate: null
  → COE manually sets dates via PATCH /api/batch-semesters/[id]
  → Validation:
    - endDate > startDate
    - No overlap with other semesters of same batch
```

### TeachingGroup (Before vs After)

```
Before: { groupNumber: 1 }      → "Group 1"
After:  { groupNumber: 1,        → "Physics Group"
          name: "Physics Group",
          description: "Divisions A and B" }
```

### CurriculumSubject (Before vs After)

```
Before: { subject, semester, unit, group, questionBankDueDate }
After:  { subject, semester, unit, group }  // pure curriculum
```

---

## 4. Future Extensibility

| Future Need | How the current design supports it |
|-------------|-----------------------------------|
| Different calendar start months | Nullable dates. COE sets whatever dates match the college calendar. |
| Non-standard semester durations | No hardcoded duration. Each semester has independent start/end dates. |
| Programme retirement | `isActive` flag on Programme. Inactive programmes reject new batches. |
| Group naming per batch | `name` field on TeachingGroup. Each batch can name its groups independently. |
| Multiple active batches per academic year | BatchSemester.academicYearId supports it. No global semester instances. |
| ExamCycle auto-generation from BatchSemester | Navigation helpers (getNext, getFirst, etc.) are centralized for future use. |

---

## 5. Remaining Limitations

| Limitation | Why it exists | Future fix |
|------------|---------------|------------|
| TeachingGroup still limited to 2 groups | Business requirement confirmed. No college has >2 groups in first year. | Extend enum/add more group numbers. |
| `BatchSemester` progression is manual (activate → complete) | No auto-advance based on dates. COE must click buttons. | Add a scheduler or webhook in a future phase. |
| `questionBankDueDate` removed with no replacement | Belongs on SubjectExamCycleLink or ExamCycle config, which doesn't exist yet. | Add when ExamCycle becomes batch-aware. |
| No automatic TeachingGroup creation | COE must create groups after batch creation. | Add auto-creation in BatchService.create() when first-year has groups. |
| `Subject.semesterNumber` still exists (legacy) | Not removed to avoid breaking existing queries. | Remove in a future migration when no code depends on it. |

---

## 6. Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | BatchSemester: nullable dates; TeachingGroup: name/description/isActive; CurriculumSubject: removed questionBankDueDate; Programme: isActive |
| `src/lib/db-helpers.ts` | (unchanged in this pass — new constraints already covered) |
| `src/modules/batches/service.ts` | Removed date computation functions; null dates; inactive programme/scheme validation |
| `src/modules/batch-semesters/service.ts` | Added getPrevious/getNext/getFirst/getLast navigation; added validateNoOverlap; updated progression checks |
| `src/modules/batch-semesters/repository.ts` | Added findByBatchAndNumber, findFirst, findLast methods |
| `src/modules/batch-semesters/validation.ts` | (unchanged — already supported null dates) |
| `src/modules/teaching-groups/validation.ts` | Added name, description, isActive to schema; added updateSchema |
| `src/modules/teaching-groups/service.ts` | Added update method; added inactive batch validation; name support in bulkCreate |
| `src/modules/teaching-groups/repository.ts` | Added update method |
| `src/modules/programmes/validation.ts` | Added isActive to schema |
| `src/modules/programmes/service.ts` | Added create-time validation: active home unit + active first year unit |
| `src/modules/curriculum-subjects/validation.ts` | Removed questionBankDueDate |
| `src/modules/curriculum-subjects/service.ts` | Added create-time validation: active scheme + active academic unit |
| `app/api/teaching-groups/route.ts` | Updated POST handler for new schema (single vs bulk dispatch) |
| `app/api/teaching-groups/[id]/route.ts` | Added PATCH handler |

### New Migration

| File | Purpose |
|------|---------|
| `prisma/migrations/20260617192737_refine_academic_domain/migration.sql` | Schema changes |

---

## 7. Verification

| Check | Result |
|-------|--------|
| `prisma validate` | Schema valid |
| `prisma migrate status` | Up to date |
| `npm run build` | Compiled successfully |
| `npm run test` | 112/113 pass (1 pre-existing CSRF test failure) |
| QuestionBank pipeline tests | All pass |
| New validation rules | All compile and are wired in service methods |
