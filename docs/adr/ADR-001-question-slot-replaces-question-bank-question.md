# ADR-001: QuestionSlot replaces QuestionBankQuestion as the linkage mechanism

**Status:** Accepted (implemented)
**Date:** 2026-06-14

---

## Problem

The original design used a `QuestionBankQuestion` join table to link `QuestionLibraryItem` to `QuestionBank`. This was a simple many-to-many bridge: `@@unique([questionBankId, questionId])`. It allowed a question to be linked to a bank but did not encode **position** — where in the bank's grid a question belongs. The position was implicitly the question's `(moduleNumber, marks)`, but multiple questions with the same (module, marks) could be linked without any ordering or slot-limit enforcement.

This created problems:
- No way to know if a (module, marks) position was "full" (7 questions max)
- No slot-level locking — a question could be linked but not reserved
- No explicit slot numbering — questions existed in the bank but had no ordinal position
- Paper generation had to figure out which questions to use from an unstructured set

## Alternatives considered

1. **Keep QuestionBankQuestion and add a position column** — Add `slotNumber` to the join table. This would create a composite unique key `[questionBankId, moduleNumber, marks, slotNumber]`. Equivalent to what QuestionSlot does, but on a bridge table that still feels like a "join" rather than a "slot".

2. **Promote QuestionSlot to a first-class entity** — Make the slot the primary entity. The join becomes implicit via `assignedQuestionId` on the slot. Clearer semantics: "a bank has slots; a slot may have a question."

3. **Keep both** — Maintain QuestionBankQuestion for simple linking and QuestionSlot for ordering. Unnecessary duplication.

## Decision

Promote `QuestionSlot` to a first-class entity. Remove `QuestionBankQuestion` entirely.

```prisma
model QuestionSlot {
  id                 String               @id @default(cuid())
  questionBankId     String
  moduleNumber       Int
  marks              Int
  slotNumber         Int
  assignedQuestionId String?
  reservedById       String?
  reservedAt         DateTime?
  isLocked           Boolean              @default(false)

  @@unique([questionBankId, moduleNumber, marks, slotNumber])
}
```

## Consequences

**Positive:**
- Slots are created at bank initialization time (from PaperPattern)
- Every slot has a well-defined position: `(module, marks, slotNumber)` — 1-7 per (module, marks)
- A question in a slot is automatically "in the bank" — no separate link step
- Paper generation iterates slots, not questions — clear what to use
- Slot-level locking (isLocked) enables fine-grained reservation
- Empty slots are explicit (`assignedQuestionId = null`)

**Negative:**
- Questions can only be in a bank via slots — no "unassigned" linking
- Migration: had to drop QuestionBankQuestion table and create QuestionSlot
- Application-layer enforcement needed for "one question per bank" invariant (the unique key is on position, not question)
