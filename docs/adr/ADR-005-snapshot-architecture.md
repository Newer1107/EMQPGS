# ADR-005: Snapshot architecture — QuestionBankSnapshot and PaperSnapshot

**Status:** Accepted (implemented)
**Date:** 2026-06-14

---

## Problem

When a question bank is locked or papers are generated, the system needs an immutable record of what the bank looked like at that moment. Without snapshots:
- Locking a bank would just set `recordStatus = LOCKED` and the slot assignments could still be modified (logically inconsistent)
- Paper generation could produce different results on re-generation, and there would be no record of what the original papers contained
- Auditors would have no way to verify what was in the bank at the time of approval
- Question-bank-level exports would have no frozen reference state

## Alternatives considered

1. **No snapshots** — Rely on the current database state. Anyone can reconstruct from current slot assignments. Problem: slots can change (unlock/re-lock), question text can change (revision history exists but requires reconstruction).

2. **JSON dump on every mutation** — Capture the entire bank state on every change. Massive storage overhead, most snapshots never used.

3. **Targeted snapshots at key lifecycle events** — Capture a snapshot only at lock time (QuestionBankSnapshot) and at paper generation time (PaperSnapshot). Minimal storage, captures the exact state needed for audit and verification.

## Decision

Use targeted snapshots at two key events:

### QuestionBankSnapshot
Created when `QuestionBankWorkflowService.lockQuestionBank()` runs.
```prisma
model QuestionBankSnapshot {
  id              String       @id @default(cuid())
  questionBankId  String
  snapshotType    SnapshotType // LOCKED | APPROVED | EXPORTED
  phase           QuestionBankPhase
  status          RecordStatus
  slotAssignments Json         // Full slot array at lock time
  paperAssignments Json?
  metadata        Json?
  version         Int          // Bank version at snapshot time
  createdAt       DateTime
}
```

### PaperSnapshot
Created/updated when `PaperGenerationService.generatePapers()` runs.
```prisma
model PaperSnapshot {
  id              String       @id @default(cuid())
  questionBankId  String
  variant         PaperVariant // PAPER_A, PAPER_B, PAPER_C
  paperJson       Json
  coverageScore   Float?
  difficultyScore Float?
  qualityScore    Float?
  metadata        Json?
  createdAt       DateTime
}
```

## Consequences

**Positive:**
- Immutable record of what was in the bank when locked
- Immutable record of what was in each paper variant when generated
- Low storage overhead (small JSON payloads)
- Audit trail: snapshot + createdAt gives exact temporal state
- QuestionBankSnapshot uses `version` to correlate with the bank's optimistic lock version

**Negative:**
- PaperSnapshot uses `upsert` — re-generating papers overwrites the snapshot. The previous snapshot is lost. (The `GeneratedPaper` record still retains the old data, but there's no dedicated snapshot history.)
- Only two snapshot types currently — adding more events requires new snapshot types or new models
