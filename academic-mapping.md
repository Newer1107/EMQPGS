# Batch & Semester Progression Management — EMQPGS
 
> **Problem Statement:** The system currently has no entity to represent a student batch (e.g., 2024–28). Academic year and semester entities exist but there is no mechanism to cohort all departments together, track which semester a batch is currently in, and advance them collectively — without breaking existing exam cycles and question banks.
 
---
 
## 1. Problem Analysis
 
### Current State
 
```
AcademicYear (2025–26)
  └── Semesters × 8 (auto-generated, ODD/EVEN)
        └── ExamCycle → QuestionBank → QuestionSlots → Papers
```
 
The current model attaches exam cycles to academic years and semesters. **There is no concept of a batch.** This means:
 
- No way to know that "2024–28 batch" is currently in Semester 3 (ODD, 2025–26 academic year).
- Advancing a batch to the next semester requires manually re-linking every department's exam cycles — there is no single lever.
- When a new academic year is created and the 2024–28 batch moves into it, that linkage is implicit and fragile.
- New batches (2025–29) entering Semester 1 at the same time the 2024–28 batch enters Semester 3 will collide in the same academic year with no disambiguation.
### Root Cause
 
The system models **time** (academic years, semesters) but not **cohorts** (batches of students moving through time). The two need to be decoupled and then re-joined by an explicit mapping.
 
---
 
## 2. Proposed Solution — Two-Entity Model
 
### Entity 1: `Batch`
 
Represents a group of students admitted in a specific year, spanning a fixed duration (4 years → 8 semesters).
 
```
Batch {
  id            UUID / SERIAL
  name          String       -- e.g., "2024-28"
  admissionYear Int          -- 2024
  graduationYear Int         -- 2028
  currentSemesterNumber Int  -- 1 through 8 (manually set / incremented)
  currentSemType  SemType    -- ODD | EVEN
  departments   Department[] -- fixed list, hardcoded / seeded (never changes)
  status        BatchStatus  -- ACTIVE | COMPLETED | ARCHIVED
  createdBy     UserId       -- COE
  createdAt     DateTime
}
```
 
**Key design decisions:**
- `departments` is a fixed set. The institution's department list is stable. Rather than a join table, a simple seeded reference list suffices.
- `currentSemesterNumber` and `currentSemType` represent the *current live semester* the batch is in.
- The batch does **not** own exam cycles — it provides context that tells the system **which semester** each department's exam cycle belongs to for this batch.
---
 
### Entity 2: `BatchSemesterAssignment`
 
The explicit mapping that binds a batch + semester position → academic year + semester entity. This is created once per increment.
 
```
BatchSemesterAssignment {
  id              UUID
  batchId         BatchId
  semesterNumber  Int       -- 1..8
  semType         SemType   -- ODD | EVEN
  academicYearId  AcademicYearId
  semesterId      SemesterId
  effectiveFrom   Date
  effectiveTo     Date?     -- null = current
  createdAt       DateTime
}
```
 
This is effectively the **audit trail** of every semester transition a batch has ever made.
 
---
 
## 3. Workflow (COE Operations)
 
### 3.1 — Creating the First Batch
 
```
COE Action: Create Batch
  ├── name:               "2024-28"
  ├── admissionYear:      2024
  ├── graduationYear:     2028
  ├── currentSemNumber:   1        ← COE sets manually
  ├── currentSemType:     ODD      ← COE sets manually
  └── status:             ACTIVE
 
System auto-creates: BatchSemesterAssignment
  ├── batchId:            <2024-28>
  ├── semesterNumber:     1
  ├── semType:            ODD
  ├── academicYearId:     <2024-25>
  └── semesterId:         <Sem-1-ODD-2024-25>
```
 
All department exam cycles created under AcademicYear 2024-25 / Sem 1 / ODD are now **contextually tied** to the 2024-28 batch via `BatchSemesterAssignment`.
 
---
 
### 3.2 — Incrementing a Batch (Semester Advancement)
 
At the end of the academic year (or mid-year for ODD→EVEN transition):
 
```
COE Action: Increment Batch "2024-28"
  System computes:
    currentSemNumber: 1 → 2
    currentSemType:   ODD → EVEN (toggle)
    academicYear:     stays 2024-25 (EVEN is still in same year)
 
  Creates new BatchSemesterAssignment:
    semesterNumber: 2
    semType:        EVEN
    academicYearId: <2024-25>
    semesterId:     <Sem-2-EVEN-2024-25>
 
  Updates Batch:
    currentSemesterNumber: 2
    currentSemType: EVEN
```
 
The **increment rules** are deterministic and hardcoded:
 
| Current Sem | Current Type | New Sem | New Type | Academic Year      |
|-------------|--------------|---------|----------|--------------------|
| 1           | ODD          | 2       | EVEN     | Same               |
| 2           | EVEN         | 3       | ODD      | Next (+1)          |
| 3           | ODD          | 4       | EVEN     | Same               |
| 4           | EVEN         | 5       | ODD      | Next (+1)          |
| 5           | ODD          | 6       | EVEN     | Same               |
| 6           | EVEN         | 7       | ODD      | Next (+1)          |
| 7           | ODD          | 8       | EVEN     | Same               |
| 8           | EVEN         | —       | —        | Batch → COMPLETED  |
 
**Rule:** ODD→EVEN stays in the same academic year. EVEN→ODD crosses into the next academic year.
 
---
 
### 3.3 — Creating a New Batch Simultaneously
 
When the 2024-28 batch reaches Sem 3, the 2025-29 batch enters Sem 1. Both are ACTIVE simultaneously.
 
```
COE Action: Create Batch "2025-29"
  currentSemNumber: 1
  currentSemType:   ODD
  academicYearId:   2025-26   ← new academic year
 
  Creates BatchSemesterAssignment for 2025-29 / Sem 1 / ODD / 2025-26
 
Simultaneously:
  Batch "2024-28" is on Sem 3 / ODD / 2025-26
 
Both batches are ACTIVE and both reference academic year 2025-26
but their BatchSemesterAssignment records distinguish them.
```
 
Multiple active batches per academic year is **fully supported** — this is the normal state after year 2.
 
---
 
### 3.4 — Department Auto-Inclusion on Increment
 
Since the department list is fixed and hardcoded, when a batch is incremented:
 
1. The system reads all departments from the static list (seeded at startup).
2. For each department, a coordinator can now create an ExamCycle tagged with the new `BatchSemesterAssignment` ID.
3. No manual per-department wiring is needed — the batch context propagates automatically.
> **Hardcoding rationale:** The README confirms 9 departments (AIDS, AIML, COMP, CSEC, CIVL, ENCS, INFO, IOT, MME). Institutional structure is stable across batches. A `BatchDepartment` join table adds complexity with zero business value.
 
---
 
## 4. ExamCycle Integration
 
The `ExamCycle` entity needs one new FK to complete the join:
 
```diff
ExamCycle {
  ...existing fields...
+ batchSemesterAssignmentId  FK → BatchSemesterAssignment  (nullable for legacy data)
}
```
 
This tells the system: *"This exam cycle belongs to batch X in semester Y."*
 
**What this enables:**
- Coordinator dashboard filters exam cycles by `batchId` → shows all active work for a specific cohort.
- COE can see all departments' exam cycles for a batch in one view.
- Phase progression reporting can be aggregated per batch ("5 of 9 departments have COMPLETE banks for 2024-28 Sem 3").
---
 
## 5. Database Schema (Prisma)
 
```prisma
enum BatchStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
}
 
enum SemType {
  ODD
  EVEN
}
 
model Batch {
  id                    String   @id @default(cuid())
  name                  String   @unique         // "2024-28"
  admissionYear         Int
  graduationYear        Int
  currentSemesterNumber Int      @default(1)
  currentSemType        SemType  @default(ODD)
  status                BatchStatus @default(ACTIVE)
  createdById           String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
 
  semesterAssignments   BatchSemesterAssignment[]
  createdBy             User     @relation(fields: [createdById], references: [id])
}
 
model BatchSemesterAssignment {
  id               String   @id @default(cuid())
  batchId          String
  semesterNumber   Int
  semType          SemType
  academicYearId   String
  semesterId       String
  effectiveFrom    DateTime @default(now())
  effectiveTo      DateTime?
  createdAt        DateTime @default(now())
 
  batch            Batch        @relation(fields: [batchId], references: [id])
  academicYear     AcademicYear @relation(fields: [academicYearId], references: [id])
  semester         Semester     @relation(fields: [semesterId], references: [id])
  examCycles       ExamCycle[]
 
  @@unique([batchId, semesterNumber])
}
```
 
---
 
## 6. API Surface (New Routes)
 
```
POST   /api/batches                          -- COE: create batch
GET    /api/batches                          -- COE/COORDINATOR: list batches
GET    /api/batches/:id                      -- any: get batch detail
POST   /api/batches/:id/increment            -- COE: advance to next semester
GET    /api/batches/:id/assignments          -- any: get semester history
GET    /api/batches/:id/exam-cycles          -- any: all exam cycles across depts for this batch
POST   /api/batches/:id/archive              -- COE: archive completed batch
```
 
---
 
## 7. Potential Implementation Ideas & Fix Strategies
 
### Idea A — Soft-Link via Semester Number Only (Minimal Change)
Instead of a new entity, add `batchName` (string) and `semesterNumber` (int) directly to `ExamCycle`. The COE tags each exam cycle at creation time.
 
**Pros:** Zero schema migration, backward compatible.
**Cons:** No enforcement, no aggregation, no audit trail of progression. COE must tag every single exam cycle manually. Inconsistencies guaranteed at scale.
 
**Verdict: ❌ Too fragile for production use.**
 
---
 
### Idea B — Batch Entity with Manual Department Assignment (Per-Department Join Table)
Create a `Batch` entity and a `BatchDepartmentSemester` join table where each row explicitly maps `(batchId, departmentId, semesterNumber, academicYearId)`.
 
**Pros:** Fine-grained control per department (e.g., a department can be on a different pace).
**Cons:** Over-engineered for a fixed-department institution. COE must manage 9 rows per increment × 8 semesters = 72 manual entries per batch lifetime.
 
**Verdict: ⚠️ Valid only if departments can be on independent tracks.**
 
---
 
### Idea C — Proposed Two-Entity Model (Recommended) ✅
`Batch` + `BatchSemesterAssignment` as described in sections 2–6 above.
 
**Pros:**
- Single COE action advances all 9 departments simultaneously.
- Departments are auto-included (hardcoded list), zero per-department wiring.
- Full audit trail via `BatchSemesterAssignment` history.
- Backward compatible (nullable FK on `ExamCycle`).
- Supports multiple simultaneous active batches.
**Cons:** Requires one Prisma migration + 2 new modules.
 
**Verdict: ✅ Best balance of control and automation.**
 
---
 
### Idea D — Event-Sourced Batch Progression
Model batch advancement as an immutable event log (`BatchEvent`). Each increment emits a `SEMESTER_ADVANCED` event. Current state is derived by replaying events.
 
**Pros:** Perfect audit trail, easy time-travel for debugging.
**Cons:** Significantly more complex for a use case that doesn't need event replay semantics. Overkill unless the system needs to support rollback of semester advancement.
 
**Verdict: ⚠️ Consider only if rollback/undo of semester advancement is a hard requirement.**
 
---
 
### Idea E — Batch-Aware Dashboard Aggregation Without Schema Change
Keep the schema identical. Add a COE-managed config table (`SystemConfig`) that stores the current batch→semester mapping as JSON.
 
**Pros:** Fastest to implement.
**Cons:** No relational integrity, no FK constraints, no reporting queries possible via SQL joins. Essentially storing business logic in a JSONB blob.
 
**Verdict: ❌ Technical debt from day one.**
 
---
 
### Idea F — Extend AcademicYear with BatchContext
Add `batchContext` JSON column to `AcademicYear` that stores `[{ batchName, semesterNumber, semType }]`.
 
**Pros:** No new tables.
**Cons:** Violates normalization, no FK integrity, hard to query, untestable at the unit level.
 
**Verdict: ❌ Anti-pattern.**
 
---
 
### Idea G — Auto-Advance via Cron / Scheduled Worker
Once a batch is created, the system auto-advances the semester on a configured date (e.g., June 1 for EVEN→ODD, November 1 for ODD→EVEN).
 
**Pros:** Zero COE action needed for advancement.
**Cons:** The README explicitly notes "No background workers" and "No scheduled backups." This would require adding Redis + BullMQ (known limitation #3). Also, auto-advancement without a human gate risks advancing a batch before all question banks are COMPLETE.
 
**Verdict: ⚠️ Valid future enhancement. Not viable for v1 given current infrastructure.**
 
---
 
### Idea H — Readiness-Gated Batch Increment
Extend the existing `ReadinessEngine` to also compute batch-level readiness. The COE cannot increment a batch to the next semester until *all* departments' question banks for the current semester have reached `COMPLETE` phase and are `LOCKED`.
 
**Pros:** Prevents advancement with incomplete exam cycles. Enforces quality gate at the batch level.
**Cons:** Strict gate may be too rigid (one department's delay blocks the entire batch). Needs a "force advance with override" escape hatch for COE.
 
**Verdict: ✅ Strong recommendation to pair this with Idea C (the recommended solution).**
 
---
 
## 8. Migration Plan (Zero Downtime)
 
```
Phase 1 — Schema (backward compatible)
  ├── Add Batch table
  ├── Add BatchSemesterAssignment table
  └── Add nullable batchSemesterAssignmentId FK to ExamCycle
 
Phase 2 — Backfill (optional, for existing data)
  ├── COE creates Batch "2024-28" via UI
  ├── COE manually sets currentSem to match current live state
  └── Existing ExamCycles remain unlinked (nullable FK = fine)
 
Phase 3 — Forward from here
  └── All new ExamCycles are created with batchSemesterAssignmentId set
```
 
Existing exam cycles and question banks are **untouched**. The nullable FK means legacy data coexists with the new model without a breaking migration.
 
---
 
## 9. Coordinator Impact
 
| Action | Before | After |
|--------|--------|-------|
| Know which batch a bank belongs to | Impossible | `bank → examCycle → batchSemAssignment → batch` |
| See all depts' banks for one batch | Manual search | Single query via `batchId` |
| Advance all depts to next semester | 9 manual re-linkings | 1 COE action → `POST /batches/:id/increment` |
| Know current semester for a batch | No source of truth | `batch.currentSemesterNumber` |
| Support 2024-28 and 2025-29 simultaneously | Ambiguous | Both have distinct `BatchSemesterAssignment` records |
 
---
 
## 10. Summary
 
The recommended solution is **Idea C (Two-Entity Model)** with **Idea H (Readiness-Gated Increment)** as an optional quality gate.
 
The two entities are:
- `Batch` — the cohort anchor (COE-created, manually seeded with Sem 1 / ODD)
- `BatchSemesterAssignment` — the immutable history record created on each increment
Departments are hardcoded (9, never change), so no per-department join table is needed. A single COE action advances all departments in one atomic operation. The nullable FK on `ExamCycle` ensures zero-downtime migration and backward compatibility with all existing data.