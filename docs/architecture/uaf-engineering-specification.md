# UAF v3.3 Engineering Specification

> **Purpose:** Convert every UAF v3.3 academic concept into an implementable specification.
> Every metric, formula, stage boundary, failure mode, and test is defined here.
> Another engineer can implement the Deterministic Engine without making architectural decisions.
>
> **Reference documents:**
> - Domain entities: `uaf-domain-model.md` (ratified) — referenced, never redefined
> - Formulas and extraction: `uaf-framework-extraction.md` (v3.3 specification) — cited by section

---

## Table of Contents

1. [Metric Function Catalog](#1-metric-function-catalog)
   - [Extraction Metrics](#11-extraction-metrics)
     - computeECS, computeEQI
   - [MII Sub-Metrics](#12-mii-sub-metrics)
     - computeCOA, computePOA, computePIA, computeRBTA, computeDA, computeMAA, computeQTA, computeMC, computeMCS
   - [Bloom Sub-Metrics](#13-bloom-sub-metrics)
     - computeLOTS, computeHOTS, computeCBR
   - [Core Indices](#14-core-indices)
     - computeSCI, computeMII, computeBDI, computeCVI, computeMCAI, computeDBI
   - [Quality Indices](#15-quality-indices)
     - computeQCQI, computeCAI, computeAMI, computeFRI
   - [Composite Indices](#16-composite-indices)
     - computeQPQI, computeOCI, computeConfidenceScore
2. [Computation Order (DAG)](#2-computation-order-dag)
3. [Evidence Builder Specification](#3-evidence-builder-specification)
4. [Classification Matrix](#4-classification-matrix)
5. [Pipeline Stage Boundaries](#5-pipeline-stage-boundaries)
6. [Failure Mode Matrix](#6-failure-mode-matrix)
7. [Test Specification](#7-test-specification)

---

## 1. Metric Function Catalog

### Conventions

**Domain entity used:** `UAFMetric` (defined in uaf-domain-model.md). Every computed metric produces a `UAFMetric` instance with:
- `indexCode` — from the `IndexCode` enum
- `value` — always clamped to `[0.00, 1.00]`
- `classification` — derived via the shared classification matrix
- `weight` — composition weight (default 0 unless QPQI sub-index)
- `weightedScore` — `value * weight`
- `formulaUsed` — string identifying the formula section
- `computationOrder` — position in the execution DAG

**Domain entity used:** `ConfidenceScore` (defined in uaf-domain-model.md). Every `UAFMetric` has one.

**Classification matrix:** Shared across all metrics. Defined once in [Section 4](#4-classification-matrix).

**Failures** (missing evidence, division by zero, null inputs) produce a `UAFMetric` with `value = null` and a `ConfidenceScore` with `classification = VERY_LOW`. See [Section 6](#6-failure-mode-matrix).

---

### 1.1 Extraction Metrics

#### computeECS

**Purpose:** Measures extraction completeness — what fraction of required attributes were successfully extracted from the QuestionBank.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 4.9 of extraction doc)

```
ECS = Successfully Extracted Attributes / Required Attributes
```

**Inputs:**
- `successfullyExtractedAttributes: number` — attributes that were extracted without error
- `requiredAttributes: number` — total attributes that should exist (questions × attribute types per question)

**Output:**
- `UAFMetric` with `indexCode = ECS`, `value = result, `classification` derived, `weight = 0`, `computationOrder = 1`

**Dependencies:**
- EvidenceBuilder must have completed extraction

**Validation:**
- `value` clamped to `[0.00, 1.00]`
- `requiredAttributes > 0`
- Both inputs non-null

**Failure conditions:**
- `requiredAttributes === 0` → set `value = null`, confidence `VERY_LOW`, log "requiredAttributes is zero"
- `successfullyExtractedAttributes === null` → set `value = null`, confidence `VERY_LOW`, log "extraction count missing"

**Test scenarios:**
- Happy: 45 extracted / 50 required → `ECS = 0.90` → EXEMPLARY
- Edge: 0 extracted / 50 required → `ECS = 0.00` → MAJOR_REVISION
- Edge: 50 extracted / 50 required → `ECS = 1.00` → EXEMPLARY
- Failure: requiredAttributes = 0 → `value = null`, confidence VERY_LOW

---

#### computeEQI

**Purpose:** Measures extraction quality — of the attributes extracted, what fraction were verified as correct.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 4.10 of extraction doc)

```
EQI = Verified Attributes / Extracted Attributes
```

**Inputs:**
- `verifiedAttributes: number` — attributes cross-verified against source documentation
- `extractedAttributes: number` — total attributes that were extracted (denominator from computeECS)

**Output:**
- `UAFMetric` with `indexCode = EQI`, `value = result`, `classification` derived, `weight = 0`, `computationOrder = 2`

**Dependencies:**
- EvidenceBuilder must have completed extraction with verification

**Validation:**
- `value` clamped to `[0.00, 1.00]`
- `extractedAttributes > 0`
- `verifiedAttributes <= extractedAttributes`

**Failure conditions:**
- `extractedAttributes === 0` → set `value = null`, confidence `VERY_LOW`
- `verifiedAttributes === null` → set `value = null`, confidence `VERY_LOW`
- `verifiedAttributes > extractedAttributes` → clamp to 1.00, log warning

**Test scenarios:**
- Happy: 40 verified / 45 extracted → `EQI ≈ 0.89` → HIGHLY_EFFECTIVE
- Edge: 0 verified / 45 extracted → `EQI = 0.00` → MAJOR_REVISION
- Edge: 45 verified / 45 extracted → `EQI = 1.00` → EXEMPLARY
- Failure: extractedAttributes = 0 → `value = null`, confidence VERY_LOW

---

### 1.2 MII Sub-Metrics

All MII sub-metrics follow the same pattern: they compute accuracy/completeness for a single metadata dimension. Each produces a `UAFMetric` that feeds into the MII composite.

---

#### computeCOA

**Purpose:** Course Outcome mapping accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.3 of extraction doc)

```
COA = Correct CO Mappings / Total CO Mappings
```

**Inputs:**
- `correctCOMappings: number` — questions where assigned CO matches documented CO
- `totalCOMappings: number` — total questions with CO metadata

**Output:**
- `UAFMetric` with `indexCode = COA`, `value = result`, `classification` derived, `weight = 0`
  (weight is implicit via MII composite, not direct), `computationOrder = 3`

**Dependencies:**
- EvidenceBuilder must have extracted and verified CO mappings

**Validation:**
- `value` clamped to `[0.00, 1.00]`
- `totalCOMappings > 0`

**Failure conditions:**
- `totalCOMappings === 0` → COA = null, VERY_LOW
- `correctCOMappings === null` → COA = null, VERY_LOW

**Test scenarios:**
- Happy: 18 correct / 20 total → `COA = 0.90` → EXEMPLARY
- Edge: 0 correct / 20 total → `COA = 0.00` → MAJOR_REVISION
- Edge: 20 correct / 20 total → `COA = 1.00` → EXEMPLARY
- Failure: totalCOMappings = 0 → null, VERY_LOW

---

#### computePOA

**Purpose:** Program Outcome mapping accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.4 of extraction doc)

```
POA = Correct PO Mappings / Total PO Mappings
```

**Inputs:**
- `correctPOMappings: number`
- `totalPOMappings: number`

**Output:**
- `UAFMetric` with `indexCode = POA`

**Dependencies:** EvidenceBuilder verified PO mappings.

**Validation, Failure conditions:** Same pattern as COA.

**Test scenarios:**
- Happy: 15 correct / 18 total → `POA ≈ 0.83` → HIGHLY_EFFECTIVE
- Edge: 0 correct / 18 total → `POA = 0.00` → MAJOR_REVISION
- Edge: 18 correct / 18 total → `POA = 1.00` → EXEMPLARY
- Failure: totalPOMappings = 0 → null, VERY_LOW

---

#### computePIA

**Purpose:** Program Indicator mapping accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.5 of extraction doc)

```
PIA = Correct PI Mappings / Total PI Mappings
```

**Inputs:**
- `correctPIMappings: number`
- `totalPIMappings: number`

**Output:**
- `UAFMetric` with `indexCode = PIA`

**Dependencies:** EvidenceBuilder verified PI mappings.

**Validation, Failure conditions:** Same pattern.

**Test scenarios:**
- Happy: 12 correct / 15 total → `PIA = 0.80` → HIGHLY_EFFECTIVE
- Edge: 0 correct / 15 total → `PIA = 0.00` → MAJOR_REVISION
- Edge: 15 correct / 15 total → `PIA = 1.00` → EXEMPLARY
- Failure: totalPIMappings = 0 → null, VERY_LOW

---

#### computeRBTA

**Purpose:** Revised Bloom's Taxonomy level accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.6 of extraction doc)

```
RBTA = Correct Bloom Classifications / Total Bloom Classifications
```

**Inputs:**
- `correctBloomClassifications: number`
- `totalBloomClassifications: number`

**Output:**
- `UAFMetric` with `indexCode = RBTA`

**Dependencies:** EvidenceBuilder verified Bloom levels.

**Test scenarios:**
- Happy: 22 correct / 25 total → `RBTA = 0.88` → HIGHLY_EFFECTIVE
- Edge: 0 correct / 25 total → `RBTA = 0.00` → MAJOR_REVISION
- Edge: 25 correct / 25 total → `RBTA = 1.00` → EXEMPLARY
- Failure: totalBloomClassifications = 0 → null, VERY_LOW

---

#### computeDA

**Purpose:** Difficulty level accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.7 of extraction doc)

```
DA = Correct Difficulty Classifications / Total Difficulty Classifications
```

**Inputs:**
- `correctDifficultyClassifications: number`
- `totalDifficultyClassifications: number`

**Output:**
- `UAFMetric` with `indexCode = DA`

**Test scenarios:**
- Happy: 20 correct / 25 total → `DA = 0.80` → HIGHLY_EFFECTIVE
- Edge: 0 correct / 25 total → `DA = 0.00` → MAJOR_REVISION
- Edge: 25 correct / 25 total → `DA = 1.00` → EXEMPLARY
- Failure: totalDifficultyClassifications = 0 → null, VERY_LOW

---

#### computeMAA

**Purpose:** Marks allocation accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.8 of extraction doc)

```
MAA = Correct Marks Allocations / Total Questions
```

**Inputs:**
- `correctMarksAllocations: number`
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = MAA`

**Test scenarios:**
- Happy: 23 correct / 25 total → `MAA = 0.92` → EXEMPLARY
- Edge: 0 correct / 25 total → `MAA = 0.00` → MAJOR_REVISION
- Edge: 25 correct / 25 total → `MAA = 1.00` → EXEMPLARY
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeQTA

**Purpose:** Question type classification accuracy.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.9 of extraction doc)

```
QTA = Correct Classifications / Total Questions
```

**Inputs:**
- `correctTypeClassifications: number`
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = QTA`

**Test scenarios:**
- Happy: 22 correct / 25 total → `QTA = 0.88` → HIGHLY_EFFECTIVE
- Edge: 0 correct / 25 total → `QTA = 0.00` → MAJOR_REVISION
- Edge: 25 correct / 25 total → `QTA = 1.00` → EXEMPLARY
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeMC

**Purpose:** Metadata completeness — what fraction of required metadata fields are present.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.10 of extraction doc)

```
MC = Available Metadata Fields / Required Metadata Fields
```

**Inputs:**
- `availableMetadataFields: number` — sum of present fields across all questions
- `requiredMetadataFields: number` — total fields that should exist (questions × 7 metadata dimensions)

**Output:**
- `UAFMetric` with `indexCode = MC`

**Test scenarios:**
- Happy: 160 available / 175 required → `MC ≈ 0.91` → EXEMPLARY
- Edge: 0 available / 175 required → `MC = 0.00` → MAJOR_REVISION
- Edge: 175 available / 175 required → `MC = 1.00` → EXEMPLARY
- Failure: requiredMetadataFields = 0 → null, VERY_LOW

---

#### computeMCS

**Purpose:** Metadata consistency — of all metadata entries, what fraction are internally consistent.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.11 of extraction doc)

```
MCS = Consistent Metadata Entries / Total Metadata Entries
```

**Inputs:**
- `consistentMetadataEntries: number` — entries with no internal contradictions
- `totalMetadataEntries: number` — total entries across all questions

**Output:**
- `UAFMetric` with `indexCode = MCS`

**Test scenarios:**
- Happy: 155 consistent / 175 total → `MCS ≈ 0.89` → HIGHLY_EFFECTIVE
- Edge: 0 consistent / 175 total → `MCS = 0.00` → MAJOR_REVISION
- Edge: 175 consistent / 175 total → `MCS = 1.00` → EXEMPLARY
- Failure: totalMetadataEntries = 0 → null, VERY_LOW

---

### 1.3 Bloom Sub-Metrics

#### computeLOTS

**Purpose:** Computes the proportion of questions targeting Lower Order Thinking Skills (Remember, Understand, Apply).

**Pipeline Stage:** MetricEngine

**Formula:** (Section 7.3 of extraction doc)

```
LOTS = LOTS Questions / Total Questions
```

LOTS levels: Remember, Understand, Apply

**Inputs:**
- `lotsQuestions: number` — questions classified at Remember, Understand, or Apply
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = LOTS`

**Test scenarios:**
- Happy: 15 LOTS / 25 total → `LOTS = 0.60`
- Edge: 0 LOTS / 25 total → `LOTS = 0.00`
- Edge: 25 LOTS / 25 total → `LOTS = 1.00`
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeHOTS

**Purpose:** Computes the proportion of questions targeting Higher Order Thinking Skills (Analyze, Evaluate, Create).

**Pipeline Stage:** MetricEngine

**Formula:** (Section 7.3 of extraction doc)

```
HOTS = HOTS Questions / Total Questions
```

HOTS levels: Analyze, Evaluate, Create

**Inputs:**
- `hotsQuestions: number`
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = HOTS`

**Test scenarios:**
- Happy: 10 HOTS / 25 total → `HOTS = 0.40`
- Edge: 0 HOTS / 25 total → `HOTS = 0.00`
- Edge: 25 HOTS / 25 total → `HOTS = 1.00`
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeCBR

**Purpose:** Cognitive Balance Ratio — compares HOTS to LOTS emphasis.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 7.5 of extraction doc)

```
CBR = HOTS / LOTS
```

Special handling: if LOTS = 0 and HOTS = 0, CBR = 0.50 (balanced default).
If LOTS = 0 and HOTS > 0, CBR = 1.00 (maximum higher-order emphasis).

**Inputs:**
- `hots: number` — computed HOTS value (0.00-1.00)
- `lots: number` — computed LOTS value (0.00-1.00)

**Output:**
- `UAFMetric` with `indexCode = CBR`, `value` clamped to `[0.00, 1.00]`

**Dependencies:**
- computeHOTS must have completed
- computeLOTS must have completed

**Validation:**
- CBR is NOT clamped to the standard 0.00-1.00 in the UAF spec — values > 1.00 indicate strong HOTS emphasis.
  However, the `UAFMetric.value` invariant requires `[0.00, 1.00]`.
  Implementation: store the raw CBR in a temporary variable for AI narrative.
  The persisted `UAFMetric.value` is `min(rawCBR, 1.00)`.
  The raw CBR is included in the EvidenceSnapshot for AI interpretation.

**Failure conditions:**
- Both HOTS and LOTS null → CBR = null, VERY_LOW
- LOTS = 0 and HOTS = 0 → CBR = 0.50 (default balanced)

**Test scenarios:**
- Happy: HOTS = 0.40, LOTS = 0.60 → `CBR = 0.67` → clamped to 0.67
- Edge: HOTS = 0.00, LOTS = 0.80 → `CBR = 0.00`
- Edge: HOTS = 0.80, LOTS = 0.10 → `CBR = 8.00` → stored as 1.00 (clamped), raw 8.00 in snapshot
- Edge: HOTS = 0, LOTS = 0 → `CBR = 0.50` (default)
- Failure: both null → null, VERY_LOW

---

### 1.4 Core Indices

#### computeSCI

**Purpose:** Structural Compliance Index — measures compliance with the 10 required structural elements of a question bank.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 3.3 of extraction doc)

```
SCI = Structural Elements Present / Required Structural Elements
```

Required elements (10): Course Information, Question Numbering, Marks Allocation, CO Mapping, Bloom Mapping, Difficulty Mapping, Section Labels, Assessment Instructions, Metadata Consistency, Question Formatting.

**Inputs:**
- `structuralElementsPresent: number` — count of elements present (0-10)
- `requiredStructuralElements: number` — always 10

**Output:**
- `UAFMetric` with `indexCode = SCI`

**Dependencies:**
- EvidenceBuilder must have checked all 10 structural elements

**Failure conditions:**
- `requiredStructuralElements !== 10` (should never happen, but guard) → log warning, use 10

**Test scenarios:**
- Happy: 8 present / 10 required → `SCI = 0.80` → HIGHLY_EFFECTIVE
- Edge: 0 present / 10 required → `SCI = 0.00` → MAJOR_REVISION
- Edge: 10 present / 10 required → `SCI = 1.00` → EXEMPLARY
- Edge: 5 present / 10 required → `SCI = 0.50` → NEEDS_IMPROVEMENT (per domain model: 0.40-0.59)

---

#### computeMII

**Purpose:** Metadata Integrity Index — composite of 9 sub-metrics measuring metadata accuracy, completeness, and consistency.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 6.12 of extraction doc)

```
MII = (COA + POA + PIA + RBTA + DA + MAA + QTA + MC + MCS) / 9
```

**Inputs:**
- `coa: number` — from computeCOA
- `poa: number` — from computePOA
- `pia: number` — from computePIA
- `rbta: number` — from computeRBTA
- `da: number` — from computeDA
- `maa: number` — from computeMAA
- `qta: number` — from computeQTA
- `mc: number` — from computeMC
- `mcs: number` — from computeMCS

**Output:**
- `UAFMetric` with `indexCode = MII`

**Dependencies:**
- All 9 MII sub-metrics must have completed

**Failure conditions:**
- Any sub-metric is null → exclude it from the average, reduce denominator accordingly.
  Log which sub-metrics were missing.

**Test scenarios:**
- Happy: COA=0.90, POA=0.83, PIA=0.80, RBTA=0.88, DA=0.80, MAA=0.92, QTA=0.88, MC=0.91, MCS=0.89 → `MII ≈ 0.868` → HIGHLY_EFFECTIVE
- Edge: All 9 sub-metrics = 1.00 → `MII = 1.00` → EXEMPLARY
- Edge: All 9 sub-metrics = 0.00 → `MII = 0.00` → MAJOR_REVISION
- Partial failure: 2 sub-metrics null, 7 valid → denominator = 7, MII = average of 7

---

#### computeBDI

**Purpose:** Bloom Distribution Index — measures cognitive balance across Bloom's Taxonomy levels.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 3.5, 7.9 of extraction doc)

```
BDI = 1 - Σ|Observed - Expected| / 2
```

**Inputs:**
- `observedDistribution: Record<BloomLevel, number>` — observed fraction per level (sums to 1.00)
- `expectedDistribution: Record<BloomLevel, number>` — expected fraction per level (sums to 1.00)

Default expected distribution (Section 7.7): Remember 0.10, Understand 0.20, Apply 0.25, Analyze 0.20, Evaluate 0.15, Create 0.10.

**Output:**
- `UAFMetric` with `indexCode = BDI`

**Dependencies:**
- Bloom levels must be extracted and verified by EvidenceBuilder

**Validation:**
- Both distributions must sum to approximately 1.00 (within floating point tolerance)
- All levels must be present in both distributions

**Failure conditions:**
- Distribution sums deviate from 1.00 by more than 0.01 → normalize, log warning
- All observed values zero → BDI = 0.00, VERY_LOW

**Test scenarios:**
- Happy: Observed = [R:0.08, U:0.22, Ap:0.25, An:0.20, E:0.15, C:0.10], Expected = [R:0.10, U:0.20, Ap:0.25, An:0.20, E:0.15, C:0.10] → Σ|diff| = 0.04, `BDI = 0.98` → EXEMPLARY
- Edge: All questions at Remember level → Observed = [R:1.00, U:0, Ap:0, An:0, E:0, C:0] → Σ|diff| = 1.80, `BDI = 0.10` → MAJOR_REVISION
- Edge: Perfect match → `BDI = 1.00`
- Failure: All observed zero → BDI = 0.00, VERY_LOW

---

#### computeCVI

**Purpose:** Coverage Validation Index — measures learning outcome coverage.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.6, 5.9 of extraction doc)

```
CVI = Covered Course Outcomes / Total Course Outcomes
```

A CO is "covered" when at least one question maps to it.

**Inputs:**
- `coveredCourseOutcomes: number` — distinct COs with at least one mapped question
- `totalCourseOutcomes: number` — total defined COs for the subject

**Output:**
- `UAFMetric` with `indexCode = CVI`

**Dependencies:**
- EvidenceBuilder must have extracted CO mappings and total CO count

**Test scenarios:**
- Happy: 5 covered / 6 total → `CVI ≈ 0.83` → HIGHLY_EFFECTIVE
- Edge: 0 covered / 6 total → `CVI = 0.00` → MAJOR_REVISION
- Edge: 6 covered / 6 total → `CVI = 1.00` → EXEMPLARY
- Failure: totalCourseOutcomes = 0 → null, VERY_LOW

---

#### computeMCAI

**Purpose:** Marks Complexity Alignment Index — measures alignment between marks allocation and Bloom cognitive demand.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.7, 8.8 of extraction doc)

```
MCAI = Correctly Aligned Questions / Total Questions
```

A question is aligned (Section 8.8) when marks match expected cognitive demand per the Marks Complexity Validation Matrix.

**Expected alignment matrix (Section 8.6):**

| Marks Range | Expected Cognitive Level |
|---|---|
| 1-2 | Remember / Understand |
| 3-5 | Understand / Apply |
| 6-8 | Apply / Analyze |
| 9-12 | Analyze / Evaluate |
| 13+ | Evaluate / Create |

**Inputs:**
- `correctlyAlignedQuestions: number`
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = MCAI`

**Dependencies:**
- EvidenceBuilder must have extracted marks and verified Bloom levels

**Test scenarios:**
- Happy: 20 aligned / 25 total → `MCAI = 0.80` → HIGHLY_EFFECTIVE
- Edge: 0 aligned / 25 total → `MCAI = 0.00` → MAJOR_REVISION
- Edge: 25 aligned / 25 total → `MCAI = 1.00` → EXEMPLARY
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeDBI

**Purpose:** Difficulty Balance Index — measures balance between Easy, Medium, and Hard questions.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.8, 8.5 of extraction doc)

```
DBI = 1 - Σ|Observed - Expected| / 2
```

**Inputs:**
- `observedDistribution: Record<Difficulty, number>` — observed fraction per difficulty level
- `expectedDistribution: Record<Difficulty, number>` — expected fraction per level

Default expected distribution (Section 8.3): Easy 0.30, Medium 0.50, Hard 0.20.

**Output:**
- `UAFMetric` with `indexCode = DBI`

**Test scenarios:**
- Happy: Observed = [E:0.28, M:0.52, H:0.20], Expected = [E:0.30, M:0.50, H:0.20] → Σ|diff| = 0.04, `DBI = 0.98` → EXEMPLARY
- Edge: All questions Easy → `DBI ≈ 0.40` → NEEDS_IMPROVEMENT
- Edge: Perfect match → `DBI = 1.00`
- Failure: All observed zero → DBI = 0.00, VERY_LOW

---

### 1.5 Quality Indices

#### computeQCQI

**Purpose:** Question Construction Quality Index — measures question writing quality across 7 dimensions.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.9, 9.5 of extraction doc)

```
QCQI = (Clarity + Precision + TechnicalAccuracy + ContextAdequacy + AssessmentValidity + QuestionAlignment + Fairness) / 7
```

Each component (Section 9.4):

```
ComponentScore = Σ Question Scores for that component / Total Questions
```

Each question score per component is `0.00, 0.20, 0.40, 0.60, 0.80, or 1.00` (Section 9.2 scale).

**Inputs:**
- `clarityScore: number` — mean clarity across questions
- `precisionScore: number` — mean precision across questions
- `technicalAccuracyScore: number` — mean accuracy across questions
- `contextAdequacyScore: number` — mean context across questions
- `assessmentValidityScore: number` — mean validity across questions
- `questionAlignmentScore: number` — mean alignment across questions
- `fairnessScore: number` — mean fairness across questions

**Output:**
- `UAFMetric` with `indexCode = QCQI`

**Dependencies:**
- EvidenceBuilder must have scored each question on all 7 dimensions
- (Note: component scores are computed by EvidenceBuilder from question-level data, then QCQI averages them)

**Test scenarios:**
- Happy: All 7 components = 0.85 → `QCQI = 0.85` → HIGHLY_EFFECTIVE
- Edge: All 7 components = 1.00 → `QCQI = 1.00` → EXEMPLARY
- Edge: All 7 components = 0.00 → `QCQI = 0.00` → MAJOR_REVISION
- Edge: Mixed = [0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30] → `QCQI ≈ 0.60` → ACCEPTABLE
- Failure: Any component null → exclude from average, reduce denominator

---

#### computeCAI

**Purpose:** Constructive Alignment Index — measures alignment between learning outcomes and assessment.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.10, 10.4 of extraction doc)

```
CAI = Aligned Questions / Total Questions
```

A question is aligned (Section 10.4) when:
- CO Mapping is Valid
- Bloom Classification is Appropriate
- Learning Evidence is Observable
- Assessment Measures Intended Outcome

**Inputs:**
- `alignedQuestions: number`
- `totalQuestions: number`

**Output:**
- `UAFMetric` with `indexCode = CAI`

**Test scenarios:**
- Happy: 20 aligned / 25 total → `CAI = 0.80` → HIGHLY_EFFECTIVE
- Edge: 0 aligned / 25 total → `CAI = 0.00` → MAJOR_REVISION
- Edge: 25 aligned / 25 total → `CAI = 1.00` → EXEMPLARY
- Failure: totalQuestions = 0 → null, VERY_LOW

---

#### computeAMI

**Purpose:** Academic Moderation Index — measures moderation compliance across 7 criteria.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.11, 10.6.3 of extraction doc)

```
AMI = Moderation Criteria Satisfied / Total Moderation Criteria
```

Criteria (Section 10.6.1): Validity, Reliability, Fairness, Transparency, Traceability, Consistency, Governance Compliance. Total = 7.

**Inputs:**
- `criteriaSatisfied: number` — count of satisfied criteria (0-7)
- `totalCriteria: number` — always 7

**Output:**
- `UAFMetric` with `indexCode = AMI`

**Test scenarios:**
- Happy: 5 satisfied / 7 total → `AMI ≈ 0.71` → EFFECTIVE
- Edge: 0 satisfied / 7 total → `AMI = 0.00` → MAJOR_REVISION
- Edge: 7 satisfied / 7 total → `AMI = 1.00` → EXEMPLARY
- Failure: totalCriteria !== 7 → log warning, use 7

---

#### computeFRI

**Purpose:** Future Readiness Index — measures future-oriented assessment quality across 7 criteria.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.12, 10.7.3 of extraction doc)

```
FRI = Future Ready Criteria Satisfied / Total Future Ready Criteria
```

Criteria (Section 10.7.1): Problem Solving, Critical Thinking, Innovation, Industry Relevance, Graduate Attributes, Employability Skills, HOTS Integration. Total = 7.

**Inputs:**
- `futureReadyCriteriaSatisfied: number` — count of satisfied criteria (0-7)
- `totalFutureReadyCriteria: number` — always 7

**Output:**
- `UAFMetric` with `indexCode = FRI`

**Test scenarios:**
- Happy: 4 satisfied / 7 total → `FRI ≈ 0.57` → NEEDS_IMPROVEMENT
- Edge: 0 satisfied / 7 total → `FRI = 0.00` → MAJOR_REVISION
- Edge: 7 satisfied / 7 total → `FRI = 1.00` → EXEMPLARY
- Failure: totalFutureReadyCriteria !== 7 → log warning, use 7

---

### 1.6 Composite Indices

#### computeQPQI

**Purpose:** Question Paper Quality Index — the top-level weighted composite of all 10 core indices.

**Pipeline Stage:** MetricEngine

**Formula:** (Sections 3.13, 11.2 of extraction doc)

```
QPQI = (0.10 × SCI) + (0.10 × MII) + (0.15 × BDI) + (0.10 × CVI) + (0.10 × MCAI)
      + (0.10 × DBI) + (0.15 × QCQI) + (0.10 × CAI) + (0.05 × AMI) + (0.05 × FRI)
```

**Inputs:**
- `sci: number` — from computeSCI
- `mii: number` — from computeMII
- `bdi: number` — from computeBDI
- `cvi: number` — from computeCVI
- `mcai: number` — from computeMCAI
- `dbi: number` — from computeDBI
- `qcqi: number` — from computeQCQI
- `cai: number` — from computeCAI
- `ami: number` — from computeAMI
- `fri: number` — from computeFRI

Weights:

| Index | Weight |
|---|---|
| SCI | 0.10 |
| MII | 0.10 |
| BDI | 0.15 |
| CVI | 0.10 |
| MCAI | 0.10 |
| DBI | 0.10 |
| QCQI | 0.15 |
| CAI | 0.10 |
| AMI | 0.05 |
| FRI | 0.05 |

**Output:**
- `UAFMetric` with `indexCode = QPQI`, `weight = 1.00`

**Dependencies:**
- All 10 core metrics must have completed

**Failure conditions:**
- Any input metric is null → exclude it and redistribute its weight proportionally across remaining metrics.
  Log which indices were excluded.

**Test scenarios:**
- Happy: All indices = 0.85 → `QPQI = 0.85` → HIGHLY_EFFECTIVE
- Edge: All indices = 1.00 → `QPQI = 1.00` → EXEMPLARY
- Edge: All indices = 0.00 → `QPQI = 0.00` → MAJOR_REVISION
- Partial failure: 1 null index → redistribute weight, recompute

---

#### computeOCI

**Purpose:** Overall Confidence Index — average confidence across all 10 core indices.

**Pipeline Stage:** MetricEngine

**Formula:** (Section 11.5 of extraction doc)

```
OCI = (SCI_c + MII_c + BDI_c + CVI_c + MCAI_c + DBI_c + QCQI_c + CAI_c + AMI_c + FRI_c) / 10
```

Where `Index_c` = `ConfidenceScore.score` for that index.

**Inputs:**
- All 10 `ConfidenceScore.score` values (one per core index)

**Output:**
- `UAFMetric` with `indexCode = OCI`

**Dependencies:**
- All 10 confidence scores must have been computed

**Test scenarios:**
- Happy: All confidences = 0.90 → `OCI = 0.90` → VERY_HIGH confidence
- Edge: 5 confidences = 0.00, 5 confidences = 1.00 → `OCI = 0.50` → LOW
- Failure: All confidence scores null → OCI = null, VERY_LOW

---

#### computeConfidenceScore

**Purpose:** Computes a `ConfidenceScore` entity for a single `UAFMetric`. This function is called once per metric after its value is computed.

**Pipeline Stage:** SnapshotBuilder (called once per metric)

**Formula:** (Section 2.7 of extraction doc)

```
Confidence Score = Verified Evidence Items / Required Evidence Items
Confidence Percentage = Confidence Score × 100
```

**Inputs:**
- `verifiedItems: number` — items that were successfully verified
- `requiredItems: number` — items that were required for computation
- `metricIndexCode: IndexCode` — which metric this confidence applies to
- `evidenceGapDescription: string` — description of any missing evidence

**Output:**
- `ConfidenceScore` entity with:
  - `verifiedItems`
  - `requiredItems`
  - `score = verifiedItems / requiredItems`
  - `percentage = score × 100`
  - `classification` derived from confidence matrix
  - `justification` = human-readable explanation

**Classification matrix for confidence (uaf-domain-model.md):**

| Score Range | Classification |
|---|---|
| 0.95 - 1.00 | VERY_HIGH |
| 0.85 - 0.94 | HIGH |
| 0.70 - 0.84 | MEDIUM |
| 0.50 - 0.69 | LOW |
| 0.00 - 0.49 | VERY_LOW |

**Validation:**
- `requiredItems > 0`
- `score` clamped to `[0.00, 1.00]`

**Failure conditions:**
- `requiredItems === 0` → Confidence is undefined. Set `score = 0.00`, `classification = VERY_LOW`, `justification = "No evidence items were required"`

**Test scenarios:**
- Happy: 18 verified / 20 required → `score = 0.90` → HIGH
- Edge: 0 verified / 20 required → `score = 0.00` → VERY_LOW
- Edge: 20 verified / 20 required → `score = 1.00` → VERY_HIGH
- Failure: requiredItems = 0 → `score = 0.00`, VERY_LOW, "No evidence items were required"

---

## 2. Computation Order (DAG)

### 2.1 Group Definitions

The computation is a directed acyclic graph with 7 groups. Groups execute sequentially. Within a group, all metrics execute in parallel.

```
Group 1: Extraction Metrics
  ECS, EQI
  └── Both depend on EvidenceBuilder extraction output only

Group 2: Structural, Coverage, and MII Sub-Metrics
  SCI, CVI, LOTS, HOTS, CBR
  COA, POA, PIA, RBTA, DA, MAA, QTA, MC, MCS
  QCQI component scores (Clarity, Precision, TechnicalAccuracy,
    ContextAdequacy, AssessmentValidity, QuestionAlignment, Fairness)
  └── All depend on EvidenceBuilder extracted evidence
  └── All are independent of each other

Group 3: Single-Metric Composites
  MII  ── requires COA+POA+PIA+RBTA+DA+MAA+QTA+MC+MCS
  BDI  ── requires bloom distribution from extraction
  DBI  ── requires difficulty distribution from extraction
  MCAI ── requires marks + bloom alignment from extraction

Group 4: Question Quality
  QCQI ── requires its 7 component scores

Group 5: Alignment and Readiness
  CAI  ── requires evidence on CO/Bloom/learning alignment
  AMI  ── requires moderation criteria evaluation
  FRI  ── requires future readiness criteria evaluation

Group 6: Top-Level Composites
  QPQI ── requires SCI, MII, BDI, CVI, MCAI, DBI, QCQI, CAI, AMI, FRI
  OCI  ── requires all 10 ConfidenceScore values

Group 7: Per-Metric Confidence (runs alongside each group)
  computeConfidenceScore ── called once per metric after its value is
    ready, before the next group. NOT a separate group; it fires as soon
    as each metric in groups 1-6 completes.
```

### 2.2 DAG Visualization

```
                     ┌──────────────────────┐
                     │   EvidenceBuilder     │
                     │  (raw data from QB)   │
                     └──────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 1 (par)     │
                    │   ECS       EQI       │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 2 (par)     │
                    │ SCI  CVI  LOTS  HOTS  │
                    │ CBR  COA  POA  PIA    │
                    │ RBTA DA   MAA  QTA    │
                    │ MC   MCS  QCQI comps  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 3 (par)     │
                    │ MII  BDI  DBI  MCAI   │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 4           │
                    │     QCQI              │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 5 (par)     │
                    │ CAI  AMI  FRI         │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Group 6 (par)     │
                    │ QPQI       OCI        │
                    └───────────────────────┘
```

### 2.3 Computation Order Enum Values

Each `UAFMetric.computationOrder` is set according to its group:

| Group | computationOrder | Metrics |
|---|---|---|
| 1 | 1 | ECS, EQI |
| 2 | 2 | SCI, CVI, LOTS, HOTS, CBR, COA, POA, PIA, RBTA, DA, MAA, QTA, MC, MCS, QCQI components |
| 3 | 3 | MII, BDI, DBI, MCAI |
| 4 | 4 | QCQI |
| 5 | 5 | CAI, AMI, FRI |
| 6 | 6 | QPQI, OCI |

---

## 3. Evidence Builder Specification

The EvidenceBuilder collects and validates raw data from the QuestionBank. It produces an intermediate evidence object that feeds into all MetricEngine computations.

### 3.1 Evidence Requirements by Metric

| Metric | Evidence Required | Source | Verification Method |
|---|---|---|---|
| ECS | Count of successfully extracted attributes, total required attributes | QuestionBank extraction process | Count comparison |
| EQI | Count of verified attributes, total extracted attributes | Extraction + cross-reference with course docs | Cross-reference against source |
| SCI | Boolean presence for 10 structural elements | QuestionBank metadata, structure scan | Check presence only |
| COA | Per-question: assigned CO, verified CO | QuestionLibraryItem metadata, Course documentation | Cross-reference with documented COs |
| POA | Per-question: assigned PO, verified PO | QuestionLibraryItem metadata, Program documentation | Cross-reference with documented POs |
| PIA | Per-question: assigned PI, verified PI | QuestionLibraryItem metadata, PI documentation | Cross-reference with documented PIs |
| RBTA | Per-question: assigned Bloom level, verified Bloom level | QuestionLibraryItem metadata, command verb analysis | Verb-to-Bloom matrix check |
| DA | Per-question: assigned difficulty, verified difficulty | QuestionLibraryItem metadata, cognitive complexity analysis | Cross-reference with Bloom level + effort |
| MAA | Per-question: assigned marks, expected marks | QuestionLibraryItem metadata, mark scheme | Consistency check with marks alignment matrix |
| QTA | Per-question: assigned type, verified type | QuestionLibraryItem metadata | Cross-reference with question content |
| MC | Available metadata fields count, required fields count | QuestionLibraryItem metadata scan | Check presence of all 7 dimensions per question |
| MCS | Consistent entries count, total entries count | QuestionLibraryItem metadata | Cross-dimension consistency validation |
| CVI | Covered COs, total COs for subject | QuestionLibraryItem CO mappings, Subject CO definitions | Distinct CO coverage check |
| BDI | Observed Bloom distribution, expected distribution | QuestionLibraryItem Bloom levels | Distribution comparison |
| DBI | Observed difficulty distribution, expected distribution | QuestionLibraryItem difficulty levels | Distribution comparison |
| MCAI | Per-question: aligned status (marks vs Bloom), total questions | Marks, Bloom level per question | Marks Complexity Validation Matrix (Section 8.6) |
| QCQI | Per-question scores on 7 quality dimensions | Question content + metadata review | Question Quality Scoring Scale (Section 9.2) |
| CAI | Per-question: alignment status (4 criteria), total questions | Question content, CO maps, Bloom levels | Constructive alignment criteria check |
| AMI | Count of satisfied moderation criteria (0-7) | Moderator evaluation, governance documentation | Criterion satisfaction check |
| FRI | Count of satisfied future readiness criteria (0-7) | Question content, curriculum relevance assessment | Criterion satisfaction check |

### 3.2 Evidence Data Shape

The EvidenceBuilder produces a single evidence object (the input to all compute functions). TypeScript interface:

```typescript
interface ExtractionEvidence {
  // Counts
  successfullyExtractedAttributes: number;
  requiredAttributes: number;
  verifiedAttributes: number;
  extractedAttributes: number;

  // Structural
  structuralElementsPresent: number; // 0-10

  // Question-level arrays
  questions: QuestionEvidence[];

  // Aggregated counts
  totalQuestions: number;
  lotsQuestions: number;
  hotsQuestions: number;
  coveredCourseOutcomes: number;
  totalCourseOutcomes: number;
  correctlyAlignedQuestions: number;
  alignedQuestions: number;
  criteriaSatisfied: number;
  futureReadyCriteriaSatisfied: number;

  // Distributions
  observedBloomDistribution: Record<string, number>;
  expectedBloomDistribution: Record<string, number>;
  observedDifficultyDistribution: Record<string, number>;
  expectedDifficultyDistribution: Record<string, number>;

  // MII aggregates
  correctCOMappings: number;
  totalCOMappings: number;
  correctPOMappings: number;
  totalPOMappings: number;
  correctPIMappings: number;
  totalPIMappings: number;
  correctBloomClassifications: number;
  totalBloomClassifications: number;
  correctDifficultyClassifications: number;
  totalDifficultyClassifications: number;
  correctMarksAllocations: number;
  correctTypeClassifications: number;
  availableMetadataFields: number;
  requiredMetadataFields: number;
  consistentMetadataEntries: number;
  totalMetadataEntries: number;

  // QCQI component scores
  clarityScore: number;
  precisionScore: number;
  technicalAccuracyScore: number;
  contextAdequacyScore: number;
  assessmentValidityScore: number;
  questionAlignmentScore: number;
  fairnessScore: number;
}

interface QuestionEvidence {
  id: string;
  text: string;
  marks: number;
  cos: string[];
  pos: string[];
  pis: string[];
  bloomLevel: string;
  difficulty: string;
  questionType: string;
  // Verification status per dimension
  coVerified: boolean;
  poVerified: boolean;
  piVerified: boolean;
  bloomVerified: boolean;
  difficultyVerified: boolean;
  marksVerified: boolean;
  typeVerified: boolean;
  // Alignment
  marksComplexityAligned: boolean;
  constructivelyAligned: boolean;
  // QCQI scores (0.00-1.00)
  clarity: number;
  precision: number;
  technicalAccuracy: number;
  contextAdequacy: number;
  assessmentValidity: number;
  alignment: number;
  fairness: number;
}
```

### 3.3 EvidenceBuilder Stage Responsibility

1. **Extract** raw data from `QuestionBank` (via `QuestionLibraryItem` entities)
2. **Verify** each attribute against source documentation
3. **Count** successes and failures
4. **Construct** the `ExtractionEvidence` object (shape above)
5. **Validate** internal consistency (e.g., sum of distribution equals 1.00)
6. **Emit** the evidence object downstream to MetricEngine

---

## 4. Classification Matrix

### 4.1 Metric Classification (Shared Across All Indices)

This matrix is **shared by all UAFMetrics**. No metric defines its own classification ranges.

| Value Range | Classification |
|---|---|
| 0.90 - 1.00 | EXEMPLARY |
| 0.80 - 0.89 | HIGHLY_EFFECTIVE |
| 0.70 - 0.79 | EFFECTIVE |
| 0.60 - 0.69 | ACCEPTABLE |
| 0.40 - 0.59 | NEEDS_IMPROVEMENT |
| 0.00 - 0.39 | MAJOR_REVISION |

**Implementation:**

```typescript
function classify(value: number): Classification {
  if (value === null || value === undefined) {
    return Classification.MAJOR_REVISION; // or throw, depending on policy
  }
  if (value >= 0.90) return Classification.EXEMPLARY;
  if (value >= 0.80) return Classification.HIGHLY_EFFECTIVE;
  if (value >= 0.70) return Classification.EFFECTIVE;
  if (value >= 0.60) return Classification.ACCEPTABLE;
  if (value >= 0.40) return Classification.NEEDS_IMPROVEMENT;
  return Classification.MAJOR_REVISION;
}
```

**Domain entity reference:** `Classification` enum (uaf-domain-model.md). The six values `EXEMPLARY`, `HIGHLY_EFFECTIVE`, `EFFECTIVE`, `ACCEPTABLE`, `NEEDS_IMPROVEMENT`, `MAJOR_REVISION` are defined there and must not be redefined here.

### 4.2 Confidence Classification

| Score Range | Classification |
|---|---|
| 0.95 - 1.00 | VERY_HIGH |
| 0.85 - 0.94 | HIGH |
| 0.70 - 0.84 | MEDIUM |
| 0.50 - 0.69 | LOW |
| 0.00 - 0.49 | VERY_LOW |

**Domain entity reference:** `ConfidenceClassification` enum (uaf-domain-model.md).

**Implementation:**

```typescript
function classifyConfidence(score: number): ConfidenceClassification {
  if (score === null || score === undefined) {
    return ConfidenceClassification.VERY_LOW;
  }
  if (score >= 0.95) return ConfidenceClassification.VERY_HIGH;
  if (score >= 0.85) return ConfidenceClassification.HIGH;
  if (score >= 0.70) return ConfidenceClassification.MEDIUM;
  if (score >= 0.50) return ConfidenceClassification.LOW;
  return ConfidenceClassification.VERY_LOW;
}
```

### 4.3 CBR Interpretation (Not Classification)

The Cognitive Balance Ratio uses a separate interpretation table (Section 7.5). This is NOT a `Classification`. It is informational text for AI narratives:

| CBR Value | Interpretation |
|---|---|
| CBR < 0.50 | Excessive lower-order emphasis |
| CBR = 0.50-1.00 | Balanced cognition |
| CBR > 1.00 | Strong higher-order emphasis |

The raw CBR is included in the `EvidenceSnapshot` as contextual data. The persisted `UAFMetric.value` for CBR is clamped to `[0.00, 1.00]`.

---

## 5. Pipeline Stage Boundaries

### 5.1 Stage Definitions

| Stage | Responsibility | Input | Output |
|---|---|---|---|
| **EvidenceBuilder** | Collects and validates raw data from QuestionBank. Does NOT compute any metric. | `QuestionBank` (external aggregate), `Subject` metadata, Course/Program documentation | `ExtractionEvidence` (typed evidence object) |
| **MetricEngine** | Computes ALL metrics deterministically. No AI involvement. No randomized values. | `ExtractionEvidence` from EvidenceBuilder | `UAFMetric[]` (all computed metrics with values and classifications) + `ConfidenceScore[]` (one per metric) |
| **SnapshotBuilder** | Assembles the `EvidenceSnapshot` entity. Combines deterministic evidence + computed metrics for AI consumption. | `ExtractionEvidence`, `UAFMetric[]`, `ConfidenceScore[]`, `AnalysisVersion` metadata | `EvidenceSnapshot` (persisted entity) |
| **PromptBuilder** | Builds AI prompts from the evidence snapshot. Selects correct `PromptVersion`. | `EvidenceSnapshot`, `PromptVersion` (from registry) | Compiled prompt with context budget enforcement |
| **OllamaService** | Sends prompt to Ollama, manages retry/fallback, receives response. | Compiled prompt string | Raw AI response JSON |
| **ResponseValidator** | Validates AI output against expected schema. Checks completeness, formatting, range bounds. | Raw AI response JSON, output schema | Validated AI response |
| **AnalysisBuilder** | Assembles final `AnalysisSnapshot` read model. Combines deterministic metrics + validated AI response. | `UAFMetric[]`, `ConfidenceScore[]`, validated AI response, risks, recommendations | `AnalysisSnapshot` (full report) |
| **Persistence** | Stores all entities in their respective tables. Manages transactions. | All domain entities | Database records |

### 5.2 What Belongs Where

**EvidenceBuilder (ONLY):**
- Reading `QuestionBank` data via repository
- Iterating `QuestionLibraryItem` records
- Extracting per-question attributes (CO, PO, PI, Bloom, Difficulty, Marks, Type)
- Verifying attributes against source documentation
- Counting structural elements
- Scoring question quality dimensions (Clarity, Precision, etc.)
- Building the `ExtractionEvidence` object

**MetricEngine (ONLY):**
- All `compute*` functions defined in Section 1
- Classification lookup via shared matrix
- Confidence score computation per metric
- DAG orchestration (parallel group execution)
- No reading from QuestionBank
- No AI interaction

**SnapshotBuilder (ONLY):**
- Serializing `ExtractionEvidence` + `UAFMetric[]` + `ConfidenceScore[]` into `EvidenceSnapshot.snapshot` JSON
- Computing `evidenceHash = SHA-256(canonicalJson(snapshot) + engineVersion + promptVersion)`
- Setting `sizeBytes`

**PromptBuilder (ONLY):**
- Loading the correct `PromptVersion` for each module
- Templating prompt text with evidence data
- Truncating/structuring content to fit `contextBudget`
- No metric computation

**OllamaService (ONLY):**
- HTTP calls to Ollama API
- Retry logic, timeouts, fallback handling
- No metric computation, no prompt construction

**ResponseValidator (ONLY):**
- Schema validation against `PromptVersion.outputSchema`
- Range checks on AI-provided values
- Completeness checks (all required fields present)
- No metric computation

**AnalysisBuilder (ONLY):**
- Merging deterministic metrics with AI response
- Building the 15-phase report structure
- Generating `AnalysisSnapshot.fullReport`, `executiveSummary`, `finalVerdict`
- Assembling `Risk[]` and `Recommendation[]`
- No metric computation

**Persistence (ONLY):**
- Transactional writes of all entities
- No computation of any kind

### 5.3 State Machine Integration

The pipeline maps to `AnalysisStatus` transitions (uaf-domain-model.md):

```
INITIALIZED ──▶ EXTRACTING ──▶ COMPUTING ──▶ AI_PENDING ──▶ AI_COMPLETE ──▶ COMPLETE
                                       \                                  /
                                        └──▶ FAILED (any step) ──────────┘
```

| AnalysisStatus | Active Stage |
|---|---|
| INITIALIZED | (pre-pipeline) |
| EXTRACTING | EvidenceBuilder |
| COMPUTING | MetricEngine + SnapshotBuilder |
| AI_PENDING | PromptBuilder → OllamaService (waiting) |
| AI_COMPLETE | ResponseValidator |
| COMPLETE | AnalysisBuilder → Persistence |
| FAILED | Any stage (error handler) |

---

## 6. Failure Mode Matrix

### 6.1 Failure Handling Principles

1. **Never fabricate data** — per UAF Zero Fabrication Policy (Section 2.1)
2. **Never crash the pipeline** — a missing metric should result in null, not an exception
3. **Always log** — every failure produces a structured log entry with context
4. **Preserve partial results** — if some metrics succeed and others fail, keep the successful ones

### 6.2 Failure Mode Matrix

| Failure | Detection | Action | Resulting UAFMetric state | ConfidenceScore |
|---|---|---|---|---|
| Evidence missing (null field) | Null check on any required input | Set metric to null, log evidence gap with field name | `value = null`, `classification = MAJOR_REVISION` | `score = 0.00`, `classification = VERY_LOW`, `justification = "Missing evidence: [field]"` |
| Division by zero | Denominator check before division | Skip division, set metric to null, log invalid state | `value = null`, `classification = MAJOR_REVISION` | `score = 0.00`, `classification = VERY_LOW`, `justification = "Division by zero: [denominator] = 0"` |
| Value out of range [0.00, 1.00] | Boundary check after computation | Clamp to [0.00, 1.00], log warning | `value = clamped result`, `classification` derived | `score = confidence computation continues normally`, `classification` adjusted per available evidence |
| Distribution does not sum to 1.00 | Sum check on observed/expected distributions | Normalize to sum 1.00, log warning | `value` computed from normalized distribution | `classification = LOW`, `justification = "Distribution normalized, sum was [X]"` |
| Question bank has zero questions | totalQuestions === 0 | Set all metrics to null, log fatal | All `UAFMetric.value = null` | All `VERY_LOW` |
| MII sub-metric null (partial failure) | Sub-metric value check | Exclude null sub-metric from average, reduce denominator | `MII` computed with available sub-metrics | `classification` reduced proportionally to missing sub-metrics |
| QPQI input metric null | Input metric value check | Exclude null metric from weighted sum, redistribute weight proportionally | `QPQI` computed with available indices | `classification` reduced proportionally to missing indices |
| EvidenceSnapshot hash mismatch | Compare computed hash vs stored hash | Recompute if mismatch detected, log integrity warning | N/A (SnapshotBuilder stage) | N/A |
| Ollama timeout | HTTP timeout in OllamaService | Retry (configurable count), then fall back to deterministic-only report | N/A (AI stage) | All AI-dependent fields marked as "AI Unavailable" |
| Ollama invalid response | Schema validation failure | Log raw response, request retry (configurable count), then fall back | N/A (AI stage) | AI section confidente = VERY_LOW |
| EvidenceBuilder connection failure | Repository call fails | Retry, then FAILED status | Pipeline halts | N/A |

### 6.3 Null Propagation Rules

When a `UAFMetric.value` is null:

1. Its `classification` is set to `MAJOR_REVISION`
2. Its `ConfidenceScore.score` is `0.00`, `classification = VERY_LOW`
3. Any downstream metric that depends on this metric must handle the null:
   - **MII**: exclude null sub-metric, reduce denominator
   - **QPQI**: exclude null index, redistribute weight
   - **OCI**: exclude null confidence score, reduce denominator
4. The null metric is recorded in the `AnalysisEvidence` collection as "Unable to Verify"

---

## 7. Test Specification

### 7.1 Test Pattern

Every `compute*` function gets exactly three tests:

1. **Happy path** — normal inputs produce expected value and classification
2. **Edge case** — boundary values (0.00, 1.00, or distribution extremes)
3. **Failure case** — missing/invalid data produces null metric with VERY_LOW confidence

### 7.2 Test Matrix

| Function | Happy Path Input | Happy Output | Edge Input | Edge Output | Failure Input | Failure Output |
|---|---|---|---|---|---|---|
| computeECS | 45/50 extracted | 0.90, EXEMPLARY | 0/50 extracted | 0.00, MAJOR_REVISION | requiredAttributes = 0 | null, VERY_LOW |
| computeEQI | 40/45 verified | 0.89, HIGHLY_EFFECTIVE | 0/45 verified | 0.00, MAJOR_REVISION | extractedAttributes = 0 | null, VERY_LOW |
| computeCOA | 18/20 correct | 0.90, EXEMPLARY | 0/20 correct | 0.00, MAJOR_REVISION | totalCOMappings = 0 | null, VERY_LOW |
| computePOA | 15/18 correct | 0.83, HIGHLY_EFFECTIVE | 0/18 correct | 0.00, MAJOR_REVISION | totalPOMappings = 0 | null, VERY_LOW |
| computePIA | 12/15 correct | 0.80, HIGHLY_EFFECTIVE | 0/15 correct | 0.00, MAJOR_REVISION | totalPIMappings = 0 | null, VERY_LOW |
| computeRBTA | 22/25 correct | 0.88, HIGHLY_EFFECTIVE | 0/25 correct | 0.00, MAJOR_REVISION | totalBloomClassifications = 0 | null, VERY_LOW |
| computeDA | 20/25 correct | 0.80, HIGHLY_EFFECTIVE | 0/25 correct | 0.00, MAJOR_REVISION | totalDifficultyClassifications = 0 | null, VERY_LOW |
| computeMAA | 23/25 correct | 0.92, EXEMPLARY | 0/25 correct | 0.00, MAJOR_REVISION | totalQuestions = 0 | null, VERY_LOW |
| computeQTA | 22/25 correct | 0.88, HIGHLY_EFFECTIVE | 0/25 correct | 0.00, MAJOR_REVISION | totalQuestions = 0 | null, VERY_LOW |
| computeMC | 160/175 available | 0.91, EXEMPLARY | 0/175 available | 0.00, MAJOR_REVISION | requiredMetadataFields = 0 | null, VERY_LOW |
| computeMCS | 155/175 consistent | 0.89, HIGHLY_EFFECTIVE | 0/175 consistent | 0.00, MAJOR_REVISION | totalMetadataEntries = 0 | null, VERY_LOW |
| computeSCI | 8/10 present | 0.80, HIGHLY_EFFECTIVE | 0/10 present | 0.00, MAJOR_REVISION | N/A (denominator always 10) | N/A |
| computeMII | All 9 = [0.90,0.83,0.80,0.88,0.80,0.92,0.88,0.91,0.89] | 0.868, HIGHLY_EFFECTIVE | All 9 = 0.00 | 0.00, MAJOR_REVISION | 2 sub-metrics null | average of 7 valid, lower confidence |
| computeBDI | Observed close to expected (diff=0.04) | 0.98, EXEMPLARY | All Remember (diff=1.80) | 0.10, MAJOR_REVISION | All observed zero | 0.00, VERY_LOW |
| computeCVI | 5/6 covered | 0.83, HIGHLY_EFFECTIVE | 0/6 covered | 0.00, MAJOR_REVISION | totalCourseOutcomes = 0 | null, VERY_LOW |
| computeMCAI | 20/25 aligned | 0.80, HIGHLY_EFFECTIVE | 0/25 aligned | 0.00, MAJOR_REVISION | totalQuestions = 0 | null, VERY_LOW |
| computeDBI | Observed close to expected | 0.98, EXEMPLARY | All Easy | 0.40, NEEDS_IMPROVEMENT | All zero | 0.00, VERY_LOW |
| computeQCQI | All 7 components = 0.85 | 0.85, HIGHLY_EFFECTIVE | All 7 components = 0.00 | 0.00, MAJOR_REVISION | 1 component null | average of 6, lower confidence |
| computeCAI | 20/25 aligned | 0.80, HIGHLY_EFFECTIVE | 0/25 aligned | 0.00, MAJOR_REVISION | totalQuestions = 0 | null, VERY_LOW |
| computeAMI | 5/7 satisfied | 0.71, EFFECTIVE | 0/7 satisfied | 0.00, MAJOR_REVISION | N/A | N/A |
| computeFRI | 4/7 satisfied | 0.57, NEEDS_IMPROVEMENT | 0/7 satisfied | 0.00, MAJOR_REVISION | N/A | N/A |
| computeQPQI | All 10 = 0.85 | 0.85, HIGHLY_EFFECTIVE | All 10 = 0.00 | 0.00, MAJOR_REVISION | 1 null index | redistributed weights, lower confidence |
| computeOCI | All confidences = 0.90 | 0.90, VERY_HIGH | 5 at 0.00, 5 at 1.00 | 0.50, LOW | All null | null, VERY_LOW |
| computeConfidenceScore | 18/20 verified | 0.90, HIGH | 0/20 verified | 0.00, VERY_LOW | requiredItems = 0 | 0.00, VERY_LOW, "No evidence items were required" |
| computeLOTS | 15/25 LOTS | 0.60 | 0/25 LOTS | 0.00 | totalQuestions = 0 | null, VERY_LOW |
| computeHOTS | 10/25 HOTS | 0.40 | 0/25 HOTS | 0.00 | totalQuestions = 0 | null, VERY_LOW |
| computeCBR | HOTS=0.40, LOTS=0.60 | 0.67 | HOTS=0, LOTS=0 (default) | 0.50 | Both null | null, VERY_LOW |

### 7.3 Integration Test: Full Pipeline

An integration test must verify the complete pipeline from `ExtractionEvidence` through all compute functions to `QPQI` and `OCI`.

**Input:** Known `ExtractionEvidence` object with:
- 25 questions
- 5/6 COs covered
- 18/25 CO mappings correct
- 8/10 structural elements present
- Balanced Bloom distribution (close to default)
- Balanced difficulty distribution (close to default)
- etc.

**Expected output:**
- All 27 `UAFMetric` instances computed (15 core/sub + 2 extraction + 7 QCQI components + 3 bloom = 27 total including sub-metrics)
- All `value` in [0.00, 1.00]
- All `classification` non-null
- `QPQI` computed with all 10 indices
- `OCI` computed with all 10 confidence scores

**Verification:**
- Every metric classified correctly per shared matrix
- No null values in happy path
- Confidence scores reflect evidence availability
- `UAFMetric.weightedScore === UAFMetric.value * UAFMetric.weight` for QPQI sub-indices

---

*End of engineering specification. All formulas reference uaf-framework-extraction.md sections. All entities reference uaf-domain-model.md without redefinition.*
