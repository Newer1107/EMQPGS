# Academic Domain — Backend Services

> Last updated: 2026-06-18
> Phase: Foundation (pre-ExamCycle integration)

---

## Architecture Overview

Seven independent modules implementing the academic domain. Each module follows the established pattern: `service.ts`, `repository.ts`, `validation.ts`, and API routes. Modules are independent of the existing QuestionBank pipeline and can be consumed later by ExamCycle.

```
AcademicUnit         → Programme → CurriculumScheme → CurriculumSubject
                                                            │
                                                      Subject (existing)
                                                            │
Batch → BatchSemester (auto-created)                  TeachingGroup
```

---

## 1. AcademicUnit Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/academic-units/service.ts` |
| Repository | `src/modules/academic-units/repository.ts` |
| Validation | `src/modules/academic-units/validation.ts` |
| List/Create | `app/api/academic-units/route.ts` |
| Get/Update/Delete | `app/api/academic-units/[id]/route.ts` |

### Schema

```
AcademicUnit {
  id: String (cuid, PK)
  name: String
  code: String (unique)
  type: AcademicUnitType (ES_H | DEPARTMENT)
  hodName: String
  isActive: Boolean (default: true)
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Code must be unique | Unique constraint + service check |
| Cannot delete if referenced | Checks for `Programme.homeAcademicUnitId` and `CurriculumSubject.academicUnitId` references |
| Soft delete | Sets `isActive = false` instead of hard delete when references exist |
| ES&H vs DEPARTMENT | Distinguished by `AcademicUnitType` enum |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/academic-units` | COE, COORDINATOR | List all academic units |
| POST | `/api/academic-units` | COE | Create academic unit |
| GET | `/api/academic-units/[id]` | COE, COORDINATOR | Get academic unit by ID |
| PATCH | `/api/academic-units/[id]` | COE | Update academic unit |
| DELETE | `/api/academic-units/[id]` | COE | Deactivate academic unit |

---

## 2. Programme Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/programmes/service.ts` |
| Repository | `src/modules/programmes/repository.ts` |
| Validation | `src/modules/programmes/validation.ts` |
| List/Create | `app/api/programmes/route.ts` |
| Get/Update/Delete | `app/api/programmes/[id]/route.ts` |

### Schema

```
Programme {
  id: String (cuid, PK)
  name: String
  code: String (unique)
  degreeType: DegreeType (BE | BTECH | MTECH | PHD | DIPLOMA)
  durationYears: Int (default: 4)
  durationSemesters: Int (default: 8)
  homeAcademicUnitId: String (FK → AcademicUnit, required)
  firstYearAcademicUnitId: String? (FK → AcademicUnit, optional)
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Must have a home AcademicUnit | Required FK constraint |
| First-year unit is optional | Nullable FK |
| Code must be unique | Unique constraint |
| Cannot delete if referenced | Checks for `CurriculumScheme` and `Batch` references |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/programmes` | COE, COORDINATOR | List all programmes (includes home/firstYear AcademicUnit) |
| POST | `/api/programmes` | COE | Create programme |
| GET | `/api/programmes/[id]` | COE, COORDINATOR | Get programme detail |
| PATCH | `/api/programmes/[id]` | COE | Update programme |
| DELETE | `/api/programmes/[id]` | COE | Delete programme (if no references) |

---

## 3. CurriculumScheme Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/curriculum-schemes/service.ts` |
| Repository | `src/modules/curriculum-schemes/repository.ts` |
| Validation | `src/modules/curriculum-schemes/validation.ts` |
| List/Create | `app/api/curriculum-schemes/route.ts` |
| Get/Update/Delete | `app/api/curriculum-schemes/[id]/route.ts` |

### Schema

```
CurriculumScheme {
  id: String (cuid, PK)
  programmeId: String (FK → Programme)
  name: String
  year: Int
  isActive: Boolean (default: true)
  @@unique([programmeId, year])
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| One scheme per programme per year | Unique constraint |
| Only one active per programme | Service deactivates all others when `isActive = true` is set |
| Cannot delete if referenced | Checks for `CurriculumSubject` and `Batch` references |
| List by programme | Query param `?programmeId=` on GET |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/curriculum-schemes` | COE, COORDINATOR | List all schemes (or filter by `?programmeId=`) |
| POST | `/api/curriculum-schemes` | COE | Create scheme (auto-handles active state) |
| GET | `/api/curriculum-schemes/[id]` | COE, COORDINATOR | Get scheme detail with subjects |
| PATCH | `/api/curriculum-schemes/[id]` | COE | Update scheme |
| DELETE | `/api/curriculum-schemes/[id]` | COE | Delete scheme (if no references) |

---

## 4. CurriculumSubject Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/curriculum-subjects/service.ts` |
| Repository | `src/modules/curriculum-subjects/repository.ts` |
| Validation | `src/modules/curriculum-subjects/validation.ts` |
| List/Create | `app/api/curriculum-subjects/route.ts` |
| Get/Update/Delete | `app/api/curriculum-subjects/[id]/route.ts` |

### Schema

```
CurriculumSubject {
  id: String (cuid, PK)
  curriculumSchemeId: String (FK → CurriculumScheme)
  subjectId: String (FK → Subject)
  semesterNumber: Int (1-8)
  academicUnitId: String (FK → AcademicUnit)
  groupAssignment: GroupAssignment (ALL | GROUP_1 | GROUP_2)
  questionBankDueDate: DateTime?
  @@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Semester must be 1-8 | Zod validation |
| Subject must exist | FK to Subject (existing model) |
| No duplicate placement | Unique constraint on (scheme, subject, sem, group) |
| Subject.semesterNumber is IGNORED | New services use CurriculumSubject.semesterNumber exclusively |
| Subject can appear multiple times | A subject can be in multiple semesters, schemes, or group assignments |
| Group assignment is on THIS entity | NOT on ExamCycle |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/curriculum-subjects` | COE, COORDINATOR | List with optional filters (`?curriculumSchemeId=`, `?semesterNumber=`, `?academicUnitId=`, `?subjectId=`, `?groupAssignment=`) |
| POST | `/api/curriculum-subjects` | COE | Create curriculum subject |
| GET | `/api/curriculum-subjects/[id]` | COE, COORDINATOR | Get detail |
| PATCH | `/api/curriculum-subjects/[id]` | COE | Update |
| DELETE | `/api/curriculum-subjects/[id]` | COE | Delete |

---

## 5. Batch Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/batches/service.ts` |
| Repository | `src/modules/batches/repository.ts` |
| Validation | `src/modules/batches/validation.ts` |
| List/Create | `app/api/batches/route.ts` |
| Get/Update/Delete | `app/api/batches/[id]/route.ts` |

### Schema

```
Batch {
  id: String (cuid, PK)
  name: String
  code: String (unique)
  programmeId: String (FK → Programme)
  curriculumSchemeId: String (FK → CurriculumScheme)
  admissionYear: Int
  graduationYear: Int
  status: BatchStatus (ACTIVE | GRADUATED)
}
```

### BatchSemester Auto-Creation

When a Batch is created, the service automatically creates `n` BatchSemester records (where `n = programme.durationSemesters`):

```
For sem = 1 to programme.durationSemesters:
  academicUnitId = (sem <= 2 && programme.firstYearAcademicUnitId)
    ? programme.firstYearAcademicUnitId
    : programme.homeAcademicUnitId

  academicYear = lookup AcademicYear by code computed from batch.admissionYear + offset
    offset = floor((sem - 1) / 2) → 0, 0, 1, 1, 2, 2...

  startDate = computed from admissionYear + offset:
    odd semesters → June 1 of academic year
    even semesters → January 1 within academic year

  endDate = startDate + ~6 months

  status = "UPCOMING"
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Graduation year > admission year | Service validation |
| Code must be unique | Unique constraint |
| Academic years must exist | Service validates before creating batch semesters |
| Batch is a cohort descriptor | NO student table exists |
| Cannot create BatchSemesters manually | Auto-generated during Batch creation |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/batches` | COE, COORDINATOR | List batches (filter by `?programmeId=`) |
| POST | `/api/batches` | COE | Create batch (auto-creates BatchSemesters) |
| GET | `/api/batches/[id]` | COE, COORDINATOR | Get batch detail with semesters and groups |
| PATCH | `/api/batches/[id]` | COE | Update batch |
| DELETE | `/api/batches/[id]` | COE | Delete batch |

---

## 6. BatchSemester Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/batch-semesters/service.ts` |
| Repository | `src/modules/batch-semesters/repository.ts` |
| Validation | `src/modules/batch-semesters/validation.ts` |
| List | `app/api/batch-semesters/route.ts` |
| Get/Update/Activate/Complete | `app/api/batch-semesters/[id]/route.ts` |

### Schema

```
BatchSemester {
  id: String (cuid, PK)
  batchId: String (FK → Batch)
  semesterNumber: Int (1-8)
  academicYearId: String (FK → AcademicYear)
  academicUnitId: String (FK → AcademicUnit)
  startDate: DateTime
  endDate: DateTime
  status: BatchSemesterStatus (UPCOMING | ACTIVE | COMPLETED)
  @@unique([batchId, semesterNumber])
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Never manually created | Generated by Batch creation |
| Status lifecycle | UPCOMING → ACTIVE → COMPLETED (sequential) |
| Cannot activate completed | Service check |
| Active semesters queryable by unit | `?academicUnitId=` filter for coordinators |
| End date after start date | Service validation for manual date updates |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/batch-semesters` | COE, COORDINATOR | List by `?batchId=` or active by `?academicUnitId=` |
| GET | `/api/batch-semesters/[id]` | COE, COORDINATOR | Get semester detail |
| PATCH | `/api/batch-semesters/[id]` | COE | Update semester dates/status/unit |
| POST | `/api/batch-semesters/[id]?action=activate` | COE | Activate semester |
| POST | `/api/batch-semesters/[id]?action=complete` | COE | Complete semester |

---

## 7. TeachingGroup Module

### Files

| File | Path |
|------|------|
| Service | `src/modules/teaching-groups/service.ts` |
| Repository | `src/modules/teaching-groups/repository.ts` |
| Validation | `src/modules/teaching-groups/validation.ts` |
| List/Create | `app/api/teaching-groups/route.ts` |
| Get/Delete | `app/api/teaching-groups/[id]/route.ts` |

### Schema

```
TeachingGroup {
  id: String (cuid, PK)
  batchId: String (FK → Batch)
  groupNumber: Int (1 or 2)
  @@unique([batchId, groupNumber])
}
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Only 2 groups maximum | Zod validation (1 or 2) |
| No duplicate groups per batch | Unique constraint |
| TeachingGroup only records EXISTENCE | Subject-to-group mapping is on CurriculumSubject.groupAssignment |
| Bulk creation | Accepts `{ batchId, groupNumbers: [1, 2] }` to create both at once |

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/teaching-groups?batchId=` | COE, COORDINATOR | List groups for a batch |
| POST | `/api/teaching-groups` | COE | Create one or both groups (single or bulk) |
| GET | `/api/teaching-groups/[id]` | COE, COORDINATOR | Get detail |
| DELETE | `/api/teaching-groups/[id]` | COE | Delete group |

---

## Future ExamCycle Integration

This section explains how these services will connect to the existing QuestionBank workflow — without requiring another redesign.

### Phase 1: Add `batchId` and `academicUnitId` to ExamCycle (next implementation phase)

Add nullable fields to the existing `ExamCycle` model:

```prisma
model ExamCycle {
  // existing fields stay
  batchId         String?   // NEW: FK → Batch
  semesterNumber  Int?      // NEW: replaces Semester FK
  academicUnitId  String?   // NEW: FK → AcademicUnit
  groupNumber     Int?      // NEW: 0=ALL, 1=GROUP_1, 2=GROUP_2 (from ExamCycle's perspective)
}
```

No existing data is affected — old rows have NULL. New ExamCycles optionally reference Batch.

### Phase 2: Auto-create ExamCycles from BatchSemester

When `BatchSemesterService.activate(id)` is called, the system auto-generates standard exam cycles:

```
On BatchSemester activation:
  schemeId = batch.curriculumSchemeId
  subjects = CurriculumSubject.find({ schemeId, semesterNumber, academicUnitId })
  for each examType [ISE_1, ISE_2, ENDSEM]:
    create ExamCycle(batchId, semesterNumber, academicUnitId, examType, groupNumber=0)
    for each subject with groupAssignment='ALL':
      create SubjectExamCycleLink
    for each group [1, 2] (if TeachingGroup exists for batch):
      create ExamCycle(batchId, semNumber, unitId, examType, groupNumber=group)
      for each subject with groupAssignment=group:
        create SubjectExamCycleLink
```

The coordinator can override by manually adding/removing SubjectExamCycleLinks.

### Phase 3: QuestionBank becomes batch-aware

The navigation chain changes from:

```
QuestionBank → ExamCycle → Semester → AcademicYear
```

To:

```
QuestionBank → ExamCycle → Batch (via batchId)
                          → AcademicUnit (via academicUnitId)
                          → semesterNumber (scalar)
```

### Data Flow for Reports

```
QuestionBank discovery by Batch:
  QuestionBank → ExamCycle.batchId → Batch

QuestionBank discovery by Programme:
  QuestionBank → Subject → CurriculumSubject → CurriculumScheme → Programme

QuestionBank discovery by AcademicYear:
  QuestionBank → ExamCycle.batchId → Batch → BatchSemester.academicYearId → AcademicYear

  OR (legacy path):
  QuestionBank → ExamCycle.academicYearId → AcademicYear
```

### What does NOT change

- QuestionBank.slots (unchanged — still 63 or 126 per PaperPattern)
- QuestionBank.phase transitions (unchanged)
- Moderation, approval, paper generation, dean review — all stable
- SubjectExamCycleLink (unchanged — it's the bridge)

---

## File Inventory

### New Source Files (21 files)

| File | Lines |
|------|-------|
| `src/modules/academic-units/service.ts` | ~50 |
| `src/modules/academic-units/repository.ts` | ~50 |
| `src/modules/academic-units/validation.ts` | ~15 |
| `app/api/academic-units/route.ts` | ~18 |
| `app/api/academic-units/[id]/route.ts` | ~35 |
| `src/modules/programmes/service.ts` | ~45 |
| `src/modules/programmes/repository.ts` | ~50 |
| `src/modules/programmes/validation.ts` | ~15 |
| `app/api/programmes/route.ts` | ~18 |
| `app/api/programmes/[id]/route.ts` | ~35 |
| `src/modules/curriculum-schemes/service.ts` | ~55 |
| `src/modules/curriculum-schemes/repository.ts` | ~70 |
| `src/modules/curriculum-schemes/validation.ts` | ~15 |
| `app/api/curriculum-schemes/route.ts` | ~22 |
| `app/api/curriculum-schemes/[id]/route.ts` | ~35 |
| `src/modules/curriculum-subjects/service.ts` | ~55 |
| `src/modules/curriculum-subjects/repository.ts` | ~70 |
| `src/modules/curriculum-subjects/validation.ts` | ~22 |
| `app/api/curriculum-subjects/route.ts` | ~22 |
| `app/api/curriculum-subjects/[id]/route.ts` | ~35 |
| `src/modules/batches/service.ts` | ~100 |
| `src/modules/batches/repository.ts` | ~65 |
| `src/modules/batches/validation.ts` | ~15 |
| `app/api/batches/route.ts` | ~22 |
| `app/api/batches/[id]/route.ts` | ~35 |
| `src/modules/batch-semesters/service.ts` | ~55 |
| `src/modules/batch-semesters/repository.ts` | ~35 |
| `src/modules/batch-semesters/validation.ts` | ~15 |
| `app/api/batch-semesters/route.ts` | ~16 |
| `app/api/batch-semesters/[id]/route.ts` | ~40 |
| `src/modules/teaching-groups/service.ts` | ~40 |
| `src/modules/teaching-groups/repository.ts` | ~40 |
| `src/modules/teaching-groups/validation.ts` | ~15 |
| `app/api/teaching-groups/route.ts` | ~22 |
| `app/api/teaching-groups/[id]/route.ts` | ~22 |

### Modified Files (1 file)

| File | Change |
|------|--------|
| `src/lib/db-helpers.ts` | Added unique constraint messages for 6 new entities |

**Total: ~1,250 lines of new code across 36 files.**

---

## Verification Results

| Check | Result |
|-------|--------|
| `prisma validate` | Passed |
| `prisma migrate status` | Database is up to date |
| `npm run build` | Compiled successfully |
| `npm run test` | 112/113 passed (1 pre-existing CSRF test failure) |
| Existing QuestionBank tests | All pass |
| New API routes registered | 14 new routes verified in build output |
| Existing API routes untouched | All ~50 existing routes still present |
