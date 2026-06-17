# Architecture Investigation: Batch vs Academic Year vs Semester

> **Status:** Architecture Review (read-only)
> **Date:** 2026-06-17
> **Scope:** Domain analysis, gap identification, design comparison, recommendation

---

## Part 1 — The Current Model, Explained

### 1.1 AcademicYear

| Property | Value |
|---|---|
| **Represents** | A temporal span, e.g. "June 2026 — May 2027" |
| **Who creates it** | The COE |
| **When** | Before exams begin for that year. Typically one active year at a time |
| **Permanent?** | Yes. Years are never deleted — they transition from ACTIVE → CLOSED |
| **Key fields** | `code` ("2026-2027"), `startDate`, `endDate`, `status` (ACTIVE/CLOSED), `activeSemesterType` (ODD/EVEN) |
| **Role in workflow** | Container for all semesters, exam cycles, and subject versions. The `activeSemesterType` controls UI filters |

**How it's created:** The COE opens a form, enters the code (YYYY-YYYY), picks dates, and selects ODD or EVEN. The system auto-generates all 8 Semester rows (numbered 1–8 with Roman names I–VIII) in the same transaction.

**Critical detail:** AcademicYear currently serves **two distinct purposes** that should be separate:
1. A **temporal container** (grouping semesters by time period)
2. A **progression proxy** (via `activeSemesterType`, pretending to track "which half of the year we're in")

### 1.2 Semester

| Property | Value |
|---|---|
| **Represents** | A numbered academic term within a year (1–8) |
| **Who creates it** | Auto-created when AcademicYear is created |
| **When** | 8 semesters created at once during AcademicYear creation |
| **Permanent?** | Yes. Semesters are static reference-rows that never change |
| **Key fields** | `number` (1–8), `name` ("Semester V"), `academicYearId` FK |
| **Role in workflow** | Exam cycles link to Semesters. `activeSemesterType` on the year determines which semesters the UI shows as "active" |

**Critical detail:** Semester is **reference data**, not operational data. Semesters are never created individually in normal operation — they come in a batch of 8 when the AcademicYear is created. They never change status, never "close" or "open" on their own. The concept of "which semester are we in" does not exist as a database state — it's inferred from the `activeSemesterType` flag.

### 1.3 Department

| Property | Value |
|---|---|
| **Represents** | An academic department (COMP, AIDS, CIVL, etc.) |
| **Who creates it** | The COE |
| **When** | During system setup. Rarely changed after |
| **Permanent?** | Yes. Soft-deletable via `isActive` flag |
| **Role in workflow** | Scopes subjects, exam cycles, users. Everything is department-scoped |

### 1.4 Subject

| Property | Value |
|---|---|
| **Represents** | A course offering (e.g. "Machine Learning" in COMP) |
| **Who creates it** | The coordinator |
| **When** | When a new course is introduced. Persists across academic years |
| **Permanent?** | Yes. Soft-deletable via `status` (ACTIVE/INACTIVE) |
| **Key fields** | `subjectCode`, `subjectName`, `semesterNumber` **(int, not FK)**, `credits`, `departmentId` FK, `questionBankDueDate` |
| **Role in workflow** | Subjects are linked to exam cycles via SubjectExamCycleLink. Question banks belong to a (subject, exam cycle) pair |

**Critical design smell:** `Subject.semesterNumber` is a plain integer (1–8), **not a foreign key to Semester**. This means:
- You can set `semesterNumber = 5` even if no Semester with number 5 exists in any AcademicYear
- You can't navigate from Subject → Semester → AcademicYear via Prisma relations
- The number is purely a label — there's no referential integrity

### 1.5 SubjectVersion

| Property | Value |
|---|---|
| **Represents** | A specific version of a subject's syllabus |
| **Who creates it** | The coordinator |
| **When** | When the syllabus changes. Version 1 is auto-created with the Subject |
| **Permanent?** | Yes. Previous versions are archived (never deleted) |
| **Key fields** | `versionNumber` (auto), `effectiveFromAcademicYearId` FK, `status` (ACTIVE/ARCHIVED) |
| **Role in workflow** | Question library items are scoped to a SubjectVersion, not to a Subject. This ensures questions match the syllabus version |

### 1.6 ExamCycle

| Property | Value |
|---|---|
| **Represents** | A specific examination event (e.g. "ENDSEM Sem 5 COMP Nov 2026") |
| **Who creates it** | The COE |
| **When** | Before exams for a given semester. Created per (semester, examType, department) |
| **Permanent?** | Eventually CLOSED, but never deleted |
| **Key fields** | `examType` (ISE_1, ISE_2, ENDSEM, SUPPLEMENTARY, KT), `status` (DRAFT/ACTIVE/CLOSED), `departmentId`, `academicYearId`, `semesterId` (all FKs) |
| **Unique constraint** | `@@unique([semesterId, examType, departmentId])` |

**Critical detail:** The ExamCycle is **the entity that actually drives the workflow**. Without an ExamCycle, there are no question banks, no slots, no questions, no moderation, no papers. Everything flows from the ExamCycle.

### 1.7 QuestionBank

| Property | Value |
|---|---|
| **Represents** | A container of question slots for a (subject, exam cycle) pair |
| **Who creates it** | The coordinator |
| **When** | After a subject is linked to an exam cycle |
| **Permanent?** | Eventually in COMPLETE phase. Snapshot taken on lock |
| **Unique constraint** | `@@unique([subjectId, examCycleId])` — one bank per subject per cycle |

### 1.8 Entity Relationship (Current Model)

```
AcademicYear ──┬── Semester (1..8, auto-created)
               │
               ├── ExamCycle (per semesterId + examType + departmentId)
               │       └── SubjectExamCycleLink ── Subject
               │               └── SubjectVersion (has effectiveFromAcademicYearId)
               │       └── QuestionBank (per subjectId + examCycleId)
               │               ├── PaperPattern
               │               ├── QuestionSlot (126 pre-allocated)
               │               └── QuestionLibraryItem (scoped to SubjectVersion)
               │
               └── SubjectVersion (via effectiveFromAcademicYearId)
```

**Key observation:** Subject has `semesterNumber` (int) that is NOT connected to the Semester model. The only entity that connects to Semester via a proper FK is ExamCycle. This means the chain `Subject → ExamCycle → Semester → AcademicYear` works for navigation, but `Subject.semesterNumber` is a redundant denormalization.

---

## Part 2 — Trace the Current Workflow

Let's trace the 2024 batch entering college and progressing through 8 semesters.

### Assumptions for this trace
- The system does NOT track individual students
- Subjects are pre-configured with `semesterNumber` indicating which semester they belong to
- The COE creates exam cycles each semester
- Each batch's progression is purely implied by which exam cycles exist

### Year 1, Semester 1 (Odd) — e.g. July 2024

**What happens in the real world:** 2024 batch joins college. First semester exams happen.

**What happens in the system:**

1. **Row created:** AcademicYear "2024-2025" with `activeSemesterType: ODD`
   - 8 Semester rows auto-created (1–8) — the 2024-2025 AcademicYear gets Semesters I through VIII

2. **Rows created:** ExamCycles for Sem 1
   - The COE creates exam cycles: `(semesterId: Sem1, examType: ENDSEM, departmentId: COMP)` etc.
   - One cycle per department × exam type per semester
   - Each cycle has `academicYearId: 2024-2025` and `semesterId: sem1`

3. **Rows linked:** Subjects are linked to cycles
   - Coordinator links subjects with `semesterNumber: 1` to the Sem 1 cycles
   - e.g., Subject "Mathematics I" (semesterNumber=1) gets linked to COMP's ENDSEM cycle

4. **Rows created:** Question banks for each linked subject-cycle pair

5. **Rows created:** Questions, slot assignments, moderation, papers, etc.

**Rows that remain unchanged:**
- Department rows (unchanged since setup)
- User rows (unless new staff join)
- Subject definitions (they persist with their semesterNumber)

### Year 1, Semester 2 (Even) — e.g. December 2024

**What happens:**

1. **No new AcademicYear needed** — 2024-2025 still active. But `activeSemesterType` needs to change to EVEN
   - **Problem:** Does the COE update the existing year? Or is there a UI for this? There's no dedicated "Flip activeSemesterType" button. The COE would PATCH the AcademicYear.

2. **Rows created:** New ExamCycles for Sem 2
   - `(semesterId: sem2, examType: ENDSEM, departmentId: COMP)` etc.

3. **Rows linked:** Subjects with `semesterNumber: 2` get linked (if any exist)

4. **Rows created:** New question banks for Sem 2

**Rows that remain unchanged:**
- All Sem 1 exam cycles (now completed in the real world, but system may or may not CLOSE them)
- All Sem 1 question banks
- The AcademicYear row itself (only `activeSemesterType` changed)
- Subject rows (unchanged)

**Problem already visible:** What happened to the Sem 1 data? It stays in the database forever. Was the Sem 1 exam cycle marked CLOSED? There's no automatic closure when a semester ends.

### Year 2, Semester 3 (Odd) — e.g. July 2025

**What happens:**

1. **New AcademicYear needed:** "2025-2026" with `activeSemesterType: ODD`
   - 8 Semester rows auto-created for this year too (Sem 1–8 of 2025-2026)

2. **NOW A PROBLEM BECOMES VISIBLE:** AcademicYear "2025-2026" has its OWN Semester rows (1–8). But the 2024 batch is now in Semester 3 of their program, while the 2025-2026 year would naturally associate with Semester 1 of a 2025 batch.

3. The COE creates exam cycles using the new year's Sem 3 row for the 2024 batch, but for the 2025 batch (if any), they'd use the same year's Sem 1 row.

**This is where the model starts showing its cracks:**
- The AcademicYear "2025-2026" has 8 semesters (1–8) just like every other year
- The 2024 batch progressing to Sem 3 uses the new year's Sem 3 row
- But Sem 3 of 2025-2026 and Sem 3 of 2024-2025 are different database rows
- **There's no "batch" or "program semester" concept** — only "semester number within an academic year"

### The 4-Year Progression

| Calendar Period | AcademicYear | activeSemesterType | Batch's Actual Semester | System Action |
|---|---|---|---|---|
| Jul-Dec 2024 | 2024-2025 | ODD | 1 | Create ExamCycles for Sem 1 |
| Jan-Jun 2025 | 2024-2025 | EVEN | 2 | Create ExamCycles for Sem 2 |
| Jul-Dec 2025 | 2025-2026 | ODD | 3 | Create ExamCycles for Sem 3 |
| Jan-Jun 2026 | 2025-2026 | EVEN | 4 | Create ExamCycles for Sem 4 |
| Jul-Dec 2026 | 2026-2027 | ODD | 5 | Create ExamCycles for Sem 5 |
| Jan-Jun 2027 | 2026-2027 | EVEN | 6 | Create ExamCycles for Sem 6 |
| Jul-Dec 2027 | 2027-2028 | ODD | 7 | Create ExamCycles for Sem 7 |
| Jan-Jun 2028 | 2027-2028 | EVEN | 8 | Create ExamCycles for Sem 8 |

**Graduation:** No action in the current system. There's no way to mark a batch as graduated.

**Critical issue revealed:** The pattern works mechanically, but there is NO entity that represents "the 2024 batch" or tracks which semester they're in. The system creates exam cycles for Sem 5, 2026-2027, COMP department — and this implicitly serves the 2024 batch (who are in Sem 5). But:
- If there's also a 2025 batch entering Sem 3 in the same year, the same "2026-2027 Sem 3" exam cycles serve that batch
- There's no way to generate a report saying "show me all papers for the 2024 batch"
- If different batches have different syllabi for the same subject, the system relies on SubjectVersion, not batch affiliation
- If the COE creates exam cycles for the wrong semester, there's no validation that those cycles match any batch's actual progression

---

## Part 3 — Domain Gaps

### Gap 1: No entity represents "a cohort of students"

**Question:** Where does the system know which cohort is in Semester 5?
**Answer:** It doesn't. The system knows that ExamCycles exist for (Semester 5 of AcademicYear 2026-2027, COMP department, ENDSEM). But it cannot answer "which batch takes these exams."

**Impact:** Low for the current workflow (paper generation). High for any future academic analytics, transcript generation, or multi-batch management.

### Gap 2: Multiple admission batches can exist, but the system can't distinguish them

**Question:** Can two admission batches exist simultaneously?
**Answer:** Yes, in reality they can. In 2026-2027, the 2024 batch is in Sem 5 and the 2025 batch is in Sem 3. The system handles this by creating separate ExamCycles for (Sem 5, ...) and (Sem 3, ...). But there's no batch label distinguishing which cycle belongs to which cohort.

**Impact:** If the COE needs to create exam cycles for Batches 2024, 2025, and 2026 simultaneously (which is normal), the current system CAN do it — it just can't tell you which batch each cycle is for. The cycles are distinguished by semester number + academic year, not by batch.

### Gap 3: No answer to "which batch is taking this exam?"

**Question:** Can we answer "Which batch is taking this exam?"
**Answer:** Not directly. Given an ExamCycle, we know `semesterId` and `academicYearId`. From these, you could infer the batch: if the cycle is for Sem 5 in AY 2026-2027, the batch likely started in 2024 (since Sem 5 = 3rd year = 2024+3). But this is an inference, not a stored fact.

**Impact:** Low for the standard workflow. Medium for edge cases where a batch is accelerated or delayed (backlog students, program transfers).

### Gap 4: Cannot advance an entire cohort

**Question:** Can we advance an entire cohort today?
**Answer:** No. There's no "advance batch to next semester" operation. The COE individually creates exam cycles for each semester each year.

**But is this actually a problem?** The COE's job IS to create exam cycles each semester. Automating "batch advancement" doesn't eliminate the need to create exam cycles. The question is whether the system should track that "Batch 2024 is now in Sem 6" separately from the fact that "ExamCycles for Sem 6 have been created."

**Impact:** Low. Batch advancement tracking is metadata, not workflow. The workflow (creating exam cycles) happens regardless.

### Gap 5: AcademicYear is used as both container AND progression mechanism

**Question:** Is AcademicYear being used as a container or as a progression mechanism?
**Answer:** Both, and this is confused.

- As a **container**, AcademicYear groups semesters by calendar period. This is correct and useful.
- As a **progression mechanism**, `activeSemesterType` (ODD/EVEN) pretends to track "which half of the year we're in." But this fails when multiple batches exist — the 2024 batch in Sem 5 (ODD) and the 2025 batch in Sem 3 (ODD) are both "ODD" at the same time, and `activeSemesterType` can't distinguish them.

**Impact:** Medium. The `activeSemesterType` is a UI convenience filter, not a progression tracker. But its name and purpose are unclear, leading to confusion about what it actually represents.

### Gap 6: Semester acts as reference data, not operational data

**Question:** Is Semester acting as reference data or operational data?
**Answer:** Reference data. Semesters 1–8 are created once per AcademicYear and never change. They don't open, close, or activate independently. Their entire operational significance comes from which ExamCycles are linked to them.

**Impact:** Low. This is actually correct — a Semester is a labeled position within a year. But the fact that every AcademicYear has 8 Semesters (I-VIII) means there are duplicate rows: Semester V of 2024-2025 and Semester V of 2025-2026 are different rows despite representing the same ordinal semester.

### Gap 7: Subject.semesterNumber is unenforced

**Question:** What guarantees that a Subject with `semesterNumber: 5` is actually examined in a Semester that has number 5?
**Answer:** Nothing. There is no FK constraint. A coordinator can set `semesterNumber: 5` on a subject, and then link it to an exam cycle for Semester 3. The system will allow it.

**Impact:** Medium-High. This is a data integrity gap. Subject-semester association relies entirely on convention and careful data entry, not database constraints.

### Gap 8: No explicit semester-end or semester-start transitions

**Question:** What happens when a semester ends?
**Answer:** Nothing in the system. Exam cycles can be marked CLOSED manually, but there's no automatic transition. Question banks from the previous semester remain in their last phase. Nothing is "reset" or "archived."

**Impact:** Low for the current workflow (old data is just historical records). But it means the database accumulates exam cycles and question banks without any lifecycle management for the academic structure itself.

---

## Part 4 — Investigate the Need for Batch

### Proposed Batch Entity

```prisma
model Batch {
  id              String   @id @default(cuid())
  admissionYear   Int      // e.g. 2024
  graduationYear  Int      // e.g. 2028
  currentSemester Int      // 1-8
  status          BatchStatus // ACTIVE, GRADUATED
  departmentId    String?  // null = institution-wide, or required FK
  department      Department? @relation(fields: [departmentId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum BatchStatus {
  ACTIVE
  GRADUATED
}
```

### Q1: What business problem does Batch solve?

**Answer:** It solves ONE problem: **naming a cohort** so the system can answer "which students are in which semester."

It does NOT solve:
- The need to create exam cycles (still must be done manually)
- The need to link subjects to cycles (still manual)
- The need to fill question banks (still manual)

It ENABLES:
- Reports that filter by batch
- Analytics that compare cohorts
- A UI for "advance batch" (changes `currentSemester` from 5 to 6)
- Cross-checking: "Are we creating exam cycles for the semester this batch is actually in?"

### Q2: Which existing problems disappear?

- **Gap 3 (which batch is taking this?)** — An ExamCycle could optionally reference a Batch, or you can derive the batch from (academicYearId, semesterNumber) knowing that Sem 5 in 2026-2027 implies 2024 batch.
- **Gap 4 (can't advance cohort)** — A dedicated "Advance Semester" button would update `Batch.currentSemester`.
- **Gap 5 (AcademicYear as progression proxy)** — `activeSemesterType` could be deprecated since Batch.currentSemester is the real source of truth.

### Q3: Which new problems appear?

- **Duplication of state:** `Batch.currentSemester` duplicates information that's already implicit in which ExamCycles exist. If Batch says Sem 5 but no ExamCycles exist for Sem 5, the system has contradictory state.
- **Which operator is the source of truth?** Does advancing a batch cause the creation of exam cycles? Or does creating exam cycles cause the batch to advance? The system needs an explicit rule.
- **Multiple batches per semester:** If 2024 batch is in Sem 5 and 2025 batch is in Sem 3, they share the same AcademicYear "2026-2027." The Semester rows (Sem 3 and Sem 5) are the same rows. But the batches are different. If ExamCycles reference a Batch, you'd need two separate ExamCycle records for the same (Semester, examType, department). But the unique constraint `@@unique([semesterId, examType, departmentId])` prevents this.
- **Architecture question:** Should Batch be department-scoped or institution-wide? If institution-wide, then COMP and AIDS batches share the same admission year. But in practice, different departments may have different batch sizes and schedules.

### Q4: Which workflows become simpler?

- **Creating exam cycles for the "right" semester** — The UI could pre-select the semester matching the batch's `currentSemester` instead of relying on `activeSemesterType`.
- **Reporting** — Adding a Batch filter to question usage reports becomes straightforward.
- **Managing backlog students** — A batch-based approach doesn't help with individual student backlog tracking.

### Q5: Which workflows become more complicated?

- **Creating exam cycles** — If Batch is required on ExamCycle, the COE must now select a batch when creating a cycle, adding a step. If Batch is optional, it's just a label with no workflow impact.
- **Cross-batch situations** — If a 2024 batch student takes a remedial exam alongside the 2025 batch, which batch does the ExamCycle belong to?
- **Unique constraint conflict** — The current `@@unique([semesterId, examType, departmentId])` assumes one cycle per (semester, type, dept). If different batches need different cycles for the same (semester, type, dept), this constraint breaks.

### Q6: Which reports become easier?

- **"Show all papers generated for 2024 batch"** — Trivial with Batch on ExamCycle.
- **"Compare question coverage across batches"** — Possible with a Batch filter.
- **"Which questions were used in this batch's Sem 5 exams?"** — Direct query.

### Q7: Which reports become harder?

- **"Show all exam cycles for a department in a given academic year"** — If ExamCycle requires Batch, queries need an extra join.
- **"Show all active exam cycles"** — No change if Batch is optional; harder if required.

---

## Part 5 — Challenge the Proposal

### 5.1 Should Batch exist?

**Not yet.** The current system's primary workflow — creating exam cycles, managing question banks, generating papers — works correctly without Batch. The gaps identified in Part 3 are real but don't block any current operation.

**Conditional yes if:**
- The institution needs reports grouped by batch
- The institution runs the same semester exams for different cohorts separately (unlikely)
- The system needs to validate that exam cycles align with expected batch progression

### 5.2 Should Batch belong to Department?

**No.** A batch spans all departments in a college. The "2024 batch" includes students in COMP, AIDS, CIVL, etc. Making Batch department-scoped would create confusion — you'd have "COMP-2024 batch" and "AIDS-2024 batch" as separate entities when they're really the same admission cohort.

**Exception:** If different departments have different academic calendars or program durations (e.g., some 3-year programs vs 4-year), then department-scoped batches might make sense. But this is not the case for a standard engineering college.

### 5.3 Should Department belong to Batch?

**No.** This would be incorrect modeling. A department is not a child of a batch.

### 5.4 Should Batch span all departments?

**Yes.** An admission year is institution-wide. The "2024 batch" is defined by the calendar year students joined, regardless of their department. Individual departments don't have independent "batches."

### 5.5 Should Batch know its current semester?

**This is the critical question.** 

**Arguments for:**
- Provides a single source of truth for "where is this cohort"
- Enables the "advance semester" button
- Simplifies UI filtering

**Arguments against:**
- Duplicates state that's already implicit in ExamCycles
- Creates a synchronization problem (what if Batch says Sem 5 but no Sem 5 ExamCycles exist?)
- The actual operational state IS the ExamCycles — Batch.currentSemester is metadata, not operational state

**Verdict:** If Batch exists, it should know its current semester. The alternative (deriving it from ExamCycles) would fail if no cycles exist yet for the current semester. But the synchronization problem must be addressed.

### 5.6 Is currentSemester duplicated state?

**Yes, but that's acceptable** if there's a clear primary operator. The rule should be: **"Advancing a batch is what triggers the creation of exam cycles, not the other way around."** In other words:
1. COE clicks "Advance Batch from Sem 5 to Sem 6"
2. This updates Batch.currentSemester
3. The UI then prompts "Create ExamCycles for Sem 6?"
4. COE creates the cycles

This makes `currentSemester` the driver, not a passive reflection of existing data.

### 5.7 Is currentSemester derivable?

**Partially.** Assuming a standard 4-year program:
- If admissionYear = 2024, and current date is 2026-2027 academic year
- The batch has been in college for roughly 2.5 years
- This maps to approximately Semester 5

But this derivation is unreliable because:
- Academic calendars vary
- Some programs may skip or repeat semesters
- The COE may not agree with the automated calculation

**Verdict:** `currentSemester` should be stored, not derived.

### 5.8 Is BatchSemesterAssignment actually necessary?

**BatchSemesterAssignment:**

```prisma
model BatchSemesterAssignment {
  id         String   @id @default(cuid())
  batchId    String
  semesterId String
  startDate  DateTime?
  endDate    DateTime?
  batch      Batch    @relation(fields: [batchId], references: [id])
  semester   Semester @relation(fields: [semesterId], references: [id])
  @@unique([batchId, semesterId])
}
```

**No, it is not necessary.** The granularity of tracking each semester's start/end dates per batch adds complexity without clear value. The Batch's `currentSemester` field + the AcademicYear's pre-defined semesters provide enough information. If you need to know "when did the 2024 batch start Sem 5," you can look at the ExamCycles created for (Sem 5, 2026-2027, ...) — those have startDate on the timetable.

### 5.9 Should ExamCycle reference Batch?

**Arguments for:**
- Enables direct "which batch is this exam for" queries
- Simplifies reporting

**Arguments against:**
- **Batches share exam cycles.** In a standard college, one exam cycle serves all students taking that exam — they don't split by batch. The same "ENDSEM Sem 5 COMP 2026" exam is taken by both regular 2024 batch students AND any backlog students from earlier batches.
- Adding a `batchId` to ExamCycle would incorrectly imply that each exam is for exactly one batch.
- Breaks the existing unique constraint `@@unique([semesterId, examType, departmentId])` — adding batchId would require changing this to `@@unique([semesterId, examType, departmentId, batchId])`, which would prevent sharing exam cycles across batches.

**Verdict:** ExamCycle should NOT reference Batch. This would be a modeling error.

### 5.10 Should ExamCycle stay independent?

**Yes.** ExamCycle already has the correct relationships: it links to Semester, AcademicYear, and Department. This gives it enough context to determine which batch it serves (by inference from semester number and year). Adding Batch would create more problems than it solves.

---

## Part 6 — Compare Multiple Designs

### Option A: Current System

**Description:**
- AcademicYear with `activeSemesterType` (ODD/EVEN)
- Semester as static rows (8 per AcademicYear)
- `Subject.semesterNumber` as unenforced integer
- ExamCycle linked to (Semester + AcademicYear + Department)
- No Batch entity

| Factor | Rating | Notes |
|---|---|---|
| **Simplicity** | ★★★★☆ | Works today. Few concepts. No over-engineering |
| **Correctness** | ★★★☆☆ | `Subject.semesterNumber` has no FK enforcement. `activeSemesterType` is confusing |
| **Scalability** | ★★★★★ | No issues. Exam cycles work for any number of batches implicitly |
| **Query complexity** | ★★★★☆ | Simple queries. No extra joins |
| **Migration effort** | ★★★★★ | Already deployed |
| **Maintenance** | ★★★☆☆ | `Subject.semesterNumber` is a data integrity time bomb |
| **Risk** | ★★★★☆ | Low. It works. Only risk is data inconsistency in Subject.semesterNumber |
| **Domain clarity** | ★★★☆☆ | The model works but doesn't match how colleges actually think (in batches) |

**Pros:**
- Already implemented and working
- Simple, few moving parts
- No synchronization problems

**Cons:**
- No cohort/batch concept — can't answer "which batch is this exam for"
- `Subject.semesterNumber` is unenforced — data can drift
- `activeSemesterType` is a hack that conflates "display filter" with "progression"
- Cannot advance a cohort or track graduation

### Option B: Batch Only

**Description:**
- Add `Batch` entity with `admissionYear`, `graduationYear`, `currentSemester`, `status`
- Remove `activeSemesterType` from AcademicYear
- Keep everything else the same
- ExamCycle does NOT reference Batch
- Batch is purely metadata / UI filter

| Factor | Rating | Notes |
|---|---|---|
| **Simplicity** | ★★★★☆ | Adds one entity with no new relationships |
| **Correctness** | ★★★★☆ | Fixes the progression gap. Subject.semesterNumber still unenforced |
| **Scalability** | ★★★★★ | No impact on existing queries |
| **Query complexity** | ★★★★★ | Batch is standalone — no joins needed for existing workflows |
| **Migration effort** | ★★★★☆ | Add one table. Deprecate `activeSemesterType`. Low risk |
| **Maintenance** | ★★★★☆ | Need to ensure `currentSemester` stays in sync with reality |
| **Risk** | ★★★★☆ | Low — optional entity. Existing workflows unaffected |
| **Domain clarity** | ★★★★☆ | Now the model has a batch concept, but it's not integrated into the workflow |

**Pros:**
- Minimal change
- Adds cohort tracking without disturbing existing workflows
- Batch is optional — no migration pressure
- Enables "advance batch" button as a UI convenience

**Cons:**
- Batch is disconnected from the operational workflow (ExamCycles don't use it)
- `Subject.semesterNumber` still unenforced
- No direct link between Batch and the exam data
- Batch advancement doesn't automate any real work (still must create exam cycles)

### Option C: Batch + BatchSemesterAssignment

**Description:**
- Batch entity
- BatchSemesterAssignment linking Batch → Semester with dates
- ExamCycle optionally references Batch
- `activeSemesterType` removed
- `Subject.semesterNumber` becomes a derived FK to BatchSemesterAssignment or stays as-is

| Factor | Rating | Notes |
|---|---|---|
| **Simplicity** | ★★☆☆☆ | Two new entities, new relationships, complex lifecycle |
| **Correctness** | ★★★★☆ | Full tracking of batch through semesters |
| **Scalability** | ★★★☆☆ | More joins, more rows, more synchronization |
| **Query complexity** | ★★☆☆☆ | Extra joins for basic queries |
| **Migration effort** | ★★☆☆☆ | Schema changes, service changes, data migration |
| **Maintenance** | ★★☆☆☆ | Must keep assignments in sync with reality. `currentSemester` and assignments can conflict |
| **Risk** | ★★☆☆☆ | High. Breaks existing unique constraints. Changes core workflow |
| **Domain clarity** | ★★★★☆ | Clear model of batch progression |

**Pros:**
- Full batch lifecycle tracking
- Direct queries for "which batch is in which semester"
- Rich historical data

**Cons:**
- Over-engineered for the system's actual needs
- ExamCycle shouldn't reference Batch (see Part 5, section 5.9)
- BatchSemesterAssignment duplicates information already in ExamCycles
- Breaks the existing unique constraint on ExamCycle
- Adds synchronization complexity without solving the core workflow problem

### Option D (Recommended Fix): Normalize Subject + Add Lightweight Batch

**Description:**

Two independent changes:

**Change 1 — Normalize Subject.semesterNumber:**
- Replace `Subject.semesterNumber` (int) with `Subject.semesterId` (FK → Semester)
- This enforces referential integrity: a subject's semester must exist in an AcademicYear

```prisma
// On Subject:
semesterNumber  Int    // BEFORE: unenforced integer
// → 
semesterId      String // AFTER: FK to Semester
semester        Semester @relation(fields: [semesterId], references: [id])
```

**Change 2 — Add lightweight Batch:**
- Add `Batch` entity (standalone, no relationships to ExamCycle)
- `activeSemesterType` on AcademicYear becomes a **derived property** computed from the academic year's position (first half = ODD, second half = EVEN) or removed entirely in favor of Batch-based UI filtering

```prisma
model Batch {
  id              String       @id @default(cuid())
  admissionYear   Int          // e.g. 2024
  graduationYear  Int          // e.g. 2028
  currentSemester Int          // 1-8, nullable — not set until progression starts
  status          BatchStatus  @default(ACTIVE)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

enum BatchStatus {
  ACTIVE
  GRADUATED
}
```

| Factor | Rating | Notes |
|---|---|---|
| **Simplicity** | ★★★★☆ | Two focused changes, each independently valuable |
| **Correctness** | ★★★★★ | FK enforcement on Subject→Semester. Batch is optional metadata |
| **Scalability** | ★★★★★ | No new joins in critical paths |
| **Query complexity** | ★★★★★ | Batch is standalone; Subject→Semester FK simplifies navigation |
| **Migration effort** | ★★★★☆ | Need to backfill `semesterId` on Subjects. Add one Batch table |
| **Maintenance** | ★★★★☆ | FK prevents drift. Batch.currentSemester is optional metadata |
| **Risk** | ★★★★☆ | Low — Batch is additive. Subject change is a migration but well-scoped |
| **Domain clarity** | ★★★★★ | Model now matches how colleges think: subjects belong to semesters, and cohorts are tracked alongside |

**Pros:**
- Fixes the real data integrity problem (Subject.semesterNumber → FK)
- Adds cohort tracking without compromising existing workflow
- ExamCycle stays clean (no batch dependency)
- `activeSemesterType` can be deprecated or derived
- Batch is purely additive — no existing code breaks
- Migration is well-scoped and low-risk

**Cons:**
- Subject migration requires backfilling `semesterId` for existing subjects
- Batch doesn't participate in the operational workflow — it's purely informational
- Still needs clarity on what a "batch advance" operation actually triggers

---

## Part 7 — Verify Against Real College Operations

### What does the COE actually do every semester?

The COE:
1. Creates exam cycles for each department and exam type
2. Sets timetable dates
3. Activates the cycles
4. Monitors question bank progress
5. Manages exports and backups
6. Closes cycles when exams are done

**The COE does NOT** manually track which batch is in which semester — they know this from the academic calendar. They create Sem 5 exam cycles because the calendar says it's Sem 5 time. Whether the 2024 batch or the 2025 batch takes those exams is irrelevant to the COE's workflow — the batches' identities are implicit in which semester exam cycles are created for.

**Key insight:** The COE thinks in terms of **(Semester, Department, AcademicYear)** — not batches. When creating exam cycles, they select "Semester 5 | COMP | 2026-2027 | ENDSEM." The batch identity is secondary.

### What action happens every academic year?

1. A new AcademicYear is created (if not done already)
2. Exam cycles are created for ODD semesters (then EVEN six months later)
3. Subject versions may be updated

### What changes every semester?

- Exam cycles (created anew for each semester)
- Question banks (new ones are created; old ones remain as historical records)
- Slot assignments (new questions for new banks)
- Moderation decisions

### What changes every year?

- AcademicYear (new one created, old one closed)
- Subject versions (if syllabus changed)
- Batch progression (batches advance by 2 semesters per year)

### What never changes?

- Department structure
- Subject definitions (the course itself, not the version)
- Semester as a concept (1–8)
- User roles (mostly)

### Does the COE think in batches?

**Not primarily.** The COE creates exam cycles by semester and department. But they DO think in batches when:
- Planning the academic calendar ("2024 batch will be in Sem 5 next semester")
- Coordinating with departments ("prepare question banks for Sem 5 — this affects the 2024 batch")
- Reviewing historical data ("the 2024 batch's Sem 5 papers had good coverage")

So batches are a **secondary concern** — real for planning and communication, but not the primary unit of operation.

### Which concept is the actual primary operational unit?

**The ExamCycle.**

Everything in the system flows from ExamCycles:
- Question banks are created per (Subject, ExamCycle)
- Slots are allocated per QuestionBank
- Questions are assigned per QuestionSlot
- Moderation is scoped per QuestionBank
- Papers are generated per QuestionBank
- Snapshots are taken per QuestionBank → ExamCycle

The AcademicYear, Semester, Department, and Batch are all **scoping/labeling** entities that provide context for ExamCycles.

---

## Part 8 — Repository Investigation

### 8.1 Every place AcademicYear is used

| Location | How it's used | Impact if Batch added |
|---|---|---|
| `prisma/schema.prisma` | Model definition, FK to Semester, ExamCycle, SubjectVersion | No change. Possibly deprecate `activeSemesterType` |
| `src/modules/academic-years/service.ts` | CRUD + `findCurrent()` | No change. `findCurrent()` remains useful |
| `src/modules/academic-years/repository.ts` | CRUD | No change |
| `src/modules/academic-years/validation.ts` | Zod schema for create/update | No change. Remove `activeSemesterType` if deprecated |
| `src/modules/exam-cycles/service.ts` | Validates `semester.academicYearId` matches | No change |
| `src/modules/coordinator/subject.service.ts` | `createSubject()` finds current academic year | No change |
| `app/api/academic-years/route.ts` | API routes | No change |
| `app/(protected)/dashboard/coe/academic-years/page.tsx` | Lists years with semester breakdown | Minor UI change if `activeSemesterType` removed |
| `src/components/forms/academic-year-form.tsx` | Form for creating years | Minor UI change |
| `src/components/dashboard/exam-cycle-timetable-manager.tsx` | Academic year dropdown | No change |
| `prisma/seed.ts` | Seeds 3 academic years | Update if `activeSemesterType` removed |

**Impact score: Low-Medium.** AcademicYear is well-encapsulated. Changes would be limited to `activeSemesterType` deprecation.

### 8.2 Every place Semester is used

| Location | How it's used | Impact if Batch added |
|---|---|---|
| `prisma/schema.prisma` | Model definition, FK from ExamCycle | No change |
| `src/modules/semesters/service.ts` | CRUD + `findByAcademicYear()` | No change |
| `src/modules/exam-cycles/service.ts` | Validates semester belongs to academic year | No change |
| `app/api/semesters/route.ts` | List/filter semesters | No change |
| `src/lib/semester-utils.ts` | `isSemesterActive()`, `filterSemestersByType()` | Could be deprecated if Batch replaces `activeSemesterType` |
| `src/components/dashboard/exam-cycle-timetable-manager.tsx` | Semester dropdown, auto-select based on `activeSemesterType` | UI could use Batch.currentSemester instead |
| `prisma/seed.ts` | Creates 8 semesters per AcademicYear | No change |

**Impact score: Low.** Semester is a stable entity. The only change would be UI filtering logic.

### 8.3 Every place ExamCycle is created

| Location | How it's used | Impact if Batch added |
|---|---|---|
| `src/modules/exam-cycles/service.ts` | `create()` — validates, creates in transaction **with uniqueness check** | **Critical:** Unique constraint `@@unique([semesterId, examType, departmentId])` assumes one cycle per (semester, type, dept). If Batch were added to ExamCycle, this constraint would need to change |
| `src/modules/exam-cycles/validation.ts` | Zod schema | No change |
| `app/api/exam-cycles/route.ts` | POST handler | No change |
| `src/components/dashboard/exam-cycle-timetable-manager.tsx` | UI form for creating cycles | No change — COE still picks semester, type, department |
| `prisma/seed.ts` | Seeds cycles for each (dept, sem, type) | No change |

**Impact score: Low** (if Batch is NOT added to ExamCycle). **High** (if Batch IS added to ExamCycle — breaks unique constraint).

### 8.4 Every place semester progression is assumed

| Location | How progression is used | Impact if Batch added |
|---|---|---|
| `src/lib/semester-utils.ts` | `isSemesterActive()` — parity check | Deprecate in favor of Batch.currentSemester |
| `src/modules/academic-years/service.ts` | `activeSemesterType` on create/update | Deprecate field |
| `app/(protected)/dashboard/coe/academic-years/page.tsx` | Shows "active semesters" based on parity | Show batch semesters instead |

**Impact score: Low.** These are UI utilities, not core business logic.

### 8.5 Every place academic year progression is assumed

| Location | How it's used | Impact if Batch added |
|---|---|---|
| `src/modules/academic-years/service.ts` | `findCurrent()` — date-based lookup | No change. Still needed |
| `src/modules/coordinator/subject.service.ts` | Finds current academic year for subject creation | No change |

**Impact score: None.** Academic year as temporal container is unaffected.

### 8.6 Every place that would be affected by introducing Batch

**Directly affected by Option D (recommended):**
1. `prisma/schema.prisma` — Add Batch model, change Subject.semesterNumber → semesterId FK
2. `src/modules/subjects/` — Update validation, service, repository for FK change
3. `prisma/seed.ts` — Add Batch seeding, update Subject references
4. `app/(protected)/dashboard/coe/` — Add batch management UI (optional)
5. `src/lib/semester-utils.ts` — Deprecate or remove

**Directly affected by Option B or C (not recommended):**
- If ExamCycle references Batch: Unique constraint change, migration of existing cycles, UI changes
- If BatchSemesterAssignment is added: New service + repository + validation module

**Not affected:**
- Question-related modules (QuestionLibraryItem, QuestionSlot, etc.) — except via Subject.semesterId FK change
- Moderation modules
- Paper generation
- ReadinessEngine
- Snapshots
- Exports
- Reports
- Production/dean review

### Migration Cost Estimate

| Component | Option D (Recommended) | Option B (Batch Only) | Option C (Full) |
|---|---|---|---|
| Schema change | 2 models (Batch, Subject FK) | 1 model (Batch) | 3 models (Batch, Assignment, ExamCycle FK) |
| New services | 1 (Batch CRUD) | 1 (Batch CRUD) | 2 (Batch, Assignment) |
| New API routes | 5 (Batch CRUD) | 5 (Batch CRUD) | 8 (Batch, Assignment, ExamCycle change) |
| Existing code changes | 3 files (Subject, semester-utils, academic-year) | 2 files (semester-utils, academic-year) | 5+ files (ExamCycle unique constraint cascade) |
| Data migration | Backfill Subject.semesterId | None | Backfill ExamCycle.batchId |
| UI changes | Minor (semester-utils deprecation) | Minor (add batch filter) | Significant (batch selection on exam cycles) |
| **Estimated total** | **2-3 days** | **1-2 days** | **1-2 weeks** |
| **Risk** | Low | Very low | Medium-High |

---

## Part 9 — Final Recommendation

### My assessment after studying the entire codebase

The current system works. It has one genuine data integrity problem and one conceptual gap:

**Genuine Problem:** `Subject.semesterNumber` is an unenforced integer that should be a foreign key to Semester. This is a normalization defect that will cause data drift over time.

**Conceptual Gap:** The system cannot explicitly identify which cohort a set of exam cycles serves. This matters for reporting and analytics, but does NOT block any current operational workflow.

### What I recommend

**Option D: Normalize Subject + Add Lightweight Batch**

Two independent changes:

**Change 1 — Fix the data integrity problem:**
- Replace `Subject.semesterNumber` (int) with `Subject.semesterId` (FK → Semester)
- This is the highest-priority fix because it prevents data corruption
- No behavioral changes — the UI still shows "Semester 5" for a subject

**Change 2 — Add a lightweight Batch entity (optional metadata):**
- Add Batch as a standalone entity with `admissionYear`, `graduationYear`, `currentSemester`, `status`
- Batch is **purely informational** — it does NOT participate in the operational workflow
- No FK relationships to ExamCycle, QuestionBank, or any operational entity
- The UI can display batch information alongside exam cycles, but batches don't constrain or drive any operation
- `activeSemesterType` can be deprecated in favor of Batch-based UI filtering

### Rationale

**Why NOT make Batch drive the workflow:**
- ExamCycles should NOT reference Batch because one exam serves students from multiple batches (regular + backlog)
- The unique constraint on ExamCycle is correct as-is: `@@unique([semesterId, examType, departmentId])`
- The COE's primary workflow is creating exam cycles by semester and department — not by batch
- Adding batch as a workflow driver creates synchronization problems without eliminating any manual steps

**Why ADD Batch at all:**
- It provides a lightweight answer to "which cohort is in which semester"
- It enables batch-filtered reports without schema changes to operational entities
- It's pure metadata — zero risk to existing workflows
- The domain model becomes more complete without becoming more complex

**Why NOT attempt the full BatchSemesterAssignment design:**
- It over-engineers a solution for a problem that doesn't exist yet
- It would require changes to ExamCycle's unique constraint, which is a deeply rooted schema invariant
- The operational benefit is zero — the COE would still create exam cycles manually

### What NOT to do

- **Do not** add `batchId` to ExamCycle — this would break the unique constraint and misrepresent the fact that exam cycles serve multiple cohorts
- **Do not** create BatchSemesterAssignment — this adds complexity without value. The existing ExamCycle → Semester relationship already records which semesters have active exams
- **Do not** remove `activeSemesterType` immediately — it's used in the UI today. Deprecate it over time as Batch-based filtering matures
- **Do not** make Batch required anywhere — it should be purely additive and optional

### Migration Plan (for implementation, not execution)

1. **Schema:** Add Batch model. Change Subject.semesterNumber → semesterId FK
2. **Data migration:** For each Subject, find the Semester row matching its `semesterNumber` from the current AcademicYear, and set `semesterId`
3. **Validation:** Update Zod schemas to require `semesterId` instead of `semesterNumber`
4. **Services:** Update SubjectManagementService to accept `semesterId`. Add BatchService (light CRUD)
5. **API:** Add `/api/batches` endpoints. Update `/api/subjects` to use `semesterId`
6. **UI:** Update subject creation forms. Add batch management page (optional, can be deferred)
7. **Seed:** Add Batch seeding. Update Subject seeding to use `semesterId`
8. **Tests:** Update affected tests

### Final verdict

**The Batch proposal, in its full form (Option C with ExamCycle references and BatchSemesterAssignment), is rejected.** It's over-engineered for the system's actual needs and would create more problems than it solves.

**A lightweight Batch entity (Option D) is recommended** as informational metadata that improves domain completeness without adding operational complexity.

**The Subject.semesterNumber → FK fix is the highest-priority change** because it addresses a real data integrity risk.

The system's operational architecture — driven by ExamCycles scoped to (Semester, Department, AcademicYear) — is correct and should not be changed.
