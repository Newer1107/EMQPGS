# AI Analysis Subsystem Architecture

> **Purpose:** Define the containers, service interfaces, data flows, and integration
> boundaries for the UAF AI Analysis Pipeline within EMQPGS.
>
> **Reference documents:**
> - Domain entities: `uaf-domain-model.md` (ratified) — referenced, never redefined
> - Formulas and pipeline stages: `uaf-engineering-specification.md` (ratified) — cited by section
> - Existing implementation: `src/modules/reports/ai-report.service.ts`, `src/modules/ai/ai-provider.ts`,
>   `src/modules/ai/ollama-service.ts`

**Status:** Draft
**Applies to:** UAF Analysis Pipeline, AI Provider Layer, Dean Workspace
**Version:** 1.0

---

## Table of Contents

1. [System Context](#1-system-context-c4-level-1)
2. [Container Diagram](#2-container-diagram-c4-level-2)
3. [Service Interfaces](#3-service-interfaces)
4. [Sequence Diagram — Full Analysis Pipeline](#4-sequence-diagram--full-analysis-pipeline)
5. [Sequence Diagram — Regeneration (Evidence Unchanged)](#5-sequence-diagram--regeneration-evidence-unchanged)
6. [EvidenceHash Implementation](#6-evidencehash-implementation)
7. [Versioning Strategy](#7-versioning-strategy)
8. [Prompt Registry Integration](#8-prompt-registry-integration)
9. [Response Validator Design](#9-response-validator-design)
10. [Response Validator — Hallucination Guards](#10-response-validator--hallucination-guards)
11. [Retry and Fallback Strategy](#11-retry-and-fallback-strategy)
12. [Prisma Schema Additions](#12-prisma-schema-additions)
13. [Dean Workspace Integration Points](#13-dean-workspace-integration-points)
14. [Migration Path from Existing AiReport](#14-migration-path-from-existing-aireport)
15. [Out of Scope](#15-out-of-scope)

---

## 1. System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EMQPGS System                                    │
│                                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────────┐       │
│  │  Dean     │    │  Coordinator │    │       System (COE, Cron)      │       │
│  │ (Faculty) │    │  (Faculty)   │    │  (auto-trigger, scheduler)    │       │
│  └─────┬─────┘    └──────┬───────┘    └──────────────┬───────────────┘       │
│        │                 │                           │                        │
│        │  View analysis  │  Trigger analysis         │  Scheduled re-analysis  │
│        │  Compare        │  Review results           │                        │
│        │  Approve        │                           │                        │
│        ▼                 ▼                           ▼                        │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │                     EMQPGS (Existing System)                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │   │
│  │  │  Question    │  │  Question    │  │  Dean Review Workspace       │ │   │
│  │  │  Bank Mgmt  │  │  Paper Gen   │  │  (comparison, variant       │ │   │
│  │  │             │  │              │  │   selection, export)         │ │   │
│  │  └──────┬──────┘  └──────┬───────┘  └──────────────┬───────────────┘ │   │
│  │         │                │                          │                  │   │
│  │         └────────────────┼──────────────────────────┘                  │   │
│  │                          │                                             │   │
│  │         ┌────────────────▼──────────────────────────┐                  │   │
│  │         │         UAF Analysis Pipeline (New)        │                  │   │
│  │         │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │                  │   │
│  │         │  │Evidence- │ │Metric-   │ │Snapshot-   │ │                  │   │
│  │         │  │Builder   │ │Engine    │ │Builder     │ │                  │   │
│  │         │  └──────────┘ └──────────┘ └────────────┘ │                  │   │
│  │         │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │                  │   │
│  │         │  │Prompt-   │ │Ollama-   │ │Response-   │ │                  │   │
│  │         │  │Builder   │ │Service   │ │Validator   │ │                  │   │
│  │         │  └──────────┘ └──────────┘ └────────────┘ │                  │   │
│  │         │  ┌──────────┐ ┌──────────┐                │                  │   │
│  │         │  │Analysis- │ │Persist-  │                │                  │   │
│  │         │  │Builder   │ │ence      │                │                  │   │
│  │         │  └──────────┘ └──────────┘                │                  │   │
│  │         └───────────────────────────────────────────┘                  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│         ┌──────────────────┐          ┌──────────────────────────┐          │
│         │  MySQL 8         │          │  MinIO Object Store      │          │
│         │  (Existing)      │          │  (Existing)              │          │
│         │  - QuestionBank  │          │  - Generated papers      │          │
│         │  - AiReport      │          │  - Export artifacts      │          │
│         │  - New tables    │          │                          │          │
│         └──────────────────┘          └──────────────────────────┘          │
│                                                                             │
│                         ┌──────────────────────┐                            │
│                         │  Ollama (External)    │                            │
│                         │  qwen3.5:3b           │                            │
│                         │  /api/generate        │                            │
│                         └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Actors:**
- **Dean** — views analysis reports, compares versions, approves papers
- **Coordinator** — triggers analysis runs, reviews results for their department
- **System** — COE admin or cron scheduler that triggers batch re-analysis

**Systems:**
- **EMQPGS** — the existing monolith (Next.js, Prisma, MySQL, MinIO)
- **UAF Analysis Pipeline** — new subsystem of 8 containers
- **Ollama** — external LLM, the only AI provider

---

## 2. Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UAF Analysis Pipeline (New Subsystem)                  │
│                                                                             │
│  ┌────────────────────┐    ┌────────────────────┐                          │
│  │   AiOrchestrator   │    │    AiProvider       │                          │
│  │   (top-level       │    │   (thin interface   │                          │
│  │    coordinator)    │    │    wrapping Ollama)  │                          │
│  └─────────┬──────────┘    └──────────┬──────────┘                          │
│            │                          │                                      │
│  ┌─────────▼──────────────────────────────────────────────────────────┐     │
│  │                     Pipeline Containers (8 stages)                  │     │
│  │                                                                     │     │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐      │     │
│  │  │ Evidence-    │───▶│ MetricEngine │───▶│ SnapshotBuilder  │      │     │
│  │  │ Builder      │    │ (Determin-   │    │                  │      │     │
│  │  │              │    │  istic only) │    │                  │      │     │
│  │  └──────────────┘    └──────────────┘    └────────┬─────────┘      │     │
│  │                                                    │                │     │
│  │  ┌──────────────┐    ┌──────────────┐              │                │     │
│  │  │ Response-    │◀───│ OllamaService│◀───┌─────────▼────────┐      │     │
│  │  │ Validator    │    │              │    │  PromptBuilder   │      │     │
│  │  │              │    │              │    │                  │      │     │
│  │  └──────┬───────┘    └──────────────┘    └──────────────────┘      │     │
│  │         │                                                           │     │
│  │  ┌──────▼───────┐    ┌──────────────┐                              │     │
│  │  │ Analysis-    │───▶│ Persistence  │                              │     │
│  │  │ Builder      │    │              │                              │     │
│  │  └──────────────┘    └──────────────┘                              │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  External Dependencies:                                                      │
│    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐            │
│    │  MySQL 8     │    │  MinIO       │    │  Ollama API      │            │
│    │  (Prisma)    │    │  (S3)        │    │  /api/generate   │            │
│    └──────────────┘    └──────────────┘    └──────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Container Responsibilities

| Container | Responsibility | Defined In |
|---|---|---|
| **AiOrchestrator** | Top-level coordinator. Manages the 8-stage pipeline, status transitions, error handling, cache checks. | This document, Section 3 |
| **EvidenceBuilder** | Collects raw data from QuestionBank + QuestionLibraryItem. Produces `RawBankData`. Does NOT compute metrics. | Engineering spec, Section 3 |
| **MetricEngine** | Computes all 27 UAF metrics via deterministic formulas. No AI involvement. DAG-ordered execution. | Engineering spec, Section 1-2 |
| **SnapshotBuilder** | Assembles `EvidenceSnapshot` from metrics + raw data. Computes `EvidenceHash`. | This document, Section 6 |
| **PromptBuilder** | Loads `PromptVersion` records from DB. Builds structured prompts from snapshot data. | This document, Section 8 |
| **OllamaService** | Sends prompts to Ollama. Manages timeouts, retry, and fallback. | This document, Section 3 |
| **ResponseValidator** | Validates AI JSON output against Zod schemas. Runs hallucination guards. | This document, Section 9-10 |
| **AnalysisBuilder** | Merges deterministic metrics + validated AI response into final `AnalysisSnapshot`. | This document, Section 3 |
| **Persistence** | Transactional writes to new DB tables. Saves all domain entities. | This document, Section 12 |
| **AiProvider** | Thin interface wrapping Ollama. Only container that knows about Ollama HTTP. | This document, Section 3 |

---

## 3. Service Interfaces

### Pipeline Service Interfaces

```typescript
// ─── AiProvider (thin Ollama wrapper) ──────────────────────────────────────

export interface AiProviderResult<T> =
  | { success: true; data: T; model: string; durationMs: number; tokensUsed?: number }
  | { success: false; error: string };

export interface AiOptions {
  model?: string;
  context?: number;
  temperature?: number;
  format?: "json" | "text";
}

export interface AiProvider {
  generate(prompt: string, options: AiOptions): Promise<AiProviderResult<string>>;
}

// ─── Raw Bank Data ──────────────────────────────────────────────────────────

export interface RawBankData {
  questionBankId: string;
  subjectId: string;
  batchSemesterId: string;
  totalQuestions: number;
  // Per-question detail (see engineering-spec Section 3.2 for full shape)
  questions: QuestionEvidence[];
  // Aggregated counts
  successfullyExtractedAttributes: number;
  requiredAttributes: number;
  verifiedAttributes: number;
  extractedAttributes: number;
  // ... all fields from ExtractionEvidence in engineering spec
}

// ─── Evidence Builder ──────────────────────────────────────────────────────

interface EvidenceBuilder {
  collect(questionBankId: string): Promise<RawBankData>;
}

// ─── Metric Engine ─────────────────────────────────────────────────────────

interface MetricEngine {
  computeAll(raw: RawBankData): Promise<{
    metrics: UAFMetric[];
    confidences: ConfidenceScore[];
  }>;
}

// ─── Snapshot Builder ──────────────────────────────────────────────────────

interface SnapshotBuilder {
  build(
    metrics: UAFMetric[],
    confidences: ConfidenceScore[],
    raw: RawBankData,
    versionMeta: AnalysisVersionMeta,
  ): Promise<EvidenceSnapshot>;
}

// ─── Prompt Builder ────────────────────────────────────────────────────────

interface StructuredPrompts {
  modules: Array<{
    moduleId: PromptModuleId;
    promptText: string;
    promptVersionId: PromptVersionId;
    contextBudget: number;
  }>;
}

interface PromptBuilder {
  build(snapshot: EvidenceSnapshot): Promise<StructuredPrompts>;
}

// ─── Ollama Service ────────────────────────────────────────────────────────

interface AIRawResponse {
  modules: Record<PromptModuleId, unknown>;
  rawText: string;
  model: string;
  durationMs: number;
  tokensUsed?: number;
}

interface OllamaService {
  analyze(
    prompts: StructuredPrompts,
    snapshot: EvidenceSnapshot,
  ): Promise<AiProviderResult<AIRawResponse>>;
}

// ─── Response Validator ────────────────────────────────────────────────────

interface ValidatedAIResponse {
  modules: Record<PromptModuleId, unknown>;
  failures: Array<{
    moduleId: PromptModuleId;
    reason: string;
    guardTriggered?: string;
  }>;
}

interface ResponseValidator {
  validate(
    response: AIRawResponse,
    schema: ZodSchema,
  ): Promise<ValidatedAIResponse>;
}

// ─── Analysis Builder ──────────────────────────────────────────────────────

interface AnalysisBuilder {
  assemble(
    metrics: UAFMetric[],
    confidences: ConfidenceScore[],
    ai: ValidatedAIResponse,
    snapshot: EvidenceSnapshot,
  ): Promise<AnalysisSnapshot>;
}

// ─── Persistence ────────────────────────────────────────────────────────────

interface Persistence {
  save(snapshot: AnalysisSnapshot): Promise<void>;
}
```

### AiOrchestrator (Top-Level Coordinator)

```typescript
interface AiOrchestrator {
  /**
   * Runs the full 8-stage analysis pipeline for a question bank.
   * 1. Creates QuestionBankAnalysis (status=INITIALIZED)
   * 2. Routes through all 8 containers
   * 3. Handles EvidenceHash cache check
   * 4. Manages status transitions and error handling
   */
  runAnalysis(questionBankId: string, triggeredBy: UserId): Promise<AnalysisSnapshot>;

  /**
   * Re-runs analysis with possible EvidenceHash cache hit.
   * If evidence unchanged, skips Ollama and restores prior AI output.
   */
  regenerateAnalysis(questionBankId: string, triggeredBy: UserId): Promise<AnalysisSnapshot>;

  /**
   * Returns current analysis status for a question bank.
   */
  getStatus(questionBankId: string): Promise<AnalysisStatus>;
}
```

### AiProvider (isolated Ollama wrapper)

```typescript
interface AiProvider {
  generate(prompt: string, options?: AiOptions): Promise<AiProviderResult<string>>;
}

interface AiOptions {
  model?: string;         // default: env.OLLAMA_MODEL (qwen3.5:3b)
  context?: number;        // default: 8192
  temperature?: number;    // default: 0.7
  format?: "json" | "text";
}

interface AiResult {
  text: string;
  model: string;
  durationMs: number;
  tokensUsed?: number;
}
```

The `AiProvider` interface is the only abstraction layer between the pipeline and
Ollama. It exists so Ollama can be replaced without rewriting the pipeline, but
the system intentionally has only one implementation (`OllamaProvider`). No
multi-provider abstraction, no factory, no registry. The interface exists for
testability (mock in tests) and isolation of HTTP concerns.

---

## 4. Sequence Diagram — Full Analysis Pipeline

```
Dean/Coord        AiOrchestrator       EvidBuilder      MetricEngine     SnapshotBuilder
    │                    │                  │                 │                │
    │  triggerAnalysis   │                  │                 │                │
    │───────────────────▶│                  │                 │                │
    │                    │  create QBA      │                 │                │
    │                    │  (INITIALIZED)   │                 │                │
    │                    │──▶ DB ──────────▶│                 │                │
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
    │                    │  ├─ Group 3 (MII, BDI, DBI...)   │                │
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
    │                    │                  │                 │                │
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
         │                  │                   │  ── JSON.parse               │
         │                  │                   │  ── Zod schema check         │
         │                  │                   │  ── Semantic/guard checks    │
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
◀────────│──────────────────────────────────────────────────────────────────────│
         │  return AnalysisSnapshot                                             │
```

### Pipeline Stage Summary

| Step | Container | Status Transition | Output |
|---|---|---|---|
| 1 | AiOrchestrator | INITIALIZED | QuestionBankAnalysis record |
| 2 | EvidenceBuilder | → EXTRACTING | RawBankData |
| 3 | MetricEngine | → COMPUTING | 27 UAFMetrics + ConfidenceScores |
| 4 | SnapshotBuilder | (same) | EvidenceSnapshot + evidenceHash |
| 5 | Cache Check | (same) | Cache hit → skip to AnalysisBuilder |
| 6 | PromptBuilder | → AI_PENDING | StructuredPrompts |
| 7 | OllamaService | (same) | AIRawResponse |
| 8 | ResponseValidator | → AI_COMPLETE | ValidatedAIResponse |
| 9 | AnalysisBuilder | (same) | AnalysisSnapshot |
| 10 | Persistence | → COMPLETE | DB records written |

---

## 5. Sequence Diagram — Regeneration (Evidence Unchanged)

```
Dean/Coord        AiOrchestrator       EvidBuilder      MetricEngine     SnapshotBuilder
    │                    │                  │                 │                │
    │  regenerate(qbId)  │                  │                 │                │
    │───────────────────▶│                  │                 │                │
    │                    │  create QBA      │                 │                │
    │                    │  (INITIALIZED)   │                 │                │
    │                    │──▶ DB            │                 │                │
    │                    │                  │                 │                │
    │                    │  ── (same flow through            │                │
    │                    │       EvidenceBuilder,            │                │
    │                    │       MetricEngine,               │                │
    │                    │       SnapshotBuilder)            │                │
    │                    │                  │                 │                │
    │                    │  ◀── EvidenceSnapshot             │                │
    │                    │      + evidenceHash(new)          │                │
    │                    │                  │                 │                │
    │                    │  ──▶ DB: query prior versions     │                │
    │                    │       by questionBankId           │                │
    │                    │       ORDER BY versionNumber DESC │                │
    │                    │       LIMIT 1                     │                │
    │                    │                  │                 │                │
    │                    │  ◀── prior evidenceHash (old)     │                │
    │                    │                  │                 │                │
    │                    │  ╔═══════════════════════════════╗│                │
    │                    │  ║  COMPARE: new evidenceHash    ║│                │
    │                    │  ║  === old evidenceHash         ║│                │
    │                    │  ║  RESULT: MATCH                ║│                │
    │                    │  ╚═══════════════════════════════╝│                │
    │                    │                  │                 │                │
    │                    │  ──▶ DB: load cached AI output    │                │
    │                    │       from prior AnalysisVersion  │                │
    │                    │       with matching evidenceHash  │                │
    │                    │                  │                 │                │
    │                    │  ◀── prior ValidatedAIResponse    │                │
    │                    │      (cached)                     │                │
    │                    │                  │                 │                │
```

```
    AnalysisBuilder      Persistence
         │                  │
         │  assemble(metrics, cached_ai, snapshot)
    ◀────│──────────────────│
         │                  │
         │  save(snapshot)  │
         │─────────────────▶│
         │                  │ ── transactional write ──▶ DB
         │                  │
         │  updateStatus    │
         │  (COMPLETE)      │
         │──▶ DB            │
         │                  │
◀────────│──────────────────│
         │  return AnalysisSnapshot (immediate)
```

### Cache Hit Flow

1. EvidenceBuilder collects data (same as full pipeline)
2. MetricEngine computes metrics (same as full pipeline)
3. SnapshotBuilder builds EvidenceSnapshot + evidenceHash
4. Orchestrator queries prior AnalysisVersion for same questionBankId
5. If prior evidenceHash matches new hash:
   - Skip PromptBuilder entirely
   - Skip OllamaService entirely
   - Skip ResponseValidator entirely
   - Load prior validated AI response from DB
   - Pass cached AI response directly to AnalysisBuilder
6. AnalysisBuilder runs with cached AI output
7. Persistence saves new AnalysisVersion (with new versionNumber, same evidenceHash)
8. Status set to COMPLETE immediately

This means regeneration of an unchanged bank returns in seconds, not minutes.

---

## 6. EvidenceHash Implementation

### Canonical JSON Requirement

The EvidenceHash must be deterministic. Two snapshots with identical content
must produce identical hashes, regardless of key ordering, whitespace, or
floating-point representation.

```typescript
import { createHash } from "node:crypto";

/**
 * Computes the EvidenceHash for cache-key derivation.
 *
 * @param snapshot - The EvidenceSnapshotData (deterministic evidence blob)
 * @param evaluationEngineVersion - SemVer of the MetricEngine (e.g. "1.0.0")
 * @param promptVersion - SemVer of the active prompt pack (e.g. "2.1.0")
 * @returns SHA-256 hex string
 */
function computeEvidenceHash(
  snapshot: EvidenceSnapshotData,
  evaluationEngineVersion: string,
  promptVersion: string,
): EvidenceHash {
  const canonicalJson = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  const input = canonicalJson + evaluationEngineVersion + promptVersion;
  return createHash("sha256").update(input, "utf-8").digest("hex") as EvidenceHash;
}
```

### When EvidenceHash Changes

The hash changes whenever any of these three inputs differ:

| Input | Changes When |
|---|---|
| `snapshot` (EvidenceSnapshotData) | Questions are added/removed/modified in the bank, metrics change, computation order changes |
| `evaluationEngineVersion` | MetricEngine formulas are updated, new metrics added, classification matrix changes |
| `promptVersion` | Prompt templates are updated, output schema changes, context budget changes |

### Cache Key Strategy

```
Key: evidenceHash (string, 64 hex chars)
Lookup: "SELECT ai_output FROM analysis_version WHERE evidence_hash = :hash ORDER BY version_number DESC LIMIT 1"
TTL: No expiration (immutable by design)
Invalidation: None (hash change naturally produces cache miss)
```

The `evidenceHash` is persisted on every `AnalysisVersion`. A cache hit means
reusing the prior version's validated AI output verbatim.

---

## 7. Versioning Strategy

### Version Fields (Persisted on Every AnalysisVersion)

Every analysis record captures the exact conditions of its run:

```typescript
interface AnalysisVersionMeta {
  evaluationEngineVersion: string;   // SemVer, e.g. "1.0.0"
  promptVersion: string;             // SemVer, references PromptVersion.id
  analysisSchemaVersion: string;     // SemVer, e.g. "1.0.0"
  ollamaModel: string;              // e.g. "qwen3.5:3b"
  ollamaContext: number;            // 8192
  ollamaTemperature: number;        // default: 0.7
  evidenceHash: EvidenceHash;       // SHA-256 computed at runtime
  createdAt: DateTime;
}
```

### Versioning Rules

1. `versionNumber` is monotonic per `questionBankId`. Each run increments by 1.
2. An `AnalysisVersion` is IMMUTABLE once persisted. No field may be updated.
3. If evidence is unchanged (hash match), a new `AnalysisVersion` is still created
   (incremented versionNumber) but references the cached AI output. The hash is
   the same. This preserves the version history.
4. If evaluation engine, prompt, or schema version changes, the hash WILL change,
   triggering a fresh Ollama call.

### Purpose of Each Version Field

| Field | Why It Exists |
|---|---|
| `evaluationEngineVersion` | Audit: which formula version produced the metrics |
| `promptVersion` | Audit: which prompt templates were used |
| `analysisSchemaVersion` | Compatibility: downstream consumers check this |
| `ollamaModel` | Reproducibility: different models produce different output |
| `ollamaContext` | Reproducibility: context window affects output shape |
| `ollamaTemperature` | Reproducibility: temperature affects randomness |
| `evidenceHash` | Cache key + integrity check |

---

## 8. Prompt Registry Integration

### Design

PromptVersion records are stored in the database, not in memory or config files.
The PromptBuilder loads them at runtime.

### PromptVersion Table

| Field | Type | Description |
|---|---|---|
| id | `PromptVersionId` | Unique identifier |
| moduleId | `PromptModuleId` | Which analysis module (e.g. "executive-summary") |
| version | `string` | SemVer (e.g. "1.2.0") |
| promptText | `string` | Full prompt template with {{placeholder}} variables |
| outputSchema | `Json` | Zod-compatible schema definition |
| contextBudget | `number` | Max tokens for this module's output |
| createdAt | `DateTime` | When created |
| supersededAt | `DateTime?` | When replaced (null = active version) |

### Prompt Loading Flow

```
PromptBuilder.build(snapshot)
  │
  ├── For each PromptModuleId:
  │     SELECT * FROM PromptVersion
  │     WHERE moduleId = :moduleId AND supersededAt IS NULL
  │     ORDER BY version DESC LIMIT 1
  │
  ├── Template resolution:
  │     promptText
  │       .replace("{{subjectName}}", snapshot.subject.name)
  │       .replace("{{metrics}}", serializeMetrics(snapshot.metrics))
  │       .replace("{{evidence}}", serializeEvidence(snapshot))
  │       ... per-module variable substitution
  │
  ├── Context budget enforcement:
  │     Truncate/compress to fit contextBudget tokens
  │     (approximate: 1 token ≈ 4 chars for English text)
  │
  └── Return StructuredPrompts { modules: [...] }
```

### Invariant

Only one version of a `moduleId` may have `supersededAt = null` at a time.
When a new prompt version is published, the previous version is marked superseded.
Old versions are never deleted (immutability guarantee).

---

## 9. Response Validator Design

### Validation Pipeline

Each module's AI response passes through a 4-stage pipeline:

```
Raw AI JSON string (per module)
  │
  ├── Stage 1: JSON.parse
  │   ├── Success → Stage 2
  │   ├── Failure → retry with format fix instruction
  │   └── Retry exhausted → mark module as FAILED, return null
  │
  ├── Stage 2: Zod Schema Validation
  │   ├── Matches schema → Stage 3
  │   ├── Violation → retry with stricter format guide
  │   └── Retry exhausted → log violation, return null for module
  │
  ├── Stage 3: Semantic Checks (Hallucination Guards)
  │   ├── Passes → Stage 4
  │   ├── Fails → drop module output, log warning, return null
  │   └── See Section 10 for full guard definitions
  │
  └── Stage 4: Return ValidatedAIResponse
      └── { modules: { [moduleId]: parsedOutput or null }, failures: [...] }
```

### Zod Schema Shape (Per Module)

Each `PromptVersion.outputSchema` defines the expected JSON shape:

```typescript
// Example: executive-summary module schema
const executiveSummarySchema = z.object({
  executiveSummary: z.string().min(50).max(500),
  keyStrengths: z.array(z.string()).min(1).max(5),
  keyWeaknesses: z.array(z.string()).min(1).max(5),
  overallTone: z.enum(["POSITIVE", "NEUTRAL", "CONCERNED"]),
});

// Example: bloom-analysis module schema
const bloomAnalysisSchema = z.object({
  distributionCommentary: z.string().min(20).max(300),
  balanceAssessment: z.enum(["WELL_BALANCED", "MODERATELY_BALANCED", "IMBALANCED"]),
  recommendation: z.string().min(10).max(200),
});
```

### Validation Result Shape

```typescript
interface ValidatedAIResponse {
  // Successful modules keyed by PromptModuleId
  modules: Record<PromptModuleId, unknown>;
  // Failures tracked per module
  failures: Array<{
    moduleId: PromptModuleId;
    stage: "PARSE" | "SCHEMA" | "SEMANTIC";
    reason: string;
    originalOutput?: string; // logged but not persisted in analysis
  }>;
  // Metadata
  overallValid: boolean; // true if at least 70% of modules passed
}
```

### Per-Module vs. Global Failure

Each module is validated independently. A failure in one module does not fail
the entire pipeline. The `AnalysisBuilder` handles null module outputs by
marking them as "AI Unavailable" and proceeding with deterministic data.

---

## 10. Response Validator — Hallucination Guards

These guards run after JSON.parse and Zod validation. They catch cases where
the AI produces syntactically valid JSON with factually incorrect content.

### Guard 1: Number Injection Guard

**Detection:** Scan AI output for numeric values that don't appear in the input
`EvidenceSnapshot`. Compare every number in the output against permitted values
in the snapshot data.

```
Algorithm:
  1. Extract all numeric values from EvidenceSnapshot (metrics, counts, percentages)
  2. Extract all numeric values from AI output
  3. For each AI number not present in snapshot:
     - Check if it's a reasonable derivation (e.g. average, sum, difference)
     - If not derivable from snapshot numbers → flag as hallucination
```

**Action:** Drop the offending module output. Mark as `HALLUCINATION_NUMBER_INJECTION`.

**Example:**
- Snapshot has `SCI = 0.80`
- AI output says `structuralCompliance: 0.85` (value not in input)
- Guard flags this module → output set to null

### Guard 2: Entity Name Guard

**Detection:** Scan AI output for entity names (module codes, CO codes, Bloom
levels, difficulty tiers) that don't exist in the snapshot.

```
Algorithm:
  1. Extract all entity names from EvidenceSnapshot:
     - Module codes (e.g. M1, M2, ..., M6)
     - CO codes (e.g. CO1, CO2, ..., CO6)
     - Bloom levels (Remember, Understand, Apply, Analyze, Evaluate, Create)
     - Difficulty tiers (Easy, Medium, Hard)
     - Question types
  2. Extract all entity references from AI output
  3. Flag any reference not in snapshot's known entities
```

**Action:** Drop the offending module output. Mark as `HALLUCINATION_ENTITY_NAME`.

**Example:**
- Snapshot has modules M1-M4 (ISE-1)
- AI output says "Module M5 has weak coverage"
- M5 does not exist in the snapshot → guard triggers

### Guard 3: Verdict Alignment Guard

**Detection:** Check that the AI's qualitative verdict matches the deterministic
classification matrix values.

```
Algorithm:
  1. Get the deterministic classification for each metric from the MetricEngine
  2. Compare AI output's qualitative assessment against deterministic values
  3. A mismatch is allowed (AI can interpret), but a contradiction is not:
     - Metric value = 0.95 (EXEMPLARY) AND AI says "major revision needed" → CONTRADICTION
     - Metric value = 0.30 (MAJOR_REVISION) AND AI says "exemplary quality" → CONTRADICTION
     - Metric value = 0.75 (EFFECTIVE) AND AI says "adequate" → ALLOWED (semantic overlap)
  4. Contradiction threshold: output is dropped if AI contradicts by 2+ classification levels
```

**Action:** Log warning. Drop the offending module only if contradiction exceeds
2 classification levels. If within 1 level, allow with warning.

**Classification level ordering:**
```
EXEMPLARY(6) > HIGHLY_EFFECTIVE(5) > EFFECTIVE(4) > ACCEPTABLE(3) > NEEDS_IMPROVEMENT(2) > MAJOR_REVISION(1)
```

Contradiction distance = `abs(AI_level - deterministic_level)`.
- Distance 0-1: allowed (interpretation)
- Distance 2+: flagged, module dropped

### Guard 4: Field Mandate Guard

**Detection:** Verify the AI output contains ALL required fields defined in the
module's `outputSchema`. Zod already validates shape, but this guard catches
cases where Zod accepts a partial object (nullable fields) but the output is
semantically incomplete.

```
Algorithm:
  1. Load the required field set from PromptVersion.outputSchema
  2. Check every required field exists and is non-null in AI output
  3. If any required field is missing or null → flag the module
```

**Action:** Attempt one retry with explicit field mandate. If still failing,
drop the module. Mark as `FIELD_MANDATE_VIOLATION`.

### Guard 5: Length Guard

**Detection:** Check that the AI output does not exceed the module's
`contextBudget` in length (approximate token count).

```
Algorithm:
  1. Get contextBudget for the module from PromptVersion
  2. Approximate tokens: text.length / 4 (English heuristic)
  3. If approximate tokens > contextBudget:
     - Truncate to fit
     - Log warning
```

**Action:** Truncate silently. No module drop. Mark as `TRUNCATED` in warnings.

### Hallucination Guard Summary

| # | Guard | Detection | Action | Severity |
|---|---|---|---|---|
| 1 | Number Injection | AI numbers not in snapshot | Drop module | HIGH |
| 2 | Entity Name | AI references unknown entities | Drop module | HIGH |
| 3 | Verdict Alignment | AI contradicts deterministic classification by 2+ levels | Drop module | MEDIUM |
| 4 | Field Mandate | Required fields missing/null in output | Retry, then drop | MEDIUM |
| 5 | Length Guard | Output exceeds context budget | Truncate | LOW |

---

## 11. Retry and Fallback Strategy

### Retry Policy

Each Ollama call has a maximum of 4 attempts before falling back.

| Attempt | Trigger | Action | Timeout |
|---|---|---|---|
| 1 | Module timeout (120s default) | Retry with same parameters | Same |
| 2 | Invalid JSON response | Retry with explicit "Return ONLY valid JSON" instruction appended to prompt | Same |
| 3 | Zod schema violation | Retry with stricter format guide appended (field names + types listed) | Same |
| 4 | Any failure | Fallback: set module output to null, mark as AI_UNAVAILABLE | N/A |

### Per-Module Independence

Retries are per-module, not global. If module A fails on attempt 4 and module B
succeeds on attempt 1, module B's output is preserved. Module A gets null.

### Fallback Behavior

When a module fails all retries:

```
1. AnalysisBuilder receives null for that module
2. Module is marked as AI_UNAVAILABLE in the analysis status
3. deterministicReport includes note: "AI analysis unavailable for [module]. Using deterministic data only."
4. The QuestionBankAnalysis is still set to COMPLETE
5. A warning notification is sent to the triggering user
```

### Global Pipeline Fallback

If ALL modules fail (Ollama unreachable, network down, model not found):

```
1. status = COMPLETE (not FAILED — deterministic data is always available)
2. All AI-dependent fields = null
3. executiveSummary = "AI analysis unavailable. Showing deterministic analysis only."
4. Notification sent to triggering user with Ollama connectivity warning
```

### Timeout Configuration

```
OLLAMA_TIMEOUT_MS = 120_000       // per-module timeout
MAX_RETRIES = 3                    // 3 retries = 4 total attempts
RETRY_BACKOFF_MS = [0, 1000, 5000] // immediate, 1s, 5s between attempts
```

---

## 12. Prisma Schema Additions

### New Models

```prisma
// ─── QuestionBankAnalysis (Root Aggregate) ─────────────────────────────────

model QuestionBankAnalysis {
  id              String         @id @default(cuid())
  questionBankId  String
  version         Int            @default(1)
  status          AnalysisStatus @default(INITIALIZED)
  triggeredById   String
  startedAt       DateTime       @default(now())
  completedAt     DateTime?

  // Relations
  questionBank    QuestionBank   @relation(fields: [questionBankId], references: [id])
  triggeredBy     User           @relation(fields: [triggeredById], references: [id])
  versions        AnalysisVersion[]
  snapshot        AnalysisSnapshot?
  metrics         UAFMetric[]
  risks           Risk[]
  recommendations Recommendation[]
  evidence        AnalysisEvidence[]
  paperAnalyses   PaperAnalysis[]

  @@index([questionBankId, status])
  @@index([questionBankId, version])
}

// ─── AnalysisVersion (Immutable) ───────────────────────────────────────────

model AnalysisVersion {
  id                      String           @id @default(cuid())
  questionBankAnalysisId  String
  versionNumber           Int
  evaluationEngineVersion String
  promptVersion           String
  analysisSchemaVersion   String
  ollamaModel             String
  ollamaContext           Int              @default(8192)
  ollamaTemperature       Float            @default(0.7)
  evidenceHash            String
  createdAt               DateTime         @default(now())

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
  evidenceSnapshot        EvidenceSnapshot?
  promptVersionRef        PromptVersion?       @relation(fields: [promptVersion], references: [id])

  @@unique([questionBankAnalysisId, versionNumber])
  @@index([evidenceHash])
}

// ─── EvidenceSnapshot (Deterministic Evidence Blob) ────────────────────────

model EvidenceSnapshot {
  id                  String           @id @default(cuid())
  analysisVersionId   String           @unique
  snapshot            Json
  evidenceHash        String
  sizeBytes           Int

  // Relations
  analysisVersion     AnalysisVersion  @relation(fields: [analysisVersionId], references: [id])

  @@index([evidenceHash])
}

// ─── AnalysisSnapshot (Read Model) ─────────────────────────────────────────

model AnalysisSnapshot {
  id                      String               @id @default(cuid())
  questionBankAnalysisId  String               @unique
  analysisVersionId       String
  fullReport              Json
  executiveSummary        String               @db.Text
  finalVerdict            FinalVerdict

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
  analysisVersion         AnalysisVersion      @relation(fields: [analysisVersionId], references: [id])
}

// ─── PaperAnalysis ─────────────────────────────────────────────────────────

model PaperAnalysis {
  id                      String               @id @default(cuid())
  questionBankAnalysisId  String
  generatedPaperId        String
  indexValues             Json
  aiNarrative             Json

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
  generatedPaper          GeneratedPaper       @relation(fields: [generatedPaperId], references: [id])

  @@unique([questionBankAnalysisId, generatedPaperId])
}

// ─── UAFMetric ─────────────────────────────────────────────────────────────

model UAFMetric {
  id                      String               @id @default(cuid())
  questionBankAnalysisId  String
  indexCode               String               // from IndexCode enum
  value                   Float?
  classification          String               // from Classification enum
  weight                  Float                @default(0)
  weightedScore           Float?
  formulaUsed             String
  computationOrder        Int

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
  confidence              ConfidenceScore?

  @@index([questionBankAnalysisId, indexCode])
}

// ─── ConfidenceScore ───────────────────────────────────────────────────────

model ConfidenceScore {
  id              String @id @default(cuid())
  uafMetricId     String @unique
  verifiedItems   Int
  requiredItems   Int
  score           Float
  percentage      Float
  classification  String // from ConfidenceClassification enum
  justification   String @db.Text

  // Relations
  uafMetric       UAFMetric @relation(fields: [uafMetricId], references: [id])
}

// ─── Risk ──────────────────────────────────────────────────────────────────

model Risk {
  id                      String   @id @default(cuid())
  questionBankAnalysisId  String
  finding                 String   @db.Text
  educationalRisk         String   @db.Text
  institutionalRisk       String   @db.Text
  priority                String   // from RiskPriority enum
  riskType                String   // from RiskType enum
  affectedModules         Json     // string[]
  affectedCOs             Json     // string[]
  evidenceReference       String

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
}

// ─── Recommendation ────────────────────────────────────────────────────────

model Recommendation {
  id                      String   @id @default(cuid())
  questionBankAnalysisId  String
  finding                 String   @db.Text
  recommendation          String   @db.Text
  priority                String   // from RiskPriority enum
  impact                  String   @db.Text
  suggestedActions        Json     // string[]
  evidenceReference       String

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
}

// ─── AnalysisEvidence ──────────────────────────────────────────────────────

model AnalysisEvidence {
  id                      String   @id @default(cuid())
  questionBankAnalysisId  String
  evidenceType            String   // from EvidenceType enum
  category                String
  description             String   @db.Text
  sourceReference         String
  level                   Int

  // Relations
  questionBankAnalysis    QuestionBankAnalysis @relation(fields: [questionBankAnalysisId], references: [id])
}

// ─── PromptVersion ─────────────────────────────────────────────────────────

model PromptVersion {
  id              String   @id @default(cuid())
  moduleId        String   // from PromptModuleId enum
  version         String
  promptText      String   @db.Text
  outputSchema    Json
  contextBudget   Int
  createdAt       DateTime @default(now())
  supersededAt    DateTime?

  // Relations
  analysisVersions AnalysisVersion[]

  @@unique([moduleId, version])
  @@index([moduleId, supersededAt])
}

// ─── AiReport (existing — unchanged) ──────────────────────────────────────
// See schema.prisma line 691 for existing model. Add optional field:
//   paperAnalysisId String?  // link to PaperAnalysis for migration path
```

### New Enums

```prisma
enum AnalysisStatus {
  INITIALIZED
  EXTRACTING
  COMPUTING
  AI_PENDING
  AI_COMPLETE
  COMPLETE
  FAILED
}

enum FinalVerdict {
  EXEMPLARY
  SATISFACTORY
  NEEDS_IMPROVEMENT
  MAJOR_REVISION
}
```

### Relations to Existing Models

```
QuestionBank  ──1:N──▶ QuestionBankAnalysis  (new, via questionBankId)
User          ──1:N──▶ QuestionBankAnalysis  (new, via triggeredById)
GeneratedPaper ──1:N──▶ PaperAnalysis        (new, via generatedPaperId)
AiReport      ──?:?──▶ PaperAnalysis         (optional, via paperAnalysisId for migration)
```

---

## 13. Dean Workspace Integration Points

### API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/question-banks/{id}/analysis` | Load the current (latest) full analysis |
| GET | `/api/question-banks/{id}/analysis/versions` | List all analysis versions |
| GET | `/api/question-banks/{id}/analysis/{versionId}` | Load a specific version's analysis |
| GET | `/api/question-banks/{id}/analysis/compare?v1={v1}&v2={v2}` | Diff two analysis versions |
| POST | `/api/question-banks/{id}/analysis/regenerate` | Trigger a new analysis run |
| GET | `/api/question-banks/{id}/analysis/status` | Check current analysis status |
| GET | `/api/question-banks/{id}/papers/{paperId}/analysis` | Per-paper analysis for variant |

### Response Shapes

**Load Analysis (GET /analysis)**
```json
{
  "id": "ana_xxx",
  "version": 3,
  "status": "COMPLETE",
  "snapshot": {
    "executiveSummary": "...",
    "finalVerdict": "EXEMPLARY",
    "fullReport": { "... 15 phases ..." }
  },
  "metrics": [
    {
      "indexCode": "SCI",
      "value": 0.8,
      "classification": "HIGHLY_EFFECTIVE",
      "weight": 0.1,
      "confidence": { "score": 0.9, "classification": "HIGH" }
    }
  ],
  "risks": [...],
  "recommendations": [...],
  "versioning": {
    "evaluationEngineVersion": "1.0.0",
    "promptVersion": "2.1.0",
    "analysisSchemaVersion": "1.0.0",
    "ollamaModel": "qwen3.5:3b",
    "evidenceHash": "abc123..."
  }
}
```

**List Versions (GET /analysis/versions)**
```json
{
  "versions": [
    {
      "versionNumber": 3,
      "status": "COMPLETE",
      "evidenceHash": "abc123...",
      "evaluationEngineVersion": "1.0.0",
      "promptVersion": "2.1.0",
      "createdAt": "2026-06-22T10:00:00Z"
    },
    {
      "versionNumber": 2,
      "status": "COMPLETE",
      "evidenceHash": "def456...",
      "evaluationEngineVersion": "1.0.0",
      "promptVersion": "2.0.0",
      "createdAt": "2026-06-21T14:00:00Z"
    }
  ]
}
```

**Compare Versions (GET /analysis/compare?v1=2&v2=3)**
```json
{
  "v1": 2,
  "v2": 3,
  "changes": {
    "metricsChanged": ["SCI", "BDI"],
    "verdictChanged": false,
    "aiModulesChanged": ["executive-summary", "bloom-analysis"],
    "newRisks": [...],
    "resolvedRisks": [...]
  },
  "diffs": {
    "SCI": { "from": 0.75, "to": 0.80, "classificationChanged": false },
    "BDI": { "from": 0.90, "to": 0.95, "classificationChanged": true }
  }
}
```

**Trigger Regeneration (POST /analysis/regenerate)**
```json
// Request: empty body (or { force: true } to bypass cache)
// Response:
{
  "id": "ana_yyy",
  "version": 4,
  "status": "EXTRACTING",
  "cacheHit": false,
  "estimatedDurationMs": 180000
}
```

**Check Status (GET /analysis/status)**
```json
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
```

**Per-Paper Analysis (GET /papers/{paperId}/analysis)**
```json
{
  "paperId": "paper_xxx",
  "variant": "A",
  "indexValues": {
    "coverage": 0.85,
    "difficulty": 0.72,
    "quality": 0.90
  },
  "aiNarrative": {
    "strengths": [...],
    "weaknesses": [...],
    "recommendation": "..."
  }
}
```

### Dean Workspace UI Components Needed

| Component | Data Source | Purpose |
|---|---|---|
| AnalysisSummaryCard | `GET /analysis` | Executive summary + final verdict |
| MetricTable | `GET /analysis` → metrics[] | All 10+ core indices with sparklines |
| VersionHistoryPanel | `GET /analysis/versions` | Timeline of analysis runs |
| VersionDiffView | `GET /analysis/compare` | Side-by-side comparison |
| RegenerateButton | `POST /analysis/regenerate` | Triggers new analysis |
| StatusIndicator | `GET /analysis/status` | Real-time pipeline progress |
| PaperAnalysisCard | `GET /papers/{id}/analysis` | Per-variant analysis |

---

## 14. Migration Path from Existing AiReport

### Coexistence Strategy

The existing `AiReport` table and `AiReportService` remain fully operational.
The new system writes to separate tables. No existing data is migrated.

```
┌──────────────────────────────────────────────┐
│                   EMQPGS                      │
│                                               │
│  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Old Path        │  │  New Path         │   │
│  │  AiReportService │  │  AiOrchestrator   │   │
│  │  → AiReport      │  │  → New tables     │   │
│  │  (unchanged)     │  │  (8 pipeline      │   │
│  │                  │  │   containers)     │   │
│  └─────────────────┘  └──────────────────┘   │
│                                               │
│  Both paths can coexist.                      │
│  Dean workspace reads from new path.          │
│  Old reports accessible via old API.          │
└──────────────────────────────────────────────┘
```

### Migration Steps

| Step | Action | Impact |
|---|---|---|
| 1 | Add `paperAnalysisId` field to AiReport (optional, nullable) | None — existing code ignores null |
| 2 | New analysis writes to QuestionBankAnalysis + new tables | No change to AiReport writes |
| 3 | Old AiReport records remain readable via existing API | Backwards compatible |
| 4 | Old API routes remain unchanged | No breaking changes |
| 5 | Dean workspace points to new API only | Older banks show "no analysis" |
| 6 | Optional: backfill old AiReport data into new tables | Separate job, not required |

### Timeline

```
Phase 1: Deploy new schema + pipeline (existing AiReport untouched)
Phase 2: Dean workspace reads from new tables (old reports still accessible)
Phase 3: Deprecate AiReportService (old code path still works, no new callers)
Phase 4: Optional backfill (when bandwidth allows)
```

### What Stays

- `AiReport` table — never dropped
- `AiReportService` — never removed (old records remain accessible)
- `src/modules/reports/ai-report.service.ts` — unchanged
- Old API routes — unchanged

### What Changes

- `AiReport` model gets optional `paperAnalysisId` field (nullable, no migration needed for existing rows)
- New `AiReportService` methods are deprecated markers
- All new code imports from new pipeline services

---

## 15. Out of Scope

The following are intentionally absent from this document:

- **Prompt text content** — defined in document 3 (Prompt Specification)
- **UI wireframes** — defined in document 4 (Dean Dashboard UI)
- **Implementation code** — actual TypeScript classes, not interfaces
- **Deployment configuration** — Docker, environment variables, CI/CD
- **Test specifications** — unit/integration tests are defined in engineering spec, Section 7
- **Event definitions** — domain events like `AnalysisCompleted` are defined in a separate events specification
- **Async queue implementation** — whether the pipeline runs synchronously or via a job queue is an operational decision
- **MinIO integration** — paper storage and export is outside the analysis subsystem
- **Authentication and authorization** — handled by EMQPGS's existing `withApiHandler` and `AuthorizationService`

---

*End of AI Analysis Subsystem Architecture. All domain entities reference
`uaf-domain-model.md` without redefinition. All pipeline stages and metric
functions reference `uaf-engineering-specification.md` by section.*
