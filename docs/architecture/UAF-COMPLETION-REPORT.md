# UAF AI Analysis Subsystem — Architecture Completion Report

**Generated:** June 22, 2026  
**Status:** All 7 architectural documents complete (6 new + 1 reference)

---

## Documents Created

| # | Document | Lines | KB | Agent | Description |
|---|---|---|---|---|---|
| 0 | `uaf-domain-model.md` | 682 | 35 | writing | Foundation domain entities — QuestionBankAnalysis, EvidenceSnapshot, UAFMetric, etc. |
| 1 | `uaf-engineering-specification.md` | 1,120 | 55 | writing | 27 metric compute functions with DTOs, validation, failure modes, test specs |
| 2 | `ai-analysis-subsystem.md` | 1,194 | 67 | writing | 8-stage pipeline architecture, service interfaces, sequence diagrams, Prisma schema |
| 3 | `ai-prompt-design.md` | 1,610 | 65 | writing | 10 modular prompts, 8K context budgeting, hallucination guards, versioning |
| 4 | `dean-ai-review-workspace.md` | 993 | 60 | writing | Versioned analysis history UI, wireframes, comparison flows, state management |
| 5 | `uaf-master-blueprint.md` | 1,472 | 96 | writing | Capstone — all formulas, ADRs, rollout plan, risk register, cross-reference matrix |
| R | `uaf-framework-extraction.md` (reference) | 1,159 | 38 | writing | Complete UAF v3.3 spec extraction (pre-existing) |
| **Total** | **7 documents** | **8,230** | **417** | — | — |

---

## Architecture Decisions Made (ADRs)

| ID | Decision | Rationale | Documented In |
|---|---|---|---|
| ADR-1 | Deterministic Engine owns ALL calculations. AI never computes any metric. | Zero Fabrication Policy; AI is academic reviewer, not evaluator. | blueprint §2.12 |
| ADR-2 | Ollama-only with thin AiProvider service isolation. | Intentionally single-provider. Isolation prevents provider coupling. | blueprint §2.12 |
| ADR-3 | EvidenceSnapshot is the exact AI input — never raw bank data. | Prevents hallucination; enforces boundary; cacheable. | blueprint §2.12 |
| ADR-4 | EvidenceHash = SHA-256(snapshot + engineVersion + promptVersion) as cache key. | Skip Ollama when evidence unchanged; reproducible analyses. | blueprint §2.12 |
| ADR-5 | 10 modular prompts execute sequentially in independent 8K windows. | Each module focused; total >8K but per-call <3K. | prompt-design §2 |
| ADR-6 | Version everything — evaluations, metrics, prompts, schemas. | Every analysis reproducible; historical comparison possible. | blueprint §11 |
| ADR-7 | Prompt Registry in DB (PromptVersion table), not in-memory. | Audit traceability; version history; recovery after restart. | ai-subsystem §8 |
| ADR-8 | AI responses are structured JSON objects, not paragraph-heavy narrative. | UI renders structured cards; validation via Zod. | prompt-design §3 |
| ADR-9 | Two-mode Dean workspace: bank-level UAF overview + per-paper variant analysis. | UAF evaluates banks, not papers. Dean needs both views. | dean-workspace §2 |
| ADR-10 | Existing AiReport/AiReportService left untouched. New system coexists. | Zero migration risk for existing data. Backwards compatible. | ai-subsystem §14 |

---

## Unresolved Design Questions

| Question | Options Considered | Recommendation for v1 |
|---|---|---|
| EvidenceSnapshot storage: MySQL JSON column vs MinIO object? | MySQL is simpler, MinIO better for large snapshots | Start with MySQL JSON, move to MinIO if snapshots exceed 1MB |
| Default expected distributions: institutional policy or UAF defaults? | Institutional policy vs UAF v3.3 reference values | UAF defaults (from extraction doc) with override via SecurityConfig |
| Concurrent analysis requests for same bank? | Queue (serialize per bank) vs reject (return in-progress status) | Return in-progress status — simple, no queue infrastructure |
| Prompt version changes: auto-reanalyze all banks? | Auto vs manual trigger | Manual trigger via Dean workspace — safe for v1 |
| AI module failure: skip and mark PARTIAL vs retry indefinitely? | Cap-3 retry vs infinite retry vs skip immediately | Cap-3 retry then skip — pragmatism over perfection |

---

## Implementation Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| Qwen3.5:3b produces unreliable academic narrative | M | H | Fallback to deterministic-only mode; path to upgrade model |
| 8K context insufficient for complex modules | L | M | Merge adjacent modules; reduce evidence verbosity |
| Ollama latency (3B model on CPU) too slow for interactive use | M | M | Show progress bar; async pipeline; polling endpoint |
| EvidenceSnapshot exceeds expected size | M | L | Truncate oversized arrays; sample representative data; cap at 50K tokens |
| Formula errors in MetricEngine produce wrong indices | M | H | 3 tests per compute function; manual cross-check against extraction doc |
| Dean workspace performance with 10 tabs × multiple queries | M | M | Composite indexes; lazy loading tabs; field selection |
| Concurrent regeneration overwrites analysis versions | L | H | Optimistic locking on version number; unique constraint prevents duplicates |

---

## Migration Strategy (Current AiReport → New System)

1. **Phase 0 — Coexistence**: New code writes to QuestionBankAnalysis table. Existing AiReport untouched. No migration script needed.
2. **Phase 1 — Link**: Add optional `paperAnalysisId` to AiReport. Backfill null.
3. **Phase 2 — Opt-in**: New Dean workspace renders both old AiReport + new QuestionBankAnalysis.
4. **Phase 3 — Deprecate**: Old Dean UI marked "legacy". New UI is default.
5. **Phase 4 — Archive**: Old AiReport data remains readable but not writable.
6. **Phase 5 (future)**: If needed, migrate old AiReport JSON to new structured tables.

**Key principle**: No data loss at any phase. Old reports always accessible.

---

## Recommended Implementation Order

| Phase | Weeks | Deliverable | Key Files | Depends On |
|---|---|---|---|---|
| 0 | 1-2 | Prisma models + migrations | `prisma/schema.prisma` + migration SQL | domain-model.md |
| 1 | 2-4 | EvidenceBuilder + MetricEngine (27 functions) | `src/lib/uaf/evidence-builder.ts`, `src/lib/uaf/metric-engine.ts` | engineering-spec.md |
| 2 | 4-5 | SnapshotBuilder + EvidenceHash | `src/lib/uaf/snapshot-builder.ts` | Phase 1 |
| 3 | 5-7 | PromptBuilder + PromptVersion table + OllamaService | `src/lib/uaf/prompt-builder.ts`, `src/lib/uaf/ollama-service.ts` | Phase 2 + prompt-design.md |
| 4 | 7-8 | ResponseValidator + AnalysisBuilder + Persistence | `src/lib/uaf/response-validator.ts`, `src/lib/uaf/analysis-builder.ts` | Phase 3 |
| 5 | 8-10 | API endpoints + Dean workspace views | `app/api/question-banks/.../analysis/`, Dean UI components | Phase 4 + dean-workspace.md |
| 6 | 10-11 | Version history + comparison UI | Comparison view, diff components | Phase 5 |
| 7 | 11-12 | Testing + coexistence validation | Test files, integration tests, smoke tests | All phases |

---

## Estimated Implementation Effort

| Subsystem | Files | Est. Lines | Effort (person-weeks) | Complexity |
|---|---|---|---|---|
| Prisma models + migrations | 2-3 | 200 | 1 | Low |
| EvidenceBuilder | 2 | 300 | 1 | Low |
| MetricEngine (27 functions) | 3-4 | 1,200 | 3 | High — formula accuracy critical |
| SnapshotBuilder + EvidenceHash | 2 | 200 | 0.5 | Low |
| PromptBuilder + PromptVersion | 3 | 400 | 1 | Medium |
| OllamaService (wrapping existing) | 2 | 200 | 0.5 | Low |
| ResponseValidator | 2 | 300 | 1 | Medium |
| AnalysisBuilder + Persistence | 3 | 300 | 1 | Medium |
| API endpoints (8) | 8-10 | 600 | 2 | Medium |
| Dean workspace views (5 pages) | 5-8 | 1,500 | 3 | High — UX polish |
| Version history + comparison | 2-3 | 500 | 1.5 | Medium |
| Testing (~136 tests) | 15-20 | 2,000 | 2 | Medium |
| **Total** | **~50** | **~7,700** | **~17** | — |

---

## Document Cross-Reference Matrix

| Topic | Domain Model | Engineering Spec | AI Subsystem | Prompt Design | Dean Workspace | Master Blueprint |
|---|---|---|---|---|---|---|
| **QuestionBankAnalysis** | §3.1 | — | §2, §12 | — | — | §4 |
| **AnalysisVersion** | §3.2 | — | §12 | — | — | §4 |
| **EvidenceSnapshot** | §3.3 | §15 | §3, §6 | — | — | §3, §4, §6 |
| **UAFMetric** | §3.5 | §3-§14 | §12 | — | — | §3, §4 |
| **ConfidenceScore** | §3.7 | §2 | §12 | — | — | §3 |
| **PaperAnalysis** | §3.4 | — | §12 | — | §5 | §4 |
| **Risk** | §3.8 | — | — | §3(7) | §2 | §4 |
| **Recommendation** | §3.9 | — | — | §3(8) | §2 | §4 |
| **PromptVersion** | §3.11 | — | §8 | §5 | — | §8 |
| **SCI Formula** | — | §3.1 | — | — | — | §3 |
| **MII Formula** | — | §4.2 | — | — | — | §3 |
| **BDI Formula** | — | §5.1 | — | §3(2) | §6 | §3 |
| **CVI Formula** | — | §6.1 | — | §3(4) | — | §3 |
| **MCAI Formula** | — | §7.1 | — | — | — | §3 |
| **DBI Formula** | — | §8.1 | — | §3(3) | — | §3 |
| **QCQI Formula** | — | §9.1 | — | §3(9) | — | §3 |
| **CAI/AMI/FRI** | — | §10 | — | — | — | §3 |
| **QPQI/OCI** | — | §11, §12 | — | — | — | §3 |
| **Computation DAG** | — | §2 | §5 | — | — | §5 |
| **Pipeline services** | — | §15 | §3, §4 | — | — | §2 |
| **EvidenceHash** | §10 | — | §6 | — | — | §6, §11 |
| **Prompt modules** | — | — | §8 | §3 | — | §8 |
| **Context budgeting** | — | — | — | §2, §8 | — | §8 |
| **Response validator** | — | — | §9, §10 | — | — | §6 |
| **Hallucination guards** | — | — | §10 | §4 | — | §12 |
| **Dean dashboard** | — | — | — | — | §2 | §10 |
| **UAF overview page** | — | — | — | — | §3 | §10 |
| **Version comparison** | — | — | — | — | §4 | §10 |
| **Per-paper analysis** | — | — | — | — | §5 | §10 |
| **Index drill-down** | — | — | — | §3(2) | §6 | §10 |
| **API endpoints** | — | — | §13 | — | §11 | §9 |
| **Versioning strategy** | §10 | — | §7 | §5 | — | §11 |
| **Testing strategy** | — | §17 | — | §6 | §9 | §12 |
| **Rollout plan** | — | — | §14 | — | — | §13 |
| **Architecture ADRs** | — | — | — | — | — | §2 |
| **Risk register** | — | — | — | — | — | §14 |
| **Open questions** | — | — | — | — | — | §15 |
| **Assumptions** | — | — | — | — | — | §16 |
| **Acceptance criteria** | — | — | — | — | — | §17 |
| **Migration path** | — | — | §14 | — | — | §5 |

---

## Key Rules That Must Never Be Violated

1. **AI never computes any academic metric.** The Deterministic Engine (MetricEngine) owns every formula.
2. **EvidenceSnapshot is the exact AI input.** Never send raw QuestionBank data to Ollama.
3. **EvidenceHash determines cache hits.** If hash matches, skip Ollama entirely.
4. **All responses are structured JSON.** No paragraph-heavy narrative. The UI renders structured cards.
5. **Version everything.** Every analysis record persists engineVersion, promptVersion, schemaVersion, modelName, evidenceHash.
6. **Prompt Registry in DB.** Prompt text exists only in the PromptVersion table.
7. **Ollama is the only provider.** No multi-provider abstraction. Isolate behind AiProvider interface for hygiene only.
8. **Existing AiReport untouched.** New system coexists with old. No migration required.

---

*End of completion report. Ready for Phase 0 implementation (Prisma schema + migrations).*
