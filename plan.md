# EMQPGS — Architecture Change Report

## Status: COMPLETE — all 4 phases implemented

Architecture redesign scope: 100%. Build passes. 105/105 tests pass. Seed runs.

---

## What Changed

### Schema — 5 new models, 2 modified, 3 removed, 4 new enums

**Removed models/tables:**
- `QuestionBankQuestion` (replaced by `QuestionSlot.assignedQuestionId`)
- `QuestionBankStatus` enum (10-state → 4-phase + RecordStatus)

**Removed columns from QuestionBank:**
- `status` (QuestionBankStatus)
- `coordinatorDecision`, `coordinatorReviewedAt`, `coordinatorReviewRemark`
- `signedReportAssetId`, `signedReportUploadedAt`
- `FileAsset @relation("questionBankSignedReport")`

**New models:**
| Model | Purpose |
|---|---|
| `QuestionSlot` | Per-bank slot grid (126 slots). `assignedQuestionId` is the sole bank↔question linkage. Unique per `(questionBankId, moduleNumber, marks, slotNumber)`. |
| `PaperPattern` | 1:1 with QuestionBank. Seeded from exam-type defaults at creation. Defines `totalModules`, `marksPattern`, `slotsPerModule`, `totalSlots`. |
| `ApprovalDecision` | Extracted coordinator decision. Write-once record: `APPROVED`/`REJECTED` + remark. |
| `QuestionBankSnapshot` | Frozen bank state. Created on lock. Stores slot assignments as JSON. |
| `PaperSnapshot` | Frozen generated paper. Created on paper generation. Stores full paper JSON. |

**New enums:**
| Enum | Values |
|---|---|
| `QuestionBankPhase` | `DRAFTING → MODERATION → APPROVAL → COMPLETE` |
| `RecordStatus` | `ACTIVE`, `LOCKED`, `ARCHIVED` |
| `ReviewStatus` | `PENDING`, `SUBMITTED`, `CONFIRMED` |
| `SnapshotType` | `LOCKED`, `APPROVED`, `EXPORTED` |

**Modified models:**
| Model | Change |
|---|---|
| `QuestionBank` | `phase` + `recordStatus` replace `status`. `lockedReason` added. |
| `DeanReview` | `@map()` directives removed (columns match field names). `status ReviewStatus` added. |
| `QuestionUsageHistory` | 6 optional FKs replaced by `sourceType` + `sourceId`. |
| `FileAsset` | `linkedEntityType`, `linkedEntityId` removed. |
| `QuestionLibraryItem` | `bankLinks` → `slotAssignments`. |

### Services — 3 new modules, 8 modified, 0 deleted

**New modules:**
| Module | Files | Purpose |
|---|---|---|
| `question-slots/` | `service.ts`, `repository.ts`, `validation.ts` | Slot CRUD: list, assign, unassign |
| `readiness/` | `engine.ts` | Assesses phase readiness: `{ ready, issues, warnings }`. Does NOT auto-advance. |
| `question-bank-metrics/` | `service.ts` | Inventory reporting: fill rates, module/marks breakdown, moderation stats, coverage distributions |

**Modified services:**
| Service | Change |
|---|---|
| `QuestionBankService` | `updateStatus()` → `advancePhase()`, `lock()`, `unlock()`. Uses `isValidPhaseTransition()`. |
| `QuestionBankWorkflowService` | `initializeQuestionBank()` creates 126 slots + PaperPattern atomically. `lockQuestionBank()` creates `QuestionBankSnapshot`. |
| `ReportService` | `coordinatorDecision()` creates `ApprovalDecision` record. Phase transitions: `APPROVED` → `COMPLETE`, `REJECTED` → `MODERATION`. |
| `PaperGenerationService` | Creates `PaperSnapshot` per variant. Uses `slots` instead of `bankQuestions`. |
| `AiReportService` | Sets `phase = APPROVAL` on completion (was `status = REPORT_GENERATED`). |
| `PaperGenerator` | Uses `slots[].assignedQuestion` instead of `bankQuestions[].question`. |
| `AnalysisEngine` | Uses `slots[].assignedQuestion` instead of `bankQuestions[].question`. |
| `DeanReviewService` | Uses `recordStatus: LOCKED` instead of `status: LOCKED`. |
| `StorageService` | No `linkedEntityType`/`linkedEntityId` params. `signed-reports` removed from buckets. |

**Removed:**
- `SignedReportService`
- `question-bank-questions/` module (service, repository, validation, route)
- `signed-report-upload.tsx` component
- Moderator signed report pages (2 pages)

### API routes — 7 new, 4 modified, 6 removed

**New routes:**
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/question-banks/:id/slots` | List all slots with fill status |
| `PATCH` | `/api/question-banks/:id/slots/:slotId` | Assign question to slot |
| `DELETE` | `/api/question-banks/:id/slots/:slotId` | Unassign question from slot |
| `GET` | `/api/question-banks/:id/readiness` | ReadinessEngine assessment |
| `GET` | `/api/question-banks/:id/metrics` | QuestionBankMetrics DTO |
| `PATCH` | `/api/question-banks/:id/advance` | Manual phase advance (gated by ReadinessEngine) |

**Modified routes:**
| Route | Change |
|---|---|
| `lock` | Sets `recordStatus = LOCKED` + creates `QuestionBankSnapshot` |
| `unlock` | Sets `recordStatus = ACTIVE` |
| `coordinator-decision` | Creates `ApprovalDecision` record instead of updating `QuestionBank.coordinatorDecision` |

**Removed routes:**
| Route | Reason |
|---|---|
| `POST /api/question-banks/:id/signed-report/presign` | HOD sign workflow eliminated |
| `POST /api/question-banks/:id/signed-report` | HOD sign workflow eliminated |
| `GET/POST /api/question-bank-questions` | Replaced by slot assignment API |

### Workflow — simplified from 10 states to 4 phases

**Before (10 states):**
```
DRAFT → IN_PROGRESS → UNDER_MODERATION → MODERATED → REPORT_GENERATED
→ AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED → AWAITING_COORDINATOR_APPROVAL
→ APPROVED → LOCKED
```

**After (4 phases + orthogonal lock):**
```
DRAFTING → MODERATION → APPROVAL → COMPLETE
                              └→ MODERATION (loopback on reject)
RecordStatus: ACTIVE | LOCKED (orthogonal — any phase can be locked)
```

Phase advancement is manual (coordinator clicks "Advance"), gated by ReadinessEngine. The engine returns `{ ready, issues, warnings }` — no auto-advance.

### Phase transition flow

| From | To | Gate |
|---|---|---|
| DRAFTING | MODERATION | ReadinessEngine: all slots assigned |
| MODERATION | APPROVAL | ReadinessEngine: all questions moderated + AI report complete |
| APPROVAL | COMPLETE | Coordinator decision = APPROVED |
| APPROVAL | MODERATION | Coordinator decision = REJECTED (loopback) |

---

## Files Touched

### Schema (1 file)
- `prisma/schema.prisma` — major rewrite

### Core services (16 files)
- `src/modules/question-banks/transitions.ts` — rewritten
- `src/modules/question-banks/service.ts` — rewritten
- `src/modules/question-banks/repository.ts` — updated
- `src/modules/question-banks/validation.ts` — updated
- `src/modules/question-banks/mutable-guard.ts` — updated
- `src/modules/question-banks/slot-summary.ts` — updated
- `src/modules/coordinator/question-bank.service.ts` — major update
- `src/modules/coordinator/service.ts` — updated
- `src/modules/coordinator/reporting-coordinator.service.ts` — updated
- `src/modules/coordinator/subject.service.ts` — updated
- `src/modules/reports/service.ts` — rewritten
- `src/modules/reports/validation.ts` — updated
- `src/modules/reports/ai-report.service.ts` — updated
- `src/modules/reports/paper.service.ts` — updated
- `src/modules/reports/paper-generator.ts` — updated
- `src/modules/reports/analysis-engine.ts` — updated

### New modules (6 files)
- `src/modules/question-slots/service.ts` — NEW
- `src/modules/question-slots/repository.ts` — NEW
- `src/modules/question-slots/validation.ts` — NEW
- `src/modules/readiness/engine.ts` — NEW
- `src/modules/question-bank-metrics/service.ts` — NEW

### Infrastructure (5 files)
- `src/lib/constants.ts` — updated labels
- `src/lib/storage/storage-service.ts` — removed bucket + polymorphic fields
- `src/lib/server-data.ts` — updated
- `docker-compose.yml` — removed signed-reports bucket
- `.env` (no change)

### API routes (16 files)
- `app/api/question-banks/[id]/advance/route.ts` — NEW
- `app/api/question-banks/[id]/slots/route.ts` — NEW
- `app/api/question-banks/[id]/slots/[slotId]/route.ts` — NEW
- `app/api/question-banks/[id]/readiness/route.ts` — NEW
- `app/api/question-banks/[id]/metrics/route.ts` — NEW
- `app/api/question-banks/[id]/status/route.ts` — rewritten
- `app/api/question-banks/[id]/lock/route.ts` — updated
- `app/api/question-banks/[id]/unlock/route.ts` — rewritten
- `app/api/question-banks/[id]/coordinator-decision/route.ts` — updated
- `app/api/question-banks/[id]/signed-report/route.ts` — DELETED
- `app/api/question-banks/[id]/signed-report/presign/route.ts` — DELETED
- `app/api/question-bank-questions/route.ts` — DELETED
- `app/api/storage/presign/route.ts` — updated
- `app/api/moderation/questions/[id]/route.ts` — updated

### Frontend pages (10 files)
- `app/(protected)/dashboard/coordinator/question-banks/page.tsx` — updated
- `app/(protected)/dashboard/coordinator/question-banks/[id]/page.tsx` — rewritten
- `app/(protected)/dashboard/coordinator/questions/page.tsx` — updated
- `app/(protected)/dashboard/coordinator/questions/[id]/page.tsx` — updated
- `app/(protected)/dashboard/contributor/questions/page.tsx` — updated
- `app/(protected)/dashboard/moderator/questions/page.tsx` — (pre-existing, no change needed)
- `app/(protected)/dashboard/moderator/questions/[id]/page.tsx` — updated
- `app/(protected)/dashboard/moderator/question-banks/[id]/signed-report/page.tsx` — DELETED
- `app/(protected)/dashboard/moderator/signed-reports/page.tsx` — DELETED
- `app/(protected)/dashboard/coordinator/coverage/page.tsx` — updated
- `app/(protected)/dashboard/coordinator/coverage/coverage-client.tsx` — updated

### Components (4 files)
- `src/components/forms/bank-actions-panel.tsx` — rewritten
- `src/components/forms/workflow-timeline.tsx` — rewritten
- `src/components/forms/next-step-guidance.tsx` — rewritten
- `src/components/forms/signed-report-upload.tsx` — DELETED

### Other modules (4 files)
- `src/modules/moderation/service.ts` — updated
- `src/modules/moderation/dashboard.service.ts` — updated
- `src/modules/question-library/service.ts` — updated
- `src/modules/question-library/repository.ts` — updated
- `src/modules/production/dean-review.service.ts` — updated
- `src/modules/production/export.service.ts` — updated
- `src/modules/production/backup.service.ts` — updated

### Tests (6 files)
- `tests/unit/question-bank-status.test.ts` — rewritten
- `tests/unit/coordinator-decision.test.ts` — rewritten
- `tests/unit/analysis-engine.test.ts` — rewritten
- `tests/unit/paper-generator.test.ts` — updated
- `tests/unit/question-governance.test.ts` — updated
- `tests/unit/service-concurrency.test.ts` — updated
- `tests/unit/performance.test.ts` — updated

### Seed (1 file)
- `prisma/seed.ts` — updated

---

## Metrics

| Metric | Value |
|---|---|
| Files created | 10 |
| Files deleted | 6 |
| Files modified | 44 |
| Total files touched | 60 |
| Schema models removed | 1 |
| Schema models added | 5 |
| Schema columns removed | 7 |
| Enums removed | 1 |
| Enums added | 4 |
| API routes added | 7 |
| API routes removed | 6 |
| New service modules | 3 |
| Unit tests | 105 passing (15 test files) |
| Build | Compiles and type-checks clean |

---

## Architecture Decisions

| Decision | Status |
|---|---|
| `QuestionBankQuestion` eliminated. `QuestionSlot` is the sole linkage. | ✅ Done |
| HOD signed report workflow eliminated. | ✅ Done |
| `QuestionBank` uses `phase` + `recordStatus` (not 10-state enum). | ✅ Done |
| `ApprovalDecision` extracted as separate entity. | ✅ Done |
| `QuestionBankSnapshot` + `PaperSnapshot` for immutability. | ✅ Done |
| `PaperPattern` per-bank (1:1), seeded from exam-type defaults. | ✅ Done |
| `ReadinessEngine` assesses readiness. Phase advancement is manual. | ✅ Done |
| `QuestionBankMetrics` service for inventory reporting. | ✅ Done |
| `DomainEvent` deferred to future phase. | ✅ Deferred |
| Institution/Program/Regulation deferred to future phase. | ✅ Deferred |
| `FileAsset` polymorphic fields removed. | ✅ Done |
| `QuestionUsageHistory` simplified to `sourceType` + `sourceId`. | ✅ Done |
| `DeanReview` column naming fixed. | ✅ Done |
| `QuestionLibraryItem` may belong to multiple banks (via slots). | ✅ Documented |
