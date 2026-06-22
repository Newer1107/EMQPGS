# UAF Domain Model

> Foundation document for the UAF AI Analysis subsystem.
> All downstream documents reference these entities.
> Never redefine what lives here.

**Status:** Ratified
**Applies to:** QuestionBank Analysis Engine, UAF Analysis Pipeline, Dean's Dashboard
**Version:** 1.0

---

## Table of Contents

1. [Scope and Purpose](#scope-and-purpose)
2. [Entity Relationship Map](#entity-relationship-map)
3. [Entity Definitions](#entity-definitions)
4. [Value Objects and Enums](#value-objects-and-enums)
5. [Glossary](#glossary)
6. [Constraints and Invariants](#constraints-and-invariants)
7. [Out of Scope](#out-of-scope)

---

## Scope and Purpose

This document defines every domain entity, relationship, invariant, and term
for the UAF (Unit Assessment Framework) AI Analysis subsystem. It is the
single source of truth for what exists in the domain. Services, APIs, UI
components, prompts, and database schemas are derived from this model and
must not introduce new domain concepts without updating this document first.

**Who owns this:** Domain leads. Changes here ripple everywhere.

---

## Entity Relationship Map

```
                     ┌──────────────────────────────────────────────────┐
                     │                  QuestionBank                    │
                     │  (external aggregate root, not owned by UAF)     │
                     └──────────────┬───────────────────────────────────┘
                                    │ 1
                                    │ has
                                    ▼
                     ┌──────────────────────────────────────────────────┐
                     │              QuestionBankAnalysis                │
                     │  Root aggregate. One per UAF evaluation run.     │
                     └──┬──────┬──────┬──────┬──────┬──────┬───────────┘
                        │      │      │      │      │      │
             1          │ 1    │ 1    │ 1..* │ 1..* │ 1..* │ 1..*
     ┌──────────────────┘      │      │      │      │      └──────────┐
     ▼                         ▼      ▼      ▼      ▼                 ▼
┌────────────┐    ┌─────────────────┐    ┌──────┐  ┌───────────┐  ┌──────┐
│AnalysisVer.│───▶│ EvidenceSnapshot │    │UAFMet│  │  Risk     │  │Paper │
│(immutable) │ 1  │ (deterministic   │    │ric   │  │           │  │Analy.│
│            │    │  evidence blob)  │    │      │  │           │  │      │
│            │    └──────────────────┘    │      │  │           │  │ 1..* │
│            │                            │ 1..* │  │           │  └──┬───┘
│            │                            └──┬───┘  └───────────┘     │
│            │                               │ 1                     │
│            │                               ▼                       ▼
│            │                    ┌──────────────────┐    ┌──────────────────┐
│            │                    │ ConfidenceScore  │    │ GeneratedPaper   │
│            │                    │ (per-metric)     │    │ (variant A/B/C)  │
│            │                    └──────────────────┘    └──────────────────┘
│            │
│ 1          │ 1..*        0..1
│            ▼
│     ┌─────────┐
│     │PromptVer│    ┌──────────────────┐    ┌──────────────────┐
│     │sion     │    │Recommendation    │    │AnalysisEvidence  │
│     │(immut.) │    │                  │    │                  │
│     └─────────┘    └──────────────────┘    └──────────────────┘
│
│                      ┌──────────────────┐
│                      │ AnalysisSnapshot │
│                      │ (read model,     │
│                      │  full report)    │
│                      └──────────────────┘

Relationships:
  QuestionBankAnalysis  ──1:N──▶ AnalysisVersion
  QuestionBankAnalysis  ──1:1──▶ AnalysisSnapshot
  QuestionBankAnalysis  ──1:N──▶ UAFMetric
  QuestionBankAnalysis  ──1:N──▶ Risk
  QuestionBankAnalysis  ──1:N──▶ Recommendation
  QuestionBankAnalysis  ──1:N──▶ AnalysisEvidence
  QuestionBankAnalysis  ──1:N──▶ PaperAnalysis
  AnalysisVersion       ──1:1──▶ EvidenceSnapshot
  AnalysisVersion       ──1:1──▶ PromptVersion
  UAFMetric             ──1:1──▶ ConfidenceScore
  PaperAnalysis         ──N:1──▶ GeneratedPaper (external)
  QuestionBank          ──1:N──▶ QuestionBankAnalysis

Legend:
  ──▶  : navigable association
  1     : exactly one
  1..*  : one or more
  0..1  : zero or one
  N     : many
```

---

## Entity Definitions

### QuestionBankAnalysis

The root aggregate for one complete UAF evaluation of a QuestionBank.
Every evaluation run creates exactly one `QuestionBankAnalysis` instance.
All other entities in this model are children of this aggregate.

| Field           | Type                          | Description                                          |
|-----------------|-------------------------------|------------------------------------------------------|
| id              | `AnalysisId`                  | Unique identifier for this analysis run               |
| questionBankId  | `QuestionBankId`              | Foreign key to the QuestionBank being evaluated       |
| version         | `number` (monotonic)          | Version number for this QuestionBank. Increments per bank, per run |
| status          | `AnalysisStatus`              | Current lifecycle state (see enum)                    |
| triggeredById   | `UserId`                      | Who or what triggered this analysis run               |
| startedAt       | `DateTime`                    | When the analysis was initiated                       |
| completedAt     | `DateTime?`                   | When the analysis reached a terminal state            |

**Status lifecycle:**

```
INITIALIZED ──▶ EXTRACTING ──▶ COMPUTING ──▶ AI_PENDING ──▶ AI_COMPLETE ──▶ COMPLETE
                                        \                                  /
                                         └──▶ FAILED (any step) ──────────┘
```

```typescript
// TypeScript representation
interface QuestionBankAnalysis {
  id: AnalysisId;
  questionBankId: QuestionBankId;
  version: number; // monotonic per questionBankId
  status: AnalysisStatus;
  triggeredById: UserId;
  startedAt: DateTime;
  completedAt: DateTime | null;

  // Navigation (domain concept, not persistence)
  versions: AnalysisVersion[];
  snapshot: AnalysisSnapshot;
  metrics: UAFMetric[];
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: AnalysisEvidence[];
  paperAnalyses: PaperAnalysis[];
}
```

**Invariants:**
- `version` is monotonic for a given `questionBankId`. No gaps, no skips.
- Terminal states are `COMPLETE` and `FAILED`. No transitions out of them.
- `completedAt` is `null` until a terminal state is reached.
- At least one `AnalysisVersion` must exist for any status beyond `INITIALIZED`.

---

### AnalysisVersion

An immutable version record that captures the exact conditions under which
an analysis was computed. Multiple versions exist per `QuestionBankAnalysis`
when analysis is re-run with different parameters.

| Field                    | Type                          | Description |
|--------------------------|-------------------------------|-------------|
| id                       | `AnalysisVersionId`           | Unique identifier |
| questionBankAnalysisId   | `AnalysisId`                  | Parent analysis |
| versionNumber            | `number`                      | Monotonic version within the parent analysis |
| evaluationEngineVersion  | `string`                      | SemVer of the deterministic evaluation engine |
| promptVersion            | `string`                      | SemVer of the prompt pack |
| analysisSchemaVersion    | `string`                      | SemVer of the analysis output schema |
| ollamaModel              | `string`                      | Ollama model tag (e.g. `llama3.1:70b`) |
| ollamaContext            | `number`                      | Context window size used |
| ollamaTemperature        | `number`                      | Temperature setting used |
| evidenceHash             | `EvidenceHash`                | SHA-256 of the evidence snapshot + engine version + prompt version |
| createdAt                | `DateTime`                    | When this version was created |

```typescript
interface AnalysisVersion {
  id: AnalysisVersionId;
  questionBankAnalysisId: AnalysisId;
  versionNumber: number;
  evaluationEngineVersion: string;
  promptVersion: string;
  analysisSchemaVersion: string;
  ollamaModel: string;
  ollamaContext: number;
  ollamaTemperature: number;
  evidenceHash: EvidenceHash;
  createdAt: DateTime;

  // Navigation
  evidenceSnapshot: EvidenceSnapshot;
  promptVersionRef: PromptVersion;
}
```

**Invariants:**
- IMMUTABLE once created. No fields may be updated after creation.
- `versionNumber` is monotonic within a `questionBankAnalysisId`.
- `evidenceHash` must match `SHA-256(snapshot.json + evaluationEngineVersion + promptVersion)`.

---

### EvidenceSnapshot

The exact deterministic data package that was sent to Ollama for analysis.
Persisted for reproducibility, audit, and cache-key derivation.
This is a first-class entity, not a JSON field on another record.

| Field             | Type                          | Description |
|-------------------|-------------------------------|-------------|
| id                | `EvidenceSnapshotId`          | Unique identifier |
| analysisVersionId | `AnalysisVersionId`           | Parent version |
| snapshot          | `Json`                        | Complete deterministic evidence blob |
| evidenceHash      | `EvidenceHash`                | SHA-256 checksum of this payload + metadata |
| sizeBytes         | `number`                      | Byte size of the snapshot JSON |

```typescript
interface EvidenceSnapshot {
  id: EvidenceSnapshotId;
  analysisVersionId: AnalysisVersionId;
  snapshot: Json; // the complete deterministic evidence blob
  evidenceHash: EvidenceHash;
  sizeBytes: number;
}
```

**Invariants:**
- Contains ONLY deterministic data. No raw AI output, no randomized values.
- `evidenceHash` is stable for identical evidence + engine version + prompt version.
- The hash is used as a cache key: if it matches a prior run, skip Ollama.

---

### AnalysisSnapshot

A point-in-time full state snapshot of a completed analysis. This is the
read model that the Dean's Dashboard and downstream consumers load.
One exists per `QuestionBankAnalysis`, regenerated on each completion.

| Field                   | Type                          | Description |
|-------------------------|-------------------------------|-------------|
| id                      | `AnalysisSnapshotId`          | Unique identifier |
| questionBankAnalysisId  | `AnalysisId`                  | Parent analysis |
| analysisVersionId       | `AnalysisVersionId`           | Which version produced this snapshot |
| fullReport              | `Json`                        | Complete 15-phase analysis report |
| executiveSummary        | `string`                      | Human-readable summary |
| finalVerdict            | `FinalVerdict`                | Overall verdict classification |

```typescript
interface AnalysisSnapshot {
  id: AnalysisSnapshotId;
  questionBankAnalysisId: AnalysisId;
  analysisVersionId: AnalysisVersionId;
  fullReport: Json; // all 15 phases of output
  executiveSummary: string;
  finalVerdict: FinalVerdict;
}
```

**Invariants:**
- Generated only when parent `QuestionBankAnalysis` reaches `COMPLETE` status.
- `fullReport` must include all 15 phases of the analysis pipeline.
- Previous snapshots are retained for history but not linked from the active entity.

---

### PaperAnalysis

UAF analysis results scoped to a single `GeneratedPaper` (variant A, B, or C).
Each variant in a QuestionBank gets its own `PaperAnalysis`.

| Field                   | Type                          | Description |
|-------------------------|-------------------------------|-------------|
| id                      | `PaperAnalysisId`             | Unique identifier |
| questionBankAnalysisId  | `AnalysisId`                  | Parent analysis |
| generatedPaperId        | `GeneratedPaperId`            | Foreign key to the variant being analyzed |
| indexValues             | `Json`                        | Per-variant computed index values |
| aiNarrative             | `Json`                        | Per-variant AI-generated narrative |

```typescript
interface PaperAnalysis {
  id: PaperAnalysisId;
  questionBankAnalysisId: AnalysisId;
  generatedPaperId: GeneratedPaperId;
  indexValues: Json; // variant-specific metric values
  aiNarrative: Json; // variant-specific AI commentary
}
```

**Invariants:**
- Always references a parent `QuestionBankAnalysis`.
- Always references a `GeneratedPaper` (external entity).
- `generatedPaperId` must be unique within a single `QuestionBankAnalysis`.

---

### UAFMetric

One computed index or sub-metric within the UAF framework. All metrics
share the same `Classification` matrix and the same `0.00-1.00` value range.

| Field             | Type                          | Description |
|-------------------|-------------------------------|-------------|
| id                | `UAFMetricId`                 | Unique identifier |
| questionBankAnalysisId | `AnalysisId`             | Parent analysis |
| indexCode         | `IndexCode`                   | Which index this metric represents |
| value             | `number`                      | Computed value, always 0.00-1.00 |
| classification    | `Classification`              | Derived from value via shared matrix |
| weight            | `number`                      | Composition weight (for QPQI nesting) |
| weightedScore     | `number`                      | `value * weight` |
| formulaUsed       | `string`                      | Reference to the formula that produced this value |
| computationOrder  | `number`                      | Execution order in the computation DAG |

```typescript
interface UAFMetric {
  id: UAFMetricId;
  questionBankAnalysisId: AnalysisId;
  indexCode: IndexCode;
  value: number; // always 0.00-1.00
  classification: Classification;
  weight: number;
  weightedScore: number;
  formulaUsed: string;
  computationOrder: number;

  // Navigation
  confidence: ConfidenceScore;
}
```

**Invariants:**
- `value` is always in `[0.00, 1.00]`. Enforced at computation time.
- IMMUTABLE after computation. Metric values are never overwritten.
- `weightedScore` always equals `value * weight`.
- `computationOrder` defines the DAG ordering for metric calculation.
- `indexCode` must be a recognized member of the `IndexCode` enum.

---

### ConfidenceScore

Confidence metadata associated with a single `UAFMetric`. Answers the
question: how sure are we that this metric is accurate?

| Field         | Type                          | Description |
|---------------|-------------------------------|-------------|
| id            | `ConfidenceScoreId`           | Unique identifier |
| uafMetricId   | `UAFMetricId`                 | Parent metric |
| verifiedItems | `number`                      | Number of evidence items that could be verified |
| requiredItems | `number`                      | Number of evidence items required |
| score         | `number`                      | `verifiedItems / requiredItems`, always 0.00-1.00 |
| percentage    | `number`                      | `score * 100` |
| classification | `ConfidenceClassification`   | Verbal confidence rating |
| justification | `string`                      | Human-readable explanation |

```typescript
interface ConfidenceScore {
  id: ConfidenceScoreId;
  uafMetricId: UAFMetricId;
  verifiedItems: number;
  requiredItems: number;
  score: number; // verifiedItems / requiredItems, 0.00-1.00
  percentage: number; // score * 100
  classification: ConfidenceClassification;
  justification: string;
}
```

**Invariants:**
- `score` is always `verifiedItems / requiredItems`.
- `requiredItems > 0`. If zero items are required, confidence is undefined.
- IMMUTABLE after computation.

---

### Risk

One entry in the Risk Register generated during UAF analysis.

| Field              | Type                          | Description |
|--------------------|-------------------------------|-------------|
| id                 | `RiskId`                      | Unique identifier |
| questionBankAnalysisId | `AnalysisId`             | Parent analysis |
| finding            | `string`                      | Description of the risk finding |
| educationalRisk    | `string`                      | Impact on educational outcomes |
| institutionalRisk  | `string`                      | Impact on institutional standing |
| priority           | `RiskPriority`                | Criticality level |
| riskType           | `RiskType`                    | Category of risk |
| affectedModules    | `string[]`                    | Module codes affected |
| affectedCOs        | `string[]`                    | Course Outcome codes affected |
| evidenceReference  | `string`                      | Reference back to supporting evidence |

```typescript
interface Risk {
  id: RiskId;
  questionBankAnalysisId: AnalysisId;
  finding: string;
  educationalRisk: string;
  institutionalRisk: string;
  priority: RiskPriority;
  riskType: RiskType;
  affectedModules: string[];
  affectedCOs: string[];
  evidenceReference: string;
}
```

**Invariants:**
- At least one of `affectedModules` or `affectedCOs` must be non-empty.
- `evidenceReference` should point to a valid `AnalysisEvidence.id` or external source.

---

### Recommendation

One entry in the Recommendation Register generated during UAF analysis.

| Field              | Type                          | Description |
|--------------------|-------------------------------|-------------|
| id                 | `RecommendationId`            | Unique identifier |
| questionBankAnalysisId | `AnalysisId`             | Parent analysis |
| finding            | `string`                      | What was found |
| recommendation     | `string`                      | What should be done |
| priority           | `RiskPriority`                | Urgency level |
| impact             | `string`                      | Expected impact if actioned |
| suggestedActions   | `string[]`                    | Concrete action steps |
| evidenceReference  | `string`                      | Reference back to supporting evidence |

```typescript
interface Recommendation {
  id: RecommendationId;
  questionBankAnalysisId: AnalysisId;
  finding: string;
  recommendation: string;
  priority: RiskPriority;
  impact: string;
  suggestedActions: string[];
  evidenceReference: string;
}
```

---

### AnalysisEvidence

One piece of evidence available during analysis. Maps to the UAF Evidence
Hierarchy (5 levels).

| Field               | Type                          | Description |
|---------------------|-------------------------------|-------------|
| id                  | `AnalysisEvidenceId`          | Unique identifier |
| questionBankAnalysisId | `AnalysisId`              | Parent analysis |
| evidenceType        | `EvidenceType`                | How this evidence was obtained |
| category            | `string`                      | Evidence category label |
| description         | `string`                      | Human-readable description |
| sourceReference     | `string`                      | Where this evidence came from |
| level               | `number`                      | UAF Evidence Hierarchy level (1-5) |

```typescript
interface AnalysisEvidence {
  id: AnalysisEvidenceId;
  questionBankAnalysisId: AnalysisId;
  evidenceType: EvidenceType;
  category: string;
  description: string;
  sourceReference: string;
  level: number; // 1-5, UAF Evidence Hierarchy
}
```

**Invariants:**
- `level` must be an integer in `[1, 5]`.
- Level 5 is highest quality (direct, empirical evidence).
- Level 1 is lowest quality (professional judgment, unsupported).

---

### PromptVersion

Immutable record of a specific prompt used for AI analysis.

| Field          | Type                          | Description |
|----------------|-------------------------------|-------------|
| id             | `PromptVersionId`             | Unique identifier |
| moduleId       | `PromptModuleId`              | Which analysis module this prompt serves |
| version        | `string`                      | SemVer for this prompt |
| promptText     | `string`                      | The full prompt template |
| outputSchema   | `Json`                        | Expected JSON output schema |
| contextBudget  | `number`                      | Maximum context tokens |
| createdAt      | `DateTime`                    | When this version was created |
| supersededAt   | `DateTime?`                   | When this version was replaced |

```typescript
interface PromptVersion {
  id: PromptVersionId;
  moduleId: PromptModuleId;
  version: string;
  promptText: string;
  outputSchema: Json;
  contextBudget: number;
  createdAt: DateTime;
  supersededAt: DateTime | null;
}
```

**Invariants:**
- IMMUTABLE once created. Prompt text never changes after publication.
- `supersededAt` is `null` for the active version of a module.
- Only one version of a `moduleId` may have `supersededAt = null` at a time.

---

## Value Objects and Enums

### AnalysisStatus

```typescript
enum AnalysisStatus {
  INITIALIZED   = "INITIALIZED",    // Created, not yet started
  EXTRACTING    = "EXTRACTING",     // Extracting data from QuestionBank
  COMPUTING     = "COMPUTING",      // Running deterministic calculations
  AI_PENDING    = "AI_PENDING",     // Waiting for Ollama response
  AI_COMPLETE   = "AI_COMPLETE",    // Ollama response received
  COMPLETE      = "COMPLETE",       // All phases done, report ready
  FAILED        = "FAILED",         // Terminal failure state
}
```

### IndexCode

All recognized UAF indices and sub-metrics.

```typescript
enum IndexCode {
  // Core Indices
  SCI   = "SCI",    // Syllabus Coverage Index
  MII   = "MII",    // Module Integration Index
  BDI   = "BDI",    // Bloom Distribution Index
  CVI   = "CVI",    // CO-Vertex Index
  MCAI  = "MCAI",   // Module Coverage Adequacy Index

  // Difficulty and Balance
  DBI   = "DBI",    // Difficulty Balance Index
  QCQI  = "QCQI",   // Question Complexity and Quality Index

  // Cognitive and Alignment
  CAI   = "CAI",    // Cognitive Alignment Index
  AMI   = "AMI",    // Attainment Mapping Index
  FRI   = "FRI",    // Fairness and Representation Index

  // Quality
  QPQI  = "QPQI",   // Question Paper Quality Index (composite)
  OCI   = "OCI",    // Outcome Coverage Index
  ECS   = "ECS",    // Effective Coverage Score

  // Evaluation
  EQI   = "EQI",    // Exam Quality Index
  COA   = "COA",    // CO Attainment
  POA   = "POA",    // PO Attainment
  PIA   = "PIA",    // PSO Attainment

  // Taxonomy
  RBTA  = "RBTA",   // Revised Bloom's Taxonomy Alignment
  DA    = "DA",     // Difficulty Analysis
  MAA   = "MAA",    // Module Articulation Analysis
  QTA   = "QTA",    // Question Type Analysis

  // Cognitive Spectrum
  MC    = "MC",     // Multiple Choice (RBT Level)
  MCS   = "MCS",    // Multiple Choice Score
  LOTS  = "LOTS",   // Lower Order Thinking Score
  HOTS  = "HOTS",   // Higher Order Thinking Score
  CBR   = "CBR",    // Cognitive Bloom Ratio
}
```

### Classification

Shared classification matrix for all metrics.

```typescript
enum Classification {
  EXEMPLARY          = "EXEMPLARY",
  HIGHLY_EFFECTIVE   = "HIGHLY_EFFECTIVE",
  EFFECTIVE          = "EFFECTIVE",
  ACCEPTABLE         = "ACCEPTABLE",
  NEEDS_IMPROVEMENT  = "NEEDS_IMPROVEMENT",
  MAJOR_REVISION     = "MAJOR_REVISION",
}
```

**Classification matrix (shared across all metrics):**

| Value Range       | Classification     |
|-------------------|--------------------|
| 0.90 - 1.00       | EXEMPLARY          |
| 0.80 - 0.89       | HIGHLY_EFFECTIVE   |
| 0.70 - 0.79       | EFFECTIVE          |
| 0.60 - 0.69       | ACCEPTABLE         |
| 0.40 - 0.59       | NEEDS_IMPROVEMENT  |
| 0.00 - 0.39       | MAJOR_REVISION     |

### ConfidenceClassification

```typescript
enum ConfidenceClassification {
  VERY_HIGH  = "VERY_HIGH",
  HIGH       = "HIGH",
  MEDIUM     = "MEDIUM",
  LOW        = "LOW",
  VERY_LOW   = "VERY_LOW",
}
```

**Confidence matrix:**

| Score Range       | Classification   |
|-------------------|------------------|
| 0.95 - 1.00       | VERY_HIGH        |
| 0.85 - 0.94       | HIGH             |
| 0.70 - 0.84       | MEDIUM           |
| 0.50 - 0.69       | LOW              |
| 0.00 - 0.49       | VERY_LOW         |

### FinalVerdict

```typescript
enum FinalVerdict {
  EXEMPLARY         = "EXEMPLARY",
  SATISFACTORY      = "SATISFACTORY",
  NEEDS_IMPROVEMENT = "NEEDS_IMPROVEMENT",
  MAJOR_REVISION    = "MAJOR_REVISION",
}
```

### RiskPriority

```typescript
enum RiskPriority {
  CRITICAL = "CRITICAL",
  MAJOR    = "MAJOR",
  MODERATE = "MODERATE",
  MINOR    = "MINOR",
}
```

### RiskType

```typescript
enum RiskType {
  EDUCATIONAL    = "EDUCATIONAL",
  INSTITUTIONAL  = "INSTITUTIONAL",
  ASSESSMENT     = "ASSESSMENT",
  ACCREDITATION  = "ACCREDITATION",
}
```

### EvidenceType

```typescript
enum EvidenceType {
  DIRECT               = "DIRECT",
  METADATA             = "METADATA",
  CALCULATED           = "CALCULATED",
  PROFESSIONAL_JUDGEMENT = "PROFESSIONAL_JUDGEMENT",
}
```

### PromptModuleId

```typescript
enum PromptModuleId {
  EXECUTIVE_SUMMARY     = "executive-summary",
  BLOOM_ANALYSIS        = "bloom-analysis",
  DIFFICULTY            = "difficulty",
  CO_COVERAGE           = "co-coverage",
  MODULE_COVERAGE       = "module-coverage",
  CONCEPT_DIVERSITY     = "concept-diversity",
  RISK_ANALYSIS         = "risk-analysis",
  RECOMMENDATIONS       = "recommendations",
  ACADEMIC_QUALITY      = "academic-quality",
  FINAL_VERDICT         = "final-verdict",
}
```

### Type Aliases

```typescript
// Branded / opaque identifier types
type AnalysisId = string & { readonly __brand: "AnalysisId" };
type AnalysisVersionId = string & { readonly __brand: "AnalysisVersionId" };
type EvidenceSnapshotId = string & { readonly __brand: "EvidenceSnapshotId" };
type AnalysisSnapshotId = string & { readonly __brand: "AnalysisSnapshotId" };
type PaperAnalysisId = string & { readonly __brand: "PaperAnalysisId" };
type UAFMetricId = string & { readonly __brand: "UAFMetricId" };
type ConfidenceScoreId = string & { readonly __brand: "ConfidenceScoreId" };
type RiskId = string & { readonly __brand: "RiskId" };
type RecommendationId = string & { readonly __brand: "RecommendationId" };
type AnalysisEvidenceId = string & { readonly __brand: "AnalysisEvidenceId" };
type PromptVersionId = string & { readonly __brand: "PromptVersionId" };
type QuestionBankId = string & { readonly __brand: "QuestionBankId" };
type GeneratedPaperId = string & { readonly __brand: "GeneratedPaperId" };
type UserId = string & { readonly __brand: "UserId" };
type EvidenceHash = string & { readonly __brand: "EvidenceHash" };

// Standard primitives
type DateTime = string; // ISO 8601
type Json = Record<string, unknown>;
```

---

## Glossary

| Term | Definition |
|------|------------|
| **UAF** | Unit Assessment Framework. The methodology for evaluating question bank quality across 15 analysis phases. |
| **QuestionBank** | External aggregate root. A collection of questions organized by module and outcome. Not owned by this subsystem. |
| **QuestionBankAnalysis** | Root aggregate for one complete UAF evaluation run of a single QuestionBank. |
| **AnalysisVersion** | Immutable record of the conditions under which an analysis was performed. Enables reproduction and audit. |
| **EvidenceSnapshot** | The complete deterministic data package sent to Ollama. First-class entity for reproducibility and caching. |
| **EvidenceHash** | SHA-256 checksum that uniquely identifies an EvidenceSnapshot + engine version + prompt version. Used as cache key. |
| **AnalysisSnapshot** | Point-in-time full state read model. What the UI loads. |
| **AnalysisPipeline** | The sequence of phases that process a QuestionBank through evaluation. Not a stored entity, but the orchestration layer over this domain. |
| **DeterministicEngine** | The computation engine that calculates all index values (UAFMetrics) before any AI call. Output is fully reproducible. |
| **PaperAnalysis** | Analysis results scoped to a single generated paper variant (A, B, or C). |
| **GeneratedPaper** | External entity. One variant of a question paper generated from the QuestionBank. |
| **Module** | A unit of instruction within the syllabus. A QuestionBank covers multiple modules. |
| **Variant** | One version of a generated question paper (typically Variant A, B, C). |
| **Phase** | One step in the 15-phase UAF analysis pipeline. |
| **Index** | A computed metric (UAFMetric) within the UAF framework. Has a value, classification, and confidence. |
| **IndexCode** | Unique code identifying which index a UAFMetric represents (e.g. SCI, BDI, QPQI). |
| **Classification** | Verbal rating derived from a numeric metric value via the shared classification matrix. |
| **Confidence** | A measure of how much evidence supports a given metric. Derived from verified vs. required evidence items. |
| **QPQI** | Question Paper Quality Index. The composite top-level index that aggregates all other indices. |
| **Risk** | A finding in the Risk Register that identifies a potential educational or institutional issue. |
| **Recommendation** | A finding in the Recommendation Register that suggests an actionable improvement. |
| **AnalysisEvidence** | A single piece of evidence used during analysis, classified by type and hierarchy level. |
| **Evidence Hierarchy** | 5-level classification of evidence quality, from Level 1 (professional judgment) to Level 5 (direct empirical data). |
| **Evidence Type** | Classification of how evidence was obtained: DIRECT, METADATA, CALCULATED, or PROFESSIONAL_JUDGEMENT. |
| **PromptVersion** | Immutable record of a prompt template used for one module of the AI analysis phase. |
| **PromptModuleId** | Identifier for which analysis module a prompt serves (e.g. bloom-analysis, risk-analysis). |
| **FinalVerdict** | Overall judgment for the QuestionBank: EXEMPLARY, SATISFACTORY, NEEDS_IMPROVEMENT, or MAJOR_REVISION. |
| **Monotonic Version** | A version number that strictly increases with no gaps, no skips, and no repeats. |

---

## Constraints and Invariants

### Immutability

1. **AnalysisVersion** is immutable once created. No field may be updated after the record is persisted.
2. **EvidenceSnapshot** is immutable once created. The snapshot and its hash never change.
3. **PromptVersion** is immutable once created. Prompt text and schema never change after publication.
4. **UAFMetric** values are immutable after computation. A re-analysis creates new records with a new `AnalysisVersion`.
5. **ConfidenceScore** values are immutable after computation.

### EvidenceHash Derivation

```
evidenceHash = SHA-256(
  canonicalJson(evidenceSnapshot.snapshot) +
  analysisVersion.evaluationEngineVersion +
  analysisVersion.promptVersion
)
```

- The hash is the cache key. If a prior `AnalysisVersion` with the same `evidenceHash` exists, the Ollama call can be skipped and the prior AI output reused.
- The hash is computable before any AI call is made.
- `canonicalJson` means deterministic, key-sorted, whitespace-normalized JSON.

### UAFMetric Value Range

- All `UAFMetric.value` values are in `[0.00, 1.00]`.
- All `ConfidenceScore.score` values are in `[0.00, 1.00]`.
- Zero and one are inclusive bounds. A perfect score is `1.00`. A complete failure is `0.00`.

### Classification Matrix (Shared)

- The `Classification` enum (EXEMPLARY through MAJOR_REVISION) and its value ranges are shared across ALL metric types.
- No metric type may define its own classification ranges.
- The `ConfidenceClassification` enum has its own independent ranges.

### PaperAnalysis Constraints

- Every `PaperAnalysis` always references a parent `QuestionBankAnalysis`.
- A `GeneratedPaperId` is unique within a single `QuestionBankAnalysis`. The same paper cannot be analyzed twice in the same run.
- `QuestionBankAnalysis` maintains exactly one `PaperAnalysis` per variant (A, B, C) when papers exist.

### EvidenceSnapshot Content Rule

- `EvidenceSnapshot.snapshot` contains ONLY deterministic data.
- No raw AI output, no randomized values, no non-reproducible data.
- Deterministic data includes: question text, options, keys, metadata, computed indices, module mappings, CO mappings, taxonomy classifications.
- This rule exists so that `evidenceHash` is stable and can be used as a cache key.

### Aggregation

- All entities except `PromptVersion` are children of `QuestionBankAnalysis`.
- `QuestionBankAnalysis` is the root aggregate. External consumers reference analysis results via the `AnalysisSnapshot` read model.
- `QuestionBank`, `GeneratedPaper`, and `UserId` are external entities owned by other subsystems.

---

## Out of Scope

The following are intentionally absent from this domain model:

- **Service interfaces** — `IAnalysisService`, `IPromptService`, etc. are defined in the service layer.
- **Prompt text** — Prompt templates live in the prompt registry, not in the domain.
- **API endpoints** — REST, GraphQL, or RPC contracts have their own specification.
- **UI components** — Dashboard screens, report renderers, and forms are view-layer concerns.
- **Database schema** — Tables, indexes, migrations, and ORM mappings are persistence concerns derived from this model.
- **Event definitions** — Domain events (e.g. `AnalysisCompleted`, `MetricComputed`) are defined in the events specification.
- **Orchestration logic** — The pipeline state machine, retry policies, and queue management are infrastructure.
- **Caching strategy** — Cache-aside vs. write-through, TTLs, and eviction policies are not domain concepts.

---

*End of domain model. All downstream documents must reference the entities,
value objects, and invariants defined here without redefinition.*
