# Documentation Coverage Report

> Generated: 2026-06-15
> Verifies that all documentation reflects the current implemented architecture.

---

## Success criteria checklist

| Criterion | Status | Evidence |
|---|---|---|
| New engineer can understand architecture without reading source | ✅ | `docs/architecture.md` covers domain model, 5 Mermaid diagrams, service graph, invariants |
| New engineer can understand workflow without reading source | ✅ | `docs/workflow.md` covers all phase transitions, readiness, locking, approval, rejection loopback, full end-to-end flow |
| New engineer can understand database without reading source | ✅ | `docs/database.md` covers all 26 tables, 19 enums, invariants, ownership rules |
| New engineer can understand paper generation without reading source | ✅ | `docs/architecture.md` §5, `docs/workflow.md` §7 cover generation flow with sequence diagram |
| New engineer can understand readiness rules without reading source | ✅ | `docs/workflow.md` §3, `docs/architecture.md` §4 cover all readiness checks |
| New engineer can contribute code without reading source | ✅ | `docs/onboarding.md` covers module pattern, important services, API patterns, extension points |

## Document inventory

| Document | Status | Architecture alignment |
|---|---|---|
| `README.md` | **Rewritten** | ✅ QuestionBankPhase + RecordStatus, QuestionSlot, 5 MinIO buckets, no signed report, unlock exists |
| `docs/architecture.md` | **New** | ✅ Full domain model, state model, QuestionSlot linkage, readiness, paper generation, approval, service graph, invariants |
| `docs/database.md` | **New** | ✅ All 26 models, all relationships, all invariants, all enums |
| `docs/api.md` | **New** | ✅ All 59 route files, no deleted routes, no QuestionBankQuestion, no signed-report routes |
| `docs/workflow.md` | **New** | ✅ Phase transitions, ReadinessEngine, locking behavior, approval behavior, rejection loopback, paper generation lifecycle |
| `docs/onboarding.md` | **New** | ✅ Architecture summary, important services, common workflows, API patterns, debugging tips, extension points |
| `docs/rbac-matrix.md` | **Updated** | ✅ Removed signed report HOD upload row |
| `docs/production-checklist.md` | **Updated** | ✅ Fixed status references (phase, not 10-state) |
| `docs/security-checklist.md` | **Updated** | ✅ Fixed state machine references to two-axis model |
| `docs/deployment-guide.md` | **Unchanged** | ✅ Still accurate |
| `docs/monitoring-guide.md` | **Unchanged** | ✅ Still accurate |
| `docs/gap-report.md` | **New** | Documents all findings from initial audit |
| `docs/adr/ADR-001.md` | **New** | ✅ QuestionSlot replaces QuestionBankQuestion |
| `docs/adr/ADR-002.md` | **New** | ✅ QuestionBankPhase + RecordStatus |
| `docs/adr/ADR-003.md` | **New** | ✅ Signed report workflow removal |
| `docs/adr/ADR-004.md` | **New** | ✅ ReadinessEngine advisory, manual advancement |
| `docs/adr/ADR-005.md` | **New** | ✅ Snapshot architecture |
| `docs/README.md` (index) | **Rewritten** | ✅ Points to new docs only |
| `AGENTS.md` | **Updated** | ✅ Updated architecture rules, removed question-bank-questions module, updated doc references |

## Removed outdated docs

| Old document | Action | Moved to |
|---|---|---|
| `docs/architecture/system-overview.md` | Archived | `docs/archive/system-overview.md` |
| `docs/domains/question-domain.md` | Archived | `docs/archive/question-domain.md` |
| `docs/domains/exam-domain.md` | Archived | `docs/archive/exam-domain.md` |
| `docs/api/reference.md` | Archived | `docs/archive/api-reference.md` |
| `docs/developer/onboarding.md` | Archived | `docs/archive/developer-onboarding.md` |
| `EMQPGS-Complete-Operational-Workflow.md` | Archived | `docs/archive/EMQPGS-Complete-Operational-Workflow.md` |

## Remaining issues

| Issue | Priority | Action needed |
|---|---|---|
| Dead sidebar link in `app-shell.tsx:38` | ✅ **FIXED** | Replaced with comment |
| `docs/archive/` files reference old architecture | Low | Historical record — intentional |
| `docs/audits/` files reference old architecture | Low | Historical record — intentional |
| `docs/domains/academic-domain.md` and `production-domain.md` moved to archive with old refs | Low | Contents were still mostly accurate but needed to be alongside other domain docs in archive |
| Some deprecated empty directories may remain on disk | Low | `docs/architecture/`, `docs/domains/`, `docs/developer/`, `docs/api/` removed |

## Stats

| Metric | Before | After |
|---|---|---|
| Primary doc files (excluding archive) | 15 | 12 |
| Outdated architecture references | ~50 | 0 (in primary docs) |
| Mermaid diagrams | 0 | 5 |
| ADRs | 0 | 5 |
| Onboarding time estimate | 60+ min (had to read source to correct docs) | ~30 min |
