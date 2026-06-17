# ExamCycle v2 — Simplified Domain

> Last updated: 2026-06-18
> Domain simplification: `20260617202534_simplify_exam_cycle_domain`

---

## Design Principle

ExamCycle stores exactly ONE piece of academic context: `batchSemesterId`.
Everything else is derived through relations.

**Removed redundant fields:**
- ~~`batchId`~~ → derived from `batchSemester.batchId`
- ~~`semesterNumber`~~ → derived from `batchSemester.semesterNumber`
- ~~`academicUnitId`~~ → derived from `batchSemester.academicUnitId`
- ~~`groupNumber`~~ → derived from linked `CurriculumSubject.groupAssignment`

## Entity Relationship Diagram

```
Batch
  └── BatchSemester (1..N)
       ├── batchId ──→ Batch
       ├── semesterNumber (1-8)
       ├── academicUnitId ──→ AcademicUnit
       │
       └── ExamCycle (0..N)
            ├── batchSemesterId ──→ BatchSemester  ← SOLE ACADEMIC CONTEXT
            ├── examType (ISE_1, ISE_2, ENDSEM, ...)
            ├── status (DRAFT → ACTIVE → CLOSED)
            │
            └── SubjectExamCycleLink (1..N)
                 └── Subject (1)
                      ├── QuestionBank (1)
                      │    ├── QuestionSlot[]
                      │    │    └── QuestionLibraryItem
                      │    ├── Moderation, Approval, Paper Generation
                      │    └── ...
                      └── CurriculumSubject (0..N)
                           ├── curriculumSchemeId
                           ├── semesterNumber
                           ├── academicUnitId
                           └── groupAssignment (ALL|GROUP_1|GROUP_2)
```

## Source of Truth

| Concept | Source | Why |
|---------|--------|-----|
| Batch identity | `BatchSemester.batchId` | ExamCycle references BatchSemester, not Batch directly |
| Semester number | `BatchSemester.semesterNumber` | Single source, not duplicated on ExamCycle |
| Academic Unit | `BatchSemester.academicUnitId` | Single source, not duplicated on ExamCycle |
| Teaching Group | `CurriculumSubject.groupAssignment` | Group is a property of subject placement, not of exam cycles |
| Subjects in an exam | `SubjectExamCycleLink` | Join table links subjects to exam cycle |

## Creation Workflow

```
COE selects:
  Batch Semester (from the batch's timeline)
  ↓
  Exam Type (ISE_1, ISE_2, ENDSEM, ...)
  ↓
SYSTEM discovers subjects from CurriculumSubject:
  WHERE curriculumSchemeId = BatchSemester.batch.curriculumSchemeId
  AND semesterNumber = BatchSemester.semesterNumber
  AND academicUnitId = BatchSemester.academicUnitId
  (ALL group assignments included)
  ↓
SYSTEM creates:
  ExamCycle with batchSemesterId + examType + timetable
  SubjectExamCycleLink for each discovered subject
  ↓
COE confirms / adds / removes subjects
```

## API

```json
POST /api/exam-cycles
{
  "batchSemesterId": "...",
  "examType": "ENDSEM",
  "timetableDocumentRef": "...",
  "timetableIssueDate": "2027-11-01",
  "timetableTitle": "ENDSEM November 2027",
  "timetableRows": [...],
  "timetableSignature": "...",
  "subjectOverrides": ["optional-subject-ids"]
}
```

## Query Paths

| Question | Query |
|---|---|
| "All ExamCycles for batch 2025-29" | `ExamCycle.batchSemester.batchId → Batch` |
| "Semester 3 ExamCycles" | `ExamCycle.batchSemester.semesterNumber = 3` |
| "ES&H ExamCycles" | `ExamCycle.batchSemester.academicUnit.type = ES_H` |
| "Group 1 subjects" | `SubjectExamCycleLink → Subject → CurriculumSubject WHERE groupAssignment = GROUP_1` |

## Automatic Creation Removed

BatchSemester activation no longer auto-creates ExamCycles. The COE must explicitly create exam cycles using the Create Exam Cycle workflow. This keeps the system configurable for different college examination structures.

## Legacy Compatibility

| Field | Status |
|---|---|
| `departmentId` | KEPT (legacy) |
| `academicYearId` | KEPT (legacy) |
| `semesterId` | KEPT (legacy) |
| `batchSemesterId` | ACTIVE (new source of truth for academic context) |
| ~~`batchId`~~ | REMOVED (derivable) |
| ~~`semesterNumber`~~ | REMOVED (derivable) |
| ~~`academicUnitId`~~ | REMOVED (derivable) |
| ~~`groupNumber`~~ | REMOVED (derivable from CurriculumSubject) |

## Simplification Summary

| Metric | Before | After |
|--------|--------|-------|
| New academic fields on ExamCycle | 5 (`batchId`, `batchSemesterId`, `semesterNumber`, `academicUnitId`, `groupNumber`) | 1 (`batchSemesterId`) |
| Duplicate sources of truth | 4 | 0 |
| Auto-creation paths | 1 (on BatchSemester activate) | 0 |
| Migration count | 3 | 2 (consolidated) |
