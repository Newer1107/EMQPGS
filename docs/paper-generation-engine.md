# Paper Generation Engine

## Architecture

```
PaperGenerationEngine
        │
        ├── ConstraintEngine     (hard rules — never violated)
        ├── CandidateBuilder     (legal candidates only)
        ├── EvaluationEngine     (fitness scoring)
        └── SearchStrategy       (pluggable algorithm)
                │
                └── GenerationTrace  (explainability)
```

Every component has **exactly one responsibility**. The engine depends only on the `SearchStrategy`
interface — new strategies are added by implementing the interface, not by modifying the engine.

```
                    ┌──────────────────────────┐
                    │   PaperGenerationEngine  │
                    │   orchestrator, owns      │
                    │   module range, profile   │
                    └───────────┬──────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
     ┌────────────────┐ ┌──────────────┐ ┌────────────────┐
     │ Candidate      │ │ Constraint   │ │ Evaluation     │
     │ Builder        │ │ Engine       │ │ Engine         │
     │                │ │              │ │                │
     │ "what          │ │ "what must   │ │ "how good      │
     │  questions     │ │  never       │ │  is this       │
     │  can fill      │ │  happen"     │ │  paper?"       │
     │  this slot?"   │ │              │ │                │
     └────────┬───────┘ └──────────────┘ └────────┬───────┘
              │                                    │
              ▼                                    ▼
     ┌──────────────────────────────────────────────────┐
     │           ConstraintAwareGreedyStrategy          │
     │                                                  │
     │  For each slot:                                  │
     │    1. Get candidates from CandidateBuilder       │
     │    2. For each candidate:                        │
     │       a. Add temporarily to the paper            │
     │       b. Score the partial paper                 │
     │    3. Pick the highest-scoring candidate         │
     │    4. Record the decision with reasoning         │
     │                                                  │
     │  Output: PaperSolution + GenerationTrace         │
     └──────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │    GenerationTrace        │
                    │  ┌────────────────────┐  │
                    │  │ SlotDecision[]      │  │
                    │  │  per slot:          │  │
                    │  │  - candidates[]     │  │
                    │  │  - scores           │  │
                    │  │  - rejectionReasons │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │ GenerationStats     │  │
                    │  │  - candidates      │  │
                    │  │  - duration        │  │
                    │  │  - failures        │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │ EvaluationReport    │  │
                    │  │  - overall score   │  │
                    │  │  - per-category    │  │
                    │  │  - deductions      │  │
                    │  └────────────────────┘  │
                    └──────────────────────────┘
```

---

## Slot Structure

A question bank has **126 slots**: 6 modules × 3 mark values × 7 slot positions.

```
Module 1     Module 2     Module 3     Module 4     Module 5     Module 6
┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐
│ 2m x7│     │ 2m x7│     │ 2m x7│     │ 2m x7│     │ 2m x7│     │ 2m x7│
│ 5m x7│     │ 5m x7│     │ 5m x7│     │ 5m x7│     │ 5m x7│     │ 5m x7│
│10m x7│     │10m x7│     │10m x7│     │10m x7│     │10m x7│     │10m x7│
└──────┘     └──────┘     └──────┘     └──────┘     └──────┘     └──────┘
```

Each slot has exactly **one approved question** assigned. A paper selects one question
from each (module, marks) position, producing **18 questions** for ENDSEM (6 modules × 3 marks)
or **9 questions** for ISE (3 modules × 3 marks).

### Module Range by Exam Type

| Exam Type  | Modules  | Slots  | Profile      | Target Duration |
|------------|----------|--------|--------------|----------------|
| ISE-1      | 1–3      | 9      | ISE_PROFILE  | 60 min         |
| ISE-2      | 4–6      | 9      | ISE_PROFILE  | 60 min         |
| ENDSEM     | 1–6      | 18     | TCET_PROFILE | 180 min        |

---

## The Algorithm: ConstraintAwareGreedyStrategy

### Pseudocode

```
function generate(questionBank, examType):
    slots   = buildSlotList(examType)          // e.g. 18 slots for ENDSEM
    profile = selectProfile(examType)          // TCET or ISE
    
    builder      = CandidateBuilder(questionBank, profile.moduleRange)
    constraints  = ConstraintEngine(profile)
    evaluator    = EvaluationEngine(profile)
    
    validateBankInventory(builder, constraints)
    
    paper = []
    trace = { slotDecisions: [], stats: {} }
    
    for each slot in slots:
        candidates = builder.getCandidates(slot, paper)
        
        bestScore = -infinity
        bestQuestion = null
        
        for each candidate in candidates:
            tempPaper = paper + [{ slot, candidate }]
            score = evaluator.evaluate(tempPaper)
            record(trace, candidate, score)
            
            if score > bestScore:
                bestScore = score
                bestQuestion = candidate
        
        paper = paper + [{ slot, bestQuestion }]
        recordDecision(trace, slot, candidates, bestQuestion)
    
    constraints.validate(paper)     // final check — must pass
    return { paper, evaluator.evaluate(paper), trace }
```

### Step-by-step Walkthrough

For a 3-module ISE-1 paper (9 slots), the algorithm works as follows:

```
Slots to fill: [M1·2m, M1·5m, M1·10m, M2·2m, M2·5m, M2·10m, M3·2m, M3·5m, M3·10m]

Step 1: Fill M1·2m
  ┌─ Candidates: Q1 (EASY, L1, TG1), Q2 (MEDIUM, L2, TG2), Q3 (HARD, L3, TG3)
  │
  ├─ Try Q1 → score partial paper [Q1] = 72.3
  ├─ Try Q2 → score partial paper [Q2] = 78.1  ← highest
  ├─ Try Q3 → score partial paper [Q3] = 69.8
  │
  └─ SELECT Q2 (MEDIUM, L2, TG2) — score 78.1
     Reject Q1: "Lower difficulty balance (-4 pts), Lower concept diversity (-2 pts)"
     Reject Q3: "Lower difficulty balance (-6 pts), Lower freshness (-3 pts)"

Step 2: Fill M1·5m
  ┌─ Candidates: Q4 (MEDIUM, L3, TG4), Q5 (EASY, L1, TG1)
  │
  ├─ Try Q4 → score [Q2, Q4] = 82.5  ← highest
  ├─ Try Q5 → score [Q2, Q5] = 76.2
  │
  └─ SELECT Q4 (MEDIUM, L3, TG4) — score 82.5
     Reject Q5: "Lower concept diversity (-3 pts), Lower bloom balance (-2 pts)"

... continue for all 9 slots ...

Final paper: 9 questions
Final score: 87/100
```

### Determinism

The algorithm is **deterministic** given the same inputs:

1. Slots are processed in a fixed order (module asc, marks asc)
2. Candidates are returned in consistent order (stable Map iteration)
3. Tie-breaking picks the first candidate with the highest score (stable iteration)
4. The evaluation function is pure (no randomness, no state)

This means: `engine.generate(bank, "ISE-1")` always produces the same paper.
Randomness is introduced only by future search strategies (RandomSearch, GeneticAlgorithm),
never by the evaluation engine.

---

## Component Details

### 1. ConstraintEngine

Path: `src/modules/paper-generation-engine/constraint-engine.ts`

**Responsibility**: Rules that can NEVER be violated. No score can compensate for a broken constraint.

**Rules enforced**:

| Rule | Check |
|------|-------|
| MODULE_RANGE | Slot's module is within the exam's module range |
| MARKS_PATTERN | Slot's marks value is 2, 5, or 10 |
| SLOT_COUNT | Total slots match expected count |
| INSUFFICIENT_INVENTORY | At least one approved question exists for this slot |
| MARKS_MISMATCH | Question's marks match the slot's marks |
| MODULE_MISMATCH | Question's module matches the slot's module |
| QUESTION_STATUS | Question status is `APPROVED` |
| DUPLICATE_QUESTION | Same question ID not used twice |
| DUPLICATE_CONCEPT_GROUP | TeachingIndex not repeated |
| QUESTION_ALREADY_USED | Question not in `QuestionUsageHistory` (historical exams only) |

**Pre-flight check**: `validateBankState()` runs before any search starts — ensures the bank
has sufficient inventory. If it fails, the entire generation is aborted immediately.

**Post-flight check**: `validateAssignment()` runs on the complete paper — ensures no
constraint was violated during the greedy assembly.

### 2. CandidateBuilder

Path: `src/modules/paper-generation-engine/candidate-builder.ts`

**Responsibility**: Answer the question "which questions are eligible for this slot?"

**Pure filter**: Knows NOTHING about:
- Evaluation weights
- Bloom scores
- Difficulty targets
- Optimization strategies

Filters applied per slot:
```
candidatesFor(slot, currentPaper) → QuestionLibraryItem[]
    1. Must match (moduleNumber, marks) of the slot
    2. Must be APPROVED status
    3. Not already picked in this paper
    4. Not consumed by other variants in this generation run
```

### 3. EvaluationEngine

Path: `src/modules/paper-generation-engine/evaluation-engine.ts`

**Responsibility**: Score a paper (or partial paper) from 0–100.

**Pure function**: Given the same paper + profile, always returns the same score.
No randomness, no hidden state, no database queries.

#### Scoring Criteria

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                        TOTAL: 100                                │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Difficulty Balance (30)                │                 │
  │  │                                             │                 │
  │  │  ├── Overall (50%): |avg - target| penalty  │                 │
  │  │  ├── Per-module (35%): variance penalty     │                 │
  │  │  └── Progression (15%): upward trend check  │                 │
  │  └─────────────────────────────────────────────┘                 │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Bloom Balance (20)                     │                 │
  │  │                                             │                 │
  │  │  ├── Overall dist (50%): target overlap     │                 │
  │  │  ├── Per-module (30%): diversity check      │                 │
  │  │  └── Progression (20%): L4+ trend check     │                 │
  │  └─────────────────────────────────────────────┘                 │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Concept Diversity (20)                 │                 │
  │  │                                             │                 │
  │  │  ├── Overall (60%): unique / total          │                 │
  │  │  └── Per-module (40%): duplicate penalty    │                 │
  │  └─────────────────────────────────────────────┘                 │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Freshness (15)                         │                 │
  │  │  Penalizes questions used in past exams     │                 │
  │  └─────────────────────────────────────────────┘                 │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Module Balance (10)                    │                 │
  │  │  Variance of difficulty across modules      │                 │
  │  └─────────────────────────────────────────────┘                 │
  │                                                                  │
  │  ┌─────────────────────────────────────────────┐                 │
  │  │      Estimated Solve Time (5)               │                 │
  │  │  Estimated total vs target exam duration    │                 │
  │  └─────────────────────────────────────────────┘                 │
  └──────────────────────────────────────────────────────────────────┘
```

#### Difficulty Balance Scoring

```
Difficulty Balance (30)
│
├─ Overall (50% = 15pts)
│    avg = mean difficulty of all questions (EASY=1, MEDIUM=2, HARD=3)
│    diff = |avg - target|  (target = 2.0)
│    score = max(0, 15 - diff × 10)
│    → Perfect (avg=2.0): 15 pts
│    → All EASY (avg=1.0): 5 pts
│    → All HARD (avg=3.0): 5 pts
│
├─ Per-module (35% = 10.5pts)
│    For each module: compute avg difficulty
│    avgDeviation = mean |moduleAvg - target|
│    penalty = avgDeviation × 10.5 × 0.35
│    score = 10.5 - penalty
│
└─ Progression (15% = 4.5pts)
     Sort modules by number
     Count upward steps (module[i+1].avg > module[i].avg)
     Count downward steps
     Upward > Downward → 4.5 pts
     Flat (no trend) → 4.5 × 0.85
     Downward trend → 4.5 × 0.7
```

#### Bloom Balance Scoring

```
Bloom Balance (20)
│
├─ Overall distribution (50% = 10pts)
│    For each level L1–L6:
│      expected = targetDistribution[level] × totalQuestions
│      overlap  = sum of min(expected, actual)
│      similarity = overlap / total
│    score = 10 × similarity
│
├─ Per-module (30% = 6pts)
│    For each module:
│      uniqueLevels = count of distinct RbtLevel values
│      uniqueLevels ≤ 1 ⇒ full penalty
│      uniqueLevels = 2 ⇒ half penalty
│    score = 6 × (1 - avgPenalty × 0.3)
│
└─ Progression (20% = 4pts)
     For each module: ratio of L4+ questions
     Upward trend (higher-order thinking in later modules) → 4 pts
     Flat → 4 × 0.8
     Downward → 4 × 0.6
```

#### Concept Diversity Scoring

```
Concept Diversity (20)
│
├─ Overall (60% = 12pts)
│    unique concepts / total slots
│    score = 12 × min(1, unique/ total)
│
└─ Per-module (40% = 8pts)
     For each module:
       questionsWithIndex = questions in module with non-null teachingIndex
       duplicatesInModule = questionsWithIndex - uniqueIndices
       penalty += duplicatesInModule / questionsWithIndex
     avgPenalty = totalPenalty / numModules
     score = 8 × (1 - avgPenalty)
```

#### Freshness Scoring

```
Freshness (15)
│
├─ For each question:
│    If question.id exists in QuestionUsageHistory → penalty += 1
│
└─ avgPenalty = totalPenalty / total questions
   score = 15 × (1 - avgPenalty)
```

#### Module Balance Scoring

```
Module Balance (10)
│
├─ For each module: compute avg difficulty
│  mean = mean of all module averages
│  variance = mean squared deviation from mean
│
└─ score = 10 × (1 - min(1, variance))
   → All modules same difficulty: score = 10
   → High variance: score = 0
```

#### Estimated Solve Time Scoring

```
Solve Time (5)
│
├─ estimated = sum of marksTimeMap[question.marks]
│   marksTimeMap: { 2: 2min, 5: 8min, 10: 15min }
│
├─ diff = |estimated - targetDuration|
│  targetDuration: 180min (ENDSEM), 60min (ISE)
│
└─ score = max(0, 5 - (diff / target) × 5)
   → On target: 5 pts
   → 50% off: 2.5 pts
   → 100%+ off: 0 pts
```

### 4. SearchStrategy Interface

Path: `src/modules/paper-generation-engine/strategies/types.ts`

```typescript
interface SearchStrategy {
  search(
    slots: PaperSlot[],          // slots to fill
    builder: CandidateBuilder,   // supplies candidates
    evaluator: EvaluationEngine, // scores papers
    constraints: ConstraintEngine, // validates
    usageHistory: QuestionUsageHistory[],
    variant: string,
  ): { solution: PaperSolution; trace: GenerationTrace };
}
```

The engine depends ONLY on this interface. New strategies implement it without
changing the engine, builder, evaluator, or constraints:

| Strategy | Status | When to Use |
|----------|--------|-------------|
| ConstraintAwareGreedyStrategy | ✅ Implemented | Default — deterministic, explainable |
| RandomSearchStrategy | 🔜 Future | Explore wider search space |
| GeneticAlgorithmStrategy | 🔜 Future | Large question banks (1000+) |
| SimulatedAnnealingStrategy | 🔜 Future | Avoid local optima |
| BeamSearchStrategy | 🔜 Future | Balance exploration vs computation |

---

## Evaluation Profiles

Weights and tuning parameters are data-driven, not hardcoded.

```
EvaluationProfile
│
├── id: "tcet-default" | "tcet-ise"
├── name: "TCET Standard" | "TCET ISE"
├── weights: { difficulty, bloom, conceptDiversity, freshness, moduleBalance, solveTime }
│
├── difficulty: { targetValue, perModuleWeight, progressionWeight }
├── bloom:      { targetDistribution, perModuleWeight, progressionWeight }
└── solveTime:  { targetDurationMinutes, marksTimeMap }
```

Adding a new profile (e.g. "Mumbai University", "Autonomous College") requires
no code changes — just define a new `EvaluationProfile` object.

### TCET Standard Profile (END SEMESTER)

| Parameter | Value |
|-----------|-------|
| Weights | D:30 B:20 C:20 F:15 M:10 S:5 |
| Difficulty target | 2.0 (MEDIUM) |
| Per-module difficulty weight | 0.35 |
| Progression weight | 0.15 |
| Bloom target distribution | L1:0.17, L2:0.17, L3:0.17, L4:0.17, L5:0.16, L6:0.16 |
| Target duration | 180 min |
| Time per mark | 2m → 2min, 5m → 8min, 10m → 15min |

### TCET ISE Profile

Same as TCET Standard except:

| Parameter | Value |
|-----------|-------|
| Target duration | 60 min |
| Time per mark | 2m → 2min, 5m → 8min |

---

## Generation Trace

Every generation produces a `GenerationTrace` that explains every decision.

```
GenerationTrace
│
├── stats: GenerationStats
│   ├── strategyName: "ConstraintAwareGreedyStrategy"
│   ├── profileId: "tcet-default"
│   ├── generatedAt: ISO timestamp
│   ├── durationMs: total generation time
│   ├── totalCandidatesConsidered: sum of all candidates across all slots
│   ├── candidatesRejectedByConstraints: count of constraint violations
│   ├── candidatesEvaluated: candidates that received a score
│   └── constraintFailuresByType: { "DUPLICATE_QUESTION": 2, ... }
│
├── slotDecisions: SlotDecision[]
│   For each slot:
│   ├── moduleNumber: 1..6
│   ├── marks: 2 | 5 | 10
│   ├── candidates: CandidateEvaluation[]
│   │   For each candidate:
│   │   ├── questionId
│   │   ├── score: partial paper score with this candidate
│   │   ├── report: full evaluation breakdown
│   │   ├── selected: true | false
│   │   └── rejectionReasons: ["Lower Difficulty Balance (-3 pts)", ...]
│   └── selectedQuestionId: the winner
│
└── finalReport: EvaluationReport (final paper score)
```

### Trace Persistence

```
PaperGenerationEngine
        │
        │  generate()
        ▼
{ solution, trace }
        │
        ▼
paper.service.ts
        │
        │  upsert GeneratedPaper
        ▼
paperJson: {
    evaluationReport: ...,      // DetailedEvaluationReport
    scoreBreakdown: "...",     // formatted text
    generationTrace: {         // full trace
        stats,
        slotDecisions,
        finalReport
    }
}
        │
        ▼
    MySQL (JSON column)
        │
        ▼
GET /papers/{variant}/insights
        │
        ▼
Dean Explainability Dashboard
```

---

## Paper Lifecycle

```
Question Bank (Locked)
        │
        ▼
Dean selects exam type (ISE-1 / ISE-2 / ENDSEM)
        │
        ▼
PaperGenerationEngine.generate()
        │
        ├── ConstraintEngine: pre-flight check
        ├── CandidateBuilder: build slot list
        ├── GreedyStrategy: fill slots one by one
        ├── ConstraintEngine: post-flight check
        ├── EvaluationEngine: final score
        └── GenerationTrace: record decisions
        │
        ▼
GeneratedPaper (status: COMPLETED)
paperJson has: evaluationReport, scoreBreakdown, generationTrace
        │
        ▼
Dean reviews → assigns to (Regular, Supplementary, KT)
        │
        ▼
COE downloads (no usage history created)
        │
        ▼
COE: "Mark As Used In Examination"
        │
        ▼
QuestionUsageHistory created for every question in the paper
        │
        ▼
Generator now excludes these questions from future runs
```

### Key Rule

> **Paper generation must never mutate QuestionUsageHistory.**
>
> A generated paper is a proposal. Only the COE's "Mark As Used In Examination"
> action creates historical usage records. Generated, regenerated, rejected,
> and archived papers must never affect inventory.

---

## File Map

```
src/modules/paper-generation-engine/
├── types.ts                          # All interfaces and type definitions
├── constraint-engine.ts              # Hard rule validation
├── candidate-builder.ts              # Legal candidate filtering
├── evaluation-engine.ts              # 6-criteria fitness scoring
├── score-report.ts                   # Formatting + explainability
├── paper-generation-engine.ts        # Main orchestrator
└── strategies/
    ├── types.ts                      # SearchStrategy interface
    └── constraint-aware-greedy.ts    # Greedy algorithm
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| Evaluation engine is a pure function | Same input → same output. Deterministic. Testable. |
| Strategy depends on interface | New strategies plug in without engine changes. |
| CandidateBuilder knows nothing about scores | Separation of concerns. Builder = filter, not optimizer. |
| ConstraintEngine runs pre and post | Catch inventory issues early, validate final result. |
| Profile is data, not code | New evaluation configurations without code changes. |
| Trace emitted by strategy, not engine | Strategies can have different trace granularity. |
| SolveTime from profile's marksTimeMap | No DB query needed during scoring. Configurable per profile. |
