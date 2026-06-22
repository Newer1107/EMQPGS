# UAF AI Analysis Subsystem — Master Blueprint

> **Purpose:** Definitive, self-contained implementation guide for the UAF AI
> Analysis Subsystem within EMQPGS. Every section cross-references the source
> document where the detail lives. A reader can build the entire subsystem from
> this document alone but knows where to find deeper context.
>
> **Status:** Draft
> **Applies to:** UAF Analysis Pipeline, Dean Workspace, AI Provider Layer
> **Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Architecture](#2-complete-architecture)
3. [Complete Formula Catalog](#3-complete-formula-catalog)
4. [Complete Data Model](#4-complete-data-model)
5. [Complete Evaluation Flow](#5-complete-evaluation-flow)
6. [Complete AI Flow](#6-complete-ai-flow)
7. [Complete Persistence](#7-complete-persistence)
8. [Complete Prompt System](#8-complete-prompt-system)
9. [Complete API Design](#9-complete-api-design)
10. [Complete UI](#10-complete-ui)
11. [Complete Versioning](#11-complete-versioning)
12. [Complete Testing Strategy](#12-complete-testing-strategy)
13. [Complete Rollout Plan](#13-complete-rollout-plan)
14. [Risk Register for Implementation](#14-risk-register-for-implementation)
15. [Open Questions](#15-open-questions)
16. [Implementation Assumptions](#16-implementation-assumptions)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Document Cross-Reference Matrix](#18-document-cross-reference-matrix)

---

## 1. Executive Summary

### 1.1 What It Is

The UAF AI Analysis Subsystem is a new 8-stage pipeline within EMQPGS that
evaluates question bank quality using the Universal Academic Framework (UAF)
v3.3 methodology. It produces 11 academic indices, structured risk registers,
recommendations, and AI-interpreted narratives for the Dean's review workspace.

### 1.2 What Problem It Solves

Before this subsystem, EMQPGS had a basic `AiReport` service (see
`src/modules/reports/ai-report.service.ts`) that produced unstructured AI output
with no deterministic metric foundation, no reproducibility, no caching, no
versioning, and no structured prompt architecture. The Dean workspace had no
analytics — just raw paper generation.

This subsystem adds:
- **Deterministic-first architecture:** All 27 metric functions compute exact,
  reproducible values before any AI touches the data
- **EvidenceHash caching:** If the bank hasn't changed, Ollama calls are skipped
- **Full versioning:** Every analysis run is immutable and auditable
- **10 structured prompt modules:** Each with Zod-validated output schemas
- **Dean-grade UI:** Version comparison, index drill-down, AI attribution

### 1.3 Key Architectural Decisions

| Decision | Description | Source |
|---|---|---|
| 8-stage pipeline | EvidenceBuilder → MetricEngine → SnapshotBuilder → PromptBuilder → OllamaService → ResponseValidator → AnalysisBuilder → Persistence | ai-analysis-subsystem.md §2 |
| Deterministic-first | MetricEngine computes ALL 27 functions before any AI call | uaf-engineering-specification.md §1 |
| Ollama-only | Single AI provider (Qwen3.5:3b). Thin `AiProvider` interface for testability only | ai-analysis-subsystem.md §3 |
| EvidenceHash cache | SHA-256 hash of snapshot + engine version + prompt version. Cache hit skips all 10 AI modules | ai-analysis-subsystem.md §6 |
| 10 modular prompts | Sequential, independent modules each within their own 8K context window | ai-prompt-design.md §1 |
| Version everything | Evaluation engine, prompts, analysis schema, Ollama params all captured per version | ai-analysis-subsystem.md §7 |
| Prompt Registry in DB | PromptVersion table stores templates, output schemas, and context budgets | ai-analysis-subsystem.md §8 |
| Structured AI responses | Every module outputs Zod-validated JSON, not free-form paragraphs | ai-prompt-design.md §3 |
| Two-mode Dean workspace | Bank-level overview + per-paper variant analysis | dean-ai-review-workspace.md §1 |
| Existing AiReport coexistence | Old tables and services untouched. No migration required | ai-analysis-subsystem.md §14 |

---

## 2. Complete Architecture

### 2.1 System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EMQPGS System                                  │
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐       │
│  │  Dean     │    │  Coordinator │    │  System (COE, Cron)      │       │
│  │ (Faculty) │    │  (Faculty)   │    │  (auto-trigger)          │       │
│  └─────┬─────┘    └──────┬───────┘    └─────────────┬────────────┘       │
│        │                 │                           │                    │
│        │  View/Compare   │  Trigger analysis         │  Scheduled         │
│        │  Approve        │  Review results           │  re-analysis       │
│        ▼                 ▼                           ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                  EMQPGS (Existing System)                        │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │    │
│  │  │ Question     │  │ Question     │  │ Dean Review Workspace  │ │    │
│  │  │ Bank Mgmt   │  │ Paper Gen    │  │ (comparison, variant   │ │    │
│  │  │              │  │              │  │  selection, export)    │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │    │
│  │         │                 │                       │              │    │
│  │         └─────────────────┼───────────────────────┘              │    │
│  │                           │                                      │    │
│  │          ┌────────────────▼──────────────────────────┐           │    │
│  │          │     UAF Analysis Pipeline (New)            │           │    │
│  │          │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │           │    │
│  │          │  │Evidence- │ │Metric-   │ │Snapshot-   │ │           │    │
│  │          │  │Builder   │ │Engine    │ │Builder     │ │           │    │
│  │          │  └──────────┘ └──────────┘ └────────────┘ │           │    │
│  │          │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │           │    │
│  │          │  │Prompt-   │ │Ollama-   │ │Response-   │ │           │    │
│  │          │  │Builder   │ │Service   │ │Validator   │ │           │    │
│  │          │  └──────────┘ └──────────┘ └────────────┘ │           │    │
│  │          │  ┌──────────┐ ┌──────────┐                │           │    │
│  │          │  │Analysis- │ │Persist-  │                │           │    │
│  │          │  │Builder   │ │ence      │                │           │    │
│  │          │  └──────────┘ └──────────┘                │           │    │
│  │          └───────────────────────────────────────────┘           │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│     ┌──────────────────┐          ┌──────────────────────────┐          │
│     │  MySQL 8          │          │  MinIO Object Store      │          │
│     │  (Existing)       │          │  (Existing)              │          │
│     │  - QuestionBank  │          │  - Generated papers      │          │
│     │  - AiReport      │          │  - Export artifacts      │          │
│     │  - New tables    │          │                          │          │
│     └──────────────────┘          └──────────────────────────┘          │
│                                                                         │
│                    ┌──────────────────────┐                             │
│                    │  Ollama (External)    │                             │
│                    │  qwen3.5:3b           │                             │
│                    │  /api/generate        │                             │
│                    └──────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Source:** ai-analysis-subsystem.md §1 — System Context (C4 Level 1)

### 2.2 Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  UAF Analysis Pipeline (8 Containers)                    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     AiOrchestrator (Top-Level)                    │   │
│  │  Manages pipeline state, status transitions, cache checks,       │   │
│  │  error handling, version tracking                                │   │
│  └──────────────────────┬───────────────────────────────────────────┘   │
│                         │                                               │
│  ┌──────────────────────▼───────────────────────────────────────────┐   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │   │
│  │  │ Evidence-    │───▶│ MetricEngine │───▶│ SnapshotBuilder  │   │   │
│  │  │ Builder      │    │ (Determin-   │    │                  │   │   │
│  │  │              │    │  istic only) │    │                  │   │   │
│  │  └──────────────┘    └──────────────┘    └────────┬─────────┘   │   │
│  │                                                    │             │   │
│  │  ┌──────────────┐    ┌──────────────┐              │             │   │
│  │  │ Response-    │◀───│ OllamaService│◀───┌─────────▼────────┐   │   │
│  │  │ Validator    │    │              │    │  PromptBuilder   │   │   │
│  │  │              │    │              │    │                  │   │   │
│  │  └──────┬───────┘    └──────────────┘    └──────────────────┘   │   │
│  │         │                                                       │   │
│  │  ┌──────▼───────┐    ┌──────────────┐                          │   │
│  │  │ Analysis-    │───▶│ Persistence  │                          │   │
│  │  │ Builder      │    │              │                          │   │
│  │  └──────────────┘    └──────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  External Dependencies:                                                  │
│    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐        │
│    │  MySQL 8     │    │  MinIO       │    │  Ollama API      │        │
│    │  (Prisma)    │    │  (S3)        │    │  /api/generate   │        │
│    └──────────────┘    └──────────────┘    └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Source:** ai-analysis-subsystem.md §2 — Container Diagram (C4 Level 2)

### 2.3 Container Responsibilities

| Container | Responsibility | Defined In |
|---|---|---|
| **AiOrchestrator** | Top-level coordinator. Manages 8-stage pipeline, status transitions, error handling, cache checks. | ai-analysis-subsystem.md §3 |
| **EvidenceBuilder** | Collects raw data from QuestionBank + QuestionLibraryItem. Produces `RawBankData`. Does NOT compute metrics. | uaf-engineering-specification.md §3 |
| **MetricEngine** | Computes all 27 UAF metrics via deterministic formulas. No AI involvement. DAG-ordered execution. | uaf-engineering-specification.md §1-2 |
| **SnapshotBuilder** | Assembles `EvidenceSnapshot` from metrics + raw data. Computes `EvidenceHash`. | ai-analysis-subsystem.md §6 |
| **PromptBuilder** | Loads `PromptVersion` records from DB. Builds structured prompts from snapshot data. | ai-analysis-subsystem.md §8 |
| **OllamaService** | Sends prompts to Ollama. Manages timeouts, retry, and fallback. | ai-analysis-subsystem.md §3, §11 |
| **ResponseValidator** | Validates AI JSON output against Zod schemas. Runs 5 hallucination guards. | ai-analysis-subsystem.md §9-10 |
| **AnalysisBuilder** | Merges deterministic metrics + validated AI response into final `AnalysisSnapshot`. | ai-analysis-subsystem.md §3 |
| **Persistence** | Transactional writes to new DB tables. Saves all domain entities. | ai-analysis-subsystem.md §12 |
| **AiProvider** | Thin interface wrapping Ollama. Only container that knows about Ollama HTTP. Exists for testability. | ai-analysis-subsystem.md §3 |

### 2.4 Architecture Decision Log

#### ADR-1: Deterministic Engine Owns ALL Calculations

**Context:** The AI model could be tempted to compute metrics, leading to
non-reproducible results and hallucinated numbers.

**Decision:** The MetricEngine (27 compute functions) runs ALL calculations
before any AI call. The AI receives only pre-computed values, classifications,
and distributions. The AI NEVER performs arithmetic.

**Enforcement:** Three layers — input constraint (only final values sent),
prompt instructions (explicit "NEVER compute" rules), post-hoc validation
(Number Injection Guard drops modules with fabricated numbers).

**Source:** uaf-engineering-specification.md §1; ai-prompt-design.md §2.1

#### ADR-2: Ollama-Only with Thin Service Isolation

**Context:** Multi-provider abstractions (OpenAI, Anthropic, Ollama) add
complexity. EMQPGS has only Ollama available.

**Decision:** Single `AiProvider` interface with one Ollama implementation.
The interface exists ONLY for testability (mock in unit tests) and HTTP
concern isolation. No factory, no registry, no multi-provider support.

**Source:** ai-analysis-subsystem.md §3

#### ADR-3: EvidenceSnapshot Is the Exact AI Input (No Raw Bank Data)

**Context:** Sending raw QuestionBank data to the AI is wasteful (context
budget) and risks hallucination (too much unstructured data).

**Decision:** The `EvidenceSnapshot` is a curated, deterministic JSON blob
that contains ONLY pre-computed metrics, classifications, distributions,
and aggregate counts. The AI never sees raw question text or bank structure.

**Source:** uaf-domain-model.md §3.3; ai-analysis-subsystem.md §6

#### ADR-4: EvidenceHash as Cache Key

**Context:** Re-running analysis on an unchanged bank should return
immediately, not wait minutes for Ollama.

**Decision:** `evidenceHash = SHA-256(canonicalJson(snapshot) + engineVersion + promptVersion)`.
A cache hit (hash matches prior version) skips PromptBuilder, OllamaService,
and ResponseValidator. The prior AI output is restored from the DB.

**Source:** ai-analysis-subsystem.md §5-6

#### ADR-5: 10 Modular Prompts with Sequential Execution

**Context:** A single prompt with all 10 analysis modules would exceed the 8K
context window.

**Decision:** 10 independent prompt modules, each running sequentially in its
own 8K window. Each module receives only the evidence subset it needs. Module
independence means a failure in one module does not cascade.

**Source:** ai-prompt-design.md §1, §8

#### ADR-6: Version Everything for Reproducibility

**Context:** Without version capture, reproducing an old analysis is impossible.

**Decision:** Every `AnalysisVersion` captures: evaluationEngineVersion,
promptVersion, analysisSchemaVersion, ollamaModel, ollamaContext,
ollamaTemperature, evidenceHash, createdAt. All fields immutable once written.

**Source:** ai-analysis-subsystem.md §7; uaf-domain-model.md §3.2

#### ADR-7: Prompt Registry in DB (Not In-Memory)

**Context:** Prompt versions need audit trail, version control, and runtime
selectability.

**Decision:** `PromptVersion` is a first-class Prisma model stored in MySQL.
The `PromptBuilder` loads active versions at runtime via
`SELECT ... WHERE moduleId = :mid AND supersededAt IS NULL`.

**Source:** ai-analysis-subsystem.md §8; uaf-domain-model.md §3.9

#### ADR-8: Structured AI Responses (Not Paragraph-Heavy)

**Context:** Free-form paragraphs cannot be validated, compared, or
programmatically consumed.

**Decision:** Every module outputs a strict Zod-validated JSON schema
(using `.strict()`). Only Module 1 (Executive Summary) has predominantly
narrative output. All others produce structured arrays and enums.

**Source:** ai-prompt-design.md §3

#### ADR-9: Two-Mode Dean Workspace (Bank + Variant)

**Context:** The Dean needs both bank-level overview and per-paper variant
analysis in one workspace.

**Decision:** The workspace has two modes switched via query parameters:
`/dashboard/dean/review?bank={id}` for bank overview and
`/dashboard/dean/review?bank={id}&variant=A` for per-paper analysis.
No new top-level routes.

**Source:** dean-ai-review-workspace.md §1-5

#### ADR-10: Existing AiReport Coexistence (No Migration Required)

**Context:** The existing `AiReport` table has data from prior analyses.
Migrating it risks data loss and blocks deployment.

**Decision:** Old `AiReport` table and `AiReportService` remain untouched.
New system writes to separate tables. Optional backfill job if bandwidth
allows. Dean workspace reads from new tables only.

**Source:** ai-analysis-subsystem.md §14

---

## 3. Complete Formula Catalog

### 3.1 Index Formula Table

Every metric produces a `UAFMetric` with `value` clamped to `[0.00, 1.00]`,
a `classification` from the shared matrix, and a `ConfidenceScore`.

| Index | Formula | Source (Engineering Spec) | Pipeline Stage | Computation Order |
|---|---|---|---|---|
| SCI | `elements_present / required_elements` (10 required) | §1.4 computeSCI | MetricEngine | 2 |
| MII | `(COA+POA+PIA+RBTA+DA+MAA+QTA+MC+MCS)/9` | §1.4 computeMII | MetricEngine | 3 |
| BDI | `1 - Σ\|Observed - Expected\|/2` (6 Bloom levels) | §1.4 computeBDI | MetricEngine | 3 |
| CVI | `covered_outcomes / total_outcomes` | §1.4 computeCVI | MetricEngine | 2 |
| MCAI | `correctly_aligned / total_questions` | §1.4 computeMCAI | MetricEngine | 3 |
| DBI | `1 - Σ\|Observed - Expected\|/2` (3 difficulty levels) | §1.4 computeDBI | MetricEngine | 3 |
| QCQI | `(7-dimension mean)` | §1.5 computeQCQI | MetricEngine | 4 |
| CAI | `aligned_questions / total` | §1.5 computeCAI | MetricEngine | 5 |
| AMI | `criteria_satisfied / 7` | §1.5 computeAMI | MetricEngine | 5 |
| FRI | `criteria_satisfied / 7` | §1.5 computeFRI | MetricEngine | 5 |
| QPQI | Weighted composite of 10 indices (see §3.2) | §1.6 computeQPQI | MetricEngine | 6 |
| OCI | `mean of all 10 confidence scores` | §1.6 computeOCI | MetricEngine | 6 |
| Confidence | `verified_items / required_items` | §1.6 computeConfidenceScore | SnapshotBuilder | per-metric |
| ECS | `extracted_attributes / required` | §1.1 computeECS | MetricEngine | 1 |
| EQI | `verified_attributes / extracted` | §1.1 computeEQI | MetricEngine | 1 |

**Source:** uaf-engineering-specification.md §1.1-§1.6; uaf-framework-extraction.md §3-§11

### 3.2 QPQI Weighted Composite

```
QPQI = (0.10 × SCI) + (0.10 × MII) + (0.15 × BDI) + (0.10 × CVI)
     + (0.10 × MCAI) + (0.10 × DBI) + (0.15 × QCQI) + (0.10 × CAI)
     + (0.05 × AMI) + (0.05 × FRI)
```

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

**Source:** uaf-engineering-specification.md §1.6 computeQPQI;
uaf-framework-extraction.md §11.2

### 3.3 MII Sub-Metrics (9 Metrics)

Each is a `correct/total` ratio feeding into the MII composite:

| Sub-Metric | Formula | Source |
|---|---|---|
| COA (CO Accuracy) | `correct_CO_mappings / total_CO_mappings` | uaf-ee §1.2 computeCOA |
| POA (PO Accuracy) | `correct_PO_mappings / total_PO_mappings` | uaf-ee §1.2 computePOA |
| PIA (PI Accuracy) | `correct_PI_mappings / total_PI_mappings` | uaf-ee §1.2 computePIA |
| RBTA (Bloom Accuracy) | `correct_bloom / total_bloom` | uaf-ee §1.2 computeRBTA |
| DA (Difficulty Accuracy) | `correct_difficulty / total_difficulty` | uaf-ee §1.2 computeDA |
| MAA (Marks Accuracy) | `correct_marks / total_questions` | uaf-ee §1.2 computeMAA |
| QTA (Type Accuracy) | `correct_classifications / total_questions` | uaf-ee §1.2 computeQTA |
| MC (Metadata Completeness) | `available_fields / required_fields` | uaf-ee §1.2 computeMC |
| MCS (Metadata Consistency) | `consistent_entries / total_entries` | uaf-ee §1.2 computeMCS |

**Source:** uaf-engineering-specification.md §1.2; uaf-framework-extraction.md §6.3-§6.11

### 3.4 Bloom Sub-Metrics (3 Metrics)

| Sub-Metric | Formula | Source |
|---|---|---|
| LOTS | `LOTS_questions / total_questions` (Remember+Understand+Apply) | uaf-ee §1.3 computeLOTS |
| HOTS | `HOTS_questions / total_questions` (Analyze+Evaluate+Create) | uaf-ee §1.3 computeHOTS |
| CBR | `HOTS / LOTS`. Clamped to `[0.00,1.00]` for UAFMetric. Raw value in EvidenceSnapshot. Special case: if both 0, CBR = 0.50. | uaf-ee §1.3 computeCBR |

**Source:** uaf-engineering-specification.md §1.3; uaf-framework-extraction.md §7.3-§7.5

### 3.5 Expected Distributions

**Bloom (default, when no institutional policy):**

| Level | Expected |
|---|---|
| Remember | 10% |
| Understand | 20% |
| Apply | 25% |
| Analyze | 20% |
| Evaluate | 15% |
| Create | 10% |

**Difficulty (default):**

| Level | Expected |
|---|---|
| Easy | 30% |
| Medium | 50% |
| Hard | 20% |

**Source:** uaf-engineering-specification.md §1.4 (BDI, DBI); uaf-framework-extraction.md §7.7, §8.3

### 3.6 Classification Matrices

**Metric Classification (shared across all indices):**

| Value Range | Classification |
|---|---|
| 0.90 - 1.00 | EXEMPLARY |
| 0.80 - 0.89 | HIGHLY_EFFECTIVE |
| 0.70 - 0.79 | EFFECTIVE |
| 0.60 - 0.69 | ACCEPTABLE |
| 0.40 - 0.59 | NEEDS_IMPROVEMENT |
| 0.00 - 0.39 | MAJOR_REVISION |

**Confidence Classification:**

| Score Range | Classification |
|---|---|
| 0.95 - 1.00 | VERY_HIGH |
| 0.85 - 0.94 | HIGH |
| 0.70 - 0.84 | MEDIUM |
| 0.50 - 0.69 | LOW |
| 0.00 - 0.49 | VERY_LOW |

**Source:** uaf-engineering-specification.md §4; uaf-domain-model.md §4

### 3.7 QCQI Component Scores

```
QCQI = (Clarity + Precision + TechnicalAccuracy + ContextAdequacy
        + AssessmentValidity + QuestionAlignment + Fairness) / 7
```

Each component score = `Σ Question Scores / Total Questions`.
Each question score per component: 0.00, 0.20, 0.40, 0.60, 0.80, or 1.00.

**Source:** uaf-engineering-specification.md §1.5 computeQCQI; uaf-framework-extraction.md §9.2-§9.5

### 3.8 Failure Handling Per Formula

| Condition | Action | Source |
|---|---|---|
| Division by zero | Set `value = null`, confidence `VERY_LOW`, log warning | uaf-ee §6.2 |
| Null input | Set `value = null`, confidence `VERY_LOW`, log evidence gap | uaf-ee §6.2 |
| Out of range | Clamp to `[0.00, 1.00]`, log warning | uaf-ee §6.2 |
| Distribution != 1.00 | Normalize, log warning | uaf-ee §6.2 |
| MII sub-metric null | Exclude from average, reduce denominator | uaf-ee §6.2 |
| QPQI input null | Exclude, redistribute weight proportionally | uaf-ee §6.2 |

**Source:** uaf-engineering-specification.md §6 — Failure Mode Matrix

---

## 4. Complete Data Model

### 4.1 Entity Relationship Diagram

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
  AnalysisVersion       ──?:?──▶ PromptVersion (via promptVersion ref)
  UAFMetric             ──1:1──▶ ConfidenceScore
  PaperAnalysis         ──N:1──▶ GeneratedPaper (external)
  QuestionBank          ──1:N──▶ QuestionBankAnalysis
```

**Source:** uaf-domain-model.md §2 — Entity Relationship Map

### 4.2 Prisma Models (Key Fields)

| Model | Key Fields | Unique/Index | Source |
|---|---|---|---|
| **QuestionBankAnalysis** | id, questionBankId, version, status, triggeredById, startedAt, completedAt | `@@index([questionBankId, status])`, `@@index([questionBankId, version])` | ai-analysis-subsystem.md §12 |
| **AnalysisVersion** | id, questionBankAnalysisId, versionNumber, evaluationEngineVersion, promptVersion, analysisSchemaVersion, ollamaModel, ollamaContext, ollamaTemperature, evidenceHash, createdAt | `@@unique([questionBankAnalysisId, versionNumber])`, `@@index([evidenceHash])` | ai-analysis-subsystem.md §12 |
| **EvidenceSnapshot** | id, analysisVersionId (unique), snapshot (Json), evidenceHash, sizeBytes | `@@index([evidenceHash])` | ai-analysis-subsystem.md §12 |
| **AnalysisSnapshot** | id, questionBankAnalysisId (unique), analysisVersionId, fullReport (Json), executiveSummary, finalVerdict | — | ai-analysis-subsystem.md §12 |
| **PaperAnalysis** | id, questionBankAnalysisId, generatedPaperId, indexValues (Json), aiNarrative (Json) | `@@unique([questionBankAnalysisId, generatedPaperId])` | ai-analysis-subsystem.md §12 |
| **UAFMetric** | id, questionBankAnalysisId, indexCode, value (Float?), classification, weight, weightedScore (Float?), formulaUsed, computationOrder | `@@index([questionBankAnalysisId, indexCode])` | ai-analysis-subsystem.md §12 |
| **ConfidenceScore** | id, uafMetricId (unique), verifiedItems, requiredItems, score, percentage, classification, justification | — | ai-analysis-subsystem.md §12 |
| **Risk** | id, questionBankAnalysisId, finding, educationalRisk, institutionalRisk, priority, riskType, affectedModules (Json), affectedCOs (Json), evidenceReference | — | ai-analysis-subsystem.md §12 |
| **Recommendation** | id, questionBankAnalysisId, finding, recommendation, priority, impact, suggestedActions (Json), evidenceReference | — | ai-analysis-subsystem.md §12 |
| **AnalysisEvidence** | id, questionBankAnalysisId, evidenceType, category, description, sourceReference, level | — | ai-analysis-subsystem.md §12 |
| **PromptVersion** | id, moduleId, version, promptText, outputSchema (Json), contextBudget, createdAt, supersededAt | `@@unique([moduleId, version])`, `@@index([moduleId, supersededAt])` | ai-analysis-subsystem.md §12 |

**Total: 11 new Prisma models.**

### 4.3 Relationships to Existing Models

```
QuestionBank     ──1:N──▶ QuestionBankAnalysis  (via questionBankId)
User             ──1:N──▶ QuestionBankAnalysis  (via triggeredById)
GeneratedPaper   ──1:N──▶ PaperAnalysis         (via generatedPaperId)
AiReport         ──?:?──▶ PaperAnalysis         (optional, paperAnalysisId for migration)
```

**Source:** ai-analysis-subsystem.md §12

---

## 5. Complete Evaluation Flow

### 5.1 Full Pipeline Sequence Diagram

```
Dean/Coord        AiOrchestrator       EvidBuilder      MetricEngine     SnapshotBuilder
     │                    │                  │                 │                │
     │  triggerAnalysis   │                  │                 │                │
     │───────────────────▶│                  │                 │                │
     │                    │  create QBA      │                 │                │
     │                    │  (INITIALIZED)   │                 │                │
     │                    │──▶ DB            │                 │                │
     │                    │                  │                 │                │
     │                    │  updateStatus    │                 │                │
     │                    │  (EXTRACTING)    │                 │                │
     │                    │──▶ DB            │                 │                │
     │                    │                  │                 │                │
     │                    │  collect(qbId)   │                 │                │
     │                    │─────────────────▶│                 │                │
     │                    │                  │  ──▶ DB ──▶    │                │
     │                    │  ◀── RawBankData │                 │                │
     │                    │                  │                 │                │
     │                    │  updateStatus    │                 │                │
     │                    │  (COMPUTING)     │                 │                │
     │                    │──▶ DB            │                 │                │
     │                    │                  │                 │                │
     │                    │  computeAll(raw) │                 │                │
     │                    │──────────────────────────────────▶│                │
     │                    │                  │                 │                │
     │                    │  ┌─ Group 1 (ECS, EQI)           │                │
     │                    │  ├─ Group 2 (all sub-metrics)    │                │
     │                    │  ├─ Group 3 (MII, BDI, DBI, MCAI)│                │
     │                    │  ├─ Group 4 (QCQI)               │                │
     │                    │  ├─ Group 5 (CAI, AMI, FRI)      │                │
     │                    │  └─ Group 6 (QPQI, OCI)          │                │
     │                    │                  │                 │                │
     │                    │  ◀── metrics[] + confidences[]  │                │
     │                    │                  │                 │                │
     │                    │  build(metrics, conf, raw,       │                │
     │                    │        versionMeta)              │                │
     │                    │───────────────────────────────────────────────▶   │
     │                    │                  │                 │                │
     │                    │  ◀── EvidenceSnapshot             │                │
     │                    │      + evidenceHash               │                │
     │                    │                  │                 │                │
     │                    │  ──▶ DB (persist snapshot)        │                │
     │                    │                  │                 │                │
     │                    │  ◀──[HASH CHECK]──▶ DB (query     │                │
     │                    │       prior hash)                 │                │
     │                    │                  │                 │                │
     │                    │  ╔═══ HASH UNCHANGED? ═══╗       │                │
     │                    │  ║   YES: skip Ollama,    ║       │                │
     │                    │  ║   restore cached AI    ║       │                │
     │                    │  ║   NO: continue         ║       │                │
     │                    │  ╚════════════════════════╝       │                │
     │                    │                  │                 │                │
     │                    │  ──[if hash changed]──            │                │
     │                    │  updateStatus (AI_PENDING)        │                │
     │                    │──▶ DB                             │                │
```

```
    PromptBuilder      OllamaService     ResponseValidator  AnalysisBuilder    Persistence
         │                  │                   │                 │               │
         │  build(snapshot) │                   │                 │               │
    ◀────│──────────────────│                   │                 │               │
         │  ◀── prompts[]   │                   │                 │               │
         │                  │                   │                 │               │
         │  analyze(prompts,│                   │                 │               │
         │    snapshot)     │                   │                 │               │
         │─────────────────▶│                   │                 │               │
         │                  │  POST /api/generate (Ollama)       │               │
         │                  │──────────────────────────────────▶│               │
         │                  │  ◀── raw JSON response            │               │
         │                  │                   │                 │               │
         │  ◀── AiRawResponse                  │                 │               │
         │                  │                   │                 │               │
         │                  │  validate(response, schema)        │               │
         │                  │──────────────────▶                 │               │
         │                  │                   │  ◀── per-module validation    │
         │                  │                   │  ── JSON.parse              │
         │                  │                   │  ── Zod schema check        │
         │                  │                   │  ── Semantic/guard checks   │
         │                  │  ◀── ValidatedAIResponse           │               │
         │                  │                   │                 │               │
         │  updateStatus (AI_COMPLETE)          │                 │               │
         │──▶ DB                               │                 │               │
         │                  │                   │                 │               │
         │  assemble(metrics, ai, snapshot)     │                 │               │
         │──────────────────────────────────────────────────────▶│               │
         │                  │                   │                 │               │
         │                  │                   │           ◀── AnalysisSnapshot │
         │                  │                   │                 │               │
         │  save(snapshot)                      │                 │               │
         │────────────────────────────────────────────────────────────────────▶│
         │                  │                   │                 │               │
         │                  │                   │    ── transactional write ──▶ DB
         │                  │                   │                 │               │
         │  updateStatus (COMPLETE)             │                 │               │
         │──▶ DB                               │                 │               │
         │                  │                   │                 │               │
   ◀─────│──────────────────────────────────────────────────────────────────────│
         │  return AnalysisSnapshot                                             │
```

**Source:** ai-analysis-subsystem.md §4 — Sequence Diagram

### 5.2 DAG Computation Order (7 Groups)

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

Groups execute sequentially. Within a group, all metrics execute in parallel.
`computeConfidenceScore` fires per-metric as soon as each metric completes.

**Source:** uaf-engineering-specification.md §2 — Computation Order (DAG)

### 5.3 Status State Machine

```
                         ┌──────────────────────────────────────────┐
                         │         QuestionBankAnalysis             │
                         └──────────────────────────────────────────┘

INITIALIZED ──▶ EXTRACTING ──▶ COMPUTING ──▶ AI_PENDING ──▶ AI_COMPLETE ──▶ COMPLETE
                                        \                                  /
                                         └──▶ FAILED (any step) ──────────┘
```

| Status | Active Stage | Source |
|---|---|---|
| INITIALIZED | (pre-pipeline) — QuestionBankAnalysis record created | uaf-domain-model.md §3.1 |
| EXTRACTING | EvidenceBuilder collecting raw data | uaf-ee §5.3 |
| COMPUTING | MetricEngine + SnapshotBuilder (all deterministic work) | uaf-ee §5.3 |
| AI_PENDING | PromptBuilder → OllamaService (waiting for response) | uaf-ee §5.3 |
| AI_COMPLETE | ResponseValidator processing AI output | uaf-ee §5.3 |
| COMPLETE | AnalysisBuilder → Persistence (terminal) | uaf-ee §5.3 |
| FAILED | Any stage — error handler invoked (terminal) | uaf-ee §5.3 |

**Source:** uaf-domain-model.md §3.1; uaf-engineering-specification.md §5.3

---

## 6. Complete AI Flow

### 6.1 Evidence Collection → Metric Computation → Snapshot Assembly

```
AiOrchestrator
  │
  ├── 1. create QuestionBankAnalysis (INITIALIZED)
  │
  ├── 2. EvidenceBuilder.collect(questionBankId)
  │       └── Reads QuestionLibraryItem records via Prisma
  │       └── Extracts per-question: marks, CO, PO, PI, Bloom, Difficulty, Type
  │       └── Verifies attributes against source documentation
  │       └── Produces: RawBankData (typed ExtractionEvidence object)
  │     Status → EXTRACTING
  │
  ├── 3. MetricEngine.computeAll(raw)
  │       └── Groups 1-6, DAG-ordered, parallel within groups
  │       └── 27 compute functions produce UAFMetric[] + ConfidenceScore[]
  │       └── Every value classified via shared matrix
  │     Status → COMPUTING
  │
  ├── 4. SnapshotBuilder.build(metrics, confidences, raw, versionMeta)
  │       └── Serializes all deterministic data into EvidenceSnapshot JSON
  │       └── Computes: evidenceHash = SHA-256(canonicalJson + engineVer + promptVer)
  │       └── Persists EvidenceSnapshot to DB
  │
  └── Continues to hash check (step 5)
```

**Source:** ai-analysis-subsystem.md §4-6; uaf-engineering-specification.md §3

### 6.2 Hash Match? → Skip Ollama, Restore Cache

```
  ┌── 5. AiOrchestrator queries prior AnalysisVersion for same questionBankId
  │         ORDER BY versionNumber DESC LIMIT 1
  │
  ├── IF prior evidenceHash == new evidenceHash:
  │     ├── Skip PromptBuilder entirely
  │     ├── Skip OllamaService entirely
  │     ├── Skip ResponseValidator entirely
  │     ├── Load prior validated AI response from DB (cached)
  │     └── Pass cached AI response directly to AnalysisBuilder
  │
  ├── IF hash mismatch (or no prior version):
  │     └── Continue to step 6
  │
  Status remains COMPUTING during cache check
```

**Source:** ai-analysis-subsystem.md §5 — Regeneration Flow

### 6.3 Hash Mismatch? → Build Prompts → Send to Ollama → Validate → Assemble

```
  └── 6. PromptBuilder.build(snapshot)
          └── For each of 10 PromptModuleIds:
          └── Load active PromptVersion from DB (supersededAt IS NULL)
          └── Substitute {{placeholders}} with evidence snapshot data
          └── Select only relevant evidence subset per module
          └── Enforce context budget (truncate if needed)
          └── Prepend system preamble to each module
          └── Returns: StructuredPrompts { modules: [...] }
        Status → AI_PENDING

  ┌── 7. OllamaService.analyze(prompts, snapshot)
  │       └── For each module (sequential):
  │       └── POST /api/generate to Ollama (model: qwen3.5:3b)
  │       └── Timeout: 120s per module
  │       └── Retry: 4 attempts max (retry on timeout, invalid JSON, schema fail)
  │       └── Returns: AIRawResponse { modules: {}, rawText, model, durationMs }
  │
  ├── 8. ResponseValidator.validate(response, schema)
  │       └── Per module, 4-stage pipeline:
  │       └── 1. JSON.parse → retry on failure
  │       └── 2. Zod schema validation (.strict()) → retry on violation
  │       └── 3. Hallucination guards (5 guards: Number, Entity, Verdict, Field, Length)
  │       └── 4. Return ValidatedAIResponse { modules, failures }
  │     Status → AI_COMPLETE
  │
  └── 9. AnalysisBuilder.assemble(metrics, confidences, ai, snapshot)
          └── Merges deterministic metrics with validated AI response
          └── Builds 15-phase full report
          └── Generates executiveSummary + finalVerdict
          └── Assembles Risk[] and Recommendation[] from AI output
          └── Returns: AnalysisSnapshot

  ┌── 10. Persistence.save(snapshot)
  │        └── Transactional write of all entities
  │        └── Status → COMPLETE
  │
  └── Return AnalysisSnapshot to caller
```

**Source:** ai-analysis-subsystem.md §4, §8-11; ai-prompt-design.md §3-4, §7

### 6.4 Partial Failure Handling

When some AI modules fail (all retries exhausted) and others succeed:

```
1. Failed modules have null output in ValidatedAIResponse
2. Failed modules are marked AI_UNAVAILABLE in analysis status
3. AnalysisBuilder uses deterministic data for failed module sections
4. Executive summary includes note: "AI analysis unavailable for [module]"
5. Overall QuestionBankAnalysis still reaches COMPLETE status
6. Notification sent to triggering user with module list

If ALL 10 modules fail:
1. Status = COMPLETE (not FAILED — deterministic data always present)
2. All AI-dependent fields = null
3. Executive summary: "AI analysis unavailable. Deterministic data only."
4. Warning notification to user
```

**Source:** ai-analysis-subsystem.md §11 — Retry and Fallback Strategy

---

## 7. Complete Persistence

### 7.1 New Prisma Models (11 Total)

| # | Model | Key Purpose | Immutable? | Source |
|---|---|---|---|---|
| 1 | **QuestionBankAnalysis** | Root aggregate. One per evaluation run. | Status mutable; version monotonic | ai-analysis-subsystem.md §12 |
| 2 | **AnalysisVersion** | Immutable version record with execution parameters | YES | ai-analysis-subsystem.md §12 |
| 3 | **EvidenceSnapshot** | Deterministic evidence blob sent to Ollama | YES | ai-analysis-subsystem.md §12 |
| 4 | **AnalysisSnapshot** | Read model — what the UI loads | Regenerated per completion | ai-analysis-subsystem.md §12 |
| 5 | **PaperAnalysis** | Per-variant analysis results | YES | ai-analysis-subsystem.md §12 |
| 6 | **UAFMetric** | One computed index value | YES | ai-analysis-subsystem.md §12 |
| 7 | **ConfidenceScore** | Confidence metadata for one metric | YES | ai-analysis-subsystem.md §12 |
| 8 | **Risk** | One risk register entry | YES | ai-analysis-subsystem.md §12 |
| 9 | **Recommendation** | One recommendation entry | YES | ai-analysis-subsystem.md §12 |
| 10 | **AnalysisEvidence** | One piece of analysis evidence | YES | ai-analysis-subsystem.md §12 |
| 11 | **PromptVersion** | Prompt template with schema and budget | YES (after supersession) | ai-analysis-subsystem.md §12 |

### 7.2 Key Indexes

| Model | Index | Purpose |
|---|---|---|
| QuestionBankAnalysis | `@@index([questionBankId, status])` | Filter banks by analysis status for Dean dashboard |
| QuestionBankAnalysis | `@@index([questionBankId, version])` | Look up latest version per bank |
| AnalysisVersion | `@@index([evidenceHash])` | Cache key lookup — O(1) hash match check |
| AnalysisVersion | `@@unique([questionBankAnalysisId, versionNumber])` | Enforce monotonic versioning |
| EvidenceSnapshot | `@@index([evidenceHash])` | Accelerate cached AI output retrieval |
| EvidenceSnapshot | `analysisVersionId @unique` | One snapshot per version |
| UAFMetric | `@@index([questionBankAnalysisId, indexCode])` | Quick metric lookup by index code |
| PaperAnalysis | `@@unique([questionBankAnalysisId, generatedPaperId])` | One analysis per paper per run |
| PromptVersion | `@@unique([moduleId, version])` | Enforce version uniqueness per module |
| PromptVersion | `@@index([moduleId, supersededAt])` | Active version lookup |

**Source:** ai-analysis-subsystem.md §12 (embedded @@index annotations)

### 7.3 JSON vs. Relational Decisions Matrix

| Field | Storage Choice | Rationale | Source |
|---|---|---|---|
| EvidenceSnapshot.snapshot | Json | Variable structure, no relational queries needed | uaf-domain-model.md §3.3 |
| AnalysisSnapshot.fullReport | Json | Complete 15-phase report, read-only | uaf-domain-model.md §3.4 |
| UAFMetric.indexCode | String (not enum) | Enables adding new indices without migration | ai-analysis-subsystem.md §12 |
| UAFMetric.classification | String (not enum) | Enables new classification values without migration | ai-analysis-subsystem.md §12 |
| Risk.affectedModules | Json (string[]) | Variable-length array, no relational join needed | uaf-domain-model.md §3.8 |
| Risk.affectedCOs | Json (string[]) | Same as above | uaf-domain-model.md §3.8 |
| Recommendation.suggestedActions | Json (string[]) | Variable-length array | uaf-domain-model.md §3.9 |
| PaperAnalysis.indexValues | Json | Variable per-variant metric shape | uaf-domain-model.md §3.7 |
| PaperAnalysis.aiNarrative | Json | Variable per-variant narrative | uaf-domain-model.md §3.7 |
| PromptVersion.outputSchema | Json | Zod-compatible schema definition | uaf-domain-model.md §3.10 |

### 7.4 EvidenceSnapshot Storage Strategy

The EvidenceSnapshot is stored as a MySQL JSON column. The expected size
per snapshot is 10-50 KB. This is well within MySQL's JSON column capacity
(up to 1 GB). If snapshots exceed 100 KB in practice, evaluate MinIO as an
alternative storage backend (see Open Questions §15).

### 7.5 Version History Query Patterns

| Query Pattern | Example | Index Used |
|---|---|---|
| Latest analysis for a bank | `WHERE questionBankId = ? ORDER BY version DESC LIMIT 1` | `@@index([questionBankId, version])` |
| All versions for a bank | `WHERE questionBankId = ? ORDER BY version DESC` | `@@index([questionBankId, version])` |
| Cache hit check | `WHERE evidenceHash = ? ORDER BY versionNumber DESC LIMIT 1` | `@@index([evidenceHash])` |
| Specific version | `WHERE questionBankAnalysisId = ? AND versionNumber = ?` | `@@unique([questionBankAnalysisId, versionNumber])` |
| Version comparison | Two queries: `WHERE questionBankAnalysisId = ? AND versionNumber IN (?, ?)` | `@@unique` per query |
| Active prompt version | `WHERE moduleId = ? AND supersededAt IS NULL` | `@@index([moduleId, supersededAt])` |

**Source:** ai-analysis-subsystem.md §13 — API Response Shapes

---

## 8. Complete Prompt System

### 8.1 Context Budget Table

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

Each module runs in its own 8K context window. Sequential execution.
Per-call average: ~2,000 tokens, leaving ~6,000 headroom for safety margin.

**Source:** ai-prompt-design.md §1 — Context Budget Allocation

### 8.2 Module List with Purpose and Output Type

| # | Module | PromptModuleId | Purpose | Output Type | Source |
|---|---|---|---|---|---|
| 1 | Executive Summary | `executive-summary` | Synthesize all metrics into narrative | Narrative (keyFindings[], overallAssessment, majorRisks[], accreditationReadiness) | ai-pd §3.1 |
| 2 | Bloom Analysis | `bloom-analysis` | Interpret Bloom distribution, LOTS/HOTS/CBR | Structured (cognitiveBalance[], risks[], recommendations[], balanceAssessment) | ai-pd §3.2 |
| 3 | Difficulty Analysis | `difficulty` | Interpret DBI, MCAI, DA | Structured (difficultyAssessment, rigorLevel, marksAlignment[], risks[]) | ai-pd §3.3 |
| 4 | CO Coverage | `co-coverage` | Analyze CVI, per-CO coverage | Structured (coverageStatus, weakOutcomes[], attainmentRisk[], recommendations[]) | ai-pd §3.4 |
| 5 | Module Coverage | `module-coverage` | Analyze per-module distribution | Structured (moduleAssessment{}, weakModules[], strongModules[], recommendation) | ai-pd §3.5 |
| 6 | Concept Diversity | `concept-diversity` | Analyze concept/knowledge spread | Structured (diversityScore, clusteringRisk, dominantConceptNote, recommendation) | ai-pd §3.6 |
| 7 | Risk Analysis | `risk-analysis` | Generate risk register from metrics | Structured (risks[]: finding, educationalRisk, institutionalRisk, priority, riskType, affectedModules, affectedCOs) | ai-pd §3.7 |
| 8 | Recommendations | `recommendations` | Generate actionable recommendations | Structured (recommendations[]: finding, recommendation, priority, impact, suggestedActions) | ai-pd §3.8 |
| 9 | Academic Quality | `academic-quality` | Assess 7 QCQI dimensions | Structured (qualityAssessment, strongDimensions[], weakDimensions[], revisionCandidates[]) | ai-pd §3.9 |
| 10 | Final Verdict | `final-verdict` | Synthesize into moderation verdict | Structured (verdict, justification, keyEvidence[], confidence) | ai-pd §3.10 |

**Source:** ai-prompt-design.md §3 — Module Definitions

### 8.3 Versioning Strategy for Prompts

| Module | Initial Version | Increment When | Source |
|---|---|---|---|
| All 10 modules | 1.0.0 | Prompt text changes, output schema changes, rubric/threshold changes | ai-pd §5.2 |
| System preamble | 1.0.0 (singleton, moduleId = "system-preamble") | Role/constraint/rule changes | ai-pd §2.2 |

Two version tracks:
- `promptVersion` — per-module SemVer (prompt text, instructions)
- `analysisSchemaVersion` — global SemVer (output JSON schema)

Both recorded on every `AnalysisVersion`.

**Source:** ai-prompt-design.md §5 — Prompt Versioning

### 8.4 Prompt Registry Design

```
PromptVersion table:
  id            String   @id
  moduleId      String   (PromptModuleId enum)
  version       String   (SemVer)
  promptText    String   (template with {{placeholders}})
  outputSchema  Json     (Zod-compatible schema)
  contextBudget Int      (max output tokens)
  createdAt     DateTime
  supersededAt  DateTime? (null = active)

Invariant: Only one version per moduleId may have supersededAt = null.

Load pattern:
  SELECT * FROM PromptVersion
  WHERE moduleId = :moduleId AND supersededAt IS NULL
  ORDER BY version DESC LIMIT 1
```

**Source:** ai-analysis-subsystem.md §8; ai-prompt-design.md §5.4

---

## 9. Complete API Design

### 9.1 Endpoints Table

All endpoints require Dean role via EMQPGS `withApiHandler` and
`AuthorizationService`.

| Method | Path | Purpose | Request | Response | Source |
|---|---|---|---|---|---|
| GET | `/api/question-banks/{id}/analysis` | Load current (latest) full analysis | — | `AnalysisSnapshotResponse` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/analysis/versions` | List all analysis versions | — | `AnalysisVersion[]` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/analysis/{versionId}` | Load a specific version | — | `AnalysisSnapshotResponse` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/analysis/compare?v1=X&v2=Y` | Compare two versions | query params | `ComparisonResult` | dean-ws §11; ai-as §13 |
| POST | `/api/question-banks/{id}/analysis/regenerate` | Trigger new analysis run | `{ force?: boolean }` | `{ id, version, status, cacheHit }` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/analysis/status` | Poll current analysis status | — | `{ status, progress }` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/papers/{paperId}/analysis` | Per-paper variant analysis | — | `PaperAnalysis` | dean-ws §11; ai-as §13 |
| GET | `/api/question-banks/{id}/analysis/{versionId}/metric/{indexCode}` | Single metric detail | — | `UAFMetric + ConfidenceScore` | dean-ws §11 |

**Source:** ai-analysis-subsystem.md §13; dean-ai-review-workspace.md §11

### 9.2 Key Response Types

**AnalysisSnapshotResponse:**
```typescript
interface AnalysisSnapshotResponse {
  id: string;
  version: number;
  status: AnalysisStatus;
  snapshot: {
    executiveSummary: string;
    finalVerdict: FinalVerdict;
    fullReport: Record<string, unknown>;
  };
  metrics: Array<{
    indexCode: IndexCode;
    value: number;
    classification: Classification;
    weight: number;
    weightedScore: number;
    formulaUsed: string;
    confidence: {
      score: number;
      percentage: number;
      classification: ConfidenceClassification;
      justification: string;
    } | null;
  }>;
  risks: Array<{
    id: string;
    finding: string;
    educationalRisk: string;
    institutionalRisk: string;
    priority: RiskPriority;
    riskType: RiskType;
    affectedModules: string[];
    affectedCOs: string[];
  }>;
  recommendations: Array<{
    id: string;
    finding: string;
    recommendation: string;
    priority: RiskPriority;
    impact: string;
    suggestedActions: string[];
  }>;
  versioning: {
    evaluationEngineVersion: string;
    promptVersion: string;
    analysisSchemaVersion: string;
    ollamaModel: string;
    ollamaContext: number;
    ollamaTemperature: number;
    evidenceHash: string;
    createdAt: string;
  };
  aiStatus: {
    overall: "FULL" | "PARTIAL" | "UNAVAILABLE";
    failedModules: PromptModuleId[];
  };
}
```

**ComparisonResult:**
```typescript
interface ComparisonResult {
  versionA: { version: AnalysisVersionResponse; snapshot: AnalysisSnapshotResponse };
  versionB: { version: AnalysisVersionResponse; snapshot: AnalysisSnapshotResponse };
  deltas: MetricDelta[];
  classificationChanges: ClassificationChange[];
  changeReasonSummary: string | null;
  rootCauses: string[];
}

interface MetricDelta {
  indexCode: IndexCode;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged" | "new" | "removed";
  oldClassification: Classification | null;
  newClassification: Classification | null;
}
```

**Source:** dean-ai-review-workspace.md §11; ai-analysis-subsystem.md §13

### 9.3 Polling Pattern

```
GET /api/question-banks/{id}/analysis/status

Response when in progress:
{
  "id": "ana_yyy",
  "version": 4,
  "status": "AI_PENDING",
  "progress": {
    "stage": "OllamaService",
    "stageIndex": 5,
    "totalStages": 8,
    "modulesComplete": 3,
    "modulesTotal": 10
  },
  "startedAt": "2026-06-22T10:05:00Z"
}

Poll interval: 5s for first 30s, then 15s.
Max poll duration: 10 minutes.
```

**Source:** dean-ai-review-workspace.md §10; ai-analysis-subsystem.md §13

---

## 10. Complete UI

### 10.1 Navigation Hierarchy

```
/dashboard/dean                              → Analysis list (Page 1)
/dashboard/dean/review?bank={bankId}         → Bank analysis overview (Page 2)
/dashboard/dean/review?bank={bankId}&compare → Version comparison (Page 3)
/dashboard/dean/review?bank={bankId}&variant=A → Per-paper analysis (Page 4)
/dashboard/dean/review?bank={bankId}&index=BDI  → Index drill-down (Page 5)
```

All sub-views extend the existing `/dashboard/dean/review?bank={bankId}` route.
No new top-level routes introduced.

**Source:** dean-ai-review-workspace.md §1

### 10.2 Key Pages

**Page 1: Dean Dashboard (Analysis List)**
- Summary stat bar (total, pending, complete, obsolete)
- Pending analyses list (color-coded status badges)
- Recent completed list (QPQI value, classification)
- Data source: existing `getDeanReviewData()` extended with analysis status

**Page 2: UAF Bank Analysis Overview**
- AnalysisHeader: BankIdentityBreadcrumb, ClassificationBadge, VersionSelector, ActionBar
- IndexSummaryTable: 11 color-coded rows, clickable for drill-down
- ExecutiveSummaryPanel: AI-attributed narrative with confidence badge
- RiskRegisterPanel: Priority-sorted risks with detail modal
- RecommendationsPanel: Recommendation cards
- AccreditationReadinessStrip: Per-CO progress tiles
- VersionHistoryPanel: Timeline with compare dropdown

**Page 3: Version Comparison View**
- Side-by-side CSS grid (1fr 1fr, stack below 1024px)
- VersionMetadataRow (engine, prompt, model per column)
- MetricComparisonGrid with DeltaIndicator (▲ green, ▼ red, ─ gray, ★ new)
- ChangeReasonSummary (AI-generated, attribution badge)

**Page 4: Per-Paper Variant Analysis**
- VariantTabBar (A, B, C tabs)
- VariantAnalysisPanel per tab
- AI commentary cards: Bloom, Difficulty, CO Coverage, Module, Concept Diversity, Academic Quality
- SlotDecisionIndicator (Regular, Supplementary, KT selection)
- Deterministic cards show `[D]` badge, AI cards show `[AI]` badge

**Page 5: Index Drill-Down**
- MetricHeader: large value, classification, confidence, weight, formula
- DistributionBarChart: actual vs expected bars with percentage labels
- AIInterpretationPanel: regenerate per-panel
- Chart legend for actual vs expected overlay

**Source:** dean-ai-review-workspace.md §2-§6

### 10.3 State Management Per Component

Every component defines four states: Loading, Empty, Error, Data.

| Component | Loading | Empty | Data | Error |
|---|---|---|---|---|
| IndexSummaryTable | 11 skeleton rows | "No analysis data" | Full table, color-coded | Retry |
| ExecutiveSummaryPanel | Text skeleton | — | Rendered + `[AI]` badge | AI_FAILED + Retry |
| RiskRegisterPanel | 3 skeleton rows | Green "No risks" | Priority-sorted rows | Retry |
| RecommendationsPanel | 3 skeleton cards | "No recommendations" | Recommendation cards | Retry |
| AccreditationReadinessStrip | 6 skeleton tiles | "No CO data" | CO tiles with progress | Retry |
| VersionHistoryPanel | 3 timeline skeletons | "First analysis" | Timeline with compare | Retry |
| VariantAnalysisPanel | Tab bar + skeletons | "No papers generated" | Tabs with cards | Retry |
| IndexDrillDownPage | Metric header + bars | "Index not found" | Full chart + AI panel | Retry |

**Source:** dean-ai-review-workspace.md §9

### 10.4 AI Attribution Design

| Category | Badge | Background | Border | Regenerate? |
|---|---|---|---|---|
| AI-generated | `[AI]` + confidence % | Tinted (accent at 5% opacity) | None | Yes |
| Deterministic | `[D]` | Standard surface | None | No |
| AI fallback | `[AI]` or `[D]` | Tinted if AI, standard if D | Dashed when fallback | Contextual |

AI sections use subtle background tint via `color-mix()`. Badge shows
confidence percentage. Tooltip: "Generated by AI (qwen3.5:3b). Confidence
based on evidence coverage."

**Source:** dean-ai-review-workspace.md §8

### 10.5 Color Coding for Index Values

| Classification | Meaning |
|---|---|
| EXEMPLARY | Green tint |
| HIGHLY_EFFECTIVE | Blue-green tint |
| EFFECTIVE | Blue tint |
| ACCEPTABLE | Amber tint |
| NEEDS_IMPROVEMENT | Orange tint |
| MAJOR_REVISION | Red tint |

All values mapped to CSS custom properties. Same matrix as domain model §4.

**Source:** dean-ai-review-workspace.md §3; uaf-domain-model.md §4

---

## 11. Complete Versioning

### 11.1 What Is Versioned

| Entity | Versioned Field | Purpose | Source |
|---|---|---|---|
| QuestionBankAnalysis | `version` (monotonic per bank) | Analysis run counter | uaf-domain-model.md §3.1 |
| AnalysisVersion | `versionNumber` (monotonic per parent) | Versioned execution record | uaf-domain-model.md §3.2 |
| AnalysisVersion | `evaluationEngineVersion` (SemVer) | MetricEngine formula version | ai-analysis-subsystem.md §7 |
| AnalysisVersion | `promptVersion` (SemVer) | Active prompt pack version | ai-analysis-subsystem.md §7 |
| AnalysisVersion | `analysisSchemaVersion` (SemVer) | Output schema version | ai-analysis-subsystem.md §7 |
| AnalysisVersion | `evidenceHash` (SHA-256) | Cache key + integrity check | ai-analysis-subsystem.md §6 |
| AnalysisVersion | `ollamaModel, ollamaContext, ollamaTemperature` | AI reproducibility params | ai-analysis-subsystem.md §7 |
| PromptVersion | `version` (SemVer per module) | Prompt template version | uaf-domain-model.md §3.10 |
| UAFMetric | `formulaUsed` (string) | Which formula produced value | uaf-domain-model.md §3.5 |

### 11.2 Version Schema per Entity

**AnalysisVersion:**
```typescript
interface AnalysisVersionMeta {
  versionNumber: number;                // monotonic per questionBankAnalysis
  evaluationEngineVersion: string;      // "1.0.0"
  promptVersion: string;                // "2.1.0"
  analysisSchemaVersion: string;        // "1.0.0"
  ollamaModel: string;                  // "qwen3.5:3b"
  ollamaContext: number;               // 8192
  ollamaTemperature: number;            // 0.7
  evidenceHash: EvidenceHash;           // SHA-256
  createdAt: DateTime;                  // ISO 8601
}
```

**PromptVersion:**
```typescript
interface PromptVersionMeta {
  moduleId: PromptModuleId;
  version: string;                      // "1.2.0"
  createdAt: DateTime;
  supersededAt: DateTime | null;        // null = active
}
```

### 11.3 Immutability Rules

1. **AnalysisVersion** — immutable once persisted. No field updated after creation.
2. **EvidenceSnapshot** — immutable. Snapshot and hash never change.
3. **PromptVersion** — immutable after publication. Superseded (not deleted).
4. **UAFMetric** — immutable after computation. Re-analysis creates new records.
5. **ConfidenceScore** — immutable after computation.
6. **Risk** — immutable after generation.
7. **Recommendation** — immutable after generation.

**Source:** uaf-domain-model.md §6

### 11.4 EvidenceHash as Cache Key

```
evidenceHash = SHA-256(
  canonicalJson(evidenceSnapshot.snapshot) +
  analysisVersion.evaluationEngineVersion +
  analysisVersion.promptVersion
)

Lookup: SELECT ai_output FROM analysis_version
        WHERE evidence_hash = :hash
        ORDER BY version_number DESC LIMIT 1

TTL: No expiration (immutable by design)
Invalidation: None (hash change naturally causes cache miss)
```

The hash changes when: (a) question bank data changes, (b) evaluation engine
version changes, (c) prompt version changes. Cache hit restores prior AI
output verbatim — no Ollama call, no re-validation.

**Source:** ai-analysis-subsystem.md §6; uaf-domain-model.md §6

### 11.5 Comparison Query Pattern

```
GET /api/question-banks/{id}/analysis/compare?v1=X&v2=Y

1. Fetch AnalysisVersion for v1 and v2
2. Fetch EvidenceSnapshots for both
3. Compute MetricDelta[] by iterating all 11 indices:
     for each indexCode:
       find metric in v1, find metric in v2
       compute delta = (v2.value - v1.value)
       determine direction (improved/declined/unchanged/new/removed)
4. Compute ClassificationChange[]:
     for each indexCode where classification differs:
       compute levelsChanged
5. If promptVersion changed, include changeReasonSummary
   (AI-generated from cached output or new prompt)
```

**Source:** dean-ai-review-workspace.md §11; ai-analysis-subsystem.md §13

---

## 12. Complete Testing Strategy

### 12.1 Test Layer Table

| Layer | Test Type | Scope | Est. Count | Source |
|---|---|---|---|---|
| MetricEngine | Unit (per compute function) | 27 functions × 3 tests (happy, edge, failure) | ~81 | uaf-ee §1, §7 |
| EvidenceBuilder | Integration | Raw data collection from QuestionLibraryItem | ~5 | uaf-ee §3 |
| SnapshotBuilder | Unit | EvidenceSnapshot assembly + hash computation | ~3 | ai-as §6 |
| PromptBuilder | Unit | Prompt assembly per module (correct fields, no unrelated) | ~10 | ai-pd §6.1 |
| OllamaService | Integration | Full AI round-trip with mock Ollama | ~3 | ai-as §3, §11 |
| ResponseValidator | Unit | Parse → Zod → semantic per module | ~10 | ai-as §9-10 |
| AnalysisBuilder | Integration | Full assembly from metrics + AI | ~3 | ai-as §3 |
| Pipeline | E2E | Complete analysis lifecycle | ~3 | ai-as §4 |
| API | Integration | All 8 endpoints | ~8 | ai-as §13; dean-ws §11 |
| UI | Component (Playwright) | Dean workspace views | ~10 | dean-ws §2-§6 |
| **Total** | | | **~136** | |

### 12.2 MetricEngine Unit Tests

Per compute function, 3 test categories:

| Category | Example | Source |
|---|---|---|
| Happy path | SCI: 8/10 structural elements → 0.80 → HIGHLY_EFFECTIVE | uaf-ee §1.4 |
| Edge case | SCI: 0/10 → 0.00 → MAJOR_REVISION | uaf-ee §1.4 |
| Failure | SCI: requiredElements = 0 → null, VERY_LOW | uaf-ee §6.2 |

Each test verifies: `value`, `classification`, `weightedScore`, `formulaUsed`,
`computationOrder`, and `ConfidenceScore` fields.

**Source:** uaf-engineering-specification.md §1 (per-function test scenarios), §7

### 12.3 PromptBuilder Tests

| Test | Verification | Source |
|---|---|---|
| Content inclusion | Prompt contains correct metric values from snapshot | ai-pd §6.1 |
| Field isolation | Prompt does NOT contain unrelated module fields | ai-pd §6.1 |
| Template substitution | All {{placeholders}} correctly replaced | ai-pd §2 |
| Context budget | Prompt does not exceed module's contextBudget | ai-pd §1 |
| Active version loading | Loads only PromptVersion with `supersededAt IS NULL` | ai-as §8 |

### 12.4 ResponseValidator Tests

| Test | Verification | Source |
|---|---|---|
| Valid JSON passes | Known-good fixture → passes all stages | ai-pd §6.1 |
| Invalid JSON fails | Malformed → retry → drop module | ai-as §9 |
| Zod violation | Missing field → retry → drop module | ai-as §9 |
| Number Injection Guard | AI adds number not in input → drop module | ai-as §10 |
| Entity Name Guard | AI references unknown CO/module → drop module | ai-as §10 |
| Verdict Alignment Guard | AI contradicts classification by 2+ levels → drop | ai-as §10 |
| Field Mandate Guard | Required field null → retry → drop | ai-as §10 |
| Length Guard | Output exceeds budget → truncate (no drop) | ai-as §10 |

**Source:** ai-analysis-subsystem.md §9-10; ai-prompt-design.md §6.1

### 12.5 Hallucination Test Fixtures

Each module needs 3 fixture categories:

| Category | Purpose | Source |
|---|---|---|
| Valid evidence | Known-good EvidenceSnapshot data | Hand-crafted from uaf-ee §1 test scenarios |
| Invalid evidence | Edge cases: null metrics, missing fields | Derived from uaf-ee §6 failure matrix |
| Hallucinated output | JSON with fabricated content | Hand-crafted by test author |

**Source:** ai-prompt-design.md §6.2

---

## 13. Complete Rollout Plan

### 13.1 Phase Breakdown

| Phase | Weeks | Deliverable | Dependencies | Source |
|---|---|---|---|---|
| 0 | 1-2 | Prisma models + migrations | Domain model ratified | uaf-domain-model.md |
| 1 | 2-4 | EvidenceBuilder + MetricEngine + all 27 compute functions | Phase 0 | uaf-engineering-specification.md |
| 2 | 4-5 | SnapshotBuilder + EvidenceHash | Phase 1 | ai-analysis-subsystem.md §6 |
| 3 | 5-7 | PromptBuilder + Prompt Registry + OllamaService | Phase 2 + Prompt design | ai-prompt-design.md |
| 4 | 7-8 | ResponseValidator + AnalysisBuilder + Persistence | Phase 3 | ai-analysis-subsystem.md §9-10 |
| 5 | 8-10 | API endpoints + Dean workspace integration | Phase 4 + Dean workspace | dean-ai-review-workspace.md |
| 6 | 10-11 | Version history + comparison UI | Phase 5 | dean-ws §4, §7 |
| 7 | 11-12 | Migration + coexistence + testing | All phases | ai-as §14 |

### 13.2 Phase 0 Details — Prisma Models

**Actions:**
- Add all 11 new Prisma models to `prisma/schema.prisma`
- Add new enums: `AnalysisStatus`, `FinalVerdict`
- Add optional `paperAnalysisId` field to existing `AiReport` model
- Run `npx prisma migrate dev` to generate migration
- Verify existing models and relations unchanged

**Verification:**
- `npx prisma db push` succeeds
- Existing `AiReport` queries still work
- New `QuestionBankAnalysis` can be created via raw query

### 13.3 Phase 1 Details — EvidenceBuilder + MetricEngine

**Actions:**
- Implement `EvidenceBuilder.collect(questionBankId)`: reads
  QuestionLibraryItem records, extracts per-question attributes,
  verifies against documentation, builds `ExtractionEvidence` object
- Implement all 27 compute functions in `MetricEngine.computeAll()`
- Implement DAG orchestrator (7 groups, parallel within groups)
- Implement shared classification function
- Implement ConfidenceScore computation (called per-metric)
- Write ~81 unit tests (3 per function)

**Verification:**
- All 27 functions return correct values for known test data
- Edge cases (zero division, null inputs) handled per failure matrix
- Classification matches shared matrix
- `computeConfidenceScore` returns correct score per metric

### 13.4 Phase 2 Details — SnapshotBuilder + EvidenceHash

**Actions:**
- Implement `SnapshotBuilder.build()`: serialize metrics + evidence + confidences
  into `EvidenceSnapshot.snapshot` JSON
- Implement `computeEvidenceHash()`: `SHA-256(canonicalJson + engineVersion + promptVersion)`
- Ensure canonical JSON serialization (key-sorted, deterministic)
- Persist `EvidenceSnapshot` to DB

**Verification:**
- Same inputs produce identical hash
- Hash changes when any input (snapshot, engine version, prompt version) changes
- Snapshot JSON contains ONLY deterministic data
- `sizeBytes` correctly calculated

### 13.5 Phase 3 Details — PromptBuilder + Prompt Registry + OllamaService

**Actions:**
- Seed PromptVersion table with initial 10 module prompts + system preamble
- Implement `PromptBuilder.build()`: load active versions, substitute placeholders,
  select evidence subsets, enforce context budgets
- Implement `OllamaService.analyze()`: sequential per-module calls to Ollama,
  retry logic (4 attempts), timeout handling, per-module independence
- Implement `AiProvider` thin wrapper

**Verification:**
- Each module prompt contains only its relevant evidence subset
- No module exceeds its context budget
- OllamaService handles retry and timeout correctly
- Single module failure does not cascade

### 13.6 Phase 4 Details — ResponseValidator + AnalysisBuilder + Persistence

**Actions:**
- Implement 4-stage validation pipeline (JSON.parse → Zod → semantic → return)
- Implement 5 hallucination guards (Number, Entity, Verdict, Field, Length)
- Implement `AnalysisBuilder.assemble()`: merge metrics + AI, build 15-phase report
- Implement `Persistence.save()`: transactional write of all entities
- Write ~10 unit tests for ResponseValidator, ~3 for AnalysisBuilder

**Verification:**
- Valid AI response passes all validation stages
- Hallucinated content triggers correct guard and drops module
- Partial failure (some modules fail) still produces COMPLETE analysis
- All entities persisted in correct tables with correct relations

### 13.7 Phase 5 Details — API + Dean Workspace

**Actions:**
- Implement all 8 API endpoints
- Implement Dean Dashboard Page 1 (analysis list with status)
- Implement Page 2 (UAF Bank Analysis Overview with all panels)
- Implement Page 3 (Version Comparison View)
- Implement Page 4 (Per-Paper Variant Analysis)
- Implement Page 5 (Index Drill-Down)
- Implement Version History Panel
- Wire polling for in-progress analyses
- Add AI attribution badges to all AI sections
- Write ~8 API integration tests + ~10 Playwright component tests

**Verification:**
- All 8 endpoints return correct response shapes
- Dean can trigger, view, compare, and regenerate analysis
- Loading/empty/error states render correctly per component
- AI attribution badges visible on all AI sections
- Polling transitions through all status states

### 13.8 Phase 6 Details — Version History + Comparison UI

**Actions:**
- Implement VersionHistoryPanel with timeline + compare dropdown
- Implement VersionComparisonView with side-by-side metrics + deltas
- Implement ChangeReasonSummary (AI-generated)
- Handle all version states (loading, empty, single, multiple, error)

**Verification:**
- Single version shows "initial analysis" state
- Multiple versions show full timeline with compare options
- Deltas correctly computed (improved, declined, unchanged, new)
- ChangeReasonSummary renders when prompt/engine version changed

### 13.9 Phase 7 Details — Migration + Coexistence + Testing

**Actions:**
- Verify existing AiReport + AiReportService untouched
- Verify all old API routes still functional
- Run full test suite (~136 tests)
- Manual E2E verification: trigger analysis, verify all 11 indices,
  verify EvidenceSnapshot persistence, verify hash caching
- Run Dean workspace manual QA: all 5 pages, all state transitions,
  all interaction flows

**Verification:**
- All acceptance criteria met (§17)
- No regressions in existing AiReport functionality
- Dean workspace works without Ollama (deterministic-only mode)
- Full test suite passes

---

## 14. Risk Register for Implementation

| Risk | Likelihood | Impact | Mitigation | Source |
|---|---|---|---|---|
| 3B model cannot produce useful academic narrative | Medium | High | Fallback to deterministic-only mode; upgrade model path to 7B+ | ai-pd §7.4 |
| 8K context insufficient for some prompt modules | Low | Medium | Subset evidence fields; merge low-priority modules into one call | ai-pd §1.3 |
| EvidenceSnapshot size exceeds expected bounds | Medium | Low | Truncate oversized arrays; sample representative data; evaluate MinIO storage | Open Question |
| Existing AiReport migration causes data loss | Low | Critical | Coexistence strategy (§7.5); no migration needed | ai-as §14 |
| Ollama latency makes real-time analysis impossible | Medium | Medium | Async pipeline with polling; Dean sees progress bar; cache hit returns in seconds | dean-ws §10 |
| Formula errors in MetricEngine produce wrong indices | Medium | High | Every compute function has 3 tests; integration test compares with manual calculation | uaf-ee §7 |
| Dean workspace performance (10 tabs = many queries) | Medium | Medium | Composite indexes; field selection in API; lazy loading for sections | ai-as §12 |
| Prompt version change invalidates cached analysis | Medium | Low | Hash naturally changes; cache miss triggers fresh Ollama call; no data loss | ai-as §6 |
| Ollama unreachable at analysis time | Medium | Medium | Deterministic-only fallback; notification to user | ai-as §11 |
| Hash collision on evidenceHash | Low | Medium | SHA-256 collision probability negligible in practice; log and alert if duplicate found | — |

---

## 15. Open Questions

| Question | Options | Recommendation for v1 | Source |
|---|---|---|---|
| Should EvidenceSnapshot be stored in MySQL or MinIO? | MySQL JSON column (default) vs MinIO object | Start with MySQL. Move to MinIO if snapshots exceed 100 KB | uaf-domain-model.md §3.3 |
| What is the initial expected Bloom and Difficulty distribution if no institutional policy exists? | Defaults from UAF spec vs configurable | Use UAF defaults (Bloom: 10,20,25,20,15,10; Difficulty: 30,50,20) | uaf-ee §1.4 |
| How should the system handle concurrent analysis requests for the same bank? | Queue vs reject vs parallel | Reject with "analysis in progress" for same bank | ai-as §3 |
| Should prompt version changes trigger automatic re-analysis of all banks? | Auto vs manual trigger | Manual trigger recommended for v1. Add "Re-analyze all with new prompts" button | ai-pd §5 |
| Should per-paper variant indices be computed independently or derived from bank-level metrics? | Independent vs derived from bank | Derived from bank-level metrics with per-variant question subset | uaf-domain-model.md §3.7 |
| Should PaperAnalysis get AI commentary for each variant separately or share bank-level AI? | Per-variant vs shared | Per-variant: each variant has its own AI commentary from same pipeline | uaf-domain-model.md §3.7 |
| Should the pipeline run synchronously or via an async job queue? | Sync vs Bull/BullMQ queue | Sync for v1 (single request). Queue if latency becomes an issue | — |

---

## 16. Implementation Assumptions

1. **Ollama is running and accessible** at the configured endpoint
   (`OLLAMA_BASE_URL` env var, default `http://localhost:11434`).
2. **Qwen3.5:3b model is pulled and available** on the Ollama server.
3. **MySQL 8 supports JSON columns** for flexible schema storage
   (used for EvidenceSnapshot.snapshot, AnalysisSnapshot.fullReport, etc.).
4. **Existing AiReport and AiReportService remain untouched** — no changes
   to existing code paths.
5. **Dean has appropriate responsibility assignment** (DEAN scope) via
   existing `ResponsibilityAssignment` and `AuthorizationService`.
6. **All 27 compute functions run synchronously** within a single request
   (or background job) — no distributed computation.
7. **Token counting uses 1 token ≈ 4 characters** approximation for English
   text and 1 token ≈ 3 characters for JSON-heavy content.
8. **The system preamble is sent with every module call** — Prepended by
   PromptBuilder, stored as PromptVersion with moduleId "system-preamble".
9. **All prompts are in English** — the UAF academic domain uses English-
   language prompts and responses.
10. **No real-time multi-user collaboration** — the Dean workspace is
    single-user.
11. **No mobile optimization for comparison view** — version comparison
    below 768px stacks vertically but is not fully responsive.

---

## 17. Acceptance Criteria

The implementation is complete when:

1. **Triggering analysis** on a QuestionBank produces all 11 indices (SCI,
   MII, BDI, CVI, MCAI, DBI, QCQI, CAI, AMI, FRI, QPQI) with correct
   values and classifications.
   - Source: uaf-engineering-specification.md §1.4-§1.6
   - Verification: Manual calculation matches MetricEngine output for a
     test QuestionBank.

2. **EvidenceSnapshot is persisted and reproducible.** Two identical
   QuestionBanks produce identical EvidenceSnapshots with identical
   evidenceHashes.
   - Source: uaf-domain-model.md §3.3; ai-analysis-subsystem.md §6
   - Verification: Unit test with deterministic input produces same hash.

3. **EvidenceHash correctly skips Ollama** when evidence is unchanged.
   Regenerating an unchanged bank returns in < 5 seconds.
   - Source: ai-analysis-subsystem.md §5
   - Verification: Second analysis of same bank has `cacheHit: true` in
     response.

4. **All 10 AI prompt modules produce valid structured JSON** that passes
   Zod schema validation and hallucination guards.
   - Source: ai-prompt-design.md §3; ai-analysis-subsystem.md §9-10
   - Verification: Integration test with mock EvidenceSnapshot data.

5. **Dean workspace shows versioned analysis history** with comparisons.
   Version comparison UI correctly shows deltas, direction indicators,
   and classification changes.
   - Source: dean-ai-review-workspace.md §4, §7
   - Verification: Playwright test navigates comparison view, verifies
     metric deltas.

6. **All 27 compute functions pass their test suites.** Happy path, edge
   case, and failure tests all pass.
   - Source: uaf-engineering-specification.md §1, §7
   - Verification: `npm run test` passes with 100% metric computation tests.

7. **Existing AiReport records remain accessible** without migration.
   Old API routes return existing data. New pipeline writes to new tables.
   - Source: ai-analysis-subsystem.md §14
   - Verification: E2E test queries old and new endpoints, both return data.

8. **Partial AI failure still produces COMPLETE status.** When some AI
   modules fail, the analysis completes with deterministic data for those
   sections.
   - Source: ai-analysis-subsystem.md §11
   - Verification: Integration test with Ollama disabled produces COMPLETE
     with aiStatus.overall = "PARTIAL".

9. **PromptVersion registry correctly serves active versions.** Only one
   version per moduleId has `supersededAt = null`. Superseding a version
   makes the new version active.
   - Source: uaf-domain-model.md §3.10; ai-analysis-subsystem.md §8
   - Verification: Unit test for version lifecycle.

10. **API endpoints return correct response shapes** per the specification
    in §9.2.
    - Source: ai-analysis-subsystem.md §13; dean-ai-review-workspace.md §11
    - Verification: API integration tests verify response shapes with Zod.

---

## 18. Document Cross-Reference Matrix

| Topic | Domain Model | Engineering Spec | AI Subsystem | Prompt Design | Dean Workspace | Extraction | Master Blueprint |
|---|---|---|---|---|---|---|---|
| QuestionBankAnalysis | §3.1 | — | §2 | — | — | — | §4 |
| AnalysisVersion | §3.2 | — | §7, §12 | — | — | — | §4, §11 |
| EvidenceSnapshot | §3.3 | — | §6 | — | — | — | §4, §6 |
| AnalysisSnapshot | §3.4 | — | §12 | — | — | — | §4 |
| PaperAnalysis | §3.7 | — | §12 | — | §5 | — | §4 |
| UAFMetric | §3.5 | §1-§2 | §12 | — | — | — | §3, §4 |
| ConfidenceScore | §3.6 | §1.6, §4 | — | — | — | §2.7 | §3, §4 |
| Risk | §3.8 | — | — | §3.7 | — | — | §4 |
| Recommendation | §3.9 | — | — | §3.8 | — | — | §4 |
| AnalysisEvidence | §3.10 | — | — | — | — | — | §4 |
| PromptVersion | §3.11 | — | §8 | §5 | — | — | §4, §8 |
| SCI Formula | — | §1.4 | — | — | — | §3.3 | §3 |
| MII Formula | — | §1.4 | — | — | — | §6.12 | §3 |
| BDI Formula | — | §1.4 | — | §3.2 | — | §7.9 | §3 |
| CVI Formula | — | §1.4 | — | §3.4 | — | §5.9 | §3 |
| MCAI Formula | — | §1.4 | — | §3.3 | — | §8.8 | §3 |
| DBI Formula | — | §1.4 | — | §3.3 | — | §8.5 | §3 |
| QCQI Formula | — | §1.5 | — | §3.9 | — | §9.5 | §3 |
| CAI Formula | — | §1.5 | — | — | — | §10.4 | §3 |
| AMI Formula | — | §1.5 | — | — | — | §10.6.3 | §3 |
| FRI Formula | — | §1.5 | — | — | — | §10.7.3 | §3 |
| QPQI Formula | — | §1.6 | — | — | — | §11.2 | §3 |
| OCI Formula | — | §1.6 | — | — | — | §11.5 | §3 |
| ECS/EQI Formulas | — | §1.1 | — | — | — | §4.9-§4.10 | §3 |
| MII Sub-Metrics | — | §1.2 | — | — | — | §6.3-§6.11 | §3 |
| Bloom Sub-Metrics | — | §1.3 | — | — | — | §7.3-§7.5 | §3 |
| Classification Matrix | §4 | §4 | — | — | — | §3.2 | §3 |
| IndexCode Enum | §4 | — | — | — | — | — | §3 |
| AnalysisStatus | §3.1 | §5.3 | — | — | §10 | — | §5 |
| Pipeline Services | — | §2, §5 | §2, §3 | — | — | — | §2 |
| EvidenceBuilder | — | §3 | §3 | — | — | — | §2, §6 |
| MetricEngine | — | §1-§2 | §3 | — | — | — | §2, §6 |
| SnapshotBuilder | — | — | §3, §6 | — | — | — | §2, §6 |
| PromptBuilder | — | — | §3, §8 | §1, §6 | — | — | §2, §8 |
| OllamaService | — | — | §3, §11 | §7 | — | — | §2, §6 |
| ResponseValidator | — | — | §9-§10 | §4 | — | — | §2, §6 |
| AnalysisBuilder | — | — | §3 | — | — | — | §2, §6 |
| Hallucination Guards | — | — | §10 | §4 | — | — | §6 |
| Prompt Modules | — | — | §8 | §3 | — | — | §8 |
| Context Budget | — | — | — | §1, §8 | — | — | §8 |
| Dean Dashboard | — | — | — | — | §2 | — | §10 |
| UAF Overview Page | — | — | — | — | §3 | — | §10 |
| Version Comparison | — | — | §13 | — | §4 | — | §10 |
| Per-Paper Analysis | — | — | — | — | §5 | — | §10 |
| Index Drill-Down | — | — | — | — | §6 | — | §10 |
| AI Attribution | — | — | — | — | §8 | — | §10 |
| State Management | — | — | — | — | §9 | — | §10 |
| API Endpoints | — | — | §13 | — | §11 | — | §9 |
| Prisma Schema | — | — | §12 | — | — | — | §4, §7 |
| Coexistence | — | — | §14 | — | — | — | §12 |
| Rollout | — | — | §14 | — | — | — | §13 |
| Testing | — | §7 | — | §6 | §9 | — | §12 |
| Failure Mode Matrix | — | §6 | — | — | — | — | §3 |
| Evidence Hierarchy | — | — | — | — | — | §2.3 | — |

---

## Out of Scope

The following are intentionally absent from this document:

- **Actual implementation code** — this is a design blueprint. Code lives in
  `src/modules/uaf-analysis/`.
- **Deployment infrastructure configuration** — Docker, environment variables,
  CI/CD pipelines.
- **User training materials** — Dean workspace user guide, coordinator guides.
- **Commercial Ollama hosting setup** — Ollama deployment is assumed running.
- **Alternative AI model comparisons** — Qwen3.5:3b is the only supported model.
- **Event definitions** — Domain events (`AnalysisCompleted`, `MetricComputed`)
  are defined in a separate events specification.
- **Async queue implementation** — Whether the pipeline runs synchronously
  or via a job queue is an operational decision deferred to implementation.
- **Authentication and authorization** — Handled by EMQPGS's existing
  `withApiHandler` and `AuthorizationService`.
- **MinIO integration** — Paper storage and export is outside the analysis
  subsystem.
- **Existing AiReport modification** — Old code path remains untouched.
- **Dark mode design tokens** — Colors reference CSS variables defined in
  the design token system, not this document.
- **Responsive layout below 768px** — Version comparison is not designed for
  mobile screens.

---

*End of UAF AI Analysis Subsystem Master Blueprint. All formulas trace to
`uaf-engineering-specification.md` sections. All entities trace to
`uaf-domain-model.md` without redefinition. All UI components trace to
`dean-ai-review-workspace.md`. All prompt designs trace to
`ai-prompt-design.md`. All service interfaces trace to
`ai-analysis-subsystem.md`. All academic framework references trace to
`uaf-framework-extraction.md`.*
