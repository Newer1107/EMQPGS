# Academic Domain

## Entities

### AcademicYear
- **Fields:** `id`, `code` (e.g. "2026-2027", unique), `startDate`, `endDate`, `status` (ACTIVE/CLOSED)
- **Relationships:** `semesters[]`, `examCycles[]`, `subjectVersions[]`
- **Responsibilities:** Defines the temporal container for all academic activity. A year can be ACTIVE or CLOSED.

### Semester
- **Fields:** `id`, `number` (1-8), `name` (e.g. "Semester V"), `academicYearId`
- **Unique:** `@@unique([academicYearId, number])` — one semester 5 per year
- **Relationships:** `academicYear`, `subjects[]`, `examCycles[]`
- **Responsibilities:** Groups subjects and exam cycles within an academic year.

### Subject
- **Fields:** `id`, `subjectCode`, `subjectName`, `credits`, `status` (ACTIVE/INACTIVE), `questionBankDueDate`, `departmentId`, `semesterId`
- **Unique:** `@@unique([subjectCode, departmentId])` — code is unique per department
- **Relationships:** `department`, `semester`, `examCycleLinks[]`, `questionBanks[]`, `versions[]`
- **Responsibilities:** The course offering. Persists across exam cycles. Has a due date for question bank completion.

### SubjectVersion
- **Fields:** `id`, `subjectId`, `versionNumber` (auto), `title`, `syllabusDescription?`, `effectiveFromAcademicYearId`, `status` (ACTIVE/ARCHIVED)
- **Unique:** `@@unique([subjectId, versionNumber])` — version numbers increment per subject
- **Relationships:** `subject`, `effectiveFromAcademicYear`, `libraryItems[]`
- **Responsibilities:** Tracks curriculum changes over time. Creating a new version auto-archives the current active version. Question library items are scoped to a SubjectVersion.

## Relationships

```
Department 1──N Subject 1──N SubjectVersion
                           1──N QuestionLibraryItem
             1──N ExamCycle

AcademicYear 1──N Semester 1──N Subject
                      1──N ExamCycle
             1──N SubjectVersion (via effectiveFromAcademicYearId)
```

## Responsibilities

- COE manages AcademicYears and Semesters (CRUD)
- COE manages Departments (create, edit, delete)
- COE manages Users (create, edit, disable, re-enable)
- COE manages Coordinator Department Assignments (assign, remove)
- Coordinator manages Subjects and SubjectVersions (create, edit, deactivate, version)
- Subject creation auto-creates the first SubjectVersion (v1)
- Questions are linked to SubjectVersions, not directly to Subjects

## Workflows

### Creating a Subject
```
Coordinator → POST /api/subjects { subjectCode, subjectName, credits, semesterId, departmentId, questionBankDueDate }
  → SubjectManagementService.createSubject()
    → Validates coordinator has department access
    → Validates semester exists
    → $transaction:
        1. Create Subject
        2. Create SubjectVersion v1 (ACTIVE)
    → Returns Subject + SubjectVersion
```

### Versioning a Subject (syllabus update)
```
Coordinator → POST /api/subject-versions { subjectId, title, effectiveFromAcademicYearId }
  → SubjectVersionService.create()
    → Archives current ACTIVE version (status → ARCHIVED)
    → Creates new version with versionNumber = previous + 1
    → Returns new SubjectVersion
```

### Assigning Coordinator to Department

```
COE → POST /api/coordinator-departments { coordinatorId, departmentId }
  → CoordinatorDepartmentAssignmentService.create()
    → Validates: coordinator exists, role is COORDINATOR
    → Validates: department exists
    → Validates: no duplicate assignment (unique constraint on coordinatorId + departmentId)
    → Creates CoordinatorDepartmentAssignment
    → Returns assignment with coordinator + department data
```

### Removing Coordinator from Department

```
COE → DELETE /api/coordinator-departments/[id]
  → CoordinatorDepartmentAssignmentService.delete()
    → Validates: assignment exists
    → Deletes the record
```

### Linking Subject to Exam Cycle
```
Coordinator → POST /api/subjects/[id]/link-cycle { examCycleId }
  → SubjectManagementService.linkSubjectToExamCycle()
    → Validates: subject exists, exam cycle exists, coordinator has department access
    → Validates: exam cycle department matches subject department
    → Validates: exam cycle is ACTIVE
    → Upserts SubjectExamCycleLink
    → Required before initializeQuestionBank
```

## Invariants

- One unique `subjectCode` per `departmentId` (subject codes are department-scoped)
- One SubjectVersion active at a time per Subject
- Version numbers auto-increment; no gaps
- Subject must be linked to an ExamCycle before a QuestionBank can be created
- A subject's `semesterId` determines which exam cycles it can participate in (via matching semester)
- `academicYear` is NOT a field on Subject — use `semester.academicYear` to navigate
