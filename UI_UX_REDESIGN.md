# UI/UX Redesign

> **Part of the EMQPGS engineering handoff set**  
> Companion to: `PROJECT_HANDOFF.md` · `SYSTEM_ARCHITECTURE.md` · `DATABASE_REFERENCE.md` · `PRODUCTION_RUNBOOK.md`

---

## 1. Current UI Audit Summary

### Strengths
- Consistent layout: all dashboards share `PageHeader` + card-based content
- Role-based navigation (sidebar filtered by role)
- Server components for fast initial load
- Clean URL structure with role prefix

### Weaknesses

| Issue | Severity | Pages Affected |
|---|---|---|
| No loading skeletons — pages show nothing during fetch | Medium | All server components |
| No empty states — empty tables provide no guidance | Medium | All list pages |
| `activeSubjects: 0` hardcoded on coordinator dashboard | Low | `/coordinator` |
| Coordinator bank detail page is a monolithic client component | High | `/coordinator/question-banks/[id]` |
| Dean review workspace loads everything at once | High | `/dean/review?bank=` |
| No search/filter on contributor question library | Medium | `/contributor/questions` |
| No "start here" onboarding for any role | Low | All landing pages |
| Coordinator exam workspace loads all data upfront | Medium | `/coordinator/exam-workspace/[id]` |
| No question text search (only basic `contains`) | Medium | All question list pages |
| No pagination persistence across page navigation | Low | All list pages |
| Plain textarea for question writing (no rich text) | Medium | `QuestionForm` |

---

## 2. Information Architecture (Redesigned)

### Current IA

```
/ (role card selector)
├── /coe/ (21 routes, flat list)
├── /coordinator/ (13 routes, flat list)
├── /contributor/ (5 routes, flat list)
├── /moderator/ (5 routes, flat list)
└── /dean/ (4 routes, flat list)
```

### Redesigned IA Proposal

```
/ (role-based landing → immediate redirect)
│
├── /coe/
│   ├── /                           Dashboard: system health, active years, pending locks
│   ├── /academic/                  Academic structure hub
│   │   ├── /units                  Academic units
│   │   ├── /programmes             Programmes
│   │   ├── /schemes                Curriculum schemes
│   │   ├── /curriculum             Subject mapping
│   │   └── /semesters              Batch semester overview
│   ├── /batches/                   Cohort management
│   │   ├── /                       List all batches
│   │   └── /[id]/                  Batch detail + semesters + groups
│   ├── /setup/                     Setup wizard (multi-step)
│   ├── /production/                Export console
│   ├── /admin/
│   │   ├── /users                  User management
│   │   ├── /departments            Departments
│   │   ├── /assignments            Coordinator assignments
│   │   └── /audit                  Audit log
│   └── /monitoring/                System health
│
├── /coordinator/
│   ├── /                           Dashboard: phase dist, attention, banks table
│   ├── /subjects/                  Subject management
│   ├── /banks/                     Question bank center
│   │   ├── /                       List all banks
│   │   └── /[id]/                  Bank detail (lazy-loaded tabs)
│   ├── /workspace/[id]/            Exam workspace
│   ├── /questions/                 Question library
│   └── /assignments/               Assign moderators/contributors
│
├── /contributor/
│   ├── /                           Dashboard: assigned banks, recent questions
│   ├── /questions/                 Question library
│   │   ├── /                       List my questions
│   │   └── /new                    Submit question
│   └── /banks/                     My assigned banks
│
├── /moderator/
│   ├── /                           Dashboard: pending count, recent activity
│   ├── /queue/                     Moderation queue
│   │   ├── /                       Pending list
│   │   └── /[id]/                  Question detail + actions
│   ├── /approved/                  Approved history
│   └── /rejected/                  Rejected history
│
└── /dean/
    ├── /                           Dashboard: pending/completed reviews
    ├── /review/                    Review workspace
    ├── /reports/                   Completed reports
    └── /readiness/                 Readiness overview
```

**Key changes:**
- `/banks/` replaces `/question-banks/` (shorter, equally clear)
- `/queue/` replaces `/questions/` for moderator (clearer purpose)
- `/academic/` groups academic structure under one hub
- `/setup/` becomes a dedicated multi-step wizard page
- Flatter nesting where possible (e.g., `/coordinator/subjects/create` → `/coordinator/subjects/new`)

---

## 3. Redesigned Dashboard Concepts

### 3.1 Coordinator Dashboard (Current → Proposed)

**Current:** Single page with phase distribution, attention items, bank status table, recent activity. Everything loads at once.

**Proposed redesign:**

```
┌──────────────────────────────────────────────────────────┐
│  Coordinator Dashboard                         [Q] [🔔]  │
├──────────────────────────────────────────────────────────┤
│ ┌─── Phase Distribution ──────┐ ┌─── Attention Items ──┐│
│ │                             │ │                      ││
│ │  ████████░░ DRAFTING (5)    │ │ ⚠ 3 banks stalled    ││
│ │  ██████████░ MODERATION (8) │ │ > 7 days in phase    ││
│ │  ████████░░ APPROVAL (3)    │ │ ⚡ 2 banks ready to  ││
│ │  ████████████ COMPLETE (12) │ │   advance             ││
│ │                             │ │ ❌ 1 bank missing    ││
│ └─────────────────────────────┘ │   moderator           ││
│                                 └──────────────────────┘│
│ ┌─── Active Exam Cycles ───────────────────────────────┐│
│ │  Sem 5 · 2026-27 · ENDSEM  │  12/15 banks initialized││
│ │  Sem 3 · 2026-27 · ISE 1   │  5/8 banks initialized  ││
│ └──────────────────────────────────────────────────────┘│
│ ┌─── Question Banks ───────────────────────────────────┐│
│ │ ┌───────┬────────┬──────┬──────┬──────┬──────┬─────┐││
│ │ │ Code  │ Sem    │Phase │Fill% │Next  │Mod   │Days │││
│ │ ├───────┼────────┼──────┼──────┼──────┼──────┼─────┤││
│ │ │ OS101 │ Sem 5  │MOD   │ 85%  │Ready │✅    │  3  │││
│ │ │ DB301 │ Sem 5  │DRF   │ 45%  │Assign│❌    │ 12  │││
│ │ │ ...   │        │      │      │      │      │     │││
│ │ └───────┴────────┴──────┴──────┴──────┴──────┴─────┘││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Improvements:**
- Phase distribution as visual bars with counts
- Attention items use color-coded severity icons
- Exam cycles section shows initialization progress
- Bank table inline — no need to navigate to separate page for overview
- Search bar + notification bell in header

### 3.2 COE Dashboard

**Current:** Stats, pending tasks, notifications in cards.

**Redesigned:**

```
┌──────────────────────────────────────────────────────────┐
│  COE Control Center                           [🔔] [⚙️]  │
├──────────────────────────────────────────────────────────┤
│ ┌─ Quick Actions ────────────────────────────────────┐   │
│ │ [New Academic Year] [New Batch] [New Exam Cycle]   │   │
│ │ [Create User] [Run Backup] [View Audit]            │   │
│ └────────────────────────────────────────────────────┘   │
│ ┌─ System Status ─────────┐ ┌─ Active Structure ─────┐  │
│ │ ✅ DB Connected         │ │ 2 Academic Years       │  │
│ │ ✅ MinIO Connected      │ │ 3 Active Batches       │  │
│ │ ⚠️ Ollama Unavailable   │ │ 5 Active Exam Cycles  │  │
│ │ ✅ Last Backup: 2h ago  │ │ 38 Subjects            │  │
│ └─────────────────────────┘ └────────────────────────┘  │
│ ┌─ Setup Progress ─────────────────────────────────────┐│
│ │ [✅] Academic Units     [✅] Programmes               ││
│ │ [✅] Curriculum Scheme  [⚠️] Sem 6 not configured    ││
│ │ [✅] Batches Created    [❌] Teaching Groups (N/A)   ││
│ └──────────────────────────────────────────────────────┘│
│ ┌─ Recent Activity ────────────────────────────────────┐│
│ │ 15m ago  Locked OS101 question bank                  ││
│ │ 2h ago   Created user Prof. Sharma                   ││
│ │ 5h ago   Backup completed (1.2GB)                    ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Improvements:**
- Quick action buttons replace navigation hunting
- System status at a glance (green/yellow/red)
- Setup progress tracker shows what's configured and what's missing
- Activity feed replaces static stat cards

### 3.3 Contributor Dashboard

**Current:** Bank fill stats, question counts, recent feedback.

**Redesigned:**

```
┌──────────────────────────────────────────────────────────┐
│  My Workspace                                   [+ New]  │
├──────────────────────────────────────────────────────────┤
│ ┌─ Banks Assigned to Me ───────────────────────────────┐│
│ │ ┌──────────┬─────────┬──────────┬────────┬─────────┐││
│ │ │ Subject  │ Bank    │ My Slots │ Status │ Action  │││
│ │ ├──────────┼─────────┼──────────┼────────┼─────────┤││
│ │ │ OS 101   │ ENDSEM  │ 5/15     │▶ Active│[Add Q] │││
│ │ │ DB 301   │ ISE 1   │ 0/5      │⏳ New   │[Start] │││
│ │ │ ALGO 401 │ ENDSEM  │ 8/8      │✅ Done  │View    │││
│ │ └──────────┴─────────┴──────────┴────────┴─────────┘││
│ └──────────────────────────────────────────────────────┘│
│ ┌─ My Recent Questions ────────────────────────────────┐│
│ │ ✅ Approved: "Explain ACID properties..."  (2h ago)  ││
│ │ 🔄 Revision: "DBMS architecture..."      (1d ago)    ││
│ │ ⏳ Pending: "Normalization forms..."     (3d ago)    ││
│ └──────────────────────────────────────────────────────┘│
│ ┌─ Quick Submit ───────────────────────────────────────┐│
│ │ Subject: [DB 301 ▼]  Module: [3 ▼]  Marks: [10 ▼]   ││
│ │ ┌──────────────────────────────────────────────────┐ ││
│ │ │ Type your question here...                        │ ││
│ │ └──────────────────────────────────────────────────┘ ││
│ │ CO: [CO2 ▼]  RBT: [L3 ▼]  Difficulty: [Medium ▼]   ││
│ │ [Assign to Bank] [Save Draft] [Submit]               ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Improvements:**
- Inline quick submit form on the dashboard (reduces navigation)
- Color-coded status badges (green=approved, yellow=pending, red=revision)
- "Add Q" / "Start" action buttons per bank
- My questions feed grouped by status

---

## 4. Component Redesign Proposals

### 4.1 `BankDetailClient` — Split into Tabs

**Current:** Monolithic client component loading everything: slots grid, AI reports, papers, dean review, actions. Slow at ~4 embedded queries.

**Proposed:**

```typescript
<Tabs>
  <Tab label="Slots" count={126}>
    <SlotsGrid slots={slots} pattern={pattern} />
  </Tab>
  <Tab label="AI Report" count={aiReport ? 1 : 0}>
    <AiReportPanel report={aiReport} onGenerate={...} />
  </Tab>
  <Tab label="Generated Papers">
    <PapersPanel papers={papers} onGenerate={...} />
  </Tab>
  <Tab label="Dean Review">
    <DeanReviewPanel deanReview={deanReview} />
  </Tab>
  <Tab label="Actions">
    <WorkflowTimeline phase={...} />
    <CoordinatorDecisionForm bankId={...} />
    <BankActionsPanel bankId={...} />
  </Tab>
</Tabs>
```

**Benefits:** Each tab lazy-loads its own data. Initial render is fast (only slots). AI report and papers load on demand.

### 4.2 Dean Review Workspace — Lazy-Load Paper Details

**Current:** Loads all 3 paper variants with full question text, metrics, and recommendations at once.

**Proposed:**

```
┌──────────────────────────────────────────────────────────┐
│  Paper A: OS101 ENDSEM Sem 5 2026-27              [✓]   │
│  Coverage: 85%  Difficulty: 72%  Quality: 81%           │
│  ┌─ Questions ────────────────────────────────────────┐ │
│  │ ▶ Module 1 (3 questions)  [expand to see text]     │ │
│  │ ▶ Module 2 (3 questions)                           │ │
│  │ ▶ Module 3 (3 questions)                           │ │
│  └────────────────────────────────────────────────────┘ │
│ ──── Paper B ────  [select]  ──── Paper C ──── [select]│
│                                                         │
│ Selection: Regular → [A ▼]  Supp → [B ▼]  KT → [C ▼]  │
│ [Submit Review]                                         │
└──────────────────────────────────────────────────────────┘
```

**Benefits:** Collapsible question groups. Paper selection is a dropdown per exam type. Submit is always visible.

---

## 5. Design System Recommendations

### Typography

| Element | Current | Proposed |
|---|---|---|
| Page title | `<h1>` default | Bold, 24px, tracking -0.02em |
| Card title | `<h3>` default | Semibold, 16px |
| Table header | `<th>` default | Medium 12px uppercase |
| Body text | `<p>` default | Regular 14px |
| Labels | `<label>` default | Medium 13px |

### Colors

| Token | Current | Proposed |
|---|---|---|
| Background | `--bg: #f9fafb` | Keep |
| Surface | `--card: #ffffff` | Keep |
| Primary | `--primary: #2563eb` | Keep |
| Success | `--success: #16a34a` | `#059669` (emerald) |
| Warning | `--warning: #d97706` | `#d97706` (amber) |
| Danger | `--danger: #dc2626` | `#dc2626` (red) |

### Spacing Scale

| Token | Value |
|---|---|
| Base unit | 4px |
| Card padding | 24px |
| Section gap | 24px |
| List item gap | 12px |
| Table cell padding | 12px 16px |

### Component States

Every interactive element needs:

```
default → hover → active → focus → disabled
```

| Component | Missing States |
|---|---|
| Button | Has all 5 ✅ |
| Card | Missing hover → active ✅ currently has hover |
| Select | Missing focus ring |
| Input | Has focus ✅ |
| Badge | Static only — no click state |
| Table Row | Missing hover highlight on coordinator pages |

---

## 6. Empty States

Every list page needs an empty state. Standard pattern:

```
┌──────────────────────────────────┐
│                                  │
│         [empty icon]             │
│                                  │
│    **No subjects yet**           │
│                                  │
│    Subjects appear here once     │
│    created by the COE or         │
│    coordinator.                  │
│                                  │
│    [Create First Subject]        │
│                                  │
└──────────────────────────────────┘
```

| Page | Empty State Message | Action Button |
|---|---|---|
| `/coe/batches` | No batches yet | Create First Batch |
| `/coe/programmes` | No programmes configured | Create Programme |
| `/coordinator/subjects` | No subjects in your department | Create Subject |
| `/coordinator/question-banks` | No question banks initialized | Initialize Bank |
| `/contributor/questions` | You haven't submitted any questions | Submit Your First Question |
| `/moderator/questions` | No questions pending moderation | — (no action, info only) |
| `/dean/review` | No banks ready for review | — (info only) |

---

## 7. Loading States

```tsx
// Standard skeleton pattern for every list page
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
      ))}
    </div>
  );
}
```

Every `page.tsx` currently has no loading state. The user sees a blank page until the DB responds. Add `loading.tsx` files at each route segment:

```
app/(protected)/dashboard/coordinator/
├── loading.tsx           # Skeleton for main dashboard
├── subjects/
│   ├── loading.tsx       # Skeleton for subject list
│   └── [id]/
│       └── loading.tsx   # Skeleton for subject detail
│   ...
```

---

## 8. Error States

Each error page should show:

1. What went wrong (friendly message, not code)
2. Suggested action (refresh, go back, contact support)
3. Auto-retry for transient errors

```tsx
// Standard error page pattern
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500 mt-1">
        This page couldn't be loaded. Please try again.
      </p>
      <Button onClick={reset} className="mt-4">
        Try Again
      </Button>
    </div>
  );
}
```

Current error pages exist at each role prefix but show generic content. Update them with this pattern.

---

*End of UI_UX_REDESIGN.md*
