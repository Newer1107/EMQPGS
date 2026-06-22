# AI Prompt Design Specification

> **Purpose:** Define the 10-module prompt architecture, context budget strategy,
> hallucination prevention, versioning, and testing approach for the UAF AI
> Analysis Pipeline.
>
> **Reference documents:**
> - Domain entities: `uaf-domain-model.md` (ratified) — referenced, never redefined
> - Metric functions and evidence: `uaf-engineering-specification.md` (ratified) — cited by section
> - Service interfaces: `ai-analysis-subsystem.md` (draft) — references PromptBuilder,
>   OllamaService, ResponseValidator

**Status:** Draft
**Applies to:** PromptBuilder, OllamaService, ResponseValidator, PromptVersion Registry
**Version:** 1.0

---

## Table of Contents

1. [Context Budget Allocation](#1-context-budget-allocation)
2. [Common System Preamble](#2-common-system-preamble)
3. [Module Definitions (10 Modules)](#3-module-definitions-10-modules)
4. [Hallucination Prevention Strategy](#4-hallucination-prevention-strategy)
5. [Prompt Versioning](#5-prompt-versioning)
6. [Testing Strategy](#6-testing-strategy)
7. [Retry Strategy per Module](#7-retry-strategy-per-module)
8. [How It Fits in 8K](#8-how-it-fits-in-8k)

---

## Fundamental Rule

**AI NEVER computes any academic metric. AI ONLY interprets deterministic evidence.**

Every numeric value in every prompt comes from the `EvidenceSnapshot` (produced by
the DeterministicEngine, defined in `uaf-engineering-specification.md` Section 3).
The AI model's role is strictly interpretive: it reads pre-computed metric values,
classifications, distributions, and coverage data, then produces structured
commentary, risk assessments, and recommendations. It never performs arithmetic,
never calculates a score, and never fabricates a number.

This rule is enforced at three levels:
1. **Input constraint** — metrics are never described as formulas or raw data; only
   their final values and classifications are sent
2. **Prompt instructions** — every module contains explicit "NEVER compute" rules
3. **Post-hoc validation** — the Number Injection Guard (Section 4) catches violations

---

## 1. Context Budget Allocation

Each module runs in its own independent 8K context window. The pipeline is
**sequential**, not parallel: modules execute one after another, each with a fresh
8K window. The total across all modules exceeds 8K because each module gets its
own allocation.

### 1.1 Allocation Table

| Module | Input Tokens | Output Tokens | % of 8K | Type |
|---|---|---|---|---|
| System preamble | 400 | — | 5% | Shared context |
| 1. Executive Summary | 2000 | 500 | 31% | Narrative synthesis |
| 2. Bloom Analysis | 1200 | 300 | 19% | Structured interpretation |
| 3. Difficulty Analysis | 1200 | 300 | 19% | Structured interpretation |
| 4. CO Coverage | 1500 | 300 | 22% | Structured analysis |
| 5. Module Coverage | 1000 | 200 | 15% | Gap identification |
| 6. Concept Diversity | 800 | 200 | 12% | Pattern analysis |
| 7. Risk Analysis | 1000 | 400 | 18% | Risk identification |
| 8. Recommendations | 800 | 400 | 15% | Action generation |
| 9. Academic Quality | 1200 | 300 | 19% | Quality assessment |
| 10. Final Verdict | 1000 | 400 | 18% | Decision synthesis |

### 1.2 Why Sequential, Not Parallel

Each module needs a different subset of the `EvidenceSnapshot`. The Executive
Summary needs all metrics; Bloom Analysis needs only Bloom-related fields;
Difficulty Analysis needs only difficulty distributions. Sending the full
snapshot to every module wastes context. Instead, the `PromptBuilder` (defined
in `ai-analysis-subsystem.md` Section 8) selects only the relevant evidence
fields per module, keeping each call well within the 8K limit.

### 1.3 Per-Call Budget Calculation

| Component | Max Tokens |
|---|---|
| System preamble | 400 |
| Module-specific instructions | 200-400 |
| Evidence data (JSON) | 500-1600 |
| Output format specification | 100-200 |
| Rules section | 100-200 |
| **Total per call** | **~1,300-2,800** |
| 8K limit | 8,192 |
| **Headroom** | **~5,400-6,900** |

---

## 2. Common System Preamble

The system preamble is sent with **every** module call. It establishes the AI's
role, constraints, and output rules. The prompt builder (defined in
`ai-analysis-subsystem.md` Section 8, interface `PromptBuilder`) prepends this
preamble to each module-specific prompt before sending to `OllamaService`.

### 2.1 Preamble Text (~400 tokens)

```
You are an academic reviewer within the Unit Assessment Framework (UAF).
Your role is to INTERPRET deterministic evidence about a question bank's quality.
You NEVER compute or calculate any academic metric. You NEVER change or recalculate
any number provided to you. All metric values, classifications, counts, and
distributions are pre-computed by a deterministic engine. You comment on what these
values mean, identify patterns, flag risks, and suggest improvements.

The evidence you receive includes:
- Pre-computed index values (0.00-1.00) with their classifications
- Observed and expected distributions across cognitive levels and difficulty tiers
- Coverage data for course outcomes, modules, and concepts
- Quality dimension scores and moderation criteria

RULES:
- Return ONLY valid JSON. No preamble text, no explanations outside JSON.
- Every field in the output schema must be present. Do not omit fields.
- Do not include markdown code fences or formatting in your response.
- Never reference evidence not provided in the prompt.
- Never invent course outcomes, modules, concepts, or metrics.
- Never repeat or paraphrase questions from the bank.
- Never fabricate student performance data or historical trends.
- If evidence is insufficient for a confident assessment, state "INSUFFICIENT_EVIDENCE"
  explicitly in the relevant field rather than fabricating.
- Keep narrative text concise. Structured data is preferred over prose.
```

### 2.2 Preamble Versioning

The preamble is versioned independently from module prompts. It is stored as a
singleton in the `PromptVersion` table (entity defined in `uaf-domain-model.md`,
Section `PromptVersion`) with a special `moduleId` value of `"system-preamble"`.
When the preamble is updated, all module prompts that depend on it may need
re-validation, but the module-specific `PromptVersion.version` numbers are
independent.

---

## 3. Module Definitions (10 Modules)

### 3.1 Module 1: Executive Summary

**Purpose:** Synthesize all available evidence into a concise executive summary.
This is the only module with predominantly narrative output. All other modules
produce structured data.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 2000

**Max Output Tokens:** 500

**PromptModuleId (from domain model):** `"executive-summary"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface ExecutiveSummaryInput {
  // Core index values (from UAFMetric[], uaf-domain-model.md)
  // References: engineering-spec Sections 1.4-1.6
  metrics: Array<{
    indexCode: IndexCode;        // e.g. "SCI", "BDI", "CVI", "QPQI"
    value: number;               // 0.00-1.00
    classification: Classification;
    weight: number;
  }>;

  // Top-level composite
  qpqiValue: number;             // Question Paper Quality Index
  qpqiClassification: Classification;

  // Confidence
  ociValue: number;              // Overall Confidence Index value
  ociClassification: ConfidenceClassification;

  // Bank metadata
  subjectName: string;
  totalQuestions: number;
  moduleCount: number;
  coCount: number;
}
```

**Output Schema (validated by ResponseValidator):**

```typescript
interface ExecutiveSummaryOutput {
  keyFindings: string[];         // 3-5 key findings, one sentence each
  overallAssessment: string;     // 2-3 paragraph synthesis
  majorRisks: string[];          // 2-4 critical risks identified
  accreditationReadiness: "READY" | "PARTIAL" | "NOT_READY";
}
```

**Zod Validation Schema:**

```typescript
const executiveSummarySchema = z.object({
  keyFindings: z.array(z.string()).min(3).max(5),
  overallAssessment: z.string().min(100).max(1000),
  majorRisks: z.array(z.string()).min(0).max(4),
  accreditationReadiness: z.enum(["READY", "PARTIAL", "NOT_READY"]),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are producing the executive summary for a UAF analysis of {subjectName}.
The question bank contains {totalQuestions} questions across {moduleCount} modules
and {coCount} course outcomes.

KEY METRICS:
{qpqiValue} | Question Paper Quality Index (composite) | {qpqiClassification}
{ociValue} | Overall Confidence Index | {ociClassification}

ALL INDEX VALUES:
{JSON array of all metrics with indexCode, value, classification}

TASK:
Synthesize the evidence above into an executive summary.

OUTPUT FORMAT:
{
  "keyFindings": ["string", ...],       // 3-5 key findings
  "overallAssessment": "string",        // 2-3 paragraphs
  "majorRisks": ["string", ...],        // 0-4 critical risks
  "accreditationReadiness": "READY|PARTIAL|NOT_READY"
}

RULES:
- Never calculate or modify the metric values provided.
- Never reference metrics not listed above.
- Keep key findings to single sentences.
- overallAssessment must reference specific metric classifications.
- accreditationReadiness must align with QPQI classification:
  EXEMPLARY/HIGHLY_EFFECTIVE → READY
  EFFECTIVE/ACCEPTABLE → PARTIAL
  NEEDS_IMPROVEMENT/MAJOR_REVISION → NOT_READY
```

**Hallucination Guards:**

1. **Number Injection Guard**: AI must not introduce any numeric values not
   present in the input. Detection: scan output for any numbers outside the
   metric values provided. Action: drop module output, mark
   `HALLUCINATION_NUMBER_INJECTION`.

2. **Verdict Alignment Guard**: `accreditationReadiness` must align with QPQI
   classification within 1 level. Detection: map QPQI classification to readiness
   (see RULES above), check output. Action: on mismatch, log warning; on 2+ level
   gap, drop module output.

**Example Input/Output:**

```
Input: {
  "subjectName": "Data Structures",
  "totalQuestions": 25,
  "moduleCount": 5,
  "coCount": 6,
  "qpqiValue": 0.78,
  "qpqiClassification": "EFFECTIVE",
  "ociValue": 0.85,
  "ociClassification": "HIGH",
  "metrics": [
    { "indexCode": "SCI", "value": 0.90, "classification": "EXEMPLARY" },
    { "indexCode": "BDI", "value": 0.85, "classification": "HIGHLY_EFFECTIVE" },
    { "indexCode": "CVI", "value": 0.67, "classification": "ACCEPTABLE" }
  ]
}
Output: {
  "keyFindings": [
    "Structural compliance is exemplary at 0.90.",
    "Bloom distribution is highly effective with balanced cognitive levels.",
    "CO coverage is acceptable at 0.67, with 4 of 6 outcomes covered.",
    "Overall quality is EFFECTIVE with HIGH confidence."
  ],
  "overallAssessment": "The Data Structures question bank demonstrates solid structural quality and balanced cognitive demand. Coverage gaps in 2 course outcomes need attention but do not indicate systemic issues.",
  "majorRisks": [
    "CO coverage at ACCEPTABLE level may affect accreditation evidence."
  ],
  "accreditationReadiness": "PARTIAL"
}
```

---

### 3.2 Module 2: Bloom Analysis

**Purpose:** Interpret Bloom's Taxonomy distribution, cognitive balance, and
LOTS/HOTS/CBR indicators. Produces structured assessments and recommendations
based on the pre-computed BDI, LOTS, HOTS, and CBR values.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1200

**Max Output Tokens:** 300

**PromptModuleId:** `"bloom-analysis"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface BloomAnalysisInput {
  // Core Bloom metrics. References: engineering-spec Sections 1.3-1.4
  bdiValue: number;              // Bloom Distribution Index (0.00-1.00)
  bdiClassification: Classification;
  lotsValue: number;             // Lower Order Thinking Score (0.00-1.00)
  hotsValue: number;             // Higher Order Thinking Score (0.00-1.00)
  cbrRaw: number;                // Cognitive Balance Ratio (raw, unclamped)
  cbrClassification: Classification;

  // Distributions. References: engineering-spec Section 1.4 computeBDI
  observedDistribution: Record<string, number>;  // e.g. {"Remember": 0.10, "Understand": 0.20, ...}
  expectedDistribution: Record<string, number>;  // Default: Remember 0.10, Understand 0.20, Apply 0.25, Analyze 0.20, Evaluate 0.15, Create 0.10

  // Confidence
  confidenceScore: number;       // 0.00-1.00
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface BloomAnalysisOutput {
  cognitiveBalance: string[];    // Assessments per Bloom level (up to 6)
  risks: string[];               // Identified cognitive risks (0-3)
  recommendations: string[];     // Improvement suggestions (0-3)
  balanceAssessment: "WELL_BALANCED" | "MODERATELY_BALANCED" | "IMBALANCED";
}
```

**Zod Validation Schema:**

```typescript
const bloomAnalysisSchema = z.object({
  cognitiveBalance: z.array(z.string()).min(1).max(6),
  risks: z.array(z.string()).min(0).max(3),
  recommendations: z.array(z.string()).min(0).max(3),
  balanceAssessment: z.enum(["WELL_BALANCED", "MODERATELY_BALANCED", "IMBALANCED"]),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are analyzing the cognitive distribution of a question bank using
Bloom's Taxonomy. All metric values are pre-computed.

BLOOM DISTRIBUTION INDEX (BDI):
Value: {bdiValue} | Classification: {bdiClassification}

COGNITIVE SCORES:
LOTS (Remember+Understand+Apply): {lotsValue}
HOTS (Analyze+Evaluate+Create): {hotsValue}
Cognitive Balance Ratio (raw): {cbrRaw}

OBSERVED DISTRIBUTION:
{JSON of observedDistribution}

EXPECTED DISTRIBUTION (ideal):
{JSON of expectedDistribution}

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Interpret the Bloom distribution. Comment on each cognitive level's alignment
with expectations. Identify imbalances and risks.

OUTPUT FORMAT:
{
  "cognitiveBalance": ["string", ...],   // One assessment per level or key insight
  "risks": ["string", ...],
  "recommendations": ["string", ...],
  "balanceAssessment": "WELL_BALANCED|MODERATELY_BALANCED|IMBALANCED"
}

RULES:
- Never recalculate BDI, LOTS, HOTS, or CBR. Use only the values provided.
- Never invent Bloom levels not present in the distributions.
- balanceAssessment must be consistent with BDI classification:
  EXEMPLARY/HIGHLY_EFFECTIVE → WELL_BALANCED
  EFFECTIVE → MODERATELY_BALANCED
  ACCEPTABLE/NEEDS_IMPROVEMENT/MAJOR_REVISION → IMBALANCED
```

**Hallucination Guards:**

1. **Number Injection Guard**: AI must not introduce Bloom distribution
   percentages not in the input. Detection: scan output for numeric values.
   Action: drop module if hallucinated numbers found.

2. **Entity Name Guard**: AI must only reference the 6 standard Bloom levels
   (Remember, Understand, Apply, Analyze, Evaluate, Create). Detection: match
   against known Bloom levels. Action: drop module if unknown level referenced.

**Example Input/Output:**

```
Input: {
  "bdiValue": 0.85,
  "bdiClassification": "HIGHLY_EFFECTIVE",
  "lotsValue": 0.55,
  "hotsValue": 0.45,
  "cbrRaw": 0.82,
  "observedDistribution": {
    "Remember": 0.08, "Understand": 0.18, "Apply": 0.29,
    "Analyze": 0.22, "Evaluate": 0.15, "Create": 0.08
  },
  "confidenceScore": 0.90
}
Output: {
  "cognitiveBalance": [
    "Remember level is slightly below the 0.10 expectation at 0.08.",
    "Apply level exceeds expectation, indicating strong intermediate demand.",
    "Analyze and Evaluate align well with expected targets."
  ],
  "risks": ["Create level at 0.08 borders on insufficient for higher-order assessment."],
  "recommendations": [
    "Add 1-2 questions targeting Create level to meet the 0.10 target."
  ],
  "balanceAssessment": "WELL_BALANCED"
}
```

---

### 3.3 Module 3: Difficulty Analysis

**Purpose:** Interpret difficulty distribution, rigor level, and marks alignment.
Based on pre-computed DBI, MCAI, and DA values.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1200

**Max Output Tokens:** 300

**PromptModuleId:** `"difficulty"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface DifficultyAnalysisInput {
  // Core difficulty metrics. References: engineering-spec Sections 1.4 (DBI, MCAI), 1.2 (DA)
  dbiValue: number;              // Difficulty Balance Index (0.00-1.00)
  dbiClassification: Classification;
  mcaiValue: number;             // Marks Complexity Alignment Index (0.00-1.00)
  mcaiClassification: Classification;
  daValue: number;               // Difficulty Accuracy (0.00-1.00)
  daClassification: Classification;

  // Distributions. References: engineering-spec Section 1.4 computeDBI
  observedDifficultyDistribution: Record<string, number>;  // e.g. {"Easy": 0.30, "Medium": 0.50, "Hard": 0.20}
  expectedDifficultyDistribution: Record<string, number>;  // Default: Easy 0.30, Medium 0.50, Hard 0.20

  // Marks alignment detail
  correctlyAlignedQuestions: number;
  totalQuestions: number;
  marksAlignmentPercentage: number;  // correctlyAlignedQuestions / totalQuestions

  confidenceScore: number;
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface DifficultyAnalysisOutput {
  difficultyAssessment: string;   // 1-2 sentence assessment
  rigorLevel: "HIGH" | "MODERATE" | "LOW";
  marksAlignment: string[];       // Alignment observations (0-3)
  risks: string[];                // Difficulty-related risks (0-3)
}
```

**Zod Validation Schema:**

```typescript
const difficultyAnalysisSchema = z.object({
  difficultyAssessment: z.string().min(20).max(300),
  rigorLevel: z.enum(["HIGH", "MODERATE", "LOW"]),
  marksAlignment: z.array(z.string()).min(0).max(3),
  risks: z.array(z.string()).min(0).max(3),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are analyzing the difficulty distribution and marks alignment of a question bank.

DIFFICULTY BALANCE INDEX (DBI):
Value: {dbiValue} | Classification: {dbiClassification}

MARKS-COMPLEXITY ALIGNMENT (MCAI):
Value: {mcaiValue} | Classification: {mcaiClassification}

DIFFICULTY ACCURACY (DA):
Value: {daValue} | Classification: {daClassification}

OBSERVED DIFFICULTY DISTRIBUTION:
{JSON of observedDifficultyDistribution}

EXPECTED DIFFICULTY DISTRIBUTION (ideal):
{JSON of expectedDifficultyDistribution}

MARKS ALIGNMENT: {correctlyAlignedQuestions} of {totalQuestions} questions correctly aligned ({marksAlignmentPercentage}%)

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Assess the difficulty balance and marks alignment. Identify whether the rigor
level is appropriate and whether marks match cognitive demand.

OUTPUT FORMAT:
{
  "difficultyAssessment": "string",
  "rigorLevel": "HIGH|MODERATE|LOW",
  "marksAlignment": ["string", ...],
  "risks": ["string", ...]
}

RULES:
- Never recalculate DBI, MCAI, or DA values.
- rigorLevel should align with the HOTS/LOTS balance and DBI:
  DBI >= 0.80 with balanced distribution → MODERATE
  DBI < 0.80 with skew toward Easy → LOW
  DBI < 0.80 with skew toward Hard → HIGH
```

**Hallucination Guards:**

1. **Number Injection Guard**: AI must not introduce difficulty percentages or
   alignment numbers not present in input. Action: drop module.

2. **Entity Name Guard**: AI must only reference the 3 standard difficulty tiers
   (Easy, Medium, Hard). Detection: check for unknown tier names. Action: drop module.

**Example Input/Output:**

```
Input: {
  "dbiValue": 0.92,
  "dbiClassification": "EXEMPLARY",
  "mcaiValue": 0.78,
  "mcaiClassification": "EFFECTIVE",
  "daValue": 0.85,
  "daClassification": "HIGHLY_EFFECTIVE",
  "observedDifficultyDistribution": { "Easy": 0.28, "Medium": 0.54, "Hard": 0.18 },
  "correctlyAlignedQuestions": 20,
  "totalQuestions": 25,
  "marksAlignmentPercentage": 0.80,
  "confidenceScore": 0.88
}
Output: {
  "difficultyAssessment": "Difficulty distribution is exemplary and closely matches the 30-50-20 target.",
  "rigorLevel": "MODERATE",
  "marksAlignment": [
    "MCAI at EFFECTIVE indicates generally good alignment, with 80% of questions matching marks to cognitive demand."
  ],
  "risks": [
    "5 questions with misaligned marks may unduly reward or penalize certain cognitive levels."
  ]
}
```

---

### 3.4 Module 4: CO Coverage

**Purpose:** Analyze Course Outcome coverage using CVI, coverage gaps, and
attainment potential. References `computeCVI` from engineering-spec Section 1.4.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1500

**Max Output Tokens:** 300

**PromptModuleId:** `"co-coverage"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface COCoverageInput {
  // Core coverage metrics. References: engineering-spec Section 1.4
  cviValue: number;              // CO-Vertex Index (0.00-1.00)
  cviClassification: Classification;
  ociValue: number;              // Outcome Coverage Index (0.00-1.00)
  ociClassification: Classification;
  ecsValue: number;              // Effective Coverage Score (0.00-1.00)
  ecsClassification: Classification;

  // Coverage detail
  coveredCourseOutcomes: number;
  totalCourseOutcomes: number;
  coverageRatio: number;         // coveredCourseOutcomes / totalCourseOutcomes

  // Per-CO detail
  coCoverageDetail: Array<{
    coCode: string;              // e.g. "CO1"
    coDescription: string;       // Brief description
    questionCount: number;       // Number of questions mapping to this CO
    coverageLevel: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    totalMarks: number;          // Total marks assigned to this CO
  }>;

  confidenceScore: number;
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface COCoverageOutput {
  coverageStatus: string;            // Overall assessment sentence
  weakOutcomes: Array<{
    coCode: string;
    reason: string;                  // Why this CO is weakly covered
  }>;
  attainmentRisk: string[];          // Risks to CO attainment (0-4)
  recommendations: string[];         // Improvement suggestions (0-3)
}
```

**Zod Validation Schema:**

```typescript
const coCoverageSchema = z.object({
  coverageStatus: z.string().min(20).max(300),
  weakOutcomes: z.array(z.object({
    coCode: z.string(),
    reason: z.string().min(10).max(200),
  })).min(0).max(6),
  attainmentRisk: z.array(z.string()).min(0).max(4),
  recommendations: z.array(z.string()).min(0).max(3),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are analyzing Course Outcome coverage for a question bank.

CO-VERTEX INDEX (CVI):
Value: {cviValue} | Classification: {cviClassification}

OUTCOME COVERAGE INDEX (OCI):
Value: {ociValue} | Classification: {ociClassification}

EFFECTIVE COVERAGE SCORE (ECS):
Value: {ecsValue} | Classification: {ecsClassification}

COVERAGE SUMMARY: {coveredCourseOutcomes} of {totalCourseOutcomes} COs covered ({coverageRatio}%)

PER-CO DETAIL:
{JSON of coCoverageDetail array}

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Assess the CO coverage quality. Identify which outcomes are weakly covered or
missing. Evaluate attainment risk and suggest improvements.

OUTPUT FORMAT:
{
  "coverageStatus": "string",
  "weakOutcomes": [
    { "coCode": "CO2", "reason": "Only 2 questions map to this outcome." }
  ],
  "attainmentRisk": ["string", ...],
  "recommendations": ["string", ...]
}

RULES:
- Never invent CO codes not present in the input.
- Never recalculate CVI, OCI, or ECS values.
- A CO with coverageLevel "NONE" must appear in weakOutcomes.
- A CO with coverageLevel "LOW" (questionCount < 3) should appear in weakOutcomes.
```

**Hallucination Guards:**

1. **Entity Name Guard**: AI must only reference CO codes that appear in the
   input `coCoverageDetail`. Detection: extract all CO codes from input, match
   against output. Action: drop module if invented CO found.

2. **Number Injection Guard**: AI must not introduce question counts or
   percentages not in the input. Action: drop module.

**Example Input/Output:**

```
Input: {
  "cviValue": 0.67,
  "cviClassification": "ACCEPTABLE",
  "ociValue": 0.70,
  "coverageRatio": 0.67,
  "coveredCourseOutcomes": 4,
  "totalCourseOutcomes": 6,
  "coCoverageDetail": [
    { "coCode": "CO1", "questionCount": 6, "coverageLevel": "HIGH", "totalMarks": 30 },
    { "coCode": "CO2", "questionCount": 5, "coverageLevel": "HIGH", "totalMarks": 25 },
    { "coCode": "CO3", "questionCount": 4, "coverageLevel": "MEDIUM", "totalMarks": 20 },
    { "coCode": "CO4", "questionCount": 0, "coverageLevel": "NONE", "totalMarks": 0 },
    { "coCode": "CO5", "questionCount": 3, "coverageLevel": "MEDIUM", "totalMarks": 15 },
    { "coCode": "CO6", "questionCount": 1, "coverageLevel": "LOW", "totalMarks": 5 }
  ]
}
Output: {
  "coverageStatus": "Two of six course outcomes have inadequate coverage. CO4 is entirely missing and CO6 has only one question.",
  "weakOutcomes": [
    { "coCode": "CO4", "reason": "No questions map to this outcome. Attainment evidence is impossible." },
    { "coCode": "CO6", "reason": "Only 1 question with 5 marks. Insufficient for reliable attainment assessment." }
  ],
  "attainmentRisk": [
    "CO4 attainment cannot be demonstrated without questions.",
    "CO6 attainment evidence will be statistically weak with a single question."
  ],
  "recommendations": [
    "Add 3-4 questions targeting CO4 to achieve minimum coverage.",
    "Increase CO6 question count to at least 3 for reliable assessment."
  ]
}
```

---

### 3.5 Module 5: Module Coverage

**Purpose:** Analyze per-module question distribution, identify weak and strong
modules. References module distribution data from the EvidenceSnapshot.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1000

**Max Output Tokens:** 200

**PromptModuleId:** `"module-coverage"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface ModuleCoverageInput {
  // Per-module distribution
  moduleDistribution: Array<{
    moduleCode: string;            // e.g. "M1", "M2"
    moduleName: string;            // e.g. "Module 1: Introduction"
    questionCount: number;
    totalMarks: number;
    coveragePercentage: number;    // questions in this module / total questions
    coCoverage: string[];          // COs covered by this module
  }>;

  // Aggregate
  totalQuestions: number;
  moduleCount: number;
  expectedPerModule: number;       // Ideal questions per module (total / moduleCount)

  confidenceScore: number;
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface ModuleCoverageOutput {
  moduleAssessment: Record<string, string>;  // Key: moduleCode, Value: assessment sentence
  weakModules: string[];                     // Module codes with below-expected coverage
  strongModules: string[];                   // Module codes with above-expected coverage
  recommendation: string;                    // Overall module distribution recommendation
}
```

**Zod Validation Schema:**

```typescript
const moduleCoverageSchema = z.object({
  moduleAssessment: z.record(z.string(), z.string().min(10).max(200)),
  weakModules: z.array(z.string()),
  strongModules: z.array(z.string()),
  recommendation: z.string().min(20).max(300),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are analyzing the distribution of questions across syllabus modules.

MODULE COUNT: {moduleCount} modules
TOTAL QUESTIONS: {totalQuestions}
EXPECTED PER MODULE: ~{expectedPerModule} questions

MODULE DISTRIBUTION:
{JSON of moduleDistribution array}

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Assess the module-level coverage. Identify modules that are under- or over-represented.
Suggest optimal redistribution.

OUTPUT FORMAT:
{
  "moduleAssessment": {
    "M1": "6 questions, slightly above the expected ~{expectedPerModule} per module.",
    "M2": "2 questions, well below the expected distribution."
  },
  "weakModules": ["M2", "M4"],
  "strongModules": ["M1", "M5"],
  "recommendation": "string"
}

RULES:
- Never invent module codes not present in the input.
- A module is "weak" if its questionCount < expectedPerModule * 0.6.
- A module is "strong" if its questionCount > expectedPerModule * 1.4.
```

**Hallucination Guards:**

1. **Entity Name Guard**: AI must only reference module codes from the input.
   Detection: compare output module codes against `moduleDistribution[].moduleCode`.
   Action: drop module if invented module found.

**Example Input/Output:**

```
Input: {
  "moduleDistribution": [
    { "moduleCode": "M1", "questionCount": 6, "coveragePercentage": 0.24 },
    { "moduleCode": "M2", "questionCount": 2, "coveragePercentage": 0.08 },
    { "moduleCode": "M3", "questionCount": 5, "coveragePercentage": 0.20 },
    { "moduleCode": "M4", "questionCount": 3, "coveragePercentage": 0.12 },
    { "moduleCode": "M5", "questionCount": 7, "coveragePercentage": 0.28 },
    { "moduleCode": "M6", "questionCount": 2, "coveragePercentage": 0.08 }
  ],
  "totalQuestions": 25,
  "moduleCount": 6,
  "expectedPerModule": 4.17
}
Output: {
  "moduleAssessment": {
    "M1": "6 questions, 44% above the expected ~4 per module.",
    "M2": "2 questions, well below the expected distribution.",
    "M3": "5 questions, slightly above expected.",
    "M4": "3 questions, slightly below expected.",
    "M5": "7 questions, 68% above the expected per-module average.",
    "M6": "2 questions, well below the expected distribution."
  },
  "weakModules": ["M2", "M6"],
  "strongModules": ["M1", "M5"],
  "recommendation": "Redistribute questions from M1 and M5 to M2 and M6 for balanced module coverage."
}
```

---

### 3.6 Module 6: Concept Diversity

**Purpose:** Analyze concept and keyword spread across questions. Identify
clustering risk where too many questions target the same concept.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 800

**Max Output Tokens:** 200

**PromptModuleId:** `"concept-diversity"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface ConceptDiversityInput {
  // Concepts extracted from question text and metadata
  concepts: Array<{
    conceptName: string;
    questionCount: number;        // Questions referencing this concept
    percentage: number;           // questionCount / totalQuestions
    modulesPresent: string[];     // Modules where this concept appears
  }>;
  totalConcepts: number;
  totalQuestions: number;
  conceptToQuestionRatio: number; // totalConcepts / totalQuestions

  // Clustering indicators
  dominantConceptName: string | null;    // Concept with highest question count
  dominantConceptPercentage: number;     // Percentage for dominant concept
  top3ConceptsCoverage: number;          // Total % of top 3 concepts

  confidenceScore: number;
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface ConceptDiversityOutput {
  diversityScore: "HIGH" | "MEDIUM" | "LOW";
  clusteringRisk: string | null;       // Description if risk exists, null otherwise
  dominantConceptNote: string;         // Observation about the most covered concept
  recommendation: string;              // Diversity improvement suggestion
}
```

**Zod Validation Schema:**

```typescript
const conceptDiversitySchema = z.object({
  diversityScore: z.enum(["HIGH", "MEDIUM", "LOW"]),
  clusteringRisk: z.string().nullable(),
  dominantConceptNote: z.string().min(10).max(200),
  recommendation: z.string().min(10).max(300),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are analyzing the concept diversity of a question bank.

CONCEPT SUMMARY:
Total concepts: {totalConcepts}
Total questions: {totalQuestions}
Concept-to-question ratio: {conceptToQuestionRatio}

DOMINANT CONCEPT: {dominantConceptName} ({dominantConceptPercentage}% of questions)
TOP 3 CONCEPTS COVERAGE: {top3ConceptsCoverage}%

ALL CONCEPTS:
{JSON of concepts array}

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Assess whether the question bank covers a diverse range of concepts or is
over-concentrated on a few topics. Identify clustering risk.

OUTPUT FORMAT:
{
  "diversityScore": "HIGH|MEDIUM|LOW",
  "clusteringRisk": "string or null",
  "dominantConceptNote": "string",
  "recommendation": "string"
}

RULES:
- Never invent concept names not in the input.
- diversityScore mapping:
  top3ConceptsCoverage < 40% → HIGH
  top3ConceptsCoverage 40-60% → MEDIUM
  top3ConceptsCoverage > 60% → LOW
```

**Hallucination Guards:**

1. **Entity Name Guard**: AI must only reference concept names from the input.
   Detection: cross-reference output concept mentions against input. Action: drop module.

**Example Input/Output:**

```
Input: {
  "totalConcepts": 12,
  "totalQuestions": 25,
  "conceptToQuestionRatio": 0.48,
  "dominantConceptName": "Arrays",
  "dominantConceptPercentage": 24,
  "top3ConceptsCoverage": 52,
  "concepts": [
    { "conceptName": "Arrays", "questionCount": 6, "percentage": 24 },
    { "conceptName": "Linked Lists", "questionCount": 4, "percentage": 16 },
    { "conceptName": "Stacks", "questionCount": 3, "percentage": 12 },
    { "conceptName": "Queues", "questionCount": 3, "percentage": 12 }
  ]
}
Output: {
  "diversityScore": "MEDIUM",
  "clusteringRisk": "Top 3 concepts account for 52% of questions, indicating moderate clustering.",
  "dominantConceptNote": "Arrays dominates at 24%, suggesting possible over-emphasis.",
  "recommendation": "Distribute questions more evenly. Consider reducing Arrays questions and adding coverage to underrepresented concepts."
}
```

---

### 3.7 Module 7: Risk Analysis

**Purpose:** Synthesize all preceding module findings into a structured risk
register. Each risk links to specific evidence, affected modules, and COs.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1000

**Max Output Tokens:** 400

**PromptModuleId:** `"risk-analysis"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface RiskAnalysisInput {
  // All available metric evidence
  metrics: Array<{
    indexCode: IndexCode;
    value: number;
    classification: Classification;
  }>;

  // Key indicators that flag risk
  weakInsuficientMetrics: Array<{  // Metrics classified NEEDS_IMPROVEMENT or MAJOR_REVISION
    indexCode: IndexCode;
    value: number;
    classification: Classification;
  }>;

  // Coverage gaps
  uncoveredCOs: string[];
  weakModules: string[];

  // Confidence
  ociValue: number;
  ociClassification: ConfidenceClassification;

  // Bank context
  subjectName: string;
  totalQuestions: number;
}
```

**Output Schema:**

```typescript
// The Risk entity is defined in uaf-domain-model.md. This output maps to it.
interface RiskAnalysisOutput {
  risks: Array<{
    finding: string;               // Description of the risk
    educationalRisk: string;       // Impact on educational outcomes
    institutionalRisk: string;     // Impact on accreditation/standing
    priority: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
    riskType: "EDUCATIONAL" | "INSTITUTIONAL" | "ASSESSMENT" | "ACCREDITATION";
    affectedModules: string[];
    affectedCOs: string[];
  }>;
}
```

**Zod Validation Schema:**

```typescript
const riskAnalysisSchema = z.object({
  risks: z.array(z.object({
    finding: z.string().min(10).max(300),
    educationalRisk: z.string().min(10).max(300),
    institutionalRisk: z.string().min(10).max(300),
    priority: z.enum(["CRITICAL", "MAJOR", "MODERATE", "MINOR"]),
    riskType: z.enum(["EDUCATIONAL", "INSTITUTIONAL", "ASSESSMENT", "ACCREDITATION"]),
    affectedModules: z.array(z.string()).min(0).max(10),
    affectedCOs: z.array(z.string()).min(0).max(10),
  })).min(1).max(10),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are generating the risk register for a UAF analysis of {subjectName}.

LOW-PERFORMING METRICS:
{JSON of weakInsuficientMetrics}

COVERAGE GAPS:
Uncovered COs: {JSON of uncoveredCOs}
Weak modules: {JSON of weakModules}

ALL METRICS:
{JSON of metrics}

OVERALL CONFIDENCE: {ociValue} ({ociClassification})

TASK:
Generate a risk register. Each risk must be grounded in the evidence provided.
Link risks to specific outcomes and modules. Assign priority and type per the
domain model enums (RiskPriority, RiskType from uaf-domain-model.md).

OUTPUT FORMAT:
{
  "risks": [
    {
      "finding": "CO4 has zero questions mapped to it.",
      "educationalRisk": "Students cannot be assessed on CO4 outcomes.",
      "institutionalRisk": "Accreditation evidence for CO4 is absent.",
      "priority": "CRITICAL",
      "riskType": "ACCREDITATION",
      "affectedModules": [],
      "affectedCOs": ["CO4"]
    }
  ]
}

RULES:
- Every risk must reference evidence present in the input.
- Priority mapping: MAJOR_REVISION metrics → CRITICAL or MAJOR.
  NEEDS_IMPROVEMENT metrics → MODERATE or MINOR.
- At least one risk must be generated if any weak metrics exist.
- RiskType must be one of: EDUCATIONAL, INSTITUTIONAL, ASSESSMENT, ACCREDITATION.
```

**Hallucination Guards:**

1. **Entity Name Guard**: AI must only reference CO codes and module codes that
   exist in the input. Detection: cross-reference. Action: drop module.

2. **Number Injection Guard**: AI must not introduce metric values not in the
   input. Detection: scan output for numbers. Action: drop module.

**Example Input/Output:**

```
Input: {
  "weakInsuficientMetrics": [
    { "indexCode": "CVI", "value": 0.33, "classification": "MAJOR_REVISION" }
  ],
  "uncoveredCOs": ["CO4", "CO6"],
  "weakModules": ["M2"],
  "subjectName": "Data Structures"
}
Output: {
  "risks": [
    {
      "finding": "CVI at MAJOR_REVISION (0.33): 4 of 6 COs uncovered.",
      "educationalRisk": "Four course outcomes have insufficient assessment coverage.",
      "institutionalRisk": "Accreditation review will flag missing attainment evidence for CO4, CO6.",
      "priority": "CRITICAL",
      "riskType": "ACCREDITATION",
      "affectedModules": ["M2"],
      "affectedCOs": ["CO4", "CO6"]
    }
  ]
}
```

---

### 3.8 Module 8: Recommendations

**Purpose:** Generate actionable recommendations based on all evidence. Each
recommendation links to a finding, suggests concrete actions, and evaluates
impact.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 800

**Max Output Tokens:** 400

**PromptModuleId:** `"recommendations"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface RecommendationsInput {
  // Weak metrics that need action
  weakMetrics: Array<{
    indexCode: IndexCode;
    value: number;
    classification: Classification;
  }>;

  // Coverage gaps
  uncoveredCOs: string[];
  weakModules: string[];
  weakConcepts: string[];         // Concepts that are under-represented

  // Confidence context
  ociValue: number;

  // Context
  subjectName: string;
}
```

**Output Schema:**

```typescript
// The Recommendation entity is defined in uaf-domain-model.md
interface RecommendationsOutput {
  recommendations: Array<{
    finding: string;               // What was found
    recommendation: string;        // What should be done
    priority: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
    impact: string;                // Expected impact if actioned
    suggestedActions: string[];    // Concrete steps (1-4)
  }>;
}
```

**Zod Validation Schema:**

```typescript
const recommendationsSchema = z.object({
  recommendations: z.array(z.object({
    finding: z.string().min(10).max(200),
    recommendation: z.string().min(10).max(300),
    priority: z.enum(["CRITICAL", "MAJOR", "MODERATE", "MINOR"]),
    impact: z.string().min(10).max(200),
    suggestedActions: z.array(z.string()).min(1).max(4),
  })).min(1).max(8),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are generating recommendations for improving the {subjectName} question bank.

AREAS NEEDING ATTENTION:
{JSON of weakMetrics}

COVERAGE GAPS:
Uncovered COs: {JSON of uncoveredCOs}
Weak modules: {JSON of weakModules}
Under-represented concepts: {JSON of weakConcepts}

OVERALL CONFIDENCE: {ociValue}

TASK:
Generate actionable recommendations. Each recommendation must be specific,
measurable, and linked to the evidence provided. Include concrete action steps.

OUTPUT FORMAT:
{
  "recommendations": [
    {
      "finding": "CVI is 0.33 (MAJOR_REVISION)",
      "recommendation": "Add questions targeting CO4 and CO6.",
      "priority": "CRITICAL",
      "impact": "Achieves full CO coverage and enables attainment assessment.",
      "suggestedActions": [
        "Create 3 questions for CO4 covering M2 content.",
        "Create 3 questions for CO6 covering M5 content."
      ]
    }
  ]
}

RULES:
- Every recommendation must reference evidence from the input.
- Never suggest actions unrelated to the provided evidence.
- At least one recommendation must be generated if any weak metrics exist.
- Priority should match the severity of the underlying issue.
```

**Hallucination Guards:**

1. **Entity Name Guard**: AI must only reference CO codes, modules, and concepts
   that exist in the input. Action: drop module.

2. **Field Mandate Guard**: Every recommendation must have all 5 fields
   (finding, recommendation, priority, impact, suggestedActions). Detection:
   Zod schema. Action: retry once, then drop.

**Example Input/Output:**

```
Input: {
  "weakMetrics": [
    { "indexCode": "CVI", "value": 0.33, "classification": "MAJOR_REVISION" },
    { "indexCode": "BDI", "value": 0.45, "classification": "NEEDS_IMPROVEMENT" }
  ],
  "uncoveredCOs": ["CO4"],
  "weakModules": ["M2"],
  "subjectName": "Data Structures"
}
Output: {
  "recommendations": [
    {
      "finding": "CVI at MAJOR_REVISION (0.33): CO4 is uncovered.",
      "recommendation": "Add 3-4 questions for CO4 to achieve minimum coverage.",
      "priority": "CRITICAL",
      "impact": "Enables CO4 attainment assessment and closes accreditation gap.",
      "suggestedActions": [
        "Identify module M2 topics that map to CO4.",
        "Create questions at varying cognitive levels for CO4.",
        "Assign Bloom levels and verify alignment."
      ]
    },
    {
      "finding": "BDI at NEEDS_IMPROVEMENT (0.45): over-concentration at Remember level.",
      "recommendation": "Add higher-order questions to balance cognitive distribution.",
      "priority": "MAJOR",
      "impact": "Improves cognitive balance and HOTS assessment capability.",
      "suggestedActions": [
        "Convert 2 Remember-level questions to Analyze level.",
        "Add 1 Create-level question to evaluate synthesis skills."
      ]
    }
  ]
}
```

---

### 3.9 Module 9: Academic Quality

**Purpose:** Assess the 7 dimensions of question construction quality. References
`computeQCQI` from engineering-spec Section 1.5.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1200

**Max Output Tokens:** 300

**PromptModuleId:** `"academic-quality"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface AcademicQualityInput {
  // QCQI components. References: engineering-spec Section 1.5 computeQCQI
  qcqiValue: number;
  qcqiClassification: Classification;

  // 7 quality dimensions (each 0.00-1.00)
  clarityScore: number;
  precisionScore: number;
  technicalAccuracyScore: number;
  contextAdequacyScore: number;
  assessmentValidityScore: number;
  questionAlignmentScore: number;
  fairnessScore: number;

  // Per-question QCQI scores (aggregate view)
  questionQualitySummary: Array<{
    scoreRange: string;            // e.g. "0.90-1.00", "0.70-0.89", "below 0.70"
    questionCount: number;
    percentage: number;
  }>;

  confidenceScore: number;
  confidenceClassification: ConfidenceClassification;
}
```

**Output Schema:**

```typescript
interface AcademicQualityOutput {
  qualityAssessment: string;           // Overall assessment (1-2 sentences)
  strongDimensions: string[];          // Dimensions with score >= 0.80 (0-7)
  weakDimensions: Array<{
    dimension: string;                 // e.g. "clarityScore"
    score: number;
    recommendation: string;
  }>;
  revisionCandidates: string[];        // Specific areas flagged for revision (0-4)
}
```

**Zod Validation Schema:**

```typescript
const academicQualitySchema = z.object({
  qualityAssessment: z.string().min(20).max(300),
  strongDimensions: z.array(z.string()).min(0).max(7),
  weakDimensions: z.array(z.object({
    dimension: z.string(),
    score: z.number().min(0).max(1),
    recommendation: z.string().min(10).max(200),
  })).min(0).max(7),
  revisionCandidates: z.array(z.string()).min(0).max(4),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are assessing the academic quality of a question bank across 7 dimensions.

QUESTION CONSTRUCTION QUALITY INDEX (QCQI):
Value: {qcqiValue} | Classification: {qcqiClassification}

QUALITY DIMENSION SCORES:
Clarity: {clarityScore}
Precision: {precisionScore}
Technical Accuracy: {technicalAccuracyScore}
Context Adequacy: {contextAdequacyScore}
Assessment Validity: {assessmentValidityScore}
Question Alignment: {questionAlignmentScore}
Fairness: {fairnessScore}

QUESTION QUALITY DISTRIBUTION:
{JSON of questionQualitySummary array}

CONFIDENCE: {confidenceScore} ({confidenceClassification})

TASK:
Assess the 7 quality dimensions. Identify strengths (score >= 0.80) and
weaknesses (score < 0.60). Provide targeted recommendations for weak dimensions.

OUTPUT FORMAT:
{
  "qualityAssessment": "string",
  "strongDimensions": ["clarityScore", "precisionScore", ...],
  "weakDimensions": [
    { "dimension": "contextAdequacyScore", "score": 0.55, "recommendation": "string" }
  ],
  "revisionCandidates": ["string", ...]
}

RULES:
- Never recalculate QCQI or any dimension score.
- A dimension is strong if score >= 0.80.
- A dimension is weak if score < 0.60.
- weakDimensions array must be empty if all dimensions are >= 0.60.
```

**Hallucination Guards:**

1. **Number Injection Guard**: AI must not introduce quality scores not in the
   input. Detection: scan output for numeric values. Action: drop module.

2. **Verdict Alignment Guard**: The quality assessment must align with the QCQI
   classification within 1 level. Detection: compare classification level.
   Action: warn on gap, drop on 2+ level gap.

**Example Input/Output:**

```
Input: {
  "qcqiValue": 0.72,
  "qcqiClassification": "EFFECTIVE",
  "clarityScore": 0.85,
  "precisionScore": 0.80,
  "technicalAccuracyScore": 0.75,
  "contextAdequacyScore": 0.55,
  "assessmentValidityScore": 0.70,
  "questionAlignmentScore": 0.78,
  "fairnessScore": 0.82,
  "questionQualitySummary": [
    { "scoreRange": "0.90-1.00", "questionCount": 5, "percentage": 20 },
    { "scoreRange": "0.70-0.89", "questionCount": 14, "percentage": 56 },
    { "scoreRange": "below 0.70", "questionCount": 6, "percentage": 24 }
  ]
}
Output: {
  "qualityAssessment": "Question construction quality is EFFECTIVE overall, with strong clarity and fairness but weak context adequacy.",
  "strongDimensions": ["clarityScore", "precisionScore", "fairnessScore"],
  "weakDimensions": [
    { "dimension": "contextAdequacyScore", "score": 0.55, "recommendation": "Add more contextual information to questions, especially scenario-based problems." }
  ],
  "revisionCandidates": [
    "6 questions (24%) score below 0.70, suggesting revision is needed for context and validity."
  ]
}
```

---

### 3.10 Module 10: Final Verdict

**Purpose:** Synthesize all evidence into an overall moderation verdict. This is
the final decision synthesis that combines deterministic metrics and AI
interpretation.

**Pipeline Stage:** PromptBuilder → OllamaService → ResponseValidator

**Max Input Tokens:** 1000

**Max Output Tokens:** 400

**PromptModuleId:** `"final-verdict"`

**Input Schema (from EvidenceSnapshot):**

```typescript
interface FinalVerdictInput {
  // Top-level composite
  qpqiValue: number;
  qpqiClassification: Classification;

  // Key metric summaries
  allMetrics: Array<{
    indexCode: IndexCode;
    value: number;
    classification: Classification;
  }>;

  // Summary counts
  exemplaryCount: number;         // Metrics classified EXEMPLARY
  needsImprovementCount: number;  // Metrics classified NEEDS_IMPROVEMENT
  majorRevisionCount: number;     // Metrics classified MAJOR_REVISION

  // Confidence
  ociValue: number;
  ociClassification: ConfidenceClassification;

  // Evidence quality
  evidenceLevel: number;          // Highest evidence hierarchy level achieved (1-5)

  // Context
  subjectName: string;
  totalQuestions: number;
  moduleCount: number;
  coCount: number;
}
```

**Output Schema:**

```typescript
interface FinalVerdictOutput {
  verdict: "EXEMPLARY" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "MAJOR_REVISION";
  justification: string;           // 2-3 paragraph synthesis
  keyEvidence: string[];           // 3-5 key pieces of evidence supporting verdict
  confidence: "HIGH" | "MEDIUM" | "LOW";
}
```

**Zod Validation Schema:**

```typescript
const finalVerdictSchema = z.object({
  verdict: z.enum(["EXEMPLARY", "SATISFACTORY", "NEEDS_IMPROVEMENT", "MAJOR_REVISION"]),
  justification: z.string().min(50).max(1000),
  keyEvidence: z.array(z.string()).min(3).max(5),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
}).strict();
```

**Prompt Template:**

```
[System preamble]
---
You are producing the final moderation verdict for {subjectName}.

QUESTION PAPER QUALITY INDEX (QPQI):
Value: {qpqiValue} | Classification: {qpqiClassification}

METRIC BREAKDOWN:
All metrics: {JSON of allMetrics}
Exemplary: {exemplaryCount}
Needs improvement: {needsImprovementCount}
Major revision: {majorRevisionCount}

OVERALL CONFIDENCE: {ociValue} ({ociClassification})
EVIDENCE HIERARCHY LEVEL: {evidenceLevel} (1-5 scale)

CONTEXT: {totalQuestions} questions, {moduleCount} modules, {coCount} COs

TASK:
Synthesize all evidence into a final verdict. The verdict must be primarily
driven by the QPQI value and classification, with adjustments based on
qualitative factors. Provide clear justification referencing specific metrics.

OUTPUT FORMAT:
{
  "verdict": "EXEMPLARY|SATISFACTORY|NEEDS_IMPROVEMENT|MAJOR_REVISION",
  "justification": "string (2-3 paragraphs)",
  "keyEvidence": ["string", ...],
  "confidence": "HIGH|MEDIUM|LOW"
}

RULES:
- Verdict must align with QPQI classification by default:
  EXEMPLARY → EXEMPLARY verdict
  HIGHLY_EFFECTIVE → EXEMPLARY or SATISFACTORY
  EFFECTIVE → SATISFACTORY
  ACCEPTABLE → SATISFACTORY or NEEDS_IMPROVEMENT
  NEEDS_IMPROVEMENT → NEEDS_IMPROVEMENT
  MAJOR_REVISION → MAJOR_REVISION
- Deviation from this mapping requires explicit justification in keyEvidence.
- confidence must map from OCI:
  VERY_HIGH/HIGH → HIGH
  MEDIUM → MEDIUM
  LOW/VERY_LOW → LOW
- Never invent metric values or classifications.
```

**Hallucination Guards:**

1. **Verdict Alignment Guard (Critical)**: The verdict must be within 1 level of
   the QPQI classification mapping. Detection: compare verdict against the QPQI
   alignment rules above. Action: if verdict deviates by 2+ levels with
   insufficient justification, drop module output.

2. **Number Injection Guard**: AI must not introduce metrics not in the input.
   Detection: scan output for metric references. Action: drop module.

**Example Input/Output:**

```
Input: {
  "qpqiValue": 0.78,
  "qpqiClassification": "EFFECTIVE",
  "allMetrics": [
    { "indexCode": "SCI", "value": 0.90, "classification": "EXEMPLARY" },
    { "indexCode": "CVI", "value": 0.67, "classification": "ACCEPTABLE" }
  ],
  "exemplaryCount": 3,
  "needsImprovementCount": 1,
  "majorRevisionCount": 0,
  "ociValue": 0.85,
  "ociClassification": "HIGH",
  "evidenceLevel": 4,
  "subjectName": "Data Structures"
}
Output: {
  "verdict": "SATISFACTORY",
  "justification": "The question bank demonstrates solid structural quality (SCI: 0.90 EXEMPLARY) and balanced cognitive demand (BDI: 0.85). However, CO coverage at ACCEPTABLE (0.67) prevents a higher classification. Overall quality is EFFECTIVE with HIGH confidence, leading to a SATISFACTORY verdict.",
  "keyEvidence": [
    "QPQI 0.78 (EFFECTIVE) drives SATISFACTORY verdict.",
    "SCI 0.90 (EXEMPLARY) confirms strong structural compliance.",
    "CVI 0.67 (ACCEPTABLE) identifies coverage gaps needing attention.",
    "OCI 0.85 (HIGH) indicates reliable metric computation."
  ],
  "confidence": "HIGH"
}
```

---

## 4. Hallucination Prevention Strategy

Hallucination prevention operates at four layers: input, instruction, schema, and
post-hoc validation.

### 4.1 Layer 1: Input Constraint

The `PromptBuilder` (defined in `ai-analysis-subsystem.md` Section 8) sends only
the evidence fields relevant to each module. By constraining the input, the model
has fewer opportunities to fabricate information. The EvidenceSnapshot (defined
in `uaf-domain-model.md`) is partitioned into per-module slices.

**Implementation:** `PromptBuilder.build()` selects a subset of
`EvidenceSnapshot.snapshot` fields per module using predefined field selectors.

### 4.2 Layer 2: Negative Instructions

Every module prompt includes explicit "NEVER" rules positioned at the end of the
template, immediately before the output section. These rules are:

- NEVER compute or recalculate numbers from the evidence
- NEVER reference evidence not provided above
- NEVER invent COs, modules, or metrics not present in evidence
- NEVER fabricate student performance data or historical trends
- NEVER repeat or paraphrase question text from the bank

### 4.3 Layer 3: Schema Enforcement

Every module defines a strict Zod output schema (using `.strict()` which rejects
unknown keys). The `ResponseValidator` (defined in `ai-analysis-subsystem.md`
Section 9) runs 4-stage validation:

1. JSON.parse — verify valid JSON
2. Zod schema validation — verify shape and types
3. Semantic checks — hallucination guards
4. Field mandate — verify completeness

### 4.4 Layer 4: Post-Hoc Hallucination Guards

Five guards run after schema validation. Defined in detail in
`ai-analysis-subsystem.md` Section 10. Summary:

| # | Guard | Detection | Action |
|---|---|---|---|
| 1 | Number Injection | AI output contains numeric values not in input evidence | Drop module, mark HALLUCATION_NUMBER_INJECTION |
| 2 | Entity Name | AI references entity names (CO codes, module codes, Bloom levels) not in input | Drop module, mark HALLUCATION_ENTITY_NAME |
| 3 | Verdict Alignment | AI verdict contradicts deterministic classification by 2+ levels | Drop module, mark VERDICT_MISALIGNMENT |
| 4 | Field Mandate | Required fields missing or null in output | Retry once, then drop module, mark FIELD_MANDATE_VIOLATION |
| 5 | Length Guard | Output exceeds approximate token budget | Truncate silently, mark TRUNCATED |

### 4.5 Guard Implementation Note

The guards are implemented in the `ResponseValidator` container (interface defined
in `ai-analysis-subsystem.md` Section 3). Each guard runs independently per module.
A module failure does not fail the pipeline; the `AnalysisBuilder` handles null
module outputs by marking them as "AI Unavailable" and proceeding with
deterministic data.

---

## 5. Prompt Versioning

### 5.1 Version Structure

Each of the 10 modules has an independent version number stored in the
`PromptVersion` table (entity defined in `uaf-domain-model.md`).

```typescript
// PromptVersion entity (from domain model)
interface PromptVersion {
  id: PromptVersionId;
  moduleId: PromptModuleId;     // Which module this prompt serves
  version: string;               // SemVer, e.g. "1.0.0"
  promptText: string;            // Full prompt template with {{placeholders}}
  outputSchema: Json;            // Zod-compatible schema definition
  contextBudget: number;         // Max output tokens for this module
  createdAt: DateTime;
  supersededAt: DateTime | null; // null = active version
}
```

### 5.2 Version Numbering

| Module | Initial Version | Increment When |
|---|---|---|
| Executive Summary | 1.0.0 | Preamble changes, output schema changes, rubric changes |
| Bloom Analysis | 1.0.0 | Bloom distribution targets change, BDI interpretation changes |
| Difficulty Analysis | 1.0.0 | Difficulty tiers change, alignment matrix changes |
| CO Coverage | 1.0.0 | CO assessment criteria change |
| Module Coverage | 1.0.0 | Module distribution thresholds change |
| Concept Diversity | 1.0.0 | Diversity thresholds change |
| Risk Analysis | 1.0.0 | Risk priority mapping changes |
| Recommendations | 1.0.0 | Recommendation format changes |
| Academic Quality | 1.0.0 | QCQI dimension names or thresholds change |
| Final Verdict | 1.0.0 | Verdict criteria or enforcement rules change |

### 5.3 Version Lifecycle

```
1. New prompt version is created (supersededAt = null)
2. Previous active version gets supersededAt = now()
3. Only one version per moduleId may have supersededAt = null
4. Old versions are NEVER deleted (immutability)
5. AnalysisVersion records reference PromptVersion.id for audit trail
```

### 5.4 PromptVersion Registry Location

PromptVersion records are stored in the database (Prisma schema defined in
`ai-analysis-subsystem.md` Section 12). The `PromptBuilder` loads active versions
at runtime via:

```sql
SELECT * FROM PromptVersion
WHERE moduleId = :moduleId AND supersededAt IS NULL
ORDER BY version DESC LIMIT 1
```

### 5.5 Schema Version vs. Prompt Version

Two distinct version tracks:

| Track | Unit | Purpose | Changes When |
|---|---|---|---|
| `promptVersion` | Per-module SemVer | Prompt text, instructions | Prompt wording changes, rules change |
| `analysisSchemaVersion` | Global SemVer | Output JSON schema | Field names change, types change |

Both are recorded on `AnalysisVersion` for audit trail.

---

## 6. Testing Strategy

### 6.1 Per-Module Test Types

#### Unit Test: Prompt Construction

**Purpose:** Verify that `PromptBuilder` produces correct prompt text for a given
`EvidenceSnapshot`.

**Test case:** Given an `EvidenceSnapshot` with known Bloom metric values, verify
that the Bloom Analysis module prompt contains:
- The BDI value and classification
- The LOTS and HOTS values
- The observed distribution JSON
- The system preamble
- No fields from unrelated modules (e.g., no QCQI dimension scores)

```typescript
// Example test structure
it("includes correct evidence in bloom analysis prompt", () => {
  const prompt = promptBuilder.build(snapshot, PromptModuleId.BLOOM_ANALYSIS);
  expect(prompt).toContain("bdiValue");
  expect(prompt).toContain(snapshot.metrics.find(m => m.indexCode === "BDI").value);
  expect(prompt).not.toContain("clarityScore"); // unrelated field
});
```

#### Validation Test: Schema Compliance

**Purpose:** Verify that known-good AI responses pass Zod schema validation.

**Test case:** For each module, construct a fixture JSON matching the output
schema and verify it passes `ResponseValidator.validate()`.

```typescript
it("passes schema validation for known-good bloom output", () => {
  const output = {
    cognitiveBalance: ["Well balanced across all levels."],
    risks: [],
    recommendations: [],
    balanceAssessment: "WELL_BALANCED",
  };
  const result = validator.validate(output, bloomAnalysisSchema);
  expect(result.success).toBe(true);
});
```

#### Hallucination Test: Guard Detection

**Purpose:** Verify that hallucination guards correctly flag fabricated content.

**Test case:** Submit AI output containing a numeric value not in the input
evidence. Verify that the Number Injection Guard triggers and drops the module.

```typescript
it("detects number injection in bloom analysis output", () => {
  const output = { cognitiveBalance: [], risks: ["BDI dropped to 0.30"], ... };
  const evidence = { bdiValue: 0.85, ... }; // BDI is 0.85, AI says 0.30
  const result = validator.runGuards(output, evidence);
  expect(result.guardTriggered).toBe("HALLUCINATION_NUMBER_INJECTION");
});
```

#### Regression Test: Structural Consistency

**Purpose:** Verify that a module version N produces the same output structure
as version N-1.

**Test case:** Given identical evidence input, validate that the JSON output
of version N and version N-1 have identical field names and types (values may
differ due to model stochasticity).

```typescript
it("maintains output structure across versions", () => {
  const v1Schema = loadSchema("bloom-analysis", "1.0.0");
  const v2Schema = loadSchema("bloom-analysis", "2.0.0");
  const v1Keys = extractTopLevelKeys(v1Schema);
  const v2Keys = extractTopLevelKeys(v2Schema);
  expect(v2Keys).toEqual(v1Keys); // same field names
});
```

### 6.2 Test Fixtures

Each module needs three fixture categories:

| Category | Purpose | Source |
|---|---|---|
| Valid evidence | Known-good `EvidenceSnapshot` data | Hand-crafted from engineering spec test scenarios |
| Invalid evidence | Edge cases (null metrics, missing fields) | Derived from failure mode matrix (engineering-spec Section 6) |
| Hallucinated output | JSON with fabricated content | Hand-crafted by test author |

### 6.3 Test Automation

```
npm run test:prompt          # Unit tests for PromptBuilder
npm run test:validation      # Schema validation tests
npm run test:hallucination   # Hallucination guard tests
npm run test:regression      # Structural regression tests
```

---

## 7. Retry Strategy per Module

Each module call to `OllamaService` follows an independent retry policy. Retries
are per-module: if Module 3 fails all retries and Module 4 succeeds on the first
attempt, Module 4's output is preserved.

### 7.1 Retry Table

| Attempt | Condition | Action | Timeout |
|---|---|---|---|
| 1 | Timeout (>30s for Qwen3.5:3b) | Retry with identical prompt | 30s |
| 2 | Invalid JSON in response | Retry with "Respond in valid JSON only" appended | 30s |
| 3 | Zod schema validation fails | Retry with stricter format description (field names + types) | 30s |
| 4 | All exhausted | Mark module as AI_UNAVAILABLE, proceed | N/A |

### 7.2 Backoff Strategy

```
Attempt 1 → 2: 0s delay (immediate retry)
Attempt 2 → 3: 1s delay
Attempt 3 → 4: 5s delay
```

### 7.3 Fallback Behavior

When a module exhausts all retries:

1. Module output is set to `null` in the `ValidatedAIResponse`
2. Module is marked as `AI_UNAVAILABLE` in the analysis status
3. `AnalysisBuilder` uses deterministic data for that module's section
4. Executive summary includes note: "AI analysis unavailable for [module name]"
5. The overall `QuestionBankAnalysis` still reaches `COMPLETE` status
6. A warning notification is sent to the triggering user

### 7.4 Global Fallback

If all 10 modules fail (Ollama unreachable, model not found):

1. Status is set to `COMPLETE` (not FAILED)
2. All AI-dependent fields are null
3. Executive summary states: "AI analysis unavailable. Deterministic data only."
4. Notification sent with Ollama connectivity warning

---

## 8. How It Fits in 8K

### 8.1 The Sequential Window Strategy

Each module runs independently in its own 8K context window. The pipeline is
sequential — Module 1 completes before Module 2 starts. This is by design:

**If all 10 modules ran in one context window:**

| Component | Tokens |
|---|---|
| System preamble | 400 |
| Module 1 instructions | 300 |
| Module 1 evidence | 2000 |
| Module 1 output | 500 |
| Module 2-10 instructions + evidence | ~8000 |
| Module 2-10 output buffers | ~2000 |
| **Total** | **~13,200** |

This exceeds 8K. Splitting into sequential calls keeps each call well within
the limit.

### 8.2 Per-Call Cost

| Component | Max Tokens |
|---|---|
| System preamble | 400 |
| Module-specific instructions | 300 |
| Module-specific evidence JSON | 500-1,600 |
| Output schema + rules | 200-400 |
| **Total per call** | **~1,400-2,700** |
| **8K limit** | **8,192** |
| **Headroom** | **~5,500-6,800** |

### 8.3 Total Pipeline Cost (Not Concurrent)

Total tokens sent to Ollama across all 10 modules:

```
10 × (400 preamble + 300 instructions + 1,000 evidence + 300 output) = ~20,000 tokens
```

But the cost per request (not total) is what matters for the 8K limit:

- Each request: ~2,000 tokens
- Well within 8K
- No request is close to the limit

### 8.4 Headroom Allocation

The ~5,500+ tokens of headroom per call serve as:

1. **Buffer for longer field descriptions** — if a bank has many modules or COs
2. **Safety margin** — Qwen3.5:3b may use more tokens for complex JSON
3. **Retry margin** — retry instructions add ~50-100 tokens
4. **Future expansion** — new evidence fields can be added without hitting the limit

### 8.5 Token Approximation

Token counting uses the approximation: `1 token ≈ 4 characters` for English text.
For JSON-heavy content, the ratio is closer to `1 token ≈ 3 characters` due to
numbers, punctuation, and whitespace. The per-module budgets account for this by
using conservative (low) character estimates for evidence JSON.

### 8.6 Module Independence

Each module's prompt is self-contained. It includes:
- The system preamble (defines the AI's role)
- Module-specific instructions (defines the task)
- The evidence subset (defines the data)
- The output schema (defines the expected response format)

No module depends on the output of another module. This means:
- Modules can run in any order (though sequential is the pipeline default)
- A module failure does not cascade to other modules
- The pipeline can be parallelized in the future if needed

---

## Out of Scope

The following are intentionally absent from this document:

- **Service implementation details** — defined in `ai-analysis-subsystem.md`
- **UI rendering** — defined in Dean Dashboard UI specification
- **DB schema** — defined in `uaf-domain-model.md` and `ai-analysis-subsystem.md`
- **Implementation code** — TypeScript classes, not interfaces
- **Deployment configuration** — environment variables, Docker, CI/CD
- **Metric computation formulas** — defined in `uaf-engineering-specification.md`
- **Extraction logic** — defined in `uaf-framework-extraction.md`
- **Event definitions** — defined in events specification

---

*End of AI Prompt Design specification. All domain entities reference
`uaf-domain-model.md` without redefinition. All metric functions reference
`uaf-engineering-specification.md` by section. All service interfaces reference
`ai-analysis-subsystem.md` without redefinition.*
