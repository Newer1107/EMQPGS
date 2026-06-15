# ExamCycle Academic Alignment — Migration Report

---

## Summary

ExamCycle was the last model storing academic information as primitive values (`academicYear` string, `semester` integer). After this refactor, ExamCycle uses relational references to `AcademicYear` and `Semester`, eliminating the duplicate source of truth.

---

## Modified Model: ExamCycle

### Fields Removed

| Field | Type | Reason |
|---|---|---|
| `academicYear` | String | Replaced by `academicYearId` FK |
| `semester` | Int | Replaced by `semesterId` FK |

### Fields Added

| Field | Type | Relation |
|---|---|---|
| `academicYearId` | String (required) | FK → AcademicYear |
| `semesterId` | String (required) | FK → Semester |

### Relations Added

| Relation | Target | Type |
|---|---|---|
| `academicYear` | AcademicYear | belongsTo |
| `semester` | Semester | belongsTo |

### Model Semantics

- `ExamCycle.academicYearId` → `AcademicYear.id`
- `ExamCycle.semesterId` → `Semester.id`
- `Semester` already has `academicYearId` → `AcademicYear.id`, so the chain is fully navigable

### Unique Constraint Changed

| Before | After |
|---|---|
| `@@unique([academicYear, semester, examType])` | `@@unique([semesterId, examType])` |

The new constraint is functionally equivalent because `Semester` already has `@@unique([academicYearId, number])` — a `semesterId` uniquely identifies both the semester number and its academic year.

---

## Validation Rules Added

- `academicYearId` and `semesterId` are required in the Zod schema
- Semester must exist and belong to the specified AcademicYear — validated in `ExamCycleService.create()` and `ExamCycleService.update()`
- If the semester's `academicYearId` doesn't match the provided `academicYearId`, the request is rejected with a 400 error

---

## Modified Services

### ExamCycleService

- Unique constraint key changed from `ExamCycle_academicYear_semester_examType_key` to `ExamCycle_semesterId_examType_key`
- `create()` validates the semester → academicYear relationship before proceeding
- `update()` validates the relationship when `semesterId` or `academicYearId` is being changed

### ExamCycleRepository

- `list()` and `findById()` now include `academicYear` and `semester` relations

### All Services Reading ExamCycle Data

Every Prisma query that previously used `examCycle: true` or `{ select: { academicYear: true, semester: true, ... } }` now uses `{ include: { academicYear: true, semester: true } }` or equivalent nested selects. This ensures the related data is available for display formatting.

**Affected service files:**
- `coordinator/service.ts`
- `coordinator/question-bank.service.ts`
- `coordinator/subject.service.ts`
- `moderation/service.ts`
- `moderation/dashboard.service.ts`
- `reports/ai-report.service.ts`
- `reports/paper.service.ts`
- `reports/paper-generator.ts`
- `production/dean-review.service.ts`
- `production/export.service.ts`
- `lib/server-data.ts`

---

## Modified Route Handlers

### ExamCycle Routes

No structural changes — `POST /api/exam-cycles` and `PATCH /api/exam-cycles/[id]` accept `academicYearId` and `semesterId` instead of `academicYear` and `semester`.

### Validation Schema

| Before | After |
|---|---|
| `academicYear: z.string().regex(...)` | `academicYearId: z.string().min(1)` |
| `semester: z.coerce.number().int().min(1).max(8)` | `semesterId: z.string().min(1)` |

---

## Modified UI Components

### ExamCycleTimetableManager

- Removed: `semesterOptions` static array, `academicYear` text input, `semester` number input
- Added: AcademicYear dropdown, Semester dropdown (filtered by selected AcademicYear, loaded via API call)
- Form state uses `academicYearId` and `semesterId` instead of `academicYear` (string) and `semester` (string)
- List view shows `academicYear.code` and `semester.name` instead of raw values

### Other Components Updated For Display

| Component | Change |
|---|---|
| `assignments-manager.tsx` | `semester.name` + `academicYear.code` instead of raw values |
| `moderation-workspace.tsx` | `semester.name` + `academicYear.code` instead of raw values |
| `workspace.tsx` | `semester.name` + `academicYear.code` instead of raw values |
| `export-console.tsx` | `academicYear.code` instead of raw string |

---

## Modified Pages

| Page | Change |
|---|---|
| `coe/exam-cycles/page.tsx` | Fetches `academicYears` separately; passes academicYear/semester relations to component |
| `coordinator/question-banks/page.tsx` | `semester.name` + `academicYear.code` display; includes relations in Prisma query |
| `coordinator/subjects/page.tsx` | `semester.name` + `academicYear.code` display |
| `contributor/my-subjects/page.tsx` | `semester.name` + `academicYear.code` display |

---

## Seed Data Updated

ExamCycle creation now uses `academicYearId` and `semesterId`:
```typescript
await prisma.examCycle.create({
  data: {
    academicYearId: academicYear.id,
    semesterId: semester5.id,
    examType: ExamType.ENDSEM,
    ...
  },
});
```

Unique constraint for upsert uses `semesterId_examType` instead of `academicYear_semester_examType`.

---

## Architecture Diagram

```
AcademicYear               AcademicYear
│                          │
├── Semester               ├── Semester
│   │                      │   │
│   ├── Subject            │   └── ExamCycle
│   │   └── SubjectVersion │       └── QuestionBank
│   │                      │
│   └── ExamCycle ─────────┘ (Semester.academicYearId = AcademicYear.id)
│       └── QuestionBank
│
└── Semester (N semesters per year)
```

### Data Flow

```
AcademicYear (e.g. "2026-2027")
  └── Semester (e.g. "Semester V", number 5)
      ├── Subject (e.g. "Advanced Algorithms")
      │   └── SubjectVersion (v1)
      └── ExamCycle (e.g. "ENDSEM November 2026")
          └── QuestionBank
```

---

## Build & Test Results

| Check | Result |
|---|---|
| Build (TypeScript) | Passed |
| Build (Turbopack) | Compiled successfully |
| Tests | 18/18 files, 131/131 tests passing |
| Seed | Ran successfully |

---

## File Change Summary

| Category | Count |
|---|---|
| Modified Prisma models | 1 (ExamCycle — 2 fields removed, 2 added, 2 relations added) |
| Modified repositories | 1 (ExamCycleRepository) |
| Modified services | 1 (ExamCycleService — validation, unique key) |
| Modified service Prisma queries | 10 files (updated includes/selects) |
| Modified route handlers | 0 (payload passes through) |
| Modified validation | 1 (examCycleSchema) |
| Modified UI components | 5 (timetable, workspace, moderation-workspace, assignments-manager, export-console) |
| Modified pages | 4 (COE exam-cycles, contributor my-subjects, coordinator question-banks, coordinator subjects) |
| Modified seed | 1 (seed.ts) |
| Modified test fixtures | 0 (existing tests unchanged) |
