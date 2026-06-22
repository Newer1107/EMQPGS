# Universal Academic Framework (UAF) v3.3 — Extraction Document

> **Status:** Complete Specification  
> **Version:** 3.3  
> **Purpose:** Academic Moderation, Assessment Quality Assurance, Accreditation Evidence, Institutional Audit, Report Generation

---

## Table of Contents

1. [Governance Protocol](#1-governance-protocol)
2. [Evidence Governance and Validation Protocol](#2-evidence-governance-and-validation-protocol)
3. [Institutional Index Computation Framework](#3-institutional-index-computation-framework)
4. [Question Bank Extraction and Normalization Engine](#4-question-bank-extraction-and-normalization-engine)
5. [Coverage Analysis and Outcome Attainment Engine](#5-coverage-analysis-and-outcome-attainment-engine)
6. [Metadata Integrity and Attribute Accuracy Audit Engine](#6-metadata-integrity-and-attribute-accuracy-audit-engine)
7. [Bloom Taxonomy and Cognitive Complexity Analysis Engine](#7-bloom-taxonomy-and-cognitive-complexity-analysis-engine)
8. [Difficulty and Marks Complexity Analysis Engine](#8-difficulty-and-marks-complexity-analysis-engine)
9. [Question Construction Quality Evaluation Engine](#9-question-construction-quality-evaluation-engine)
10. [Constructive Alignment, Academic Moderation and Future Readiness Engine](#10-constructive-alignment-academic-moderation-and-future-readiness-engine)
11. [Master Quality Index and Final Report Engine](#11-master-quality-index-and-final-report-engine)

---

## 1. Governance Protocol

### 1.1 Fixed Evaluation Architecture

The framework serves the following functions:

- Academic Moderation
- Assessment Quality Assurance
- Accreditation Evidence
- Institutional Audit
- Report Generation

The evaluator operates through the following system role chain:

> Academic Moderation → Assessment Quality Assurance → OBE Evaluation → Accreditation Review

Report output is suitable for:

- NBA
- NAAC
- Academic Audits
- Examination Governance
- Curriculum Review
- QA Documentation
- Institutional Assessment Review

### 1.2 Report Template Immutability Rule

The report structure is **immutable**. The evaluator:

**Shall NOT:**
- Rename, remove, merge, or reorder sections
- Modify section numbering
- Remove tables
- Replace tables with summaries or narrative text
- Condense phases
- Alter the evaluation architecture

**MAY vary:**
- Scores, Percentages, Findings, Calculations
- Recommendations, Confidence Levels, Moderation Decisions

### 1.3 Fixed Output Architecture (15 Phases)

Every evaluation produces exactly these 15 phases, in this order:

| # | Phase |
|---|--------|
| 1 | Executive Summary |
| 2 | Question Bank Extraction |
| 3 | Structural Compliance Index (SCI) |
| 4 | Metadata Integrity Index (MII) |
| 5 | Bloom Distribution Index (BDI) |
| 6 | Coverage Validation Index (CVI) |
| 7 | Marks Complexity Alignment Index (MCAI) |
| 8 | Difficulty Balance Index (DBI) |
| 9 | Question Construction Quality Index (QCQI) |
| 10 | Constructive Alignment Index (CAI) |
| 11 | Academic Moderation Index (AMI) |
| 12 | Future Readiness Index (FRI) |
| 13 | Overall Quality Index Computation |
| 14 | Confidence Index |
| 15 | Final Verdict |

### 1.4 Mandatory Table Preservation Rule

- **Reproduce ALL tables** exactly as specified
- Preserve headings, column structures, numbering, and audit structures
- **Rows** may be added (for additional data points)
- **Columns** shall NOT be removed
- Missing information → report as "Unable to Verify" or "N/A"
- Narrative text shall **NOT** replace tables

---

## 2. Evidence Governance and Validation Protocol

### 2.1 Zero Fabrication Policy

The evaluator shall **NEVER** invent, estimate, fabricate, assume, or infer unsupported information.

**Items requiring direct evidence:**

- Course Outcomes (CO)
- Program Outcomes (PO)
- Performance Indicators (PI)
- Bloom's Taxonomy levels
- Difficulty levels
- Marks allocation
- Metadata completeness
- Coverage percentages
- Mappings (CO–PO, CO–PI, etc.)
- Accreditation mappings
- Statistical values
- Index values
- Quality scores

If evidence is unavailable → report **"Unable to Verify"**.

### 2.2 Missing Data Protocol (5 Steps)

1. **Identify** — Detect the missing information
2. **Record** — Mark as "Unable to Verify"
3. **Document** — Record what evidence is missing
4. **Reduce** — Decrease the confidence score proportionally
5. **Continue** — Proceed using only verified evidence

### 2.3 Evidence Hierarchy (5 Levels)

| Level | Type | Description |
|-------|------|-------------|
| 1 | Direct Evidence | Explicitly stated in the Question Bank |
| 2 | Metadata Evidence | Present in course documentation |
| 3 | Calculated Evidence | Derived via objective calculations |
| 4 | Professional Judgement | Based on moderation expertise |
| 5 | Unsupported Evidence | **NOT** reported as verified |

### 2.4 Evidence Traceability Requirement

Every finding must include:

- **Source Reference** — Where the evidence originates
- **Supporting Evidence** — The data that supports the finding
- **Evaluation Logic** — How the conclusion was reached
- **Educational Interpretation** — What it means for teaching/learning
- **Recommendation** — What action should be taken

### 2.5 Mandatory Moderation Chain

```
Observation
    ⇓
Evidence
    ⇓
Educational Significance
    ⇓
Recommendation
```

### 2.6 Standard Moderation Record Format

| Component | Required Content |
|-----------|------------------|
| Observation | Issue, strength, gap, inconsistency, or finding |
| Evidence | Supporting data, calculations, mappings, or references |
| Educational Significance | Impact on learning, assessment validity, fairness, or outcomes |
| Recommendation | Specific improvement action |
| Priority | Critical, Major, Moderate, or Minor |

### 2.7 Confidence Framework

**Confidence Score Formula:**

$$
\text{Confidence Score} = \frac{\text{Verified Evidence Items}}{\text{Required Evidence Items}}
$$

$$
\text{Confidence Percentage} = \text{Confidence Score} \times 100
$$

**Confidence Classification Matrix:**

| Classification | Range | Interpretation |
|---------------|-------|----------------|
| Very High | 90–100% | Direct evidence available with complete verification |
| High | 80–89% | Strong evidence with limited inference |
| Medium | 65–79% | Moderate evidence available |
| Low | 50–64% | Significant evidence gaps present |
| Very Low | Below 50% | Insufficient evidence for reliable conclusions |

**Every phase** must report: Confidence Score + Confidence Percentage + Classification + Justification (both numerical and interpretive forms).

### 2.8 Validation Requirement

Before reporting any finding, verify:

1. **Evidence Exists** — The data is available
2. **Is Traceable** — The source is identifiable
3. **Calculation Reproducible** — The same inputs produce the same outputs
4. **Interpretation Supported** — The conclusion follows from the evidence
5. **Recommendation Actionable** — The suggested action can be implemented

---

## 3. Institutional Index Computation Framework

### 3.1 Standardization

All indices conform to:

$$
0.00 \leq \text{Index} \leq 1.00
$$

### 3.2 Index Interpretation Matrix (Universal — applies to ALL indices)

| Range | Classification | Interpretation |
|-------|---------------|----------------|
| 0.90–1.00 | Exemplary | Outstanding compliance and academic quality |
| 0.80–0.89 | Highly Effective | Strong compliance, minor improvements required |
| 0.70–0.79 | Effective | Acceptable quality, moderate enhancement opportunities |
| 0.60–0.69 | Acceptable | Minimum acceptable quality level |
| 0.50–0.59 | Needs Improvement | Significant improvements required |
| Below 0.50 | Major Revision Required | Assessment quality concerns present |

### 3.3 Structural Compliance Index (SCI)

**Purpose:** Measures compliance with required question bank structure.

**Formula:**

$$
\text{SCI} = \frac{\text{Structural Elements Present}}{\text{Required Structural Elements}}
$$

**Structural Elements (10):**
1. Course Information
2. Question Numbering
3. Marks Allocation
4. CO Mapping
5. Bloom Mapping
6. Difficulty Mapping
7. Section Labels
8. Assessment Instructions
9. Metadata Consistency
10. Question Formatting

### 3.4 Metadata Integrity Index (MII) — First Definition

**Purpose:** Measures completeness and correctness of metadata.

**Formula:**

$$
\text{MII} = \frac{\text{Verified Metadata Fields}}{\text{Required Metadata Fields}}
$$

**Required Fields:**
- CO (Course Outcome)
- PO (Program Outcome)
- PI (Program Indicator)
- Bloom Level
- Difficulty
- Marks
- Question Type

> **Note:** A more detailed composite formula for MII is defined in [Section 6](#6-metadata-integrity-and-attribute-accuracy-audit-engine).

### 3.5 Bloom Distribution Index (BDI)

**Purpose:** Measures cognitive balance across Bloom's Taxonomy levels.

**Formula:**

$$
\text{BDI} = 1 - \frac{\sum |\text{Observed} - \text{Expected}|}{2}
$$

**Expected Distribution:** Institutional policy, or Uniform Distribution if none is specified.

### 3.6 Coverage Validation Index (CVI)

**Purpose:** Measures learning outcome coverage.

**Formula:**

$$
\text{CVI} = \frac{\text{Covered Outcomes}}{\text{Total Outcomes}}
$$

Coverage includes: Course Outcomes.

### 3.7 Marks Complexity Alignment Index (MCAI)

**Purpose:** Measures alignment between marks and cognitive demand.

**Formula:**

$$
\text{MCAI} = \frac{\text{Correctly Aligned Questions}}{\text{Total Questions}}
$$

A question is aligned when marks allocation matches expected Bloom complexity.

### 3.8 Difficulty Balance Index (DBI)

**Purpose:** Measures balance between Easy, Medium, and Hard questions.

**Formula:**

$$
\text{DBI} = 1 - \frac{\sum |\text{Observed} - \text{Expected}|}{2}
$$

**Expected Distribution:** Institutional assessment policy.

### 3.9 Question Construction Quality Index (QCQI)

**Purpose:** Measures question writing quality.

**Formula:**

$$
\text{QCQI} = \frac{\text{Clarity} + \text{Precision} + \text{TechnicalAccuracy} + \text{Context} + \text{Validity} + \text{Alignment} + \text{Fairness}}{7}
$$

Each component: $0.00 \leq \text{Score} \leq 1.00$

### 3.10 Constructive Alignment Index (CAI)

**Purpose:** Measures alignment between learning outcomes and assessment.

**Formula:**

$$
\text{CAI} = \frac{\text{Aligned Questions}}{\text{Total Questions}}
$$

Verifies:
- CO Consistency
- Bloom Consistency
- Learning Activity Consistency
- Evidence Traceability

### 3.11 Academic Moderation Index (AMI)

**Purpose:** Measures moderation compliance.

**Formula:**

$$
\text{AMI} = \frac{\text{Moderation Criteria Satisfied}}{\text{Total Moderation Criteria}}
$$

**Criteria:**
- Validity
- Reliability
- Fairness
- Transparency
- Traceability

### 3.12 Future Readiness Index (FRI)

**Purpose:** Measures future-oriented assessment quality.

**Formula:**

$$
\text{FRI} = \frac{\text{Future Ready Criteria Satisfied}}{\text{Total Future Ready Criteria}}
$$

**Criteria:**
- HOTS Coverage
- Industry Relevance
- Employability Skills
- Problem Solving
- Innovation
- Critical Thinking

### 3.13 Question Paper Quality Index (QPQI) — First Definition

**Formula (preliminary weights):**

$$
\begin{aligned}
\text{QPQI} = & (0.10 \times \text{SCI}) + (0.10 \times \text{MII}) + (0.15 \times \text{BDI}) + (0.10 \times \text{CVI}) \\
& + (0.10 \times \text{MCAI}) + (0.10 \times \text{DBI}) + (0.15 \times \text{QCQI}) \\
& + (0.10 \times \text{CAI}) + (0.05 \times \text{AMI}) + (0.05 \times \text{FRI})
\end{aligned}
$$

$$
0.00 \leq \text{QPQI} \leq 1.00
$$

> **Note:** A fully specified version with weights table appears in [Section 11](#11-master-quality-index-and-final-report-engine).

### 3.14 Mandatory Index Reporting Table

| Index | Value | Classification | Confidence |
|-------|-------|----------------|------------|
| SCI | | | |
| MII | | | |
| BDI | | | |
| CVI | | | |
| MCAI | | | |
| DBI | | | |
| QCQI | | | |
| CAI | | | |
| AMI | | | |
| FRI | | | |
| **QPQI** | | | |

### 3.15 Index Missing Data Rule

If an index cannot be calculated:
1. Report as **N/A**
2. Explain which inputs are missing
3. Reduce the confidence score
4. Preserve the table structure
5. **Never** estimate or fabricate the missing data

---

## 4. Question Bank Extraction and Normalization Engine

### 4.1 Core Principle

- **ALL** evaluations begin with extraction
- **No** evaluation shall proceed before extraction is complete
- The extracted dataset is the **single source of truth** for ALL subsequent analyses

### 4.2 Mandatory Extraction Workflow (7 Stages)

| Stage | Description |
|-------|-------------|
| 1. Question Identification | Identify each distinct assessment item |
| 2. Question Segmentation | Separate questions, parts, and sub-parts |
| 3. Metadata Extraction | Extract CO, PO, PI, Bloom, Difficulty, Marks, Type |
| 4. Question Classification | Classify by type and cognitive level |
| 5. Attribute Verification | Verify each attribute against source evidence |
| 6. Dataset Construction | Build the master extraction table |
| 7. Extraction Validation | Validate completeness and accuracy of extraction |

### 4.3 Master Question Extraction Table

| QID | Question Text | Marks | CO | PO | PI | RBT | Difficulty |
|-----|---------------|-------|----|----|----|-----|------------|
| | | | | | | | |

> **Mandatory:** All subsequent analyses are based on this table.

### 4.4 Required Extraction Attributes

| Attribute | Description |
|-----------|-------------|
| Question ID | Unique identifier |
| Question Text | Full statement of the question |
| Marks | Assigned marks |
| CO | Course Outcome mapping |
| PO | Program Outcome mapping |
| PI | Program Indicator mapping |
| Bloom Level | Declared or verified RBT level |
| Difficulty Level | Easy, Medium, or Hard |
| Question Type | Theory, Numerical, Case Study, Design, Practical |

### 4.5 Extraction Status Codes

| Code | Interpretation |
|------|----------------|
| V | Verified |
| PV | Partially Verified |
| UV | Unable to Verify |
| M | Missing Data |

### 4.6 Attribute Validation Rules

| Attribute | Validation Requirement |
|-----------|------------------------|
| Marks | Marks explicitly stated |
| CO | Supported by documentation |
| PO | Supported by documentation |
| PI | Supported by documentation |
| Bloom Level | Consistent with command verb |
| Difficulty | Consistent with cognitive complexity |
| Question Type | Correctly classified |

### 4.7 Bloom Verification Rule

Verify each classification against:
- Command verb used in the question
- Expected student response
- Cognitive complexity required

If a conflict is found with any of the above or with marks allocation, record **"Bloom Classification Error"** and document the recommended correction.

### 4.8 Difficulty Validation Rule

Verify against:
- Bloom Level
- Expected Effort
- Marks Allocation
- Complexity of Reasoning

If inconsistency is detected, record **"Difficulty Classification Error"**.

### 4.9 Extraction Completeness Score (ECS)

$$
\text{ECS} = \frac{\text{Successfully Extracted Attributes}}{\text{Required Attributes}}
$$

$$
0.00 \leq \text{ECS} \leq 1.00
$$

### 4.10 Extraction Quality Index (EQI)

$$
\text{EQI} = \frac{\text{Verified Attributes}}{\text{Extracted Attributes}}
$$

$$
0.00 \leq \text{EQI} \leq 1.00
$$

### 4.11 Extraction Summary Report

| Metric | Value |
|--------|-------|
| Total Questions | |
| Total Marks | |
| Verified Questions | |
| Partially Verified Questions | |
| Unable to Verify Questions | |
| Missing Data Questions | |
| Extraction Completeness Score (ECS) | |
| Extraction Quality Index (EQI) | |

---

## 5. Coverage Analysis and Outcome Attainment Engine

Evaluates:
- Course Outcome Coverage
- Marks Distribution
- Assessment Weightage
- Coverage Gaps
- Outcome Attainment Potential

### 5.1 CO Coverage Formula

$$
\text{CO Coverage} = \frac{\text{Covered Course Outcomes}}{\text{Total Course Outcomes}}
$$

$$
0.00 \leq \text{CO Coverage} \leq 1.00
$$

### 5.2 Course Outcome Coverage Table

| CO | Questions Mapped | Marks | Coverage Status | Coverage % |
|----|------------------|-------|-----------------|------------|
| CO1 | | | | |
| CO2 | | | | |
| CO3 | | | | |
| CO4 | | | | |
| CO5 | | | | |
| CO6 | | | | |

### 5.3 Marks Distribution Analysis

$$
\text{Marks Distribution} = \frac{\text{Marks Assigned To Category}}{\text{Total Marks}}
$$

### 5.4 Marks Distribution Table

| Category | Marks | Percentage |
|----------|-------|------------|
| CO1 | | |
| CO2 | | |
| CO3 | | |
| CO4 | | |
| CO5 | | |
| CO6 | | |

### 5.5 Coverage Gap Analysis

A gap exists when:
- Coverage < 0.80, OR
- A CO receives insufficient or no assessment evidence

### 5.6 Coverage Gap Table

| Area | Gap Type | Educational Risk |
|------|----------|------------------|
| | | |

### 5.7 Outcome Attainment Potential

| Rating | Interpretation |
|--------|----------------|
| High | Strong evidence available for attainment measurement |
| Moderate | Partial evidence available |
| Low | Insufficient evidence available |

### 5.8 Attainment Analysis Table

| CO | Coverage | Evidence Strength | Attainment Potential |
|----|----------|-------------------|----------------------|
| CO1 | | | |
| CO2 | | | |
| CO3 | | | |
| CO4 | | | |
| CO5 | | | |
| CO6 | | | |

### 5.9 Coverage Validation Index (CVI)

Note: CVI is equivalent to CO Coverage.

$$
\text{CVI} = \frac{\text{Covered Course Outcomes}}{\text{Total Course Outcomes}} = \text{CO Coverage}
$$

### 5.10 Coverage Validation Index Report

| Metric | Value |
|--------|-------|
| CO Coverage | |
| Coverage Validation Index (CVI) | |
| Classification | |
| Confidence | |

### 5.11 Coverage Moderation Commentary

Each entry must follow the moderation chain:

| Component | Content |
|-----------|---------|
| Observation | Coverage finding |
| Evidence | Supporting data |
| Educational Significance | Impact on learning |
| Recommendation | Improvement action |

Identify:
- **Strongly Covered Areas**
- **Underrepresented Areas**
- **Missing Learning Areas**
- **Outcome Risks**
- **Improvement Opportunities**

---

## 6. Metadata Integrity and Attribute Accuracy Audit Engine

Audits:
- CO Mapping
- PO Mapping
- PI Mapping
- Bloom Classification
- Difficulty Classification
- Marks Allocation
- Question Type
- Metadata Completeness
- Metadata Consistency

### 6.1 Metadata Validation Framework

| Attribute | Validation Requirement |
|-----------|------------------------|
| CO Mapping | Matches documented Course Outcome |
| PO Mapping | Matches documented Program Outcome |
| PI Mapping | Matches documented Program Indicator |
| Bloom Level | Consistent with command verb and cognitive demand |
| Difficulty | Consistent with Bloom level and complexity |
| Marks | Consistent with expected effort and depth |
| Question Type | Correctly classified |

### 6.2 Question-Level Metadata Audit Table

| QID | CO | PO | PI | RBT | Difficulty | Status | Remarks |
|-----|----|----|----|-----|------------|--------|---------|
| | | | | | | | |

### 6.3 CO Accuracy (COA)

$$
\text{COA} = \frac{\text{Correct CO Mappings}}{\text{Total CO Mappings}}
$$

$$
0.00 \leq \text{COA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned CO | Verified CO | Status |
|----------|-------------|-------------|--------|
| | | | |

### 6.4 PO Accuracy (POA)

$$
\text{POA} = \frac{\text{Correct PO Mappings}}{\text{Total PO Mappings}}
$$

$$
0.00 \leq \text{POA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned PO | Verified PO | Status |
|----------|-------------|-------------|--------|
| | | | |

### 6.5 PI Accuracy (PIA)

$$
\text{PIA} = \frac{\text{Correct PI Mappings}}{\text{Total PI Mappings}}
$$

$$
0.00 \leq \text{PIA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned PI | Verified PI | Status |
|----------|-------------|-------------|--------|
| | | | |

### 6.6 Bloom Accuracy (RBTA)

$$
\text{RBTA} = \frac{\text{Correct Bloom Classifications}}{\text{Total Bloom Classifications}}
$$

$$
0.00 \leq \text{RBTA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned RBT | Verified RBT | Status | Comment |
|----------|--------------|--------------|--------|---------|
| | | | | |

### 6.7 Difficulty Accuracy (DA)

$$
\text{DA} = \frac{\text{Correct Difficulty Classifications}}{\text{Total Difficulty Classifications}}
$$

$$
0.00 \leq \text{DA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned Difficulty | Verified Difficulty | Status |
|----------|---------------------|--------------------|--------|
| | | | |

### 6.8 Marks Allocation Accuracy (MAA)

$$
\text{MAA} = \frac{\text{Correct Marks Allocations}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{MAA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned Marks | Expected Marks | Status |
|----------|----------------|----------------|--------|
| | | | |

### 6.9 Question Type Accuracy (QTA)

$$
\text{QTA} = \frac{\text{Correct Classifications}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{QTA} \leq 1.00
$$

**Audit Table:**

| Question | Assigned Type | Verified Type | Status |
|----------|---------------|---------------|--------|
| | | | |

### 6.10 Metadata Completeness (MC)

$$
\text{MC} = \frac{\text{Available Metadata Fields}}{\text{Required Metadata Fields}}
$$

$$
0.00 \leq \text{MC} \leq 1.00
$$

### 6.11 Metadata Consistency (MCS)

$$
\text{MCS} = \frac{\text{Consistent Metadata Entries}}{\text{Total Metadata Entries}}
$$

$$
0.00 \leq \text{MCS} \leq 1.00
$$

### 6.12 Metadata Integrity Index (MII) — Composite Formula

$$
\text{MII} = \frac{\text{COA} + \text{POA} + \text{PIA} + \text{RBTA} + \text{DA} + \text{MAA} + \text{QTA} + \text{MC} + \text{MCS}}{9}
$$

$$
0.00 \leq \text{MII} \leq 1.00
$$

### 6.13 Metadata Integrity Report

| Metric | Value |
|--------|-------|
| CO Accuracy (COA) | |
| PO Accuracy (POA) | |
| PI Accuracy (PIA) | |
| Bloom Accuracy (RBTA) | |
| Difficulty Accuracy (DA) | |
| Marks Accuracy (MAA) | |
| Question Type Accuracy (QTA) | |
| Metadata Completeness (MC) | |
| Metadata Consistency (MCS) | |
| **Metadata Integrity Index (MII)** | |
| Classification | |
| Confidence | |

### 6.14 Metadata Risk Register

| Finding | Risk | Priority |
|---------|------|----------|
| | | |

---

## 7. Bloom Taxonomy and Cognitive Complexity Analysis Engine

### 7.1 Bloom Taxonomy Validation Matrix

| Bloom Level | Typical Command Verbs |
|-------------|----------------------|
| Remember | Define, List, Recall, State, Identify, Label |
| Understand | Explain, Describe, Discuss, Summarize, Interpret |
| Apply | Use, Implement, Solve, Execute, Demonstrate |
| Analyze | Compare, Differentiate, Investigate, Categorize |
| Evaluate | Assess, Critique, Justify, Recommend, Validate |
| Create | Design, Develop, Construct, Propose, Formulate |

### 7.2 Bloom Distribution Table

| Bloom Level | Questions | Marks | Percentage |
|-------------|-----------|-------|------------|
| Remember | | | |
| Understand | | | |
| Apply | | | |
| Analyze | | | |
| Evaluate | | | |
| Create | | | |

### 7.3 LOTS and HOTS Classification

**LOTS (Lower Order Thinking Skills):** Remember, Understand, Apply

$$
\text{LOTS} = \frac{\text{LOTS Questions}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{LOTS} \leq 1.00
$$

**HOTS (Higher Order Thinking Skills):** Analyze, Evaluate, Create

$$
\text{HOTS} = \frac{\text{HOTS Questions}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{HOTS} \leq 1.00
$$

### 7.4 LOTS / HOTS Analysis Table

| Category | Questions | Percentage |
|----------|-----------|------------|
| LOTS | | |
| HOTS | | |

### 7.5 Cognitive Balance Ratio (CBR)

$$
\text{CBR} = \frac{\text{HOTS}}{\text{LOTS}}
$$

| CBR Value | Interpretation |
|-----------|----------------|
| CBR < 0.50 | Excessive lower-order emphasis |
| CBR = 0.50–1.00 | Balanced cognition |
| CBR > 1.00 | Strong higher-order emphasis |

### 7.6 Bloom Alignment Audit Table

| Question | Assigned RBT | Verified RBT | Status |
|----------|--------------|--------------|--------|
| | | | |

### 7.7 Expected Bloom Distribution

Default distribution (when no institutional policy is specified):

| Bloom Level | Expected Percentage |
|-------------|---------------------|
| Remember | 10% |
| Understand | 20% |
| Apply | 25% |
| Analyze | 20% |
| Evaluate | 15% |
| Create | 10% |

### 7.8 Bloom Distribution Deviation

$$
\text{Deviation} = \sum |\text{Observed} - \text{Expected}|
$$

Lower values indicate stronger cognitive balance.

### 7.9 Bloom Distribution Index (BDI) — Full Definition

$$
\text{BDI} = 1 - \frac{\sum |\text{Observed} - \text{Expected}|}{2}
$$

$$
0.00 \leq \text{BDI} \leq 1.00
$$

Higher values indicate stronger cognitive balance.

### 7.10 Bloom Distribution Index Report

| Metric | Value |
|--------|-------|
| LOTS Coverage | |
| HOTS Coverage | |
| Cognitive Balance Ratio | |
| Bloom Deviation | |
| **Bloom Distribution Index (BDI)** | |
| Classification | |
| Confidence | |

### 7.11 Cognitive Risk Register

| Finding | Educational Risk | Priority |
|---------|------------------|----------|
| | | |

---

## 8. Difficulty and Marks Complexity Analysis Engine

### 8.1 Difficulty Validation Matrix

| Bloom Level | Easy | Medium | Hard |
|-------------|------|--------|------|
| Remember | ✓ | — | — |
| Understand | ✓ | ✓ | — |
| Apply | — | ✓ | ✓ |
| Analyze | — | ✓ | ✓ |
| Evaluate | — | — | ✓ |
| Create | — | — | ✓ |

### 8.2 Difficulty Distribution Table

| Difficulty | Questions | Marks | Percentage |
|------------|-----------|-------|------------|
| Easy | | | |
| Medium | | | |
| Hard | | | |

### 8.3 Expected Difficulty Distribution

Default (when no institutional policy is specified):

| Difficulty Level | Expected Percentage |
|------------------|---------------------|
| Easy | 30% |
| Medium | 50% |
| Hard | 20% |

### 8.4 Difficulty Distribution Deviation

$$
\text{Deviation} = \sum |\text{Observed} - \text{Expected}|
$$

Lower values indicate stronger balance.

### 8.5 Difficulty Balance Index (DBI) — Full Definition

$$
\text{DBI} = 1 - \frac{\sum |\text{Observed} - \text{Expected}|}{2}
$$

$$
0.00 \leq \text{DBI} \leq 1.00
$$

Higher values indicate stronger difficulty balance.

### 8.6 Marks Complexity Validation Matrix

| Marks Range | Expected Cognitive Level |
|-------------|--------------------------|
| 1–2 Marks | Remember / Understand |
| 3–5 Marks | Understand / Apply |
| 6–8 Marks | Apply / Analyze |
| 9–12 Marks | Analyze / Evaluate |
| 13+ Marks | Evaluate / Create |

### 8.7 Marks Complexity Alignment Audit Table

| Question | Marks | Bloom Level | Alignment Status | Comment |
|----------|-------|-------------|------------------|---------|
| | | | | |

### 8.8 Marks Complexity Alignment Index (MCAI)

$$
\text{MCAI} = \frac{\text{Correctly Aligned Questions}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{MCAI} \leq 1.00
$$

A question is **aligned** when:
- Marks match expected cognitive demand
- Bloom level supports marks allocation
- Expected effort matches assessment value

### 8.9 Assessment Rigor Analysis

| Classification | Interpretation |
|----------------|----------------|
| Very High | Strong cognitive challenge and depth |
| High | Appropriate rigor with limited weaknesses |
| Moderate | Balanced but improvement possible |
| Low | Insufficient challenge |
| Very Low | Minimal cognitive demand |

### 8.10 Difficulty Balance Index Report

| Metric | Value |
|--------|-------|
| Easy Question Percentage | |
| Medium Question Percentage | |
| Hard Question Percentage | |
| Difficulty Deviation | |
| **Difficulty Balance Index (DBI)** | |
| Classification | |
| Confidence | |

### 8.11 Marks Complexity Alignment Report

| Metric | Value |
|--------|-------|
| Total Questions | |
| Aligned Questions | |
| Misaligned Questions | |
| **Marks Complexity Alignment Index (MCAI)** | |
| Classification | |
| Confidence | |

### 8.12 Difficulty and Complexity Risk Register

| Finding | Educational Risk | Priority |
|---------|------------------|----------|
| | | |

---

## 9. Question Construction Quality Evaluation Engine

### 9.1 Question Quality Evaluation Dimensions

| Dimension | Evaluation Requirement |
|-----------|------------------------|
| Clarity | Question is understandable and unambiguous |
| Precision | Assessment task is clearly specified |
| Technical Accuracy | Subject matter content is correct |
| Context Adequacy | Sufficient information is provided |
| Bloom Alignment | Command verb supports intended RBT level |
| Assessment Validity | Question measures intended learning outcome |
| Constructive Alignment | Question aligns with CO and learning activities |
| Fairness | Question is unbiased and equitable |

### 9.2 Question Quality Scoring Scale

| Score | Interpretation |
|-------|----------------|
| 1.00 | Excellent |
| 0.80 | Good |
| 0.60 | Acceptable |
| 0.40 | Weak |
| 0.20 | Poor |
| 0.00 | Unacceptable |

### 9.3 Question-Level Quality Audit Table

| QID | Clarity | Precision | Accuracy | Context | Validity | Alignment | Fairness | Average |
|-----|---------|-----------|----------|---------|----------|-----------|----------|---------|
| | | | | | | | | |

### 9.4 Component Scoring Formulas

Each component is the average across all questions:

$$
\text{Clarity} = \frac{\sum \text{Question Clarity Scores}}{\text{Total Questions}}
$$

$$
\text{Precision} = \frac{\sum \text{Precision Scores}}{\text{Total Questions}}
$$

$$
\text{Technical Accuracy} = \frac{\sum \text{Accuracy Scores}}{\text{Total Questions}}
$$

$$
\text{Context Adequacy} = \frac{\sum \text{Context Scores}}{\text{Total Questions}}
$$

$$
\text{Assessment Validity} = \frac{\sum \text{Validity Scores}}{\text{Total Questions}}
$$

$$
\text{Question Alignment} = \frac{\sum \text{Alignment Scores}}{\text{Total Questions}}
$$

$$
\text{Fairness} = \frac{\sum \text{Fairness Scores}}{\text{Total Questions}}
$$

### 9.5 QCQI — Full Definition

$$
\text{QCQI} = \frac{
    \text{Clarity} + \text{Precision} + \text{TechnicalAccuracy} \\
    + \text{ContextAdequacy} + \text{AssessmentValidity} \\
    + \text{QuestionAlignment} + \text{Fairness}
}{7}
$$

$$
0.00 \leq \text{QCQI} \leq 1.00
$$

### 9.6 QCQI Computation Report

| Metric | Value |
|--------|-------|
| Clarity Score | |
| Precision Score | |
| Technical Accuracy Score | |
| Context Adequacy Score | |
| Assessment Validity Score | |
| Alignment Score | |
| Fairness Score | |
| **QCQI** | |
| Classification | |
| Confidence | |

### 9.7 Question Quality Risk Register

| Finding | Educational Risk | Priority |
|---------|------------------|----------|
| | | |

### 9.8 Revision Candidate Identification

Any question with QCQI < 0.60 must be flagged for revision. Document for each:

- **Deficiency** — What aspect of quality is lacking
- **Evidence** — Supporting data from the audit
- **Educational Impact** — How this affects assessment validity
- **Recommended Revision** — Specific improvement action

---

## 10. Constructive Alignment, Academic Moderation and Future Readiness Engine

### 10.1 Alignment Chain

```
Course Outcome → Learning Activity → Assessment → Evidence
```

### 10.2 Constructive Alignment Audit Table

| Question | CO | Bloom | Learning Activity | Evidence Status |
|----------|----|-------|-------------------|-----------------|
| | | | | |

### 10.3 Alignment Rating Scale

| Rating | Interpretation |
|--------|----------------|
| Excellent | Full observable alignment |
| Good | Minor alignment gaps |
| Moderate | Partial alignment |
| Weak | Significant deficiencies |
| Poor | No observable alignment |

### 10.4 Constructive Alignment Index (CAI)

$$
\text{CAI} = \frac{\text{Aligned Questions}}{\text{Total Questions}}
$$

$$
0.00 \leq \text{CAI} \leq 1.00
$$

A question is **aligned** when:
- CO Mapping is Valid
- Bloom Classification is Appropriate
- Learning Evidence is Observable
- Assessment Measures Intended Outcome

### 10.5 Constructive Alignment Report

| Metric | Value |
|--------|-------|
| Aligned Questions | |
| Misaligned Questions | |
| **Constructive Alignment Index (CAI)** | |
| Classification | |
| Confidence | |

### 10.6 Academic Moderation Analysis

#### 10.6.1 Moderation Criteria

| Criterion | Evaluation Requirement |
|-----------|------------------------|
| Validity | Measures intended learning outcomes |
| Reliability | Produces consistent assessment evidence |
| Fairness | Equitable for all learners |
| Transparency | Assessment expectations are clear |
| Traceability | Evidence linked to outcomes |
| Consistency | Assessment design is coherent |
| Governance Compliance | Institutional standards satisfied |

#### 10.6.2 Moderation Audit Table

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Validity | | |
| Reliability | | |
| Fairness | | |
| Transparency | | |
| Traceability | | |
| Consistency | | |
| Governance Compliance | | |

#### 10.6.3 Academic Moderation Index (AMI)

$$
\text{AMI} = \frac{\text{Moderation Criteria Satisfied}}{\text{Total Moderation Criteria}}
$$

$$
0.00 \leq \text{AMI} \leq 1.00
$$

#### 10.6.4 Academic Moderation Report

| Metric | Value |
|--------|-------|
| Criteria Satisfied | |
| Criteria Not Satisfied | |
| **Academic Moderation Index (AMI)** | |
| Classification | |
| Confidence | |

### 10.7 Future Readiness Analysis

#### 10.7.1 Future Readiness Criteria

| Criterion | Description |
|-----------|-------------|
| Problem Solving | Real-world problem solving |
| Critical Thinking | Analytical reasoning |
| Innovation | Creative solution development |
| Industry Relevance | Professional applicability |
| Graduate Attributes | Graduate competency support |
| Employability Skills | Career readiness |
| HOTS Integration | Higher-order thinking support |

#### 10.7.2 Future Readiness Audit Table

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Problem Solving | | |
| Critical Thinking | | |
| Innovation | | |
| Industry Relevance | | |
| Graduate Attributes | | |
| Employability Skills | | |
| HOTS Integration | | |

#### 10.7.3 Future Readiness Index (FRI)

$$
\text{FRI} = \frac{\text{Future Ready Criteria Satisfied}}{\text{Total Future Ready Criteria}}
$$

$$
0.00 \leq \text{FRI} \leq 1.00
$$

#### 10.7.4 Future Readiness Report

| Metric | Value |
|--------|-------|
| Criteria Satisfied | |
| Criteria Not Satisfied | |
| **Future Readiness Index (FRI)** | |
| Classification | |
| Confidence | |

### 10.8 Strategic Risk Register

| Finding | Institutional Risk | Priority |
|---------|-------------------|----------|
| | | |

---

## 11. Master Quality Index and Final Report Engine

### 11.1 Master Index Summary (with Weights)

| Index | Value | Classification | Weight |
|-------|-------|----------------|--------|
| SCI | | | 10% |
| MII | | | 10% |
| BDI | | | 15% |
| CVI | | | 10% |
| MCAI | | | 10% |
| DBI | | | 10% |
| QCQI | | | 15% |
| CAI | | | 10% |
| AMI | | | 5% |
| FRI | | | 5% |

### 11.2 Question Paper Quality Index (QPQI) — Complete with All Weights

$$
\begin{aligned}
\text{QPQI} = & (0.10 \times \text{SCI}) + (0.10 \times \text{MII}) + (0.15 \times \text{BDI}) + (0.10 \times \text{CVI}) \\
& + (0.10 \times \text{MCAI}) + (0.10 \times \text{DBI}) + (0.15 \times \text{QCQI}) \\
& + (0.10 \times \text{CAI}) + (0.05 \times \text{AMI}) + (0.05 \times \text{FRI})
\end{aligned}
$$

$$
0.00 \leq \text{QPQI} \leq 1.00
$$

### 11.3 QPQI Calculation Table

| Index | Value | Weight | Weighted Score |
|-------|-------|--------|----------------|
| SCI | | 0.10 | |
| MII | | 0.10 | |
| BDI | | 0.15 | |
| CVI | | 0.10 | |
| MCAI | | 0.10 | |
| DBI | | 0.10 | |
| QCQI | | 0.15 | |
| CAI | | 0.10 | |
| AMI | | 0.05 | |
| FRI | | 0.05 | |
| **QPQI** | | **1.00** | |

### 11.4 Final Quality Classification Matrix

| QPQI Range | Classification |
|------------|----------------|
| 0.90–1.00 | Exemplary |
| 0.80–0.89 | Highly Effective |
| 0.70–0.79 | Effective |
| 0.60–0.69 | Acceptable |
| 0.50–0.59 | Needs Improvement |
| Below 0.50 | Major Revision Required |

### 11.5 Overall Confidence Index (OCI)

$$
\text{OCI} = \frac{
    \text{SCI}_c + \text{MII}_c + \text{BDI}_c + \text{CVI}_c + \text{MCAI}_c \\
    + \text{DBI}_c + \text{QCQI}_c + \text{CAI}_c + \text{AMI}_c + \text{FRI}_c
}{10}
$$

Where $\text{Index}_c$ = Confidence Score for that index.

$$
0.00 \leq \text{OCI} \leq 1.00
$$

### 11.6 Confidence Summary Table

| Metric | Value |
|--------|-------|
| SCI Confidence | |
| MII Confidence | |
| BDI Confidence | |
| CVI Confidence | |
| MCAI Confidence | |
| DBI Confidence | |
| QCQI Confidence | |
| CAI Confidence | |
| AMI Confidence | |
| FRI Confidence | |
| **Overall Confidence Index (OCI)** | |
| **Confidence Classification** | |

### 11.7 Institutional Strengths Table

| # | Strength Area | Evidence | Impact |
|---|---------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

### 11.8 Institutional Weaknesses Table

| # | Weakness Area | Evidence | Impact |
|---|---------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

### 11.9 Recommendation Register

| # | Finding | Evidence | Recommendation | Priority |
|---|---------|----------|----------------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### 11.10 Accreditation Readiness Assessment

| Dimension | Status |
|-----------|--------|
| OBE Compliance | |
| Bloom Alignment | |
| Constructive Alignment | |
| Assessment Quality | |
| Moderation Compliance | |
| Documentation Readiness | |
| NBA Readiness | |
| NAAC Readiness | |

### 11.11 Executive Summary

The evaluator provides:
- Overall Assessment Quality
- Key Strengths
- Key Weaknesses
- Major Risks
- Strategic Opportunities
- Accreditation Readiness
- Final Recommendation

### 11.12 Final Moderation Verdict

**Verdict Options:**

1. **Approved Without Modification**
2. **Approved With Minor Improvements**
3. **Approved Subject To Revision**
4. **Major Revision Required**
5. **Not Approved**

**Justification Structure:**

```
Observation
    ⇓
Evidence
    ⇓
Educational Significance
    ⇓
Recommendation
```

### 11.13 Final Governance Statement

UAF v3.3 integrates the following domains:

- Outcome-Based Education (OBE)
- Revised Bloom's Taxonomy
- Constructive Alignment
- Academic Moderation
- Assessment Quality Assurance
- Accreditation Readiness
- Institutional Governance
- Continuous Improvement

The framework preserves:
- **Structure** — 15-phase fixed output architecture
- **Tables** — All mandatory tables with full column structures
- **Numbering** — Section and phase numbering immutability
- **Calculations** — All formulas, weights, and indices as specified
- **Reporting Sequence** — Phases in immutable order
- **Governance Requirements** — Evidence hierarchy, moderation chain, confidence framework

---

*This document is an extraction of the Universal Academic Framework (UAF) v3.3 specification. All formulas, tables, classifications, workflows, and governance rules are reproduced verbatim from the authoritative source. This document serves as the single reference for implementing UAF v3.3 evaluations.*
