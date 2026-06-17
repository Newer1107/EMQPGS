# System Workflow Diagrams

> **Purpose:** Visual reference for understanding how the EMQPGS examination management system works end-to-end.
> **Audience:** Developers, architects, and domain stakeholders.
> **Status:** Accurate as of 2026-06-17.

---

## 1. Entity Relationship Diagram

Shows all core entities and their relationships. This is the data model that underpins every workflow.

```mermaid
erDiagram
    AcademicYear ||--o{ Semester : "has 8"
    AcademicYear ||--o{ ExamCycle : "scopes"
    AcademicYear ||--o{ SubjectVersion : "effective from"

    Semester ||--o{ ExamCycle : "exam belongs to"
    
    Department ||--o{ Subject : "offers"
    Department ||--o{ ExamCycle : "department-scoped"
    Department ||--o{ User : "employs"
    Department ||--o{ CoordinatorDepartmentAssignment : "assigns coordinator"

    User ||--o{ CoordinatorDepartmentAssignment : "assigned as"
    User ||--o{ ModeratorBankAssignment : "assigned as"
    User ||--o{ QuestionLibraryItem : "creates / owns"
    User ||--o{ QuestionSlot : "reserves"
    User ||--o{ ApprovalDecision : "decides"
    User ||--o{ ModerationEvent : "performs"

    Subject ||--o{ SubjectVersion : "versioned"
    Subject ||--o{ QuestionBank : "has banks"
    Subject ||--o{ SubjectExamCycleLink : "linked to cycles"
    Subject {
        string subjectCode
        int semesterNumber
    }

    SubjectVersion ||--o{ QuestionLibraryItem : "contains questions"
    SubjectVersion {
        int versionNumber
        string effectiveFromAcademicYearId
    }

    ExamCycle ||--o{ SubjectExamCycleLink : "links subjects"
    ExamCycle ||--o{ QuestionBank : "contains"
    ExamCycle {
        enum examType
        enum status
        string departmentId
        string semesterId
    }

    QuestionBank ||--o{ QuestionSlot : "has 126 slots"
    QuestionBank ||--o{ PaperPattern : "has pattern"
    QuestionBank ||--o{ QuestionBankSnapshot : "snapshot on lock"
    QuestionBank ||--o{ PaperSnapshot : "on generation"
    QuestionBank ||--o{ ApprovalDecision : "approval record"
    QuestionBank ||--o{ AiReport : "AI analysis"
    QuestionBank ||--o{ GeneratedPaper : "generated papers"
    QuestionBank ||--o{ ModeratorBankAssignment : "moderator assignments"
    QuestionBank ||--o{ DeanReview : "dean selects variants"
    QuestionBank ||--o{ ExportArtifact : "exports"
    QuestionBank {
        enum phase
        enum recordStatus
        int version
    }

    QuestionSlot ||--o| QuestionLibraryItem : "assigned to (nullable)"
    QuestionSlot {
        int moduleNumber
        int marks
        int slotNumber
    }

    QuestionLibraryItem ||--o{ ModerationEvent : "moderated"
    QuestionLibraryItem ||--o{ QuestionRevision : "versioned"
    QuestionLibraryItem ||--o{ QuestionOwnershipHistory : "transferred"
    QuestionLibraryItem ||--o{ QuestionUsageHistory : "used in papers"
    QuestionLibraryItem {
        int moduleNumber
        int marks
        enum coMapping
        enum rbtLevel
        enum status
    }

    GeneratedPaper ||--o{ GeneratedPaperItem : "contains questions"
    GeneratedPaper {
        enum variant
        enum status
    }
```

---

## 2. Academic Year & Semester Creation

The COE creates an academic year once per calendar year. The system auto-generates all 8 semesters.

```mermaid
sequenceDiagram
    actor COE
    participant UI as COE Dashboard
    participant API as /api/academic-years
    participant Service as AcademicYearService
    participant DB as Database

    COE->>UI: Open "Create Academic Year" form
    COE->>UI: Enter code "2026-2027",<br/>dates, ODD/EVEN
    UI->>API: POST /api/academic-years
    API->>Service: create(data)
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT AcademicYear<br/>code="2026-2027",<br/>status=ACTIVE,<br/>activeSemesterType=ODD
    Service->>DB: INSERT Semester × 8<br/>(number:1..8,<br/>name:"Semester I".."VIII")
    Service->>DB: COMMIT
    DB-->>Service: AcademicYear + 8 Semesters
    Service-->>API: Result
    API-->>UI: Success response
    UI-->>COE: Year created with 8 semesters
```

**Key points:**
- 8 semesters (1–8) are auto-generated in the same transaction
- `activeSemesterType` (ODD/EVEN) determines which semesters the UI shows by default
- Semesters are reference data — they never change status independently

---

## 3. Exam Cycle Creation

The COE creates exam cycles per (semester, examType, department). This is the trigger that starts the entire question bank workflow.

```mermaid
sequenceDiagram
    actor COE
    participant UI as Exam Cycle Manager
    participant API as /api/exam-cycles
    participant Service as ExamCycleService
    participant DB as Database

    COE->>UI: Open "Create Exam Cycle"
    UI->>API: GET /api/academic-years
    API-->>UI: List of academic years
    UI->>API: GET /api/semesters?academicYearId=...
    API-->>UI: Semesters for selected year<br/>(auto-filtered by ODD/EVEN)
    COE->>UI: Select AcademicYear,<br/>Semester, ExamType,<br/>Department, Timetable
    Note over COE,UI: UI auto-selects first<br/>semester matching<br/>activeSemesterType
    UI->>API: POST /api/exam-cycles
    API->>Service: create(data)
    Service->>DB: Validate semester belongs<br/>to academicYearId
    Service->>DB: IF status=ACTIVE:<br/>SERIALIZABLE TRANSACTION
    Service->>DB: Check no other ACTIVE<br/>cycle for this department
    Service->>DB: INSERT ExamCycle
    Note over DB: Unique: @@unique([semesterId,<br/>examType, departmentId])
    DB-->>Service: Created cycle
    Service-->>API: Success
    API-->>UI: Exam cycle created
    UI-->>COE: Cycle ready for<br/>coordinator workflow

    Note over COE,UI: ⚠ One active cycle per<br/>department at a time
```

**Key points:**
- Unique constraint: one cycle per (semester, examType, department)
- Only COE can create exam cycles
- Each department can have exactly 1 ACTIVE cycle at a time
- An exam cycle without linked subjects cannot have question banks

---

## 4. Subject → Exam Cycle → Question Bank Initialization

Coordinators create subjects, link them to exam cycles, and initialize question banks.

```mermaid
sequenceDiagram
    actor Coordinator
    participant UI as Coordinator Dashboard
    participant SubAPI as /api/subjects
    participant LinkAPI as /api/subjects/[id]/link-cycle
    participant QBAPI as /api/question-banks
    participant DB as Database

    Coordinator->>UI: Create Subject
    Coordinator->>UI: Enter subjectCode, name,<br/>semesterNumber, department
    UI->>SubAPI: POST /api/subjects
    SubAPI->>DB: BEGIN TRANSACTION
    SubAPI->>DB: INSERT Subject
    SubAPI->>DB: INSERT SubjectVersion v1<br/>(ACTIVE)
    SubAPI->>DB: COMMIT
    DB-->>SubAPI: Subject + Version
    SubAPI-->>UI: Subject created
    UI-->>Coordinator: Subject ready

    Note over Coordinator,DB: Later: Link subject to exam cycle

    Coordinator->>UI: Select subject → "Link to Cycle"
    UI->>LinkAPI: POST /api/subjects/[id]/link-cycle
    LinkAPI->>DB: Validate subject exists
    LinkAPI->>DB: Validate exam cycle exists & ACTIVE
    LinkAPI->>DB: Validate same department
    LinkAPI->>DB: UPSERT SubjectExamCycleLink
    DB-->>LinkAPI: Link created
    LinkAPI-->>UI: Subject linked
    UI-->>Coordinator: Subject now linked

    Note over Coordinator,DB: Finally: Initialize question bank

    Coordinator->>UI: Select linked subject → "Initialize Bank"
    UI->>QBAPI: POST /api/question-banks
    QBAPI->>DB: Validate subject linked to cycle
    QBAPI->>DB: INSERT QuestionBank (DRAFTING, ACTIVE)
    QBAPI->>DB: INSERT PaperPattern<br/>(6 modules, [2,5,10] marks, 7 slots)
    QBAPI->>DB: INSERT QuestionSlot × 126<br/>(6 modules × 3 marks × 7 slots)
    DB-->>QBAPI: Bank + Pattern + Slots
    QBAPI-->>UI: Bank initialized
    UI-->>Coordinator: 126 empty slots ready
```

**Key points:**
- Subject + SubjectVersion v1 are created atomically in a transaction
- Linking requires same department on subject and cycle
- Question bank creation auto-generates PaperPattern and all slots
- 126 slots for ENDSEM (6 modules × 3 marks × 7 slots), 63 for ISE

---

## 5. Question Lifecycle

Questions flow through a state machine from creation to approval.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Contributor creates question
    DRAFT --> PENDING : Contributor submits
    PENDING --> APPROVED : Moderator approves
    PENDING --> REJECTED : Moderator rejects
    PENDING --> REVISION_REQUESTED : Moderator requests changes
    REVISION_REQUESTED --> REVISION_SUBMITTED : Contributor revises
    REVISION_SUBMITTED --> APPROVED : Moderator approves
    REVISION_SUBMITTED --> REJECTED : Moderator rejects
    REJECTED --> DRAFT : Contributor re-creates
    APPROVED --> [*] : Question eligible for papers

    note right of DRAFT
        Question is editable.
        Not yet assigned to
        any moderator.
    end note

    note right of PENDING
        Awaiting moderator
        review. Question is
        locked for editing.
    end note

    note right of APPROVED
        Question can be included
        in generated papers.
        Immutable after this point.
    end note
```

**Key points:**
- Questions are scoped to a SubjectVersion, not a Subject directly
- Once APPROVED, questions are immutable and eligible for paper generation
- REJECTED questions can be re-created as new DRAFTs
- Moderation events are recorded per question for audit

---

## 6. Question Bank Phase Flow

The bank progresses through four workflow phases. Two axes control state: phase (what's happening) and record status (operational state).

```mermaid
stateDiagram-v2
    direction LR

    state "DRAFTING" as D
    state "MODERATION" as M
    state "APPROVAL" as A
    state "COMPLETE" as C

    [*] --> D : Bank initialized,<br/>slots empty
    D --> M : All slots filled
    M --> A : All questions moderated,<br/>AI report done
    A --> C : Coordinator APPROVES
    A --> M : Coordinator REJECTS<br/>(loopback)
    C --> [*] : Terminal state

    note right of D
        Contributors fill slots.<br/>
        Readiness check: all 126<br/>
        slots must be filled.
    end note

    note right of M
        Moderators review questions.<br/>
        Readiness check: all filled<br/>
        slots have moderation decisions.
    end note

    note right of A
        AI analysis runs.<br/>
        Papers generated.<br/>
        Coordinator decides.
    end note

    note right of C
        Approved. Dean can<br/>
        review and select paper<br/>
        variants. Exports allowed.
    end note
```

### Orthogonal State: RecordStatus

Independently of phase, a bank can be locked or archived:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Default state
    ACTIVE --> LOCKED : Coordinator locks<br/>(creates snapshot)
    LOCKED --> ACTIVE : Coordinator unlocks<br/>(reversible)
    ACTIVE --> ARCHIVED : COE archives<br/>(long-term retention)

    note right of LOCKED
        All mutations rejected.<br/>
        Read operations still work.<br/>
        Creates QuestionBankSnapshot.
    end note
```

**Key points:**
- Phase and RecordStatus are orthogonal — a bank can be APPROVAL + LOCKED simultaneously
- ReadinessEngine is **advisory only** — coordinator manually advances
- Loopback from APPROVAL → MODERATION is first-class
- Locking creates an immutable snapshot (slot assignments frozen in time)

---

## 7. Paper Generation Flow

Once a bank reaches APPROVAL phase, the coordinator can trigger paper generation.

```mermaid
sequenceDiagram
    actor Coordinator
    participant QBAPI as /api/question-banks/[id]/papers
    participant Service as PaperGenerationService
    participant Generator as PaperGenerator
    participant PDF as PdfService
    participant MinIO
    participant DB as Database

    Note over Coordinator,DB: Precondition: Bank in APPROVAL or COMPLETE

    Coordinator->>QBAPI: POST /api/question-banks/[id]/papers
    QBAPI->>Service: generatePapers(bankId)
    Service->>DB: Find bank (must be APPROVAL or COMPLETE)
    Service->>Generator: generate(bank, variants=["A","B","C"])

    rect rgb(240, 240, 255)
        Note over Generator: FOR each variant:
        Generator->>Generator: Select 1 question per slot<br/>Balance CO, RBT, difficulty
        Generator-->>Service: GeneratedPaperPayload[]
    end

    rect rgb(240, 255, 240)
        Note over Service,PDF: Generate PDF
        Service->>PDF: createPaperPdf(title, questions)
        PDF-->>Service: PDF bytes
        Service->>MinIO: upload (generated-papers bucket)
        MinIO-->>Service: FileAsset record
    end

    rect rgb(255, 240, 240)
        Note over Service,DB: Persist
        Service->>DB: UPSERT GeneratedPaper<br/>per variant
        Service->>DB: UPSERT PaperSnapshot<br/>per variant
        Service->>DB: INSERT QuestionUsageHistory<br/>for each selected question
    end

    Service-->>QBAPI: GeneratedPaper records
    QBAPI-->>Coordinator: 3 variants ready<br/>(A, B, C)

    Note over Coordinator,MinIO: After generation:
    Note over Coordinator,MinIO: DEAN reviews & selects<br/>variants for regular/supplementary/KT
```

**Key points:**
- 3 variants (A, B, C) are generated simultaneously
- Each variant selects one question per slot, balancing CO/RBT/difficulty
- PDFs uploaded to MinIO `generated-papers` bucket
- PaperSnapshot is upserted (last write wins per variant)
- Usage history is recorded per question

---

## 8. Coordinator Decision Flow

After papers are generated, the coordinator approves or rejects the bank.

```mermaid
sequenceDiagram
    actor Coordinator
    actor Dean
    participant DecisionAPI as /api/question-banks/[id]/coordinator-decision
    participant DB as Database

    Note over Coordinator,DB: APPROVAL phase completed

    Coordinator->>DecisionAPI: POST with { decision: "APPROVED" }
    DecisionAPI->>DB: BEGIN TRANSACTION
    DecisionAPI->>DB: INSERT ApprovalDecision<br/>(decision=APPROVED, remark)
    DecisionAPI->>DB: UPDATE QuestionBank<br/>phase → COMPLETE
    DecisionAPI->>DB: COMMIT
    DB-->>DecisionAPI: Success
    DecisionAPI-->>Coordinator: Bank approved

    Note over Coordinator,DB: Dean flow (after COMPLETE)

    Dean->>Dean: Review 3 paper variants
    Dean->>Dean: Select which variant for<br/>regular exam, which for<br/>supplementary, which for KT
    Dean->>DB: POST /api/question-banks/[id]/dean-review

    alt Coordinator REJECTS
        Coordinator->>DecisionAPI: POST with { decision: "REJECTED", remark }
        DecisionAPI->>DB: INSERT ApprovalDecision<br/>(decision=REJECTED)
        DecisionAPI->>DB: UPDATE QuestionBank<br/>phase → MODERATION
        DecisionAPI-->>Coordinator: Bank sent back to moderation
        Note over DB: Loopback — moderators<br/>revise, coordinator<br/>re-advances later
    end
```

**Key points:**
- ApprovalDecision is write-once (immutable audit record)
- Decision + phase update happen in the same transaction
- Rejection loopback sends bank back to MODERATION for revision
- Dean review is separate — occurs after COMPLETE phase

---

## 9. Complete End-to-End Workflow

The full lifecycle from academic structure setup to final export.

```mermaid
flowchart TD
    subgraph Setup["Phase 0: Academic Structure"]
        A1["COE: Create AcademicYear"] --> A2["Auto-generates 8 Semesters"]
        A2 --> A3["COE: Create Departments<br/>one-time setup"]
    end

    subgraph Init["Phase 1: Exam Cycle Setup"]
        B1["COE: Create ExamCycle<br/>semester + examType + department"] --> B2["COE: Activate Cycle"]
        B2 --> B3["Coordinator: Create Subjects<br/>with semesterNumber"]
        B3 --> B4["Coordinator: Link Subject<br/>to ExamCycle"]
        B4 --> B5["Coordinator: Initialize<br/>QuestionBank"]
        B5 --> B6["126 Slots Created"]
    end

    subgraph Contribution["Phase 2: Question Contribution"]
        C1["Contributor: Create Question<br/>in library"] --> C2["Contributor: Assign to<br/>empty slot"]
        C2 --> C3["Contributor: Submit<br/>for moderation"]
        C3 --> C4{"All 126 slots<br/>filled?"}
        C4 -->|"No"| C1
        C4 -->|"Yes"| D1
    end

    subgraph Moderation["Phase 3: Moderation"]
        D1["Coordinator: Advance bank<br/>to MODERATION"] --> D2["Moderator: Review<br/>each question"]
        D2 --> D3{"Moderator decision"}
        D3 -->|"APPROVE"| D4["Question APPROVED"]
        D3 -->|"REJECT"| D5["Question REJECTED"]
        D3 -->|"REVISION REQUEST"| D6["Contributor revises"]
        D6 --> D2
        D5 --> C1
        D4 --> E1
    end

    subgraph Approval["Phase 4: Approval"]
        E1["Coordinator: Advance bank<br/>to APPROVAL"] --> E2["Coordinator: Trigger<br/>AI Analysis"]
        E2 --> E3["Coordinator: Generate<br/>3 Paper Variants"]
        E3 --> E4{"Coordinator<br/>Decision"}
        E4 -->|"APPROVED"| E5["Phase to COMPLETE"]
        E4 -->|"REJECTED"| D1
    end

    subgraph Final["Phase 5: Finalization"]
        F1["Coordinator: Lock Bank<br/>creates Snapshot"] --> F2["Dean: Review 3 Variants"]
        F2 --> F3["Dean: Select Variants<br/>regular/suppl/KT"]
        F3 --> F4["COE: Export Papers<br/>PDF/DOCX/ZIP"]
        F4 --> F5["COE: Trigger Backup"]
    end

    Setup --> Init
    Init --> Contribution
    Contribution --> Moderation
    Moderation --> Approval
    Approval --> Final
```

**Key points:**
- 5 distinct phases, each gated by a human decision
- No automatic transitions — all advances are manual
- Each phase has a ReadinessEngine check that reports issues
- The entire cycle repeats every semester for every department

---

## 10. Implicit Batch Progression Over 4 Years

The system does not track batches explicitly. Progression is implicit through which exam cycles are created.

```mermaid
timeline
    title 2024 Batch Progression (Implicit)
    AY 2024-2025 : Sem 1 (ODD) : Jul-Dec 2024
                 : Sem 2 (EVEN) : Jan-Jun 2025
    AY 2025-2026 : Sem 3 (ODD) : Jul-Dec 2025
                 : Sem 4 (EVEN) : Jan-Jun 2026
    AY 2026-2027 : Sem 5 (ODD) : Jul-Dec 2026
                 : Sem 6 (EVEN) : Jan-Jun 2027
    AY 2027-2028 : Sem 7 (ODD) : Jul-Dec 2027
                 : Sem 8 (EVEN) : Jan-Jun 2028
```

**Each transition requires the COE to:**
1. Create a new AcademicYear (if needed)
2. Create ExamCycles for each department at the new semester
3. Coordinators link subjects and initialize banks

**What happens to the old data:**
- Previous exam cycles remain in the database (historical)
- Previous question banks remain in their terminal phase
- Snapshots preserve the state at lock time
- Nothing is deleted or archived automatically

---

## 11. Actor Responsibility Matrix

Who does what in the workflow.

```mermaid
flowchart TD
    subgraph COE
        coe1["Create AcademicYears"]
        coe2["Create ExamCycles"]
        coe3["Manage Departments"]
        coe4["Manage Users"]
        coe5["Export Papers"]
        coe6["Trigger Backups"]
        coe7["View Audit Logs"]
    end

    subgraph Coordinator
        coord1["Create Subjects"]
        coord2["Link Subjects to Cycles"]
        coord3["Initialize QuestionBanks"]
        coord4["Assign Moderators"]
        coord5["Fill Slots / Assign Questions"]
        coord6["Advance Bank Phases"]
        coord7["Trigger AI Analysis"]
        coord8["Generate Papers"]
        coord9["Approve / Reject Bank"]
        coord10["Lock / Unlock Bank"]
    end

    subgraph Contributor
        cont1["Create Questions"]
        cont2["Assign to Slots"]
        cont3["Submit for Moderation"]
        cont4["Revise on Feedback"]
    end

    subgraph Moderator
        mod1["Review Assigned Questions"]
        mod2["Approve / Reject"]
        mod3["Request Revision"]
    end

    subgraph Dean
        dean1["Review Generated Papers"]
        dean2["Select Variants"]
    end

    COE -->|"provides structure"| Coordinator
    Coordinator -->|"manages banks"| Contributor
    Coordinator -->|"assigns"| Moderator
    Coordinator -->|"presents for review"| Dean
```

---

## 12. Data Flow Summary

How data moves through the system from creation to final output.

```mermaid
flowchart LR
    AY["AcademicYear"] --> S["Semester"]
    S --> EC["ExamCycle"]
    D["Department"] --> EC
    D --> SUBJ["Subject"]
    SUBJ --> SV["SubjectVersion"]
    EC --> SEL["SubjectExamCycleLink"]
    SEL --> SUBJ
    EC --> QB["QuestionBank"]
    QB --> PP["PaperPattern"]
    QB --> QSLOT["QuestionSlot x126"]
    SV --> QLI["QuestionLibraryItem"]
    QLI --> QSLOT
    QSLOT --> QA{"All filled?"}
    QA -->|"Yes"| MOD["Moderation"]
    MOD --> AI["AI Analysis"]
    MOD --> PG["Paper Generation"]
    PG --> GP["GeneratedPaper x3"]
    GP --> DR["Dean Review"]
    DR --> EXP["Export"]

    style AY fill:#e1f5fe
    style EC fill:#fff3e0
    style QB fill:#f3e5f5
    style GP fill:#e8f5e9
    style EXP fill:#ffebee
```

---

## Quick Reference: Slot Template Structure

| Exam Type | Modules | Marks per Module | Slots per (Module, Marks) | Total Slots |
|---|---|---|---|---|
| ENDSEM | 6 | 2, 5, 10 | 7 | 126 |
| SUPPLEMENTARY | 6 | 2, 5, 10 | 7 | 126 |
| KT | 6 | 2, 5, 10 | 7 | 126 |
| ISE_1 | 3 | 2, 5, 10 | 7 | 63 |
| ISE_2 | 3 | 2, 5, 10 | 7 | 63 |

---

## Quick Reference: Unique Constraints

| Entity | Constraint | Purpose |
|---|---|---|
| ExamCycle | `@@unique([semesterId, examType, departmentId])` | One cycle per (semester, type, dept) |
| QuestionBank | `@@unique([subjectId, examCycleId])` | One bank per subject per cycle |
| QuestionSlot | `@@unique([questionBankId, moduleNumber, marks, slotNumber])` | One slot position per bank |
| Subject | `@@unique([subjectCode, departmentId])` | Code unique per department |
| SubjectExamCycleLink | `@@unique([subjectId, examCycleId])` | Subject linked once per cycle |
| Semester | `@@unique([academicYearId, number])` | One semester number per year |
