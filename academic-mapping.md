# Mapping Semesters to Students — Explained Simply

## The problem we're solving

In a college, every student belongs to a "batch" — like the batch that joined in 2024 and will graduate in 2028. All students in that batch move through their 8 semesters *together*, at the same pace, on the same calendar.

The system needs to know, at any given moment: **which semester is each batch currently in?** This matters because question papers, subjects, and exam cycles are all organized by semester. If the system doesn't know that the 2024 batch is currently in Semester V, it can't generate the right exam papers for them.

## The key insight: don't track students, track batches

Here's the trick that makes this easy: we don't need to track *individual* students at all. Every student in a batch is in the exact same semester as everyone else in that batch. So instead of asking "what semester is Rahul in?" we just ask "what semester is the 2024-2028 batch in?" — and that answer applies to every student in it automatically.

Think of it like a school where an entire grade gets promoted together at the end of the year. You don't track each kid's progress separately — you just say "Grade 5 is now Grade 6" and it's true for all 30 kids in that class at once.

## Meet the "Academic Duration"

This is the entity that represents one batch, from the year it starts to the year it graduates.

**Example:** `2024-2028` is one Academic Duration. `2025-2029` is a *completely separate* Academic Duration. They don't share anything — each one tracks its own progress independently, like two separate stopwatches that were started a year apart.

Each Academic Duration stores two simple things:

1. **A current semester number**, from 1 to 8.
2. **A status** — is this batch still studying, or has it graduated?

That's it. Everything else (odd/even, which year of college they're in) can be figured out *from* the semester number — we don't need to store it separately.

| Semester number | Odd or Even? | Which year? |
|---|---|---|
| 1 | Odd | 1st year |
| 2 | Even | 1st year |
| 3 | Odd | 2nd year |
| 4 | Even | 2nd year |
| 5 | Odd | 3rd year |
| 6 | Even | 3rd year |
| 7 | Odd | 4th year |
| 8 | Even | 4th year |

## Why we track a *number*, not just "odd/even"

Here's the part that's easy to get wrong. You might think: "Just store whether the batch is in an odd semester or an even semester, and flip it twice a year." But that's not enough information — here's why with a real example.

Imagine it's the same week in June 2026, and look at three different batches:

- **2023-2027 batch** → in Semester V (odd, 3rd year)
- **2024-2028 batch** → in Semester III (odd, 2nd year)
- **2025-2029 batch** → in Semester I (odd, 1st year)

All three are "odd" *at the exact same time*. If we only stored "odd/even," the system would have no way to tell these three batches apart — it would think they're all in the same semester, when actually they're in three completely different ones. That's why each Academic Duration needs its own specific number (1 through 8), not just a label.

## The "Advance Semester" button

When a semester ends (say, December), the COE (the admin in charge) opens the dashboard, finds the 2024-2028 batch, and clicks **"Advance Semester."** The number ticks forward by exactly one — say, from 3 to 4.

A few rules keep this safe:

- You can only move forward by one step at a time (3 → 4, never 3 → 6).
- You can't go backward.
- Once a batch reaches semester 8 and that semester ends, the only next step is **graduating** — there's no semester 9.

This is deliberately a manual button, not something that flips automatically on a timer. The COE decides when a semester has truly ended (results published, etc.) and clicks it themselves — just like every other major step in this system (approving question banks, locking papers) is a manual human decision, not an automatic one.

## Creating a new batch

Every year, a new batch joins. The COE clicks **"Create Academic Duration,"** types in the range (e.g., `2026-2030`), and the system creates a brand-new entity starting at semester 1. This is completely independent of every other batch already in the system — the 2026-2030 batch starting fresh has zero effect on 2024-2028 or 2025-2029, which keep advancing on their own separately.

## Graduating a batch

After semester 8 finishes, the batch is done. The COE clicks **"Graduate Batch"** on that Academic Duration. This doesn't delete anything — all the old subjects, question banks, and exam records for that batch stay exactly where they are, for records and audits. It just marks that batch as finished, so it stops showing up in the lists of "active" batches the COE and coordinators work with day-to-day.

## Putting it all together — a mini timeline

```
2024-2028 batch created  →  starts at Semester 1
   ...time passes, semester ends, COE clicks "Advance"...
   Semester 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
   ...semester 8 ends...
   COE clicks "Graduate Batch"  →  batch marked as finished
```

Meanwhile, every other batch (2025-2029, 2026-2030, ...) is running through this exact same cycle on its own clock, completely independently.

## The one-sentence summary

Instead of tracking what semester *each student* is in, we track what semester *each batch* is in — and since a batch can be identified by nothing more than a number from 1 to 8 plus a status, the whole "which semester are these students in" problem becomes one button click by the COE, repeated once every six months, per batch.