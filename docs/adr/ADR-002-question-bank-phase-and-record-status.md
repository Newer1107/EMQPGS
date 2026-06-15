# ADR-002: QuestionBankPhase + RecordStatus replaces 10-state QuestionBankStatus

**Status:** Accepted (implemented)
**Date:** 2026-06-14

---

## Problem

The original design had a single `QuestionBankStatus` enum with 10 ordered states:

```
DRAFT → IN_PROGRESS → UNDER_MODERATION → MODERATED → REPORT_GENERATED
    → AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED
    → AWAITING_COORDINATOR_APPROVAL → APPROVED → LOCKED
```

This was problematic:
- The 10-state model conflated **workflow progress** with **operational state** (lock is not a workflow step)
- Signed report states (`AWAITING_HOD_SIGN`, `SIGNED_REPORT_UPLOADED`, `AWAITING_COORDINATOR_APPROVAL`) added complexity for a feature that was never fully built
- Every transition had to be explicitly listed in the transition table — many were never used
- The `LOCKED` state was terminal with no unlock path, which was operationally risky

## Alternatives considered

1. **Keep the 10-state enum but simplify** — Remove unused states but keep a single status column. Still conflates phase with operational state.

2. **Three-state enum** — Only DRAFTING, COMPLETE, LOCKED. Not enough granularity for the multi-step workflow.

3. **Two orthogonal axes** — One enum for phase (workflow progress) and one for record status (operational immutability). Clean separation.

## Decision

Use two orthogonal enums:

```prisma
enum QuestionBankPhase {
  DRAFTING
  MODERATION
  APPROVAL
  COMPLETE
}

enum RecordStatus {
  ACTIVE
  LOCKED
  ARCHIVED
}
```

Every `QuestionBank` has both a `phase` and a `recordStatus`. They are independent — a bank in `MODERATION` phase can be `ACTIVE` or `LOCKED`.

## Consequences

**Positive:**
- Phase transitions are simple: 4 phases, 4 allowed transitions
- Record status is orthogonal — you can lock a bank at any phase
- Lock is reversible (unlock API exists)
- Signed record: `ARCHIVED` for long-term retention
- Removed 7 enum values, 30+ lines of transition table, entire signed report workflow paths
- Transition validation is trivial: `transitions.ts` is 12 lines

**Negative:**
- Two columns to check instead of one when determining bank state
- Other systems expecting a single status need to map `(phase, recordStatus)` to a display label
- Old `SIGNED_REPORT_UPLOADED` → `AWAITING_COORDINATOR_APPROVAL` logic was deleted — any coordinator approval work that depended on specific report state needs re-evaluation
