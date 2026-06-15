# Academic Domain Refactor — Migration Report

---

## Executive Summary

The academic domain was not modeled as a first-class domain. Subjects stored `academicYear` (string) and `semester` (integer) as flat scalar fields. There was no `AcademicYear` entity, no `Semester` entity, and no `SubjectVersion` entity. This refactor introduces three new entities and refactors `Subject` to use proper relational modeling.

---

## New Entities

### AcademicYear

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `code` | String (unique) | e.g. "2026-2027" |
| `startDate` | DateTime | Academic year start |
| `endDate` | DateTime | Academic year end |
| `status` | AcademicYearStatus enum | ACTIVE or CLOSED |
| `semesters` | Semester[] | One-to-many relation |
| `subjectVersions` | SubjectVersion[] | One-to-many relation |

**New enum:** `AcademicYearStatus { ACTIVE, CLOSED }`

### Semester

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `number` | Int | 1-8, e.g. 5 |
| `name` | String | e.g. "Semester V" |
| `academicYearId` | String | Foreign key → AcademicYear |
| `subjects` | Subject[] | One-to-many relation |

**Unique constraint:** `@@unique([academicYearId, number])` — only one semester 5 per academic year.

### SubjectVersion

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `subjectId` | String | Foreign key → Subject |
| `versionNumber` | Int | Auto-incremented per subject |
| `title` | String | Version title (defaults to subject name) |
| `syllabusDescription` | String? | Optional syllabus text |
| `effectiveFromAcademicYearId` | String | Foreign key → AcademicYear |
| `status` | SubjectVersionStatus enum | ACTIVE or ARCHIVED |

**Unique constraint:** `@@unique([subjectId, versionNumber])` — version numbers increment per subject.

**New enum:** `SubjectVersionStatus { ACTIVE, ARCHIVED }`

---

## Modified Entities

### Subject (before → after)

| Field | Before | After |
|---|---|---|
| `subjectCode` | String | String (unchanged) |
| `subjectName` | String | String (unchanged) |
| `academicYear` | **String** | **REMOVED** |
| `semester` | **Int** | **REMOVED** |
| `semesterId` | — | **ADDED** (String, required, FK → Semester) |
| `credits` | Int | Int (unchanged) |
| `status` | SubjectStatus | SubjectStatus (unchanged) |
| `departmentId` | String | String (unchanged) |
| `versions` | — | **ADDED** SubjectVersion[] relation |

**New relation:** `semester → Semester` (required)
**New relation:** `versions → SubjectVersion[]`
**Removed index:** `@@index([semester])` → replaced with `@@index([semesterId])`

---

## Removed Entities

| Entity | Reason |
|---|---|
| `src/modules/subjects/validation.ts` | Dead code — all subject validation is inline in route files |
| `src/modules/subjects/service.ts` | Dead code — never imported anywhere |
| `src/modules/subjects/repository.ts` | Dead code — never imported anywhere |

---

## New API Routes

| Method | Route | Service | Purpose |
|---|---|---|---|
| GET | `/api/academic-years` | AcademicYearService.list | List all academic years |
| POST | `/api/academic-years` | AcademicYearService.create | Create academic year |
| GET | `/api/academic-years/[id]` | AcademicYearService.findById | Get academic year by ID |
| PATCH | `/api/academic-years/[id]` | AcademicYearService.update | Update academic year |
| GET | `/api/semesters` | SemesterService.list/findByAcademicYear | List semesters (optional academicYearId filter) |
| POST | `/api/semesters` | SemesterService.create | Create semester |
| GET | `/api/semesters/[id]` | SemesterService.findById | Get semester by ID |
| PATCH | `/api/semesters/[id]` | SemesterService.update | Update semester |
| GET | `/api/subject-versions?subjectId=` | SubjectVersionService.findBySubject | List versions for a subject |
| POST | `/api/subject-versions` | SubjectVersionService.create | Create new version (auto-increments, archives active) |
| PATCH | `/api/subject-versions/[id]/archive` | SubjectVersionService.archive | Archive a version |

---

## Modified API Routes

| Route | Change |
|---|---|
| `POST /api/subjects` | Accepts `semesterId` instead of `semester` (number). Creates Subject and initial SubjectVersion in a transaction. |
| `PUT /api/subjects/[id]` | Accepts `semesterId` instead of `semester` (number). |
| `GET /api/subjects` | Returns `semester` as nested object (`{ id, number, name, academicYear: { code } }`) instead of integer. |

---

## New Service Modules

| Module | Files | Purpose |
|---|---|---|
| `academic-years/` | `service.ts`, `repository.ts`, `validation.ts` | AcademicYear CRUD + findCurrent |
| `semesters/` | `service.ts`, `repository.ts`, `validation.ts` | Semester CRUD, query by academic year |
| `subject-versions/` | `service.ts`, `repository.ts`, `validation.ts` | SubjectVersion CRUD, auto-versioning, archiving |

---

## Modified Service Modules

| Service | Changes |
|---|---|
| `SubjectManagementService` | `SubjectPayload` uses `semesterId` instead of `semester`. `createSubject` validates semester exists, uses `$transaction` to create Subject + SubjectVersion atomically. `listSubjects` returns nested semester/academicYear. Removed `currentAcademicYear()` function. |

---

## Architecture Diagram

```
AcademicYear
├── code: "2026-2027"
├── startDate, endDate
├── status: ACTIVE | CLOSED
│
├── Semester (1..N)
│   ├── number: Int (1-8)
│   ├── name: String
│   │
│   └── Subject (1..N)
│       ├── subjectCode: String (unique per dept)
│       ├── subjectName: String
│       ├── credits: Int
│       ├── status: ACTIVE | INACTIVE
│       │
│       ├── SubjectVersion (1..N)
│       │   ├── versionNumber: Int (auto)
│       │   ├── title: String
│       │   ├── syllabusDescription: String?
│       │   ├── status: ACTIVE | ARCHIVED
│       │   └── effectiveFromAcademicYearId → AcademicYear
│       │
│       └── QuestionBank (1..N)
│           └── (existing question bank structure...)
│
└── SubjectVersion (1..N)
    └── (via effectiveFromAcademicYearId)
```

### Dependency Flow

```
Department
└── Subject
    ├── SubjectVersion (curriculum/syllabus history)
    └── Semester
        └── AcademicYear

ExamCycle (remains unchanged — still uses scalar academicYear + semester)
```

---

## Future-Proofing

This structure supports the following future phases without schema changes:

1. **Question Library** — SubjectVersion provides the syllabus context (CO definitions, module topics) for a shared, cross-cycle question pool.

2. **Assignment Templates** — Semesters and AcademicYears provide the temporal context for templated assignment patterns ("always assign Contributor X to Module Y of Subject Z in Semester 5").

3. **Historical Intelligence** — SubjectVersion.archive() combined with AcademicYear dates enables analysis of curriculum evolution, question difficulty trends across syllabus versions, and paper quality trends over years.

---

## File Change Summary

| Category | Files |
|---|---|
| **New Prisma models** | 3 (AcademicYear, Semester, SubjectVersion) |
| **New enum values** | 2 (AcademicYearStatus, SubjectVersionStatus) |
| **Modified Prisma models** | 1 (Subject — removed 2 fields, added 2 fields + 2 relations) |
| **New service modules** | 3 (academic-years, semesters, subject-versions) |
| **Modified services** | 1 (SubjectManagementService) |
| **New API routes** | 11 (shared across 6 route files) |
| **Modified API routes** | 2 (subjects/, subjects/[id]/) |
| **Modified UI pages** | 2 (subjects page, subject-create-form) |
| **Removed dead code** | 3 files (subjects/validation, service, repository) |
| **Updated seed** | 1 (seed.ts — now creates AcademicYear, Semester, SubjectVersion) |
| **Updated tests** | 2 (security.test.ts, service-concurrency.test.ts) |

---

## Build & Test Results

| Check | Result |
|---|---|
| Build (TypeScript) | Passed |
| Build (Turbopack) | Compiled successfully |
| Tests | 18/18 files, 131/131 tests passing |
| Seed | Ran successfully |

---

## Migration Safety Notes

- The database was reset (`prisma db push --force-reset`) since this is a development environment
- Breaking changes: `academicYear` and `semester` columns on `Subject` are dropped
- Subject `@@unique([subjectCode, departmentId])` is preserved — no data loss for that constraint
- ExamCycle is untouched — it still uses scalar `academicYear` (string) and `semester` (int) for backward compatibility
