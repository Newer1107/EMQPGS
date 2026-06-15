# ADR-004: ReadinessEngine is advisory; phase advancement is manual

**Status:** Accepted (implemented)
**Date:** 2026-06-14

---

## Problem

Should the system automatically advance a question bank's phase when conditions are met, or should advancement require explicit coordinator action?

Auto-advance would:
- Reduce coordinator effort
- Make the system feel more automated
- Reduce the chance of banks getting stuck in an intermediate state

Manual advancement would:
- Give the coordinator explicit control over when to move
- Allow the coordinator to address warnings before advancing
- Prevent surprising transitions (e.g., bank auto-advances while coordinator is reviewing)
- Handle edge cases where the readiness check is incomplete

## Alternatives considered

1. **Fully automatic** — ReadinessEngine runs on every relevant mutation and advances phase if ready. Risky — what if the coordinator disagrees with readiness?

2. **Semi-automatic** — ReadinessEngine auto-advances for some transitions (e.g. DRAFTING→MODERATION when all slots filled) but not others. Inconsistent behavior.

3. **Advisory only** — ReadinessEngine reports readiness, but the coordinator must explicitly call `advancePhase()`. Clear, predictable, explicit.

## Decision

ReadinessEngine is advisory only. `ReadinessEngine.isReady()` returns `{ ready, issues, warnings }`. The coordinator calls `advancePhase()` or `coordinatorDecision()` separately.

The advance API validates via `isValidPhaseTransition()` in `transitions.ts` — it does NOT call the ReadinessEngine. A coordinator can advance even with warnings (though not with blocking issues, since the ReadinessEngine returns those as separate concerns).

## Consequences

**Positive:**
- Coordinator has full control over phase transitions
- Clear separation of concerns: readiness evaluation vs. state mutation
- No surprises — banks never advance without explicit action
- The API is simple and predictable: coordinator calls advance, it either works or throws 409

**Negative:**
- Slightly more coordinator effort (must check readiness separately, then advance)
- Possible UX issue: coordinator might try to advance without checking readiness and get a generic error
- ReadinessEngine's full value depends on the UI showing its output alongside the advance button
