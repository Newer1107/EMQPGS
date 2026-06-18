# Workflow UX Audit

Audit performed 2026-06-18. Focuses strictly on operational efficiency and workflow completion — no visual/styling feedback.

---

## Excellent Workflow Decisions

1. **Coordinator attention sidebar** — Three categories (stalled, missing moderator, ready to advance) with click-through to the specific bank. The right abstraction: surface what needs human judgment, not raw data.

2. **Readiness panel on bank detail page** — Before advancing a phase, blocking issues are computed and shown inline. The advance button is disabled until resolved. Prevents bad state transitions.

3. **Moderator auto-navigation** — After approve/reject/request-revision, the moderator is automatically taken to the next question in queue. Combined with the position indicator ("Question 3 of 12"), this is efficient single-task flow.

4. **Dean review workspace** — Three paper variants side-by-side on one page. All metrics (coverage, difficulty, quality, duplicate risk), AI recommendations, and selection dropdowns are on the same screen. Zero navigation during a single review.

5. **Color-coded slot grid** — 126 slots visually scannable by status color in seconds. A coordinator can assess the entire bank at a glance.

6. **Contributor slot demand alert** — "X slots need questions in Y banks" with a direct CTA to submit. The single most important signal for a contributor, surfaced at the top of the dashboard.

7. **Filterable question list view** — Dropdowns for status, module, difficulty, and RBT level. The slot grid + list view toggle is a smart dual-mode design.

8. **Workflow timeline with next-step guidance** — Both the timeline (who does what in each phase) and the "Next Steps" card give explicit directional guidance at every stage.

---

## Remaining Workflow Friction

### Coordinator

| Friction | Detail |
|---|---|
| **No per-module completion in bank view** | Aggregate fill rate only. Can't see "Module 3 has all its 10-mark slots empty" without counting individual grid cells. |
| **Empty slots don't show assigned contributor** | Empty slots are all white. Coordinator can't see which empty slot belongs to which contributor. ContributorCard shows totals but doesn't link to slots. |
| **Revision-requested questions not surfaced as blockers** | Readiness panel checks empty slots and pending moderation, but revision-requested questions are not counted as blocking. A bank with 5 questions awaiting resubmission can show as "Ready to advance." |
| **No days-since-last-activity per bank** | Days-in-phase is shown, but a bank updated yesterday and one not touched in 6 weeks look the same on the detail page. No stale-slot indicators. |
| **No cross-bank comparison view** | Dashboard shows banks as cards. No sortable table with metrics across all banks. Coordinator visually scans 6+ cards to compare. |
| **Exam workspace doesn't show slot-level progress** | Workspace shows initialized/completed/drafting counts, but not slot fill percentage per bank. Must click into each bank. |

### Contributor

| Friction | Detail |
|---|---|
| **Can't see which specific slots are empty** | "12 slots need questions" but no indication of which modules, marks, or slot numbers. |
| **No personal "my work" view** | "X of mine" count shows submitted count, not expected-to-fill count. |
| **Submit question flow has no slot awareness** | Form accepts URL params but doesn't auto-select highest-priority empty slot. Contributor picks subject/module/marks from dropdowns with no guidance. |
| **No explicit next action per bank** | "X slots need questions" is generic. Contributor with 3 banks needs "Bank A needs 10-mark Module 2 questions." |
| **Edit page doesn't show slot context** | Clicking Edit on a revision request doesn't show bank, slot number, or module context. |

### Moderator

| Friction | Detail |
|---|---|
| **No prioritization signals** | Queue is chronological. No priority score, deadline indicator, or "this question is blocking a bank ready to advance" context. |
| **Can't see downstream impact** | The review page shows linked exam cycles but not slot-level dependency: "If I approve this, Module 2's 5-mark slots will be complete." |
| **No bulk moderation** | Every question requires a full page load and individual action. No batch view or keyboard-driven workflow. |
| **No diff on revision resubmission** | When a revision comes back, the moderator sees the new version but not what they previously requested. Must remember or scroll through history. |

### COE

| Friction | Detail |
|---|---|
| **No institutional readiness dashboard** | Zero visibility into workflow progress across departments from any single screen. |
| **No bottleneck identification** | Can't see "5 banks stalled for >7 days" or "2 departments have no assigned moderators." |
| **No overdue-bank view** | Stalled detection exists in coordinator dashboard but is invisible to COE. |
| **Production page shows data, not readiness** | Shows AI report status and dean selections but doesn't compute "ready for export" per bank. |
| **No aggregate AI report view** | AI report summaries exist per-bank but no cross-bank view of quality scores or coverage gaps. |

### Dean

| Friction | Detail |
|---|---|
| **No prioritization context on pending reviews** | Quality/coverage scores shown but no "generated X days ago" or "exam is Y days away" context. |
| **Single-bank review workspace** | Must go back to dashboard between reviews. No multi-bank comparison. |
| **No batch approval** | Each bank opened individually. No way to batch-approve or set default selections. |
| **Readiness overview too sparse** | Two lists (pending/completed) with basic details only. No timeline, health indicators, or urgency warnings. |

---

## Highest-Impact UX Improvements

1. **Per-module completion breakdown on bank detail page** — A small table between the stat cards and slot grid showing each module's fill/approved/empty counts. Low effort, eliminates grid-scanning for module-level gaps.

2. **Contributor name on empty slots in slot grid** — Show contributor initials or indicator on empty slots. Add a "Contributor's Empty Slots" filter in the question list view. Medium effort, eliminates cross-page lookups.

3. **Slot-priority guidance in submit-question flow** — Pre-populate the submit form with the contributor's highest-priority empty slot. Show callout: "You have 3 empty slots — Module 2, 10 marks needs attention." Medium effort, eliminates guessing.

4. **COE institutional readiness dashboard** — New or redesigned page showing department-by-department completion rates, stalled banks, overdue-by-exam-cycle chart, moderator coverage, and phase distribution per department. High effort, closes the single largest visibility gap.

5. **Revision blocking awareness in readiness panel** — Count revision-requested questions as blocking issues. "5 questions awaiting revision resubmission — bank cannot advance until resolved." Low effort, fixes a false-positive readiness computation.

6. **Slot-dependency context in moderator review** — Show in the sidebar: "This fills Slot 23 (Module 3, 10 marks). 4/7 slots in this slot type are approved. Approving fills the gap." Medium effort, turns a blind decision into an informed one.

7. **Activity staleness indicator per slot** — Show "Last activity: 14 days ago" per slot or module. Highlight slots with no recent activity. Low effort, surfaces stalled sub-bank work.

8. **Dean batch review or workspace queue** — Allow the dean to review multiple banks in a session without returning to the dashboard each time. High effort, reduces per-bank navigation by ~60%.

---

## Estimated Impact

| # | Improvement | Role | Effort | Effect |
|---|---|---|---|---|
| 1 | Per-module breakdown | Coordinator | Low | Eliminates grid-scanning for module gaps |
| 2 | Contributor on empty slots | Coordinator | Medium | Eliminates cross-page slot ownership lookups |
| 3 | Slot-awareness in submit flow | Contributor | Medium | Direct path from "what should I do" to doing it |
| 4 | COE readiness dashboard | COE | High | Closes largest visibility gap in the system |
| 5 | Revision blocking awareness | Coordinator | Low | Fixes false-positive in readiness computation |
| 6 | Slot-dependency for moderator | Moderator | Medium | Informs approve/reject decisions |
| 7 | Activity staleness indicator | Coordinator | Low | Surfaces stalled work not visible at phase level |
| 8 | Dean batch review | Dean | High | Reduces per-bank navigation by ~60% |
