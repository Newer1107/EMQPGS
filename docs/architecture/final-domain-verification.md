# Final Domain Verification

> Last updated: 2026-06-17
> Status: **Architecture Approved** (with 3 modifications required)

---

## Part 1 — Source of Truth Matrix

Every business concept must have exactly ONE authoritative source. Verifying each from the codebase:

| Business Concept | Source of Truth | Why |
|---|---|---|
| **Semester placement of a subject** | `CurriculumSubject.semesterNumber` | Verified: `Subject.semesterNumber` still exists (legacy) but `CurriculumSubject` is now the authoritative mapping. A single Subject appears in `CurriculumSubject` multiple times if it spans semesters. |
| **Academic Unit offering a subject** | `CurriculumSubject.academicUnitId` | Verified: `Subject.departmentId` still exists but is a legacy HR field (Department = faculty employer). The curriculum offering unit is `CurriculumSubject.academicUnitId`. A Subject like "Mathematics" is owned by the COMP department (HR) but offered by the ES&H unit (curriculum). |
| **Programme ownership** | `Programme` model | Verified: `Programme` owns `CurriculumScheme[]` and `Batch[]`. `Programme.homeAcademicUnitId` links to the administering AcademicUnit. |
| **Batch progression** | `BatchSemester` | Verified: Each `Batch` has `BatchSemester[]` with independent `startDate`, `endDate`, `status`. No global semester instance governs batch progression. |
| **Teaching Group assignment** | `CurriculumSubject.groupAssignment` | Verified: `TeachingGroup` records existence of groups per batch, but the actual subject-to-group assignment is on `CurriculumSubject.groupAssignment` (ALL/GROUP_1/GROUP_2). NOT on `ExamCycle`. |
| **Question Bank due date** | `CurriculumSubject.questionBankDueDate` | Verified: `Subject.questionBankDueDate` is the old location. The new source is `CurriculumSubject.questionBankDueDate` because due dates are per-curriculum-context (different batches, different schemes may have different deadlines for the same subject). |
| **Subject lifecycle** | `Subject` | Verified: `Subject` remains the permanent entity. It has `status` (ACTIVE/INACTIVE), unique code, credits. `SubjectVersion` handles syllabus evolution. Subject is referenced by both `CurriculumSubject` (new) and `SubjectExamCycleLink` (legacy). |
| **Exam ownership** | `ExamCycle` | Verified: `ExamCycle` still owns `departmentId`, `semesterId`, `academicYearId`, `examType`. New batch awareness will be added in a later phase. |
| **Curriculum ownership** | `AcademicUnit` | Verified: `AcademicUnit` owns `Programme[]` and `CurriculumSubject[]`. It is the entity that says "ES&H administers first-year subjects; Computer Engineering administers third-year subjects." Distinct from `Department` (HR). |
| **Subject existence (permanent record)** | `Subject` | Verified: Subject is the canonical record of an academic subject. `CurriculumSubject` places it in a scheme; `SubjectVersion` tracks syllabus changes. Subject cannot be deleted if referenced. |
| **Faculty HR affiliation** | `Department` | Verified: `User.departmentId` FK → `Department`. This is purely HR (who employs the faculty). Not coupled to curriculum. |

### Conflict resolution: Subject.departmentId vs CurriculumSubject.academicUnitId

These two fields look redundant but serve different purposes:

```
Subject.departmentId            → "Which Department does this subject's admin fall under?" (HR/legacy)
CurriculumSubject.academicUnitId → "Which Academic Unit offers this subject in this semester?" (curriculum)
```

Example: Mathematics I
- `Subject.departmentId` = COMP (the Computer Engineering department created/adminsters this subject record)
- `CurriculumSubject.academicUnitId` = ES&H (ES&H offers Mathematics I to first-year students)

**Verdict:** Both are valid sources of truth for different concerns. The migration path is:
1. New UI hides `Subject.departmentId` from curriculum flows
2. New flows use `CurriculumSubject.academicUnitId`
3. `Subject.departmentId` kept for backward compatibility and HR reporting

---

## Part 2 — Legacy Fields Classification

### Subject model

| Field | Decision | Reason |
|-------|----------|--------|
| `subjectCode` | **KEEP** | Unique subject identifier. No alternative. |
| `subjectName` | **KEEP** | Core to Subject existence. |
| `credits` | **KEEP** | Core to Subject definition. |
| `status` | **KEEP** | ACTIVE/INACTIVE lifecycle. |
| `questionBankDueDate` | **MOVE** | Moving to `CurriculumSubject.questionBankDueDate`. The due date is per-curriculum-context, not per-subject. Different batches/schemes may have different deadlines. **Remove from Subject in future migration.** |
| `departmentId` | **KEEP** | Legacy HR field. Indicates which Department administers this subject record. The new curriculum ownership is `CurriculumSubject.academicUnitId`. Both coexist. |
| `semesterNumber` | **MOVE** | Moving to `CurriculumSubject.semesterNumber`. Subject no longer stores its own semester placement. **Remove from Subject in future migration.** |
| `curriculumSubjects` (NEW) | **KEEP** | Back-relation to new model. Additive, no conflict. |

### ExamCycle model

| Field | Decision | Reason |
|-------|----------|--------|
| `departmentId` | **KEEP** (for now) | Scopes exam cycle to legacy Department. Will be superseded by `academicUnitId` in later phase. |
| `academicYearId` | **KEEP** | AcademicYear still exists for reporting. `BatchSemester.academicYearId` is the new per-batch link. |
| `semesterId` | **KEEP** (for now) | Legacy FK to `Semester` model. Will be superseded by `semesterNumber` + `batchId` in later phase. |
| All timetable fields | **KEEP** | No alternative exists. |

### SubjectVersion model

| Field | Decision | Reason |
|-------|----------|--------|
| `effectiveFromAcademicYearId` | **KEEP** | Links to `AcademicYear`. Valid use case — which year this version became effective. NOT removed because AcademicYear still exists. |
| All others | **KEEP** | Unchanged. |

### CoordinatorDepartmentAssignment model

| Field | Decision | Reason |
|-------|----------|--------|
| `departmentId` | **KEEP** (for now) | Will eventually be superseded by `CoordinatorAcademicUnitAssignment.coordinatorId` + `academicUnitId`. Rename in future migration. |

### Department model

| Field | Decision | Reason |
|-------|----------|--------|
| All fields | **KEEP** | Department remains for faculty HR. Not removed. AcademicUnit is additive. |

### Semester model

| Field | Decision | Reason |
|-------|----------|--------|
| All fields | **KEEP** (for now) | Still used by legacy `ExamCycle.semesterId`. Will be retired when ExamCycle becomes batch-aware. |

### AcademicYear model

| Field | Decision | Reason |
|-------|----------|--------|
| All fields | **KEEP** | Used by `BatchSemester.academicYearId` for reporting. The `activeSemesterType` field is legacy/dead but harmless. |
| `semesters` relation | **KEEP** (for now) | Legacy Semester instances still needed. |
| `batchSemesters` relation (NEW) | **KEEP** | Additive — new per-batch semester context. |

---

## Part 3 — Entity Responsibilities

Each entity has exactly ONE responsibility:

### AcademicUnit
**Responsibility:** Owns curriculum context. Defines which organizational unit (ES&H, Computer Engineering, IT) offers subjects and administers programmes.

**Does NOT do:**
- Does NOT employ faculty (that is Department)
- Does NOT track student progress (that is Batch)
- Does NOT define semester placement (that is CurriculumSubject)

### Programme
**Responsibility:** Represents a degree a student graduates with. Owns curriculum schemes. Root of accreditation reporting.

**Does NOT do:**
- Does NOT own subjects (Subject stands alone)
- Does NOT track batches directly (Batch references Programme)
- Does NOT set exam dates (ExamCycle does)

### CurriculumScheme
**Responsibility:** Groups CurriculumSubject entries for a Programme. A named plan ("2025 Scheme") that defines what subjects are studied in which semesters.

**Does NOT do:**
- Does NOT contain exam schedules (ExamCycle does)
- Does NOT track student cohorts (Batch references it)
- Does NOT replace SubjectVersion (which tracks syllabus content changes)

### CurriculumSubject
**Responsibility:** Places a single Subject into a specific (Semester, AcademicUnit, TeachingGroup) within a CurriculumScheme. This is the authoritative mapping.

**Owns:**
- `semesterNumber` (which semester)
- `academicUnitId` (which unit offers it)
- `groupAssignment` (which teaching group takes it)
- `questionBankDueDate` (when banks are due)

**Does NOT do:**
- Does NOT create Subjects (Subject exists independently)
- Does NOT create ExamCycles (ExamCycle references Subjects via SubjectExamCycleLink)
- Does NOT own question banks (QuestionBank references Subject + ExamCycle)

### Batch
**Responsibility:** Represents an academic cohort (e.g., "BE Computer 2025-29"). Pure descriptor — no student table exists.

**Does NOT do:**
- Does NOT own subjects (Subject exists independently)
- Does NOT own curriculum (CurriculumScheme does)
- Does NOT create exam cycles (ExamCycle references Batch in future phase)

### BatchSemester
**Responsibility:** Tracks a single semester's schedule for a batch. Owns `startDate`, `endDate`, `status` for that batch's instance of that semester number.

**Does NOT do:**
- Does NOT define curriculum (CurriculumSubject does)
- Does NOT replace ExamCycle (ExamCycle is the EXAM event, BatchSemester is the TEACHING period)

### TeachingGroup
**Responsibility:** Records that a batch has up to two teaching groups (Group 1, Group 2) for certain semesters. Pure existence record — the actual subject-to-group mapping is on CurriculumSubject.

**Does NOT do:**
- Does NOT assign subjects to groups (CurriculumSubject does)
- Does NOT track divisions (Division was removed as an entity)

### Subject
**Responsibility:** Represents a permanent academic subject (Mathematics I, Operating Systems). Has unique code, name, credits. Owns SubjectVersions (syllabus evolution).

**Does NOT do:**
- Does NOT store semester placement (`semesterNumber` is legacy — moving to CurriculumSubject)
- Does NOT store batch information
- Does NOT store teaching groups
- Does NOT define curriculum placement (CurriculumSubject does)

### ExamCycle
**Responsibility:** Represents a single examination event ("ENDSEM November 2026 for Semester 5"). Owns timetable, links subjects via SubjectExamCycleLink. Root of QuestionBank creation.

**Does NOT do:**
- Does NOT define curriculum (CurriculumSubject does)
- Does NOT track batch progression (BatchSemester does)

### QuestionBank
**Responsibility:** Manages the end-to-end lifecycle of exam question preparation for one subject in one exam cycle. Owns slots, moderation, AI reports, paper generation, approval.

**Does NOT do:**
- Does NOT track curriculum (Subject/CurriculumSubject does)
- Does NOT track batch (ExamCycle does, in future phase)

---

## Part 4 — Workflow Verification

### Full lifecycle: COE creates the academic structure

```
COE creates AcademicUnit (ES&H, COMP, IT...)
  → One-time setup. "These are the units that offer subjects."

COE creates Programme (BE Computer, BE IT...)
  → "This is a degree students graduate with."
  → Links to home AcademicUnit (e.g., COMP)
  → Links to first-year AcademicUnit (e.g., ES&H)

COE creates CurriculumScheme (2025 Scheme)
  → "This is the curriculum plan for BE Computer."
  → Links to Programme.

COE creates Subjects (Mathematics I, Operating Systems...)
  → "These are permanent subjects that exist in the college."
  → Subject.departmentId = who administers the record (legacy)
  → Subject exists independently of any scheme.

COE creates CurriculumSubject entries
  → "Mathematics I is in Semester 1, offered by ES&H, for ALL groups."
  → "Physics Lab is in Semester 1, offered by ES&H, for GROUP_1 only."
  → Each row links: CurriculumScheme + Subject + SemesterNumber + AcademicUnit + GroupAssignment
  → questionBankDueDate can be set per-entry.

----- ACADEMIC STRUCTURE IS DEFINED -----

COE creates Batch (BE Computer 2025-29)
  → Links to Programme (BE COMP)
  → Links to CurriculumScheme (2025 Scheme)
  → System auto-creates BatchSemesters:
    - Sem 1-2: academicUnitId = ES&H
    - Sem 3-8: academicUnitId = COMP
    - Dates computed from admissionYear

COE (or auto) creates TeachingGroups for first-year semesters
  → "Batch 2025-29 has Group 1 and Group 2 in semesters 1-2."
```

### Full lifecycle: Exam preparation

```
COE creates ExamCycle
  → Selects: Batch, SemesterNumber, AcademicUnit, ExamType, Group
  → Currently: ExamCycle.departmentId, academicYearId, semesterId (legacy)
  → Future: ExamCycle.batchId, semesterNumber, academicUnitId, groupNumber

System auto-links subjects to ExamCycle:
  → Queries: CurriculumSubject WHERE curriculumSchemeId = batch.curriculumSchemeId
             AND semesterNumber = examCycle.semesterNumber
             AND academicUnitId = examCycle.academicUnitId
             AND (groupAssignment = 'ALL' OR groupAssignment matches examCycle group)
  → Creates SubjectExamCycleLink for each matching CurriculumSubject
  → Subjects can be manually added/removed (for supple, electives, custom cycles)

Coordinator initializes QuestionBank for a (Subject, ExamCycle):
  → Same flow as current system
  → Creates QuestionBank with PaperPattern + 63/126 QuestionSlots
  → Bank phase = DRAFTING

----- EXISTING PIPELINE TAKES OVER -----

Contributor creates QuestionLibraryItem → assigns to slot
Moderator reviews questions → approves/rejects/revision
Coordinator advances phase: DRAFTING → MODERATION → APPROVAL → COMPLETE
AI analysis → Paper generation → Dean review → Lock → Export → Close
```

### Key transition: Who creates what and when

| Step | Who | When | Why |
|------|-----|------|-----|
| AcademicUnit | COE | System setup | Defines curriculum-offering bodies |
| Programme | COE | System setup | Defines available degrees |
| CurriculumScheme | COE | Per-revision | Defines curriculum plan for a programme |
| Subject | COE / Coordinator | As needed | Permanent subject records |
| CurriculumSubject | COE / Coordinator | After scheme created | Places subjects in curriculum |
| Batch | COE | Per admission year | Creates a cohort |
| BatchSemester | Auto (on Batch create) | Batch creation | Generates per-batch schedule |
| TeachingGroup | COE / Auto | Batch creation | Declares groups for first year |
| ExamCycle | COE | Per exam period | Schedules an exam event |
| SubjectExamCycleLink | Auto + manual override | ExamCycle creation | Links subjects to exam cycle |
| QuestionBank | Coordinator | After ExamCycle created | Initializes bank for a subject+cycle |

---

## Part 5 — Integration Plan

### Question 1: Should creating a CurriculumSubject automatically create a Subject?

**Answer: NO.** Subjects MUST always exist first. CurriculumSubject is a reference to an existing Subject.

**Reasoning:**
- Subject is a permanent entity with its own lifecycle (code, name, credits, status, versions)
- A Subject can exist without being placed in any curriculum
- SubjectVersion (syllabus) is per-Subject, not per-CurriculumSubject
- The QuestionLibraryItem is scoped to SubjectVersion, not to CurriculumSubject

**Flow:**
```
1. COE creates Subject: "Operating Systems", code "CS501", 4 credits → Subject record exists
2. COE creates CurriculumSubject: (Scheme=2025, Subject=OS, Sem=5, Unit=COMP, Group=ALL)
3. Later, same Subject can be added to a different scheme:
   (Scheme=2028, Subject=OS, Sem=4, Unit=COMP, Group=ALL)
```

**Invariant:** `CurriculumSubject.subjectId` FK → `Subject.id`. A CurriculumSubject cannot exist without a Subject.

### Question 2: Should ExamCycle be automatically generated?

**Answer:** Eventually YES, but initially NO. Implement auto-creation as an optional wizard step.

**Phase 1 (current):** Manual creation. COE creates ExamCycle with legacy fields (departmentId, semesterId, academicYearId).

**Phase 2 (next):** Wizard auto-populates from BatchSemester + CurriculumSubject:
1. COE selects Batch → BatchSemester
2. System finds `CurriculumSubject` entries for (batch.curriculumSchemeId, semesterNumber, academicUnitId)
3. Groups by `groupAssignment` → creates one ExamCycle per group
4. COE reviews and overrides (excluded subjects, additional subjects)
5. Confirms → ExamCycle created with SubjectExamCycleLinks

**Phase 3 (future):** Full auto-creation on BatchSemester activation:
- When a BatchSemester becomes ACTIVE, the system creates all standard ExamCycles (ISE_1, ISE_2, ENDSEM) for that semester automatically
- Coordinator only intervenes for SUPPLEMENTARY, KT, or custom cycles

### Question 3: How should QuestionBank discover its Batch?

**Current path:** `QuestionBank → ExamCycle → (no batch link yet)`

**Future path:** `QuestionBank → ExamCycle → (batchId) → Batch`

**Transition:**
1. Phase 1 (now): QuestionBank knows nothing about Batch. All batch-aware queries must join through ExamCycle → legacy Semester → AcademicYear. This is the current state.
2. Phase 2: Add `ExamCycle.batchId` as an optional FK. New ExamCycles have batchId set. Old ones are null (linked to a legacy batch via migration).
3. Phase 3: `ExamCycle.batchId` becomes required. Legacy data is migrated.

**For reporting NOW (without schema changes):**
```
QuestionBank
  → examCycleId → ExamCycle
    → semesterId → Semester
      → academicYearId → AcademicYear  (for AY reporting)
    → departmentId → Department  (for Department reporting)

QuestionBank
  → subjectId → Subject
    → curriculumSubjects → CurriculumSubject
      → curriculumSchemeId → CurriculumScheme
        → programmeId → Programme  (for Programme reporting)
```

This chain works today with the existing schema without adding any new FKs. It's a multi-hop join but functionally correct.

### Question 4: How should reports discover AcademicYear?

**ExamCycle path:** `ExamCycle.academicYearId` — direct FK, unchanged.

**Batch-aware path:** `BatchSemester.academicYearId` — each batch's semester is explicitly linked to an AcademicYear for reporting.

**Question: Why does BatchSemester need academicYearId when it has startDate/endDate?**
- Answer: Date-range scanning is expensive and error-prone (timezone issues, boundary conditions). A direct FK is faster, more precise, and self-documenting.
- AcademicYear 2026-2027 started June 1, 2026. Batch 2025-29 may start its Sem 5 in July 2026. Is that in AY 2026-2027? With an FK, yes — because the COE assigned it to that year. Without an FK, you'd need to check if July 2026 falls within June 2026-May 2027 range — correct but slower.

### Question 5: How should SubjectVersion integrate?

**Current:** `SubjectVersion` belongs to `Subject`. `QuestionLibraryItem` belongs to `SubjectVersion`. `SubjectVersion.effectiveFromAcademicYearId` FK → `AcademicYear`.

**New:** No changes needed. SubjectVersion remains:

```
Subject → SubjectVersion → QuestionLibraryItem
       ↘                      ↗
        → CurriculumSubject  (new — for placement)
```

**Reasoning:**
- QuestionLibraryItem is scoped to SubjectVersion (syllabus version), not to CurriculumSubject (placement)
- A single SubjectVersion can feed multiple batches if the syllabus hasn't changed
- CurriculumSubject does NOT replace SubjectVersion — they serve different purposes:
  - CurriculumSubject: "Where is this subject taught (semester, unit, group)?"
  - SubjectVersion: "What is the syllabus content for this version of the subject?"

---

## Part 6 — Final Architecture Review

### Challenge 1: Is AcademicUnit really necessary? Could Department serve both roles?

**Challenge:** Many colleges have 1:1 Department→AcademicUnit mapping. A Computer Engineering Department IS the Computer Engineering AcademicUnit. Is the separation over-engineering?

**Reasons to keep AcademicUnit separate:**
- ES&H is not a Department (it doesn't employ faculty in the same way). But it IS an AcademicUnit.
- A single Department (Computer Engineering) might house multiple programmes (BE + MTech).
- Faculty can teach across units without changing their HR Department.
- Department is deeply embedded in the existing codebase (User.departmentId, Subject.departmentId, etc.). Adding AcademicUnit as a clean new entity avoids refactoring the entire User/Subject model.

**Verdict: KEEP AcademicUnit.** The separation between HR (Department) and curriculum (AcademicUnit) is the correct architectural decision.

### Challenge 2: Is TeachingGroup necessary as a model, or should it be an enum?

**Current design:** `TeachingGroup` is a model (id, batchId, groupNumber). `CurriculumSubject.groupAssignment` is an enum (ALL, GROUP_1, GROUP_2).

**Challenge:** The model just records "batch X has group 1 and group 2." This could be derived from CurriculumSubject data — if any CurriculumSubject references GROUP_1, the batch has GROUP_1. Or it could be a simple boolean on Batch (`hasGroups: Boolean`).

**Simpler alternative:** Remove `TeachingGroup` model. Add `hasGroups: Boolean` to Batch. The group numbers (1 and 2) are fixed by the `GroupAssignment` enum.

**This is correct.** The TeachingGroup model currently adds no value beyond what `hasGroups: Boolean` on Batch would provide. The actual group-to-subject mapping is on CurriculumSubject. The model just declares existence.

**Recommendation for future cleanup:** Replace `TeachingGroup` model with `Batch.hasGroups: Boolean @default(false)`. For now, TeachingGroup exists but has minimal impact.

### Challenge 3: Is Programme duplication with CurriculumScheme?

**Challenge:** Programme has `durationSemesters`, `homeAcademicUnitId`, `firstYearAcademicUnitId`. CurriculumScheme has `programmeId`. Could Programme be merged into CurriculumScheme?

**No.** A Programme can have multiple curriculum schemes over time (2025 Scheme, 2028 Scheme). A Programme is the DEGREE — what appears on accreditation reports. A CurriculumScheme is a specific plan for that degree. They are genuinely different concepts at different levels of abstraction.

**Verdict: KEEP separate.**

### Challenge 4: Are there too many lookup hops from QuestionBank to Batch?

**Current chain:**
```
QuestionBank → ExamCycle → Semester → AcademicYear  (no batch link)
```

**Future chain (when ExamCycle gets batchId):**
```
QuestionBank → ExamCycle → Batch
```

**Without ExamCycle.batchId, the chain is:**
```
QuestionBank → Subject → CurriculumSubject → CurriculumScheme → Programme → Batch
```

This is 5 joins. For a query like "show all QuestionBanks for batch 2025-29", this is expensive.

**Recommendation:** Add `ExamCycle.batchId` as a nullable FK in the NEXT phase. This reduces the chain to 2 joins. It is denormalized (batchId is derivable via CurriculumSubject), but denormalization is justified for query performance.

### Challenge 5: Does SubjectSemesterNumberIndex removal risk breakage?

The migration dropped `Subject_semesterNumber_idx`. The `Subject.semesterNumber` field still exists — the index was removed because it's no longer in the Prisma schema definition. Queries that filter by `subject.semesterNumber` still work (just without index optimization). Once `semesterNumber` is removed from Subject in a future migration, those queries must use `CurriculumSubject.semesterNumber` instead.

**Risk:** Low. The index was undocumented and no critical query path relied on it.

### Challenge 6: Is two-group hard limit acceptable?

**Design decision:** `GroupAssignment` enum has exactly 3 values: ALL, GROUP_1, GROUP_2. This is hardcoded at the database level.

**Risk:** If a batch ever needs GROUP_3, this requires a database migration to add the enum value.

**Mitigation:** The user confirmed "hard limit of 2" as a business requirement. If this changes, adding GROUP_3 is a simple ALTER TABLE. The architecture supports it.

---

## Part 7 — Final Verdict

### Architecture Approved

**With 3 modifications required before service layer implementation:**

| # | Modification | Rationale | Priority |
|---|--------------|-----------|----------|
| 1 | **Add `ExamCycle.batchId`** as nullable FK → `Batch` in the next phase. Without this, every QuestionBank must traverse 5+ joins to discover its batch. This is the single most critical missing link between the two models. | Performance | HIGH |
| 2 | **Replace `TeachingGroup` model with `Batch.hasGroups: Boolean`** in the next schema cleanup. The model adds no value — group existence is derivable from CurriculumSubject data. | Simplification | LOW |
| 3 | **Plan migration of `Subject.semesterNumber` to `CurriculumSubject.semesterNumber`** in service layer. All new code reads from CurriculumSubject. Subject.semesterNumber is a display-only fallback. | Correctness | MEDIUM |

### Approved entities (12 total)

```
AcademicYear      — reporting dimension (KEEP, no structural changes)
Department        — faculty HR (KEEP, legacy)
AcademicUnit      — curriculum ownership (NEW, APPROVED)
Programme         — degree definition (NEW, APPROVED)
CurriculumScheme  — curriculum plan (NEW, APPROVED)
CurriculumSubject — subject placement (NEW, APPROVED)
Batch             — cohort descriptor (NEW, APPROVED)
BatchSemester     — per-batch schedule (NEW, APPROVED)
TeachingGroup     — group existence (NEW, CONDITIONAL — simplify to hasGroups)
Subject           — permanent subject (KEEP, fields migrating)
ExamCycle         — exam event (KEEP, needs batchId)
QuestionBank      — paper preparation pipeline (UNCHANGED)
```

### The two parallel models after verification

```
Existing Operational Model (LEGACY — still functional)
  Department → Subject → ExamCycle → QuestionBank

New Academic Model (AUTHORITATIVE for new data)
  AcademicUnit → Programme → CurriculumScheme
                                 ↓
                          CurriculumSubject → Subject
                                 ↓
                            Batch → BatchSemester → (future: ExamCycle.batchId)
                                                      ↓
                                                 ExamCycle → QuestionBank
```

The bridge between the two models is `CurriculumSubject.subjectId` → `Subject.id`. This single FK connects the academic domain to the existing operational pipeline without modifying a single existing table.
