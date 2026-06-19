# EMQPGS Design System

## Direction & Feel
**Enterprise examination management.** Authoritative, precise, calm. Like a cross between Linear's focus and a university registrar's formality. Every pixel serves clarity — this is high-stakes software for people managing exam papers.

## Typography
- **Font:** Inter (body + headings), JetBrains Mono (code/data)
- **Body:** text-sm (14px) with `--text-primary` (#171717)
- **Headings:** font-semibold, tracking-tight, text-2xl/3xl
- **Labels:** text-xs uppercase tracking-wider
- **Hierarchy:** `--text-primary` > `--text-secondary` > `--text-tertiary` > `--text-muted`
- Monospace: `0.875em` relative size

## Depth Strategy
**Borders-only.** No shadows on cards or surfaces. Hierarchy established through background shifts:
- Base: `--background` (#fff)
- Elevated: `--surface-elevated` (#fafafa)
- Hover: `--surface-hover` (#f5f5f5)
- Cards: `--card` (#fff) + `border-[--border]`

## Border System
- Standard: `--border` (#e5e5e5) — default separation
- Soft: `--border-soft` (#f0f0f0) — lighter row separators
- Emphasis: `--border-emphasis` (#d4d4d4)
- Focus ring: 2px `--ring` (#171717) with 2px offset

## Color Palette
| Token | Value | Usage |
|---|---|---|
| `--text-primary` | #171717 | Body text, headings |
| `--text-secondary` | #525252 | Supporting text |
| `--text-tertiary` | #8b8b8b | Labels, metadata |
| `--text-muted` | #a3a3a3 | Placeholders, disabled |
| `--accent` | #171717 | Primary actions, focus |
| `--accent-hover` | #404040 | Button hover |
| `--success` | #16a34a | Success states |
| `--warning` | #d97706 | Warning states |
| `--danger` | #dc2626 | Destructive actions |
| `--info` | #2563eb | Info states |

Each semantic color has a `-bg` and `-border` variant for badge/chip backgrounds.

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Micro:** gap-1.5 (6px) for icon-text pairs
- **Component:** gap-2 (8px) for button content, p-3 (12px) for dense cards
- **Section:** gap-6 (24px) between card groups
- **Page:** px-6 (24px) horizontal, py-8 (32px) vertical

## Border Radius
- Inputs, buttons: rounded-lg (8px)
- Cards: rounded-xl (12px)
- Badges: rounded-full
- Small elements (stat labels): no forced radius

## Components

### Button
- Default: `bg-[--accent]` on `--accent-foreground` with `active:scale-[0.97]`
- Secondary: bordered with `--surface-hover` background
- Outline: transparent with border
- Ghost: transparent with hover background
- Sizes: sm (h-8), default (h-9), lg (h-10), icon (h-9 w-9)

### Card
- `rounded-xl border border-[--border] bg-[--card]` — no shadows
- Header: `px-6 pt-6 pb-4` (asymmetric: more top padding)
- Content: `px-6 pb-6`
- Title: `text-base font-semibold tracking-tight`
- Description: `text-sm text-[--text-tertiary]`

### Form Controls
- Height: h-9 (36px) for inputs, selects, textareas
- Background: `--background` (not white — matches page)
- Border: `--border`, focus turns `--accent` with ring-1
- Placeholder: `--text-muted`
- Label: `text-sm font-medium`

### Table
- Header: uppercase tracking-wider, `--text-tertiary`
- Rows: `border-b border-[--border-soft]`
- Cells: px-4 py-3

### Badge
- Variants: default, success, warning, danger, info
- Semantic colors use `--{variant}` (text), `--{variant}-bg` (bg), `--{variant}-border`
- Rounded-full with pill shape

## Navigation (Sidebar)
- Background: same as page (`--background`), separated by `border-r`
- Active: `--surface-hover` bg + `--text-primary`
- Inactive: `--text-secondary`, hover to `--text-primary` on `--surface-elevated`
- Focus: ring-2 with `--ring`
- User section at bottom: `--surface-elevated` card with initials avatar

## States
Every interactive element has: default, hover, focus-visible (ring), active (scale/color shift), disabled (opacity-50).
Data states: loading (skeleton via animate-pulse), empty (icon + message + optional action), error.

## Dark Mode
Not implemented. When adding: invert surface levels (higher elevation = lighter in dark mode), desaturate semantic colors, use borders instead of shadows.

---

# Dashboard Architecture (added June 2026)

## Layout Pattern
Every role dashboard follows the same top-to-bottom mental model:
1. **DashboardHeader** — role title, greeting, workload summary badges
2. **PrimaryAction** — single hero CTA (the one thing to do right now)
3. **AlertBanner / AttentionSection** — critical items needing awareness
4. **Workflow / Queue / Task surface** — active work dominates the page
5. **Supporting Metrics** — compact stat strip (sm size) — never lead with metrics
6. **RecentActivity** — chronological timeline grouped by Today/Yesterday/Older

Dashboards are server components (no "use client") — compose data from role-specific services and render via shared components.

## Dashboard Components (src/components/dashboard/)

### DashboardHeader
- Replaces PageHeader on main dashboards (PageHeader still used on sub-pages)
- Props: `title`, `greeting?`, `summary: SummaryItem[]` (label + count + variant badges)
- Shows workload context at a glance: ready-for-export count, pending items, stalled count
- Three zones: title left | summary badges middle | actions right, responsive stack

### AlertBanner
- Slim alert list for system-level issues (missing assignees, urgent bottlenecks)
- Each item: colored left border + icon + title + description, optional Link wrap
- Severity drives the icon/color: critical=red, warning=amber, info=blue, success=green
- Returns null for empty array — always check length before rendering

### PrimaryAction
- Single hero CTA — visually the most prominent actionable element
- Large card with border + hover state, Button + ArrowRight on the right
- Variants: default (standard), success (green — for export/complete actions), warning (amber — for urgent items)
- Only one per dashboard. If no action available, show contextual fallback.

### ActionPanel
- Grid of secondary action cards (2-4 columns), less prominent than PrimaryAction
- Each card: icon + title + description + arrow-right on hover
- Used for next-step actions after the primary one is handled

### WorkflowPipeline
- Horizontal stacked bar (h-3, rounded-full) with proportional colored segments per phase
- Legend below with counts/percentages
- Bottleneck annotations (amber/red indicators with descriptions) below the legend
- Extracted from the old COE inline bar — now reusable across dashboards

### TaskQueue
- Prioritized action list with urgency badges and metadata
- Two variants: default (p-3 with description) and compact (p-2, text-xs, no description)
- Empty state: centered message with emptyMessage prop
- "View all N items" link when maxItems truncation applies
- Each item wraps in Link (if href) or div, with right-arrow reveal on hover

### ProgressSummary
- Per-item progress bars: label + h-2 bar (track + fill) + fraction + percentage
- Zero total shows 0% with muted text
- Two variants: default and compact (smaller text/spacing)

### RecentActivity
- Chronological timeline grouped by "Today" / "Yesterday" / "DD Month YYYY"
- Each event: HH:MM timestamp | colored dot | "Actor action target"
- Dot color mapped from action keywords (approved→green, rejected→red, submitted→blue)
- Left vertical connecting line between events
- Truncation via maxEvents + optional viewAllHref

### DepartmentProgress
- Compact rows: department name | h-3 stacked bar (proportional phase segments) | total count
- Hover highlight on rows with href (links to department detail)
- Phase legend below rows with colored dots
- Mobile: name stacks above bar (flex-col → sm:flex-row)

### StatCard
- Consolidated from MetricTile + old StatCard
- Three sizes: sm (text-lg, compact), md (text-2xl, default), lg (text-3xl, hero)
- Optional variant adds subtle border-left color
- Trend arrow: up=green, down=red
- Used for supporting metrics (compact, never lead with them)

## Dashboard-Specific Patterns

### COE Dashboard
- Hero: "Export N Papers" (if readyForExport) or "Review Production" (fallback)
- Pipeline: 4 phases (Drafting→Moderation→Approval→Complete) + dean bottleneck + stalled annotations
- Department progress replaces the old data table with visual stacked bars
- Footer: coverage counts (coordinators/moderators/contributors/departments) + moderation backlog + pending review

### Coordinator Dashboard
- Hero: dynamically picks highest-priority attention item (stalled/missing moderator/ready to advance)
- TaskQueue replaces the old bank-card grid — banks sorted by priorityScore
- Phase pipeline shows department-level distribution
- Active exam cycles preserved as inline cards

### Contributor Dashboard
- Hero: "Continue Writing [subject]" — points to the bank with most empty slots
- AlertBanner for overdue revisions (>3 days)
- ProgressSummary replaces old bank-card grid — per-bank fill bars
- All 6 stats preserved (submitted/approved/pending/revisionRequested/rejected/draft) as compact StatCards

### Moderator Dashboard
- Hero: "Review Oldest Pending" — first item from pendingQueue
- TaskQueue dominates: Pending Review + Awaiting Revision Resubmission in one card
- AlertBanner for banks with urgency > 5
- Per-bank stats table preserved
- Stat chips replaced by 4 compact StatCards

### Dean Dashboard
- Hero: "Review: [Oldest Subject]" — oldest by daysWaiting
- Pending review detail cards preserved (quality scores, coverage, AI summaries)
- ReviewHistory merges approvalHistory + completedReviews into one sorted table
- ReviewSummary helper kept for compatibility

## Preserved Data Philosophy
- Zero backend service modifications — all changes are frontend-only reorganization
- Every metric from the original services must render somewhere on the page
- Removing a section = move data to supporting metrics footer, not delete
- Existing components (PageHeader, AttentionSection, NextActions, EmptyState, Badge, Button, Card, MetricTile) remain in use on sub-pages and for backward compatibility
