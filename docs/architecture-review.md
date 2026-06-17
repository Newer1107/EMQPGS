# EMQPGS — Architecture Investigation & Design Review

> **Author:** Command Code (Plan Mode)
> **Date:** 2026-06-17
> **Status:** Analysis only — no implementation

---

## Phase 1 — Current Architecture (Entity-by-Entity Analysis)

### AcademicYear

| Aspect | Detail |
|--------|--------|
| **Purpose** | Represents a calendar academic year (e.g. "2026-2027") |
| **Business concept** | Time period during which academic activity occurs |
| **Category** | Time / Administration |
| **Key fields** | `code`, `startDate`, `endDate`, `status`, `activeSemesterType` |
| **Invariant** | Only one ACTIVE at a time |
| **Generates** | Auto-creates 8 semesters (Sem I–VIII) on creation |
| **activeSemesterType** | ODD (sems 1,3,5,7) or EVEN (sems 2,4,6,8) — operational filter |

**Why it exists:** AcademicYear models the institution's calendar — when the academic session starts and ends. It's purely a time container.

**Critical observation:** AcademicYear does NOT represent which batch of students is progressing. It represents wall-clock time. A batch entering in 2024 starts Sem 1 in AY 2024-2025, reaches Sem 3 in AY 2025-2026, and Sem 5 in AY 2026-2027. The system has NO entity that says "this is the 2024 intake batch."

---

### Semester

| Aspect | Detail |
|--------|--------|
| **Purpose** | A numbered period (1-8) within an academic year |
| **Business concept** | Academic term — numbered, not dated |
| **Category** | Time / Curriculum stage |
| **Key fields** | `number` (1-8), `name`, `academicYearId` |
| **Unique** | `(academicYearId, number)` — one semester number per year |
| **Lifecycle** | Auto-generated at AcademicYear creation. Read-only after creation. |

**Why it exists:** Semesters provide numbered frames (Sem 1, 2, ..., 8) within each academic year. Subjects reference `semesterNumber` to indicate when they are taught.

**Critical observation:** The Semester model conflates two things:
1. **Calendar instance**: "Semester 3 of AY 2026-2027" (a specific time window)
2. **Academic stage**: "Semester 3" (where a student is in their 4-year journey)

A subject with `semesterNumber = 5` means "this subject is taught when a student is in their 5th semester." But WHICH cohort's 5th semester? The 2024 batch's Sem 5 happens in AY 2026-2027. The 2025 batch's Sem 5 will happen in AY 2027-2028. Both use the same subject definition.

---

### Department

| Aspect | Detail |
|--------|--------|
| **Purpose** | Academic department (e.g. CSE, IT, AIDS) |
| **Business concept** | Organizational unit that owns curriculum and employs faculty |
| **Category** | Administration / Curriculum owner |
| **Key fields** | `name`, `code`, `hodName`, `isActive` |
| **Unique** | `code` |
| **Relationships** | Has: Users, Subjects, ExamCycles, CoordinatorAssignments |

**Why it exists:** Departments are the organizational structure. They own subjects, employ staff, and scope exam cycles.

**Critical observation:** The model assumes Department = Programme. In reality:
- A single department (CSE) offers B.Tech CSE, M.Tech CSE, Ph.D. — these are DIFFERENT programmes with different curricula, durations, and student cohorts
- Students from different programmes within the same department take different subjects
- The current model has no Programme entity

---

### Subject

| Aspect | Detail |
|--------|--------|
| **Purpose** | A course offering (e.g. "Data Structures" CS201) |
| **Business concept** | Curriculum unit — what is taught |
| **Category** | Curriculum |
| **Key fields** | `subjectCode`, `subjectName`, `credits`, `semesterNumber`, `departmentId`, `questionBankDueDate` |
| **Unique** | `(subjectCode, departmentId)` |
| **semesterNumber** | Static. Not a FK. Year-agnostic. Not linked to any specific Semester record. |

**Why it exists:** Subjects are the atomic curriculum unit. They define what is taught, when (which sem number), and who owns it (department).

**Critical observation:** `semesterNumber` is denormalized and meaningless without a cohort reference. "Semester 5" of WHICH batch? The system today ties subjects to exam cycles via `SubjectExamCycleLink`, and the exam cycle has a `semesterId` FK that points to a specific `Semester` record (which belongs to an `AcademicYear`). So indirectly, a subject is anchored to a time when linked to an exam cycle. But the subject itself has no concept of cohort.

---

### SubjectVersion

| Aspect | Detail |
|--------|--------|
| **Purpose** | Versioned syllabus of a subject |
| **Business concept** | Curriculum evolution over time |
| **Category** | Curriculum / Versioning |
| **Key fields** | `versionNumber`, `title`, `syllabusDescription`, `effectiveFromAcademicYearId`, `status` |
| **Unique** | `(subjectId, versionNumber)` |
| **Relationship** | Contains `QuestionLibraryItem` (questions) |

**Why it exists:** Syllabi change over time. A subject can have multiple versions, each effective from a specific academic year. Questions live in a version.

**Critical observation:** The `effectiveFromAcademicYearId` ties a version to a calendar year. This works: "From AY 2026-2027, use Syllabus v2 for Data Structures." But it doesn't answer "which cohort studies which version?" Usually: the 2024 batch follows the 2024 syllabus; the 2025 batch follows the 2025 update. The current model applies the version to ALL cohorts from that year forward, which is usually correct — new syllabus applies to new intakes.

---

### ExamCycle

| Aspect | Detail |
|--------|--------|
| **Purpose** | An exam event for a (semester, examType, department) |
| **Business concept** | Time-bound examination |
| **Category** | Workflow / Examination |
| **Unique** | `(semesterId, examType, departmentId)` |
| **Status** | DRAFT → ACTIVE → CLOSED |
| **Key fields** | `examType`, `startDate`, `endDate`, `departmentId`, `academicYearId`, `semesterId` |

**Why it exists:** An exam cycle represents a real exam event. "ENDSEM Nov 2026 for CSE Sem 5." It ties together: which calendar time (academic year), which stage (semester), which organization (department), and what type of exam.

**Critical observation:** ExamCycle is the only entity that binds a department, a semester number (via Semester), and a time period (via AcademicYear). This is the closest thing to a "cohort" reference, but it's not explicit. The assumption is: "Semester 5 of AY 2026-2027" = the 2024 batch's Sem 5. But this is implicit and breaks if batches are offset or delayed.

---

### QuestionBank

| Aspect | Detail |
|--------|--------|
| **Purpose** | Container for exam questions for one (Subject, ExamCycle) pair |
| **Business concept** | The work-in-progress question paper |
| **Category** | Workflow / Examination |
| **Unique** | `(subjectId, examCycleId)` |
| **Two axes** | Phase (DRAFTING/MODERATION/APPROVAL/COMPLETE) + RecordStatus (ACTIVE/LOCKED/ARCHIVED) |

**Why it exists:** A QuestionBank is the central artifact. It holds all the questions being prepared for a specific exam. Its lifecycle (drafting → moderation → approval → complete) is the core workflow.

---

### QuestionLibraryItem

| Aspect | Detail |
|--------|--------|
| **Purpose** | A standalone, reusable question |
| **Business concept** | A question in a subject's question library |
| **Category** | Question content |
| **Scoped to** | `SubjectVersion` — cannot exist outside a version |
| **Status** | DRAFT → PENDING → APPROVED/REJECTED/REVISION_REQUESTED → REVISION_SUBMITTED |

**Why it exists:** Questions are the atomic content unit. They belong to a subject version (which implies a subject and a time period). They are reusable across multiple banks.

---

### QuestionSlot

| Aspect | Detail |
|--------|--------|
| **Purpose** | A position in a bank's slot grid |
| **Business concept** | "Module 1, 2-mark question, slot 3" |
| **Category** | Structural / Positional |
| **Unique** | `(questionBankId, moduleNumber, marks, slotNumber)` |
| **Sole linkage** | Between QuestionBank and QuestionLibraryItem |

**Why it exists:** QuestionSlot is the key architectural decision — it replaces a join table and makes slot positions first-class entities. This is clean and correct.

---

### Other Entities (summary)

| Entity | Category | Purpose |
|--------|----------|---------|
| CoordinatorDepartmentAssignment | User-Role linking | Links coordinator to department |
| ModeratorBankAssignment | User-Role linking | Links moderator to bank |
| PaperPattern | Template | Defines slot grid shape |
| ApprovalDecision | Audit | Write-once coordinator approval |
| QuestionBankSnapshot | Audit | Immutable slot capture at lock |
| PaperSnapshot | Audit | Paper generation record |
| GeneratedPaper | Output | 3 variants (A, B, C) |
| DeanReview | Workflow | Dean's variant selection |
| ExportArtifact | Output | Final export (PDF/DOCX/ZIP) |
| AiReport | Analysis | AI-generated analysis |
| AuditLog | Audit | Append-only SHA-256 chain |
| Notification | Communication | In-app alerts |

---

## Phase 2 — Reconstructed Workflow

### How does a new academic year begin?

1. COE creates `AcademicYear` with `{ code: "2026-2027", startDate: "2026-06-01", endDate: "2027-05-31" }`
2. System auto-generates 8 `Semester` records (I–VIII) with numbers 1–8, names like "Semester 1", "Semester 2", etc.
3. Only one AcademicYear can be ACTIVE at a time

### How are semesters created?

Auto-created as part of AcademicYear creation. Never created manually. The `activeSemesterType` (ODD/EVEN) determines which semesters are shown by default in dropdowns — it's an operational filter, not a restriction.

### How are subjects assigned?

1. Coordinator creates a `Subject` with a `semesterNumber` (e.g. 5) and `departmentId` (e.g. CSE)
2. Subject is implicitly "assigned" to that semester number — but this is a static value, NOT a FK to any Semester record
3. The subject belongs to the department via FK
4. To actually use the subject in an exam, it must be "linked to an exam cycle" via `SubjectExamCycleLink`

### How does a coordinator know which subjects belong to which semester?

The coordinator filters subjects by `semesterNumber`. The UI shows subjects for a given semester number. But the semester number is just an integer on the Subject — it's not validated against any Semester record.

### How are exam cycles related?

Each `ExamCycle` has FK to: `semesterId` (a specific Semester record), `academicYearId` (the AcademicYear), `departmentId` (the Department). These three establish the context: "ENDSEM exam for Sem 5 of AY 2026-2027, CSE department."

Multiple exam cycles can exist for the same semester — one per exam type (ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT).

### What actually identifies the student cohort today?

**Nothing.** There is no entity for batch, intake, programme, or cohort. The closest approximation is: an ExamCycle for a given (department, semester, academic year) implicitly refers to a cohort. E.g., "Semester 5 of AY 2026-2027 for CSE" = the 2024 batch's Sem 5. But this is an **assumption**, not modeled data.

### How does the system distinguish papers from different years?

Papers are tied to QuestionBanks, which are tied to ExamCycles, which are tied to AcademicYears. So "the Sem 5 ENDSEM paper for CSE in AY 2026-2027" is distinct from "the Sem 5 ENDSEM paper for CSE in AY 2027-2028." The papers are distinguished by their ExamCycle's academic year.

### Can multiple intakes coexist correctly?

**Partially.** If two intakes are in different semesters (e.g., 2024 batch in Sem 5, 2025 batch in Sem 3), the system can create separate exam cycles for each. They would be:
- "CSE Sem 5, AY 2026-2027, ENDSEM" (2024 batch)
- "CSE Sem 3, AY 2026-2027, ENDSEM" (2025 batch)

Both exam cycles exist in the same AcademicYear (2026-2027) but different Semesters (Sem 5 vs Sem 3). This works because Semester is numbered and multiple semesters exist per year.

However, **the system fails** if the two batches have different calendars — e.g., 2024 batch is delayed and takes Sem 5 exams in January while 2025 batch takes Sem 3 exams in November. Currently, ALL exam cycles for a given semester within a year share the same time context.

---

## Phase 3 — Challenges to the Existing Model

### Hidden Assumptions

1. **All students in a department follow one curriculum.** There's no programme differentiation. B.Tech CSE, M.Tech CSE, and B.Tech CSE (AI specialization) all map to "CSE department, same subjects." In reality, they have different curricula.

2. **All batches progress uniformly.** The system assumes every cohort moves at the same pace. There's no mechanism for a batch being delayed, accelerated, or having a different academic calendar.

3. **One department = one curriculum owner.** In reality, a department may offer multiple programmes with different subject requirements.

4. **Semester 5 always means 5th semester of a 4-year program.** The number is hardcoded 1-8. If a programme has 6 semesters (some M.Tech programs), this breaks.

5. **Subject ownership is always departmental.** Cross-department subjects (e.g., Mathematics taught by the Math department to CSE students) are not modeled. A subject belongs to exactly one department.

6. **Exam cycles are only for one exam type per (dept, sem).** The unique constraint is `(semesterId, examType, departmentId)`. This means one ENDSEM per dept per sem. But what if a department has two programmes (B.Tech, M.Tech) both taking exams in the same semester?

7. **Subjects are static across cohorts.** Subject.semesterNumber is a fixed integer. But if the curriculum changes — e.g., a subject moves from Sem 5 to Sem 4 for the 2025 batch — there's no way to model this. SubjectVersion handles syllabus changes but not schedule changes.

### Incorrect Abstractions

1. **Subject.semesterNumber is a phantom.** It's an integer, not a FK. It has no relationship to any Semester record. It's purely a display/filter value. Its only real use is matching subjects to exam cycles during seeding.

2. **AcademicYear conflates time and progression.** It means "calendar year" but is used as if it represents "which year of study" indirectly.

3. **Department is overloaded.** It represents: organizational unit, curriculum owner, student home, and exam-cycle scope. These should be separate concerns.

### Missing Business Entities

1. **Programme** — B.Tech, M.Tech, Ph.D, Diploma. Different duration, different curriculum, different nomenclature.
2. **Batch / Intake / Cohort** — Which year students entered. The 2024 batch, 2025 batch, etc.
3. **Section / Division / Group** — Students split into groups for lab/study purposes.
4. **Student** — There is NO student entity in the system. The system manages exam workflows, not students. This is intentional (it's an exam management system, not an SIS), but it limits the model.
5. **Programme-Curriculum mapping** — Which subjects belong to which programme's which semester.

### Tight Coupling

1. **ExamCycle binds department, academic year, and semester in one record.** Any change to this relationship requires recreating cycles.
2. **QuestionBank is tied to (Subject, ExamCycle).** Cannot have a bank span multiple exam cycles.
3. **Subject is tied to one department.** Cross-department subjects require duplicate Subject records.

### Domain Ambiguity

- **What is Subject.semesterNumber?** Is it: "this subject is taught in sem 5" OR "this subject should be available for sem 5 exam cycles"? It's treated as the latter, but labeled as the former.
- **What is an ExamCycle?** Is it: "an exam event" OR "a container for question banks"? Both, which is fine architecturally, but the name is ambiguous.
- **What is AcademicYear.activeSemesterType?** Is it: "which semesters are happening now" OR "which semesters to show by default"? The latter.

### Data Duplication

- **Subject.semesterNumber** duplicates information that could be derived from Programme-Curriculum mappings.
- **SubjectVersion.effectiveFromAcademicYearId** duplicates information: if a subject belongs to a programme, and the programme has an effective year, this could be derived.

---

## Phase 4 — Scenario Comparison

### Scenario A: 2024 Intake, Semester 1, Multiple Departments

> 2024 intake starts. ES&H department teaches Physics and Chemistry to CSE, IT, and AI students. Different admission dates. Different semester start dates.

**Assessment: IMPOSSIBLE in current architecture**

| Requirement | Current Support | Why |
|-------------|----------------|-----|
| Common subjects taught by another department | ❌ Not supported | A Subject belongs to exactly one Department. Physics under the ES&H department can't be assigned to CSE students. |
| Different admission dates | ❌ Not supported | No Intake/Batch entity exists. Admission date is not modeled. |
| Different semester start dates | ❌ Not supported | AcademicYear has one startDate. All departments share the same semester timeline. |

**What would need to happen:** Create duplicate Subject records — "Physics for CSE" owned by CSE dept, "Physics for IT" owned by IT dept. This violates reality (Physics is an ES&H subject, not a CSE subject). Different start dates would require manual workarounds.

---

### Scenario B: Semester 3, Students Branch into Specializations

> After Sem 2, CSE students branch into CSE, IT, AI, Cyber Security. Different departments, different subjects.

**Assessment: PARTIALLY SUPPORTED**

| Requirement | Current Support | Why |
|-------------|----------------|-----|
| Students in different departments | ✅ Supported | Each department has its own subjects |
| Subject prerequisites from earlier semesters | ❌ Not supported | No mechanism to say "Sem 3 subject X requires Sem 1 subject Y" |
| Students carry credit from common Sem 1-2 | ❌ Not supported | No student record. No credit transfer tracking. |
| Different departments, different subjects | ✅ Supported | Each department can have its own subject list |

**What works:** The system handles this through the Department + Subject model. Each department creates its own subjects for Sem 3.

**What doesn't work:** The system can't model that "CSE students in Sem 3 take subject X" vs "AIDS students in Sem 3 take subject Y." It assumes all subjects for a department belong to that department exclusively.

---

### Scenario C: 2025 Intake Joins While 2024 Batch Is in Sem 3

> Two batches coexist in the same academic year but different semesters.

**Assessment: FULLY SUPPORTED**

| Requirement | Current Support | Why |
|-------------|----------------|-----|
| 2024 batch in Sem 3 | ✅ Supported | Create ExamCycle for Sem 3 of AY (e.g., 2025-2026) |
| 2025 batch in Sem 1 | ✅ Supported | Create ExamCycle for Sem 1 of same AY |
| Both in same academic year | ✅ Supported | AcademicYear has all 8 semesters |
| Separate question banks | ✅ Supported | Banks are per (Subject, ExamCycle) — different cycles = different banks |

**Why it works:** The system models time via AcademicYear and stage via Semester number. Two batches at different stages in the same time period just means two different semester numbers within the same AcademicYear. This is well-supported.

**Caveat:** The implicit batch identity is still not modeled. The system works because it treats each exam cycle independently, not because it understands cohorts.

---

### Scenario D: One Batch Is Delayed, Another Starts Early

> 2024 batch is delayed by one semester. 2025 batch starts on time.

**Assessment: PARTIALLY SUPPORTED with workarounds**

| Requirement | Current Support | Why |
|-------------|----------------|-----|
| 2024 batch takes Sem 3 exams in AY 2026-2027 (delayed) | ✅ Supported | Can create exam cycle for Sem 3 in AY 2026-2027 |
| 2025 batch takes Sem 3 exams in AY 2026-2027 (on time) | ⚠️ Unique constraint violation | `(semesterId, examType, departmentId)` — can't have two ENDSEM cycles for same (Sem 3, CSE) |
| Cohorts diverge | ❌ Not supported | No way to say "this exam cycle is for the 2024 batch, this one for 2025 batch" |

**Workaround:** The department would need to offset one batch's exams into a different semester slot, use different exam types, or create artificial distinctions. This is fragile and error-prone.

**Root cause:** ExamCycle's unique constraint `(semesterId, examType, departmentId)` assumes one exam event per (sem, type, dept). When two cohorts of the same department need the same exam type for the same semester, the system blocks it.

---

### Scenario E: Two Batches with Different Semester Calendars

> 2024 batch follows a semester system. 2025 batch follows a trimester system. Or: 2024 batch has a 4-year program, 2025 batch has a 3-year program.

**Assessment: IMPOSSIBLE in current architecture**

| Requirement | Current Support | Why |
|-------------|----------------|-----|
| Different semester structures | ❌ Not supported | All semesters are 1-8, hardcoded per academic year |
| Different program durations | ❌ Not supported | No Programme entity. Sem 1-8 implies 4 years. |
| Different intake cycles | ❌ Not supported | No intake/batch model |

**Root cause:** The system hardcodes the "8 semesters per academic year" model. Any deviation requires schema changes.

---

### Scenario Summary

| Scenario | Assessment |
|----------|-----------|
| A: Multi-dept common subjects, different start dates | **IMPOSSIBLE** |
| B: Sem 3 branching into specializations | **PARTIALLY SUPPORTED** |
| C: Two intakes coexisting in different semesters | **FULLY SUPPORTED** |
| D: Delayed batch conflicting with on-time batch | **PARTIALLY SUPPORTED** (blocked by unique constraint) |
| E: Different semester structures per cohort | **IMPOSSIBLE** |

---

## Phase 5 — Challenging My Own Conclusions

### Counterargument: "The current architecture is fine"

Let me argue against every criticism I've made:

**Objection 1: "We don't need Programme — Department is enough."**

In many Indian engineering colleges, the department IS the programme. "CSE Department" offers only "B.Tech in CSE." The subjects listed under the department are the programme's curriculum. If your college works this way, introducing Programme adds complexity without benefit.

**Counter:** If your college has even ONE department offering multiple programmes (B.Tech CSE + M.Tech CSE + B.Tech CSE-AIML), then Department as Programme fails.

**Objection 2: "We don't need Batch — the system doesn't manage students."**

EMQPGS is an examination management system, not a Student Information System (SIS). It doesn't need to know which students are in which batch. It only needs to know: "For this exam cycle, here are the question banks." The batch identity is irrelevant to paper generation.

**Counter:** The batch identity matters when:
- Two cohorts need exams for the same semester (Scenario D)
- Different cohorts have different syllabi
- Paper archives need to be tagged with which batch they were for
- The system needs to generate per-batch reports

But for the current workflow (question contribution → moderation → generation → export), batch identity is truly not needed. The ExamCycle's academic year + semester provides enough context for paper generation.

**Objection 3: "Subject.semesterNumber is fine as a static value."**

A subject is taught at a specific point in the curriculum. "Data Structures" is always a Sem 3 subject. It doesn't matter which cohort — Sem 3 is Sem 3. The mapping is correct.

**Counter:** Subject.semesterNumber is fine ONLY IF the curriculum never changes. If Data Structures moves from Sem 3 to Sem 4 for the 2025 batch, the model breaks. SubjectVersion handles syllabus changes but not schedule changes. However, in practice, curricula change infrequently, and a new Subject record (with new code) is often created for the new schedule.

**Objection 4: "Cross-department subjects are rare."**

In many colleges, common subjects (Mathematics, Physics, English) are taught by specialized departments. But for exam management, what matters is: which department's students are taking the exam? The subject is always listed under the offering department. The exam is scoped to the department. If CSE students take Mathematics, the exam cycle is under CSE, not the Math department.

**Counter:** This works IF the exam is managed by CSE's coordinator. The Math department would not be involved in question creation/moderations for CSE's Mathematics exam. In practice, this is how many colleges operate — the offering department manages the exam.

**Objection 5: "The unique constraint on ExamCycle works for normal operation."**

Under normal conditions, there is exactly one ENDSEM per (semester, department). Batches don't overlap because they're in different semesters at any given time. The 2024 batch is in Sem 5 when the 2025 batch is in Sem 3. No conflict.

**Counter:** This is true for ideal, non-delayed batches. But delays happen. Student batch overlaps exist. The unique constraint is an assumption of ideal operation, not a defense against real-world edge cases.

**Objection 6: "Adding Batch/Programme would complicate queries."**

Currently, every query is scoped to (department, academic year, semester). Adding cohort/batch would add another dimension. Every query would need to filter or join on cohort. This increases complexity, query time, and bug surface.

**Counter:** Valid concern. The current system is simpler because it avoids these concepts. The question is: does the business need them? If the college never has overlapping cohorts needing the same exam type for the same semester, then the added complexity is unjustified.

### Final Verdict After Self-Challenge

| Proposed Entity | Do we truly need it? | Can existing entities represent it? | Verdict |
|----------------|---------------------|-------------------------------------|---------|
| Programme | Only if one department offers multiple programmes | Department could be renamed/reinterpreted | **Questionable** — depends on college structure |
| Batch / Intake | Only if batches can be delayed or overlap | Partially via ExamCycle + AcademicYear | **Useful but not critical** |
| Student | No — out of scope for exam management | Not needed | **Reject** |
| Section / Group | Only if slots differ by section | Not needed — question banks are per exam cycle | **Reject** |
| Programme-Curriculum mapping | Useful for subject-to-semester assignment | Current model hardcodes semesterNumber on Subject | **Low priority** |
| Cross-dept subject linking | Useful for common subjects | Can workaround via duplicate subjects | **Low priority** |

**Conclusion:** The current architecture works for the common case (ideal, no overlapping cohorts, one programme per department). The gaps are in edge cases (delayed batches, multiple programmes, cross-department subjects). Whether these gaps need addressing depends on the college's actual operational reality.

---

## Phase 6 — Redesign Proposal (If Justified)

**Only if** the college operates with multiple programmes per department, handles delayed batches regularly, or has cross-department common subjects, here is the proposed architecture.

### Domain Model (Before)

```
AcademicYear ─1:N─ Semester ─1:N─ ExamCycle
Department ─1:N─ Subject ─1:N─ QuestionBank
Subject.semesterNumber = static integer
```

### Domain Model (After)

```
AcademicYear ─1:N─ Semester (calendar instances)
Programme ─1:N─ Batch (intake year)
Programme ─1:N─ ProgrammeSubject (curriculum mapping)
Department ─1:N─ Programme (only if 1 dept → N programmes)
ExamCycle ─N:1─ Batch (optional — links cycle to cohort)
Subject ─N:1─ Department (still owns the subject)
ProgrammeSubject ─N:1─ Subject (which subjects in which semester for which programme)
```

### Proposed New Entities

#### Programme

| Aspect | Detail |
|--------|--------|
| **Purpose** | A degree programme offered by a department |
| **Examples** | B.Tech CSE, M.Tech CSE, B.Tech CSE-AIML |
| **Key fields** | `name`, `code`, `departmentId`, `durationInSemesters`, `degreeType` |
| **Why not existing entities** | Department is an organizational unit, not a programme. One dept can have multiple programmes. Subject.semesterNumber assumes a single curriculum per dept. |

#### Batch (Intake / Cohort)

| Aspect | Detail |
|--------|--------|
| **Purpose** | A group of students who entered together |
| **Examples** | "2024 B.Tech CSE Batch", "2025 M.Tech CSE Batch" |
| **Key fields** | `name` ("2024-2028 B.Tech CSE"), `programmeId`, `academicYearId` (admission year), `status` |
| **Why not existing entities** | AcademicYear is calendar time, not student progression. No existing entity represents "which year the students entered." |

#### ProgrammeSubject (Curriculum Mapping)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Maps subjects to programme-semester positions |
| **Replaces** | Subject.semesterNumber |
| **Key fields** | `programmeId`, `subjectId`, `semesterNumber`, `effectiveFromBatchId` |
| **Why needed** | Different programmes have different subject-semester mappings. A subject can move between semesters for different batches. |

#### Potential ExamCycle Changes

| Change | Detail |
|--------|--------|
| `ExamCycle.batchId` | Optional FK to Batch. Links cycle to cohort. |
| Relax unique constraint | From `(semesterId, examType, departmentId)` to `(batchId, semesterId, examType)` |

**Why not make batchId required:** For backward compatibility and simplicity. When no batch overlap exists, the field can be null and behavior is identical to today.

---

## Phase 7 — Before vs After

### Entity Relationship Diagram

**Current:**
```
AcademicYear ─1:N─ Semester
Department ─1:N─ Subject ─1:N─ SubjectVersion ─1:N─ QuestionLibraryItem
Department ─1:N─ ExamCycle ─1:N─ QuestionBank ─1:N─ QuestionSlot ─N:1─ QuestionLibraryItem
Subject.semesterNumber (denormalized)
```

**Proposed:**
```
AcademicYear ─1:N─ Semester
Department ─1:N─ Programme ─1:N─ Batch
Programme ─1:N─ ProgrammeSubject ─N:1─ Subject ─1:N─ SubjectVersion ─1:N─ QuestionLibraryItem
Department ─1:N─ Subject (still owns the subject)
Department ─1:N─ ExamCycle
Batch ─N:1─ ExamCycle (optional link)
ExamCycle ─1:N─ QuestionBank ─1:N─ QuestionSlot ─N:1─ QuestionLibraryItem
```

### Workflow Changes

**Current:** Subject.semesterNumber → filter subjects → link to exam cycle → create bank
[Assumption: one curriculum per department]

**Proposed:** Select Programme → Select Batch → See ProgrammeSubjects → filter by semester → link to exam cycle → create bank
[Explicit: which programme, which cohort]

### COE Workflow Changes

**Current:**
1. Create AcademicYear
2. Create Departments
3. Create ExamCycles
4. Assign Coordinators

**Proposed:**
1. Create AcademicYear
2. Create Programmes (under departments)
3. Create ProgrammeSubject mappings (which subjects in which semester for which programme)
4. Manage Batches (admission year, status, delays)
5. Create ExamCycles (optionally linked to batch)
6. Assign Coordinators

### Coordinator Workflow Changes

**Current:**
1. Create Subject (assign semesterNumber)
2. Link Subject to ExamCycle
3. Initialize QuestionBank

**Proposed:**
1. Create Subject (semesterNumber removed from Subject)
2. Map Subject to Programme via ProgrammeSubject (which sem, for which programme)
3. Link Subject to ExamCycle (can specify batch)
4. Initialize QuestionBank

### Exam Cycle Creation Changes

**Current:** COE picks (department, academic year, semester, exam type). Unique on `(semesterId, examType, departmentId)`.

**Proposed:** COE picks (programme, batch, academic year, semester, exam type). Unique on `(batchId, semesterId, examType)` or `(programmeId, semesterId, examType)`.

### Question Bank Lifecycle — No change

The bank lifecycle (DRAFTING → MODERATION → APPROVAL → COMPLETE) is unchanged. Banks are still per (Subject, ExamCycle). The only difference is ExamCycle now has an optional batch/programme reference.

### Paper Archive Flow — Improved

**Current:** Papers identified by (ExamCycle → AcademicYear + Semester + Department).

**Proposed:** Papers identified by (ExamCycle → Batch → Programme + AcademicYear + Semester). This allows queries like "all Sem 5 papers for the 2024 B.Tech CSE batch."

---

## Phase 8 — Impact Analysis

> **Estimated effort is relative — small (1-3 days), medium (1-2 weeks), large (2-4 weeks).**

| Area | Why Changes | Effort | Migration Complexity | Risk |
|------|-------------|--------|---------------------|------|
| **Schema** | Add Programme, Batch, ProgrammeSubject models. Modify ExamCycle (optional batchId). Deprecate Subject.semesterNumber. | Medium | Medium | Medium — adding new tables with FKs to existing data |
| **Prisma models** | Generate new models. Update existing (ExamCycle, User for programme?) | Small | Low | Low — additive change |
| **Seed** | Add Programme, Batch, ProgrammeSubject seeding. Update ExamCycle seeding. | Medium | Low | Low — dev data only |
| **Repositories** | New repositories for Programme, Batch, ProgrammeSubject. | Small | Low | Low — additive |
| **Services** | New services (Programme, Batch, CurriculumMapping). Updated ExamCycleService (batch validation). Removed Subject.semesterNumber logic. | Medium | Medium | Medium — existing logic assumes semesterNumber on Subject |
| **API routes** | New CRUD routes for Programme, Batch, ProgrammeSubject. Updated ExamCycle routes. | Medium | Low | Low — additive with backward compat |
| **Validation** | Zod schemas for new entities. Updated ExamCycle validation. | Small | Low | Low |
| **Dashboard pages** | New pages for Programme/Batch management (COE). Updated exam cycle forms (add batch/programme selector). | Large | Medium | Medium — UI changes affect coordinator and COE workflows |
| **Forms** | Exam cycle creation form needs batch/programme dropdowns. Subject creation form removes semesterNumber. | Medium | Low | Low |
| **RBAC** | Programme and Batch likely COE-only. No new roles needed. | Small | Low | Low |
| **Business rules** | Updated uniqueness rules for ExamCycle. New rules for curriculum mapping (no duplicate mapping). | Small | Medium | Medium — unique constraint change is a breaking change |
| **Reports/Analytics** | Updated to include programme/batch filters. | Medium | Low | Low — additive |
| **Exports** | Paper metadata can include programme/batch info. | Small | Low | Low |
| **Tests** | New tests for new services. Updated existing tests for modified logic. | Large | Low | Low — greenfield test work |
| **Documentation** | Update all docs. | Medium | Low | Low |

### Risk Assessment by Area

| Risk Level | Areas |
|------------|-------|
| **High** | None identified — all changes are additive with backward compatibility |
| **Medium** | Schema migration (new FKs), Unique constraint on ExamCycle (requires data migration), Service logic (Subject.semesterNumber deprecation) |
| **Low** | All other areas |

### Key Risks

1. **ExamCycle unique constraint change** — Current `(semesterId, examType, departmentId)` would need to become `(semesterId, examType, programmeId)` or `(semesterId, examType, batchId)`. Changing uniqueness is a data migration: existing records need a programme/batch assigned. If programme is added, every department gets a default programme.

2. **Subject.semesterNumber deprecation** — Every place that reads `subject.semesterNumber` needs to switch to `ProgrammeSubject.semesterNumber`. This is pervasive across services, API responses, and UI components.

3. **Query complexity** — Adding batch/programme to queries adds JOINs. Dashboard queries that aggregate across exam cycles would need programme/batch filtering.

---

## Phase 9 — Migration Strategy

> **Assumes a decision is made to implement. Zero data loss is required.**

### Step 1: Add New Tables (Additive)

Create `Programme`, `Batch`, `ProgrammeSubject` tables. Add `batchId` as nullable FK on `ExamCycle`. Add `programmeId` as nullable FK on `ExamCycle`.

**Migration SQL:**
```sql
-- Add new tables
CREATE TABLE Programme (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  departmentId VARCHAR(30) NOT NULL REFERENCES Department(id),
  durationInSemesters INT NOT NULL DEFAULT 8,
  degreeType VARCHAR(50),
  isActive BOOLEAN DEFAULT true,
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE Batch (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  programmeId VARCHAR(30) NOT NULL REFERENCES Programme(id),
  academicYearId VARCHAR(30) NOT NULL REFERENCES AcademicYear(id),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  admissionDate DATE,
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE ProgrammeSubject (
  id VARCHAR(30) PRIMARY KEY,
  programmeId VARCHAR(30) NOT NULL REFERENCES Programme(id),
  subjectId VARCHAR(30) NOT NULL REFERENCES Subject(id),
  semesterNumber INT NOT NULL,
  effectiveFromBatchId VARCHAR(30) REFERENCES Batch(id),
  UNIQUE(programmeId, subjectId, semesterNumber)
);

-- Add optional FK on ExamCycle
ALTER TABLE ExamCycle ADD COLUMN programmeId VARCHAR(30) REFERENCES Programme(id);
ALTER TABLE ExamCycle ADD COLUMN batchId VARCHAR(30) REFERENCES Batch(id);
```

### Step 2: Data Migration (Backfill)

1. Create one default `Programme` per Department: "B.Tech in {Department.name}"
2. Create one default `Batch` per Programme: "{current year} intake" linked to active AcademicYear
3. Create `ProgrammeSubject` records: for each Subject, create a mapping: `(defaultProgrammeId, subjectId, subject.semesterNumber)`
4. Backfill `ExamCycle.programmeId` and `ExamCycle.batchId` from the default records

### Step 3: API Compatibility

- Existing API endpoints that return `Subject.semesterNumber` still include it (deprecated but present)
- New API endpoints return `ProgrammeSubject.semesterNumber`
- Frontend can migrate gradually: show programme/batch selectors, fallback to default

### Step 4: Gradual Frontend Migration

1. Phase 1: Add Programme/Batch management pages (COE only). No workflow changes.
2. Phase 2: Add programme/batch selectors to ExamCycle creation form. Default to existing behavior.
3. Phase 3: Add ProgrammeSubject management (COE/Coordinator). Migrate Subject creation form.
4. Phase 4: Remove Subject.semesterNumber from Subject model and API responses.

### Step 5: Rollback Strategy

1. All new columns are nullable — rollback = stop using new features
2. Deprecation of Subject.semesterNumber is reversible (data still exists)
3. Migration steps are incremental — each deploy is backward compatible

### Deployment Order

```
1. Schema migration (new tables, nullable columns)
2. Data migration (backfill defaults)
3. Backend: new services, updated exam cycle logic
4. Frontend: new pages, updated forms
5. Deprecation phase (6 months): Subject.semesterNumber still present but marked deprecated
6. Cleanup: remove Subject.semesterNumber
```

---

## Phase 10 — Final Recommendation

### Recommendation: **Option 2 — Make only small targeted improvements.**

**Do NOT implement a full domain redesign.**

### Reasoning

1. **The existing architecture works for the common case.** The core workflow (question contribution → moderation → approval → generation → export) is clean, well-designed, and handles the standard academic scenario without issues.

2. **The gaps are edge cases, not systemic failures.** The scenarios that fail (A, D, E) require specific conditions (delayed batches, overlapping cohorts, multiple programmes per department) that many colleges never encounter. Scenario C (two intakes coexisting) actually works today.

3. **Batch/Programme add significant complexity.** Every query becomes 1-2 JOINs heavier. Every API response needs batch/programme context. Every form gets another dropdown. The migration is medium-to-large effort with ongoing maintenance cost.

4. **The system doesn't manage students.** EMQPGS is an exam management system, not a student information system. Adding batch/programme without adding student records is adding half a feature — it creates the referential structure without the actual data (students) that gives it meaning.

5. **The cost-benefit ratio favors small improvements.** The specific edge cases (delayed batches, programme diversity) can be addressed with targeted fixes rather than a domain redesign.

### Targeted Improvements (Not Full Redesign)

If the specific problems from Phase 4 need addressing, here are minimal fixes:

| Problem | Minimal Fix | Effort |
|---------|------------|--------|
| Scenario D: Two batches need same exam type for same semester | Relax ExamCycle unique constraint: add `batchId` column (nullable). Unique becomes `(batchId, semesterId, examType)` — null = legacy behavior. | Small (1 schema change + 1 validation update) |
| Scenario A: Cross-department subjects | Add `Subject.offeredToDepartmentIds` JSON field (list of dept IDs that can link this subject to their exam cycles). Or create `SubjectDepartment` join table. | Small (additive, no migrations to existing data) |
| Programme differentiation | Add `Programme` table with FK from `Department`. Add `ProgrammeSubject` table. Keep `Subject.semesterNumber` for backward compatibility. Default programme = "B.Tech in {dept}" | Medium (but purely additive) |
| Paper archive search by year | Already works via AcademicYear. If by batch needed: add `batchId` FK on ExamCycle (nullable). | Small |

### What I Recommend Against Changing

- **QuestionSlot / QuestionBank linkage** — The sole-linkage pattern is excellent. Keep it.
- **Two-axis bank state** (Phase + RecordStatus) — Orthogonal state machines are correct. Keep them.
- **Question lifecycle** (DRAFT → PENDING → APPROVED/REJECTED) — Clean and complete. Keep it.
- **ReadinessEngine** (advisory, not blocking) — This is a good design choice. Keep it.
- **Snapshot immutability** — Correct for audit. Keep it.

### Summary

| Consideration | Verdict |
|---------------|---------|
| Does the architecture work for the common case? | ✅ Yes |
| Are the edge cases business-critical? | ❓ Depends on the college |
| Would a redesign make things better? | ⚠️ Would add complexity with uncertain ROI |
| Can edge cases be fixed with small changes? | ✅ Yes |
| **Final recommendation** | **Option 2 — Small targeted improvements** |

The implementation plan file concludes here. If a decision is made to proceed with the full redesign, this document contains the detailed blueprint. Otherwise, the analysis provides a reference for evaluating whether the specific edge cases that affect your institution warrant even the minimal targeted improvements.

**End of architecture review.**
