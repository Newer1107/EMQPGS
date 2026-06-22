# Dean AI Review Workspace Architecture

> **Purpose:** Define the UI architecture, component hierarchy, state management,
> interaction design, and API integration surface for the Dean's AI-powered
> question bank analysis workspace within EMQPGS.
>
> **Reference documents:**
> - Domain entities: `uaf-domain-model.md` (ratified) — entities referenced, never redefined
> - Pipeline and backend: `ai-analysis-subsystem.md` (draft) — API endpoints and shapes cited by section
> - Existing workspace: `app/(protected)/dashboard/dean/review/page.tsx`
> - Existing component: `src/components/production/dean-review-workspace.tsx`

**Status:** Draft
**Applies to:** Dean Dashboard, Dean Review Workspace, UAF Analysis UI
**Version:** 1.0

---

## Table of Contents

1. [Workspace Navigation Map](#1-workspace-navigation-map)
2. [Page 1: Dean Dashboard (Analysis List)](#2-page-1-dean-dashboard-analysis-list)
3. [Page 2: UAF Bank Analysis Overview](#3-page-2-uaf-bank-analysis-overview)
4. [Page 3: Version Comparison View](#4-page-3-version-comparison-view)
5. [Page 4: Per-Paper Variant Analysis](#5-page-4-per-paper-variant-analysis)
6. [Page 5: Detailed Index Drill-Down](#6-page-5-detailed-index-drill-down)
7. [Version History Panel](#7-version-history-panel)
8. [AI Content Attribution](#8-ai-content-attribution)
9. [State Management](#9-state-management)
10. [State Machine for Analysis Lifecycle](#10-state-machine-for-analysis-lifecycle)
11. [API Endpoints Table](#11-api-endpoints-table)
12. [Interaction Design](#12-interaction-design)
13. [Out of Scope](#13-out-of-scope)

---

## 1. Workspace Navigation Map

The Dean workspace is organized as a two-level hierarchy. The top level lists
all question banks with their analysis status. Each bank opens into a full UAF
Analysis workspace with two sub-modes: bank-level overview and per-paper variant
analysis.

```
Dean Dashboard
  ├── Pending Reviews (list)
  ├── Completed Reviews (list)
  └── Question Bank Analysis
       ├── UAF Overview (bank-level)
       │   ├── Index Summary Table
       │   ├── Executive Summary
       │   ├── Risk Register
       │   ├── Recommendations
       │   ├── Accreditation Readiness
       │   └── Version History
       └── Per-Paper Analysis
           ├── Variant A
           ├── Variant B
           └── Variant C
               ├── Index Values
               ├── Bloom Analysis
               ├── Difficulty Analysis
               ├── CO Coverage
               ├── Module Coverage
               ├── Concept Diversity
               ├── Academic Quality
               └── AI Commentary
```

### Route Structure

```
/dashboard/dean                              → Analysis list (Page 1)
/dashboard/dean/review?bank={bankId}         → Bank analysis overview (Page 2)
/dashboard/dean/review?bank={bankId}&compare → Version comparison (Page 3)
/dashboard/dean/review?bank={bankId}&variant=A → Per-paper analysis (Page 4)
/dashboard/dean/review?bank={bankId}&index=BDI  → Index drill-down (Page 5)
```

The existing route `/dashboard/dean/review?bank={bankId}` is extended with query
parameters for sub-views. No new top-level routes are introduced.

---

## 2. Page 1: Dean Dashboard (Analysis List)

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  UAF Analysis Dashboard                                [New Analysis] │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┬─────────────────┬─────────────────┬─────────┐  │
│  │  Total Banks    │  Pending        │  Complete       │ Obsolete│  │
│  │      24         │      7          │      15         │    2    │  │
│  └─────────────────┴─────────────────┴─────────────────┴─────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Pending Analyses                                      [Filter]│ │
│  ├────┬────────────────┬──────────┬──────────┬───────────────────┤ │
│  │  # │ Subject        │ Latest   │ Status   │ Requested         │ │
│  ├────┼────────────────┼──────────┼──────────┼───────────────────┤ │
│  │  1 │ Data Structures│ v.3      │ [REVIEW] │ 2 days ago        │ │
│  │  2 │ Algorithms     │ v.1      │ [PENDING]│ Today             │ │
│  │  3 │ DBMS           │ v.2      │ [REVIEW] │ 5 days ago        │ │
│  │  4 │ Computer Net.  │ v.1      │ [PENDING]│ 3 hours ago       │ │
│  └────┴────────────────┴──────────┴──────────┴───────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Recent Completed                                              │ │
│  ├────┬────────────────┬──────────┬──────────┬───────────────────┤ │
│  │  # │ Subject        │ QPQI     │ Status   │ Completed         │ │
│  ├────┼────────────────┼──────────┼──────────┼───────────────────┤ │
│  │  1 │ Computer Net.  │ 0.82     │ [✓ Done] │ Today             │ │
│  │  2 │ OS             │ 0.64     │ [! Review]│ Yesterday         │ │
│  │  3 │ Software Eng.  │ 0.91     │ [✓ Done] │ 2 days ago        │ │
│  └────┴────────────────┴──────────┴──────────┴───────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
DeanDashboardPage
  ├── SummaryStatBar
  │   └── StatTile[] (total, pending, complete, obsolete)
  ├── PendingAnalysisList
  │   ├── ListHeader (with filter controls)
  │   └── AnalysisRow[] (bank name, version, status badge, timestamp)
  └── RecentCompletedList
      ├── ListHeader
      └── CompletedRow[] (bank name, QPQI value, status, timestamp)
```

### Data Source

**Endpoint:** `GET /api/question-banks?scope=dean&status=all`

Returns all banks with their latest `QuestionBankAnalysis` status, version
number, and top-level QPQI value. The existing `getDeanReviewData()` server-side
function populates this page — extended to include analysis status and version
info.

### SummaryStatTile States

| State | Behavior |
|-------|----------|
| Loading | Animated pulse background, count shown as shimmer |
| Empty | Count = 0, muted label |
| Data | Count in bold, label underneath |
| Error | Count = "?", red tint |

### AnalysisRow States

| State | Behavior |
|-------|----------|
| Loading | Skeleton row (3 shimmer columns) |
| Empty | "No pending analyses" empty state |
| Data | Full row with clickable bank name |
| Error | Row shows "Failed to load" with retry link |

### Status Badge Variants

| Status | Badge Style |
|--------|-------------|
| REVIEW | Amber/outline, clickable |
| PENDING | Gray/solid |
| IN_PROGRESS | Blue with spinner |
| COMPLETE | Green/solid |
| FAILED | Red/outline |
| OBSOLETE | Gray/muted |

---

## 3. Page 2: UAF Bank Analysis Overview

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Structures  [CS101]  v.3  [EFFECTIVE]        [▲ ▼] [↻ Regen]│
│  Last analyzed: Jun 22, 2026 10:30 AM                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Index Summary                                    [View All]   │ │
│  ├──────┬──────────────────────┬───────┬──────────┬──────────────┤ │
│  │ Code │ Index Name           │ Value │ Classif. │ Confidence   │ │
│  ├──────┼──────────────────────┼───────┼──────────┼──────────────┤ │
│  │ QPQI │ Question Paper Qual. │ 0.81  │ EFFECTIVE│ 92% HIGH     │ │
│  │ SCI  │ Syllabus Coverage    │ 0.90  │ H.EFFECT │ 95% V.HIGH   │ │
│  │ MII  │ Module Integration   │ 0.85  │ H.EFFECT │ 88% HIGH     │ │
│  │ BDI  │ Bloom Distribution   │ 0.74  │ EFFECTIVE│ 85% HIGH     │ │
│  │ CVI  │ CO-Vertex            │ 0.80  │ H.EFFECT │ 90% HIGH     │ │
│  │ MCAI │ Module Coverage      │ 0.82  │ H.EFFECT │ 87% HIGH     │ │
│  │ DBI  │ Difficulty Balance   │ 0.70  │ EFFECTIVE│ 82% HIGH     │ │
│  │ QCQI │ Question Complexity  │ 0.78  │ EFFECTIVE│ 84% HIGH     │ │
│  │ CAI  │ Cognitive Alignment  │ 0.76  │ EFFECTIVE│ 83% HIGH     │ │
│  │ AMI  │ Attainment Mapping   │ 0.72  │ EFFECTIVE│ 80% MEDIUM   │ │
│  │ FRI  │ Fairness & Repres.   │ 0.85  │ H.EFFECT │ 86% HIGH     │ │
│  └──────┴──────────────────────┴───────┴──────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Executive Summary                                        [AI] [85%]│
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ "Data Structures question bank demonstrates effective          │ │
│  │  coverage across all 6 modules. Bloom distribution is well-    │ │
│  │  balanced with 56:44 LOTS/HOTS ratio. Key strength: high CO    │ │
│  │  alignment (SCI: 0.90). Key concern: difficulty balance shows  │ │
│  │  slight tilt toward Medium questions (DBI: 0.70). Overall      │ │
│  │  recommendation: ACCEPTABLE with optional revision to          │ │
│  │  difficulty distribution."                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Risk Register                                             [AI] [78%]│
│  ┌────┬──────────────────────────────┬──────────┬─────────────────┐ │
│  │ #  │ Finding                      │ Priority │ Type            │ │
│  ├────┼──────────────────────────────┼──────────┼─────────────────┤ │
│  │ 1  │ Low representation of HOTS   │ MODERATE │ EDUCATIONAL     │ │
│  │ 2  │ Module 6 has 0 questions     │ CRITICAL │ ASSESSMENT      │ │
│  │ 3  │ CO6 mapping incomplete       │ MAJOR    │ ACCREDITATION   │ │
│  └────┴──────────────────────────────┴──────────┴─────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Accreditation Readiness                                  [AI] [82%]│
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬──────┬──────┐ │
│  │ CO1     │ CO2     │ CO3     │ CO4     │ CO5     │ CO6  │ POs  │ │
│  │ [✓] 85% │ [✓] 90% │ [✓] 78% │ [!] 62% │ [✓] 88% │ [✗] 0%│ [✓]..│ │
│  └─────────┴─────────┴─────────┴─────────┴─────────┴──────┴──────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Analysis History                              [v.2] [Compare ▼]   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ● v.3  Jun 22, 2026  QPQI: 0.81  [CURRENT]                    │ │
│  │ ● v.2  Jun 15, 2026  QPQI: 0.72                                │ │
│  │ ● v.1  Jun 01, 2026  QPQI: 0.65                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
UafBankAnalysisPage
  ├── AnalysisHeader
  │   ├── BankIdentityBreadcrumb (subject name, code, version)
  │   ├── ClassificationBadge (color-coded by FinalVerdict)
  │   ├── VersionSelector (dropdown, loads specific version)
  │   └── ActionBar (Regenerate button, Export button)
  ├── IndexSummaryTable
  │   ├── IndexRow[] (color-coded by classification)
  │   └── IndexRow expanded state (drill-down arrow)
  ├── ExecutiveSummaryPanel [AI attributed]
  │   ├── AIAttributionBadge
  │   ├── ConfidenceIndicator
  │   ├── SummaryText
  │   └── RegenerateSectionButton (per-section, not global)
  ├── RiskRegisterPanel [AI attributed]
  │   ├── AIAttributionBadge
  │   ├── RiskRow[] (priority color-coded)
  │   └── RiskDetailModal (on click)
  ├── RecommendationsPanel [AI attributed]
  │   ├── AIAttributionBadge
  │   └── RecommendationCard[]
  ├── AccreditationReadinessStrip
  │   └── COReadinessTile[] (color-coded progress)
  └── VersionHistoryPanel (see Section 7)
```

### Color Coding for Index Values

| Classification | Background | Text Color | Badge |
|----------------|-----------|------------|-------|
| EXEMPLARY | `--exemplary-bg` | `--exemplary-text` | EXEMPLARY |
| HIGHLY_EFFECTIVE | `--highly-effective-bg` | `--highly-effective-text` | H.EFFECTIVE |
| EFFECTIVE | `--effective-bg` | `--effective-text` | EFFECTIVE |
| ACCEPTABLE | `--acceptable-bg` | `--acceptable-text` | ACCEPTABLE |
| NEEDS_IMPROVEMENT | `--needs-improvement-bg` | `--needs-improvement-text` | NEEDS IMPR. |
| MAJOR_REVISION | `--major-revision-bg` | `--major-revision-text` | MAJOR REV. |

Values should map to CSS custom properties defined in the design token system.
The same matrix (Section 5 of `uaf-domain-model.md`) is used in the UI.

---

## 4. Page 3: Version Comparison View

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Comparison: Data Structures  v.2  vs  v.3              [Close]   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┬─────────────────────────────────────┐  │
│  │  Analysis v.2           │  Analysis v.3                       │  │
│  │  Jun 15, 2026           │  Jun 22, 2026                       │  │
│  │  10:00 AM               │  10:30 AM                           │  │
│  │                         │                                     │  │
│  │  Engine: 1.0.0          │  Engine: 1.0.0                      │  │
│  │  Prompt: 2.0.0          │  Prompt: 2.1.0                      │  │
│  │  Model: qwen3.5:3b      │  Model: qwen3.5:3b                  │  │
│  ├─────────────────────────┼─────────────────────────────────────┤  │
│  │  QPQI: 0.72             │  QPQI: 0.81            ▲ +0.09     │  │
│  │  Classification:        │  Classification:                    │  │
│  │  ACCEPTABLE             │  EFFECTIVE              ▲ +1       │  │
│  │                         │                                     │  │
│  │  SCI: 0.80              │  SCI: 0.90              ▲ +0.10    │  │
│  │  MII: 0.65              │  MII: 0.85              ▲ +0.20    │  │
│  │  BDI: 0.74              │  BDI: 0.74               0.00      │  │
│  │  CVI: 0.60              │  CVI: 0.80              ▲ +0.20    │  │
│  │  MCAI: 0.70             │  MCAI: 0.82             ▲ +0.12    │  │
│  │  DBI: 0.70              │  DBI: 0.70               0.00      │  │
│  │  QCQI: 0.75             │  QCQI: 0.78             ▲ +0.03    │  │
│  │  CAI: 0.73              │  CAI: 0.76             ▲ +0.03     │  │
│  │  AMI: 0.70              │  AMI: 0.72             ▲ +0.02     │  │
│  │  FRI: 0.82              │  FRI: 0.85             ▲ +0.03     │  │
│  ├─────────────────────────┴─────────────────────────────────────┤  │
│  │  Change Reason Summary                              [AI] [80%]│  │
│  │  "Module coverage improved from 60% to 80% (CVI +0.20).      │  │
│  │   4 new questions added to Module 4 (MII +0.20). BDI, DBI    │  │
│  │   unchanged — Bloom and difficulty distribution stable.       │  │
│  │   Overall QPQI improved from ACCEPTABLE to EFFECTIVE."        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout Rules

- Side-by-side view uses CSS grid with `grid-template-columns: 1fr 1fr`.
- On mobile (below 1024px), stack vertically with a divider.
- Deltas shown inline next to the new value with direction arrow.
- Delta arrow color: green for improved, red for declined, gray for unchanged.
- Classification change shown with directional indicator: `▲ +1`, `▼ -1`.
- Version metadata (engine, prompt, model) shown in muted text above metrics.
- Change reason summary is AI-generated. Attribution badge shown.

### Component Tree

```
VersionComparisonView
  ├── ComparisonHeader (v2 label, v3 label, close button)
  ├── VersionMetadataRow (engine, prompt, model per column)
  ├── MetricComparisonGrid
  │   └── MetricComparisonRow[]
  │       ├── IndexCode label
  │       ├── OldValue
  │       ├── NewValue
  │       └── DeltaIndicator (arrow + value + direction color)
  ├── ClassificationChangeIndicator
  └── ChangeReasonSummary [AI attributed]
```

### DeltaIndicator Variants

| Delta | Arrow | Color |
|-------|-------|-------|
| Positive (improved) | `▲` | Green |
| Negative (declined) | `▼` | Red |
| Zero (unchanged) | `─` | Gray |
| Null (new metric) | `★` | Blue |
| Null (removed metric) | `∅` | Gray |

---

## 5. Page 4: Per-Paper Variant Analysis

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Structures  —  Per-Paper Analysis                            │
├─────────────────────────────────────────────────────────────────────┤
│  [Variant A]  [Variant B]  [Variant C]                             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Variant A  (PAPER_A)                    Generated: Jun 22   │  │
│  │  ┌──────────────┬──────────────────────────────────────────┐ │  │
│  │  │  Index Values │  Coverage: 0.85  |  Difficulty: 0.72   │ │  │
│  │  │               │  Quality: 0.90   |  Dup Risk: 8%       │ │  │
│  │  └──────────────┴──────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  Bloom Analysis                                    [AI] [82%]│  │
│  │  "Bloom distribution across Variant A shows acceptable      │  │
│  │   cognitive spread. 48% LOTS, 52% HOTS — balanced."         │  │
│  │                                                              │  │
│  │  Difficulty Analysis                               [AI] [80%]│  │
│  │  "Difficulty distribution: Easy 30%, Medium 50%, Hard 20%.  │  │
│  │   Slight medium tilt but within acceptable range."           │  │
│  │                                                              │  │
│  │  CO Coverage                                       [AI] [85%]│  │
│  │  "All 6 COs covered. CO1-CO5 each have 3+ questions.        │  │
│  │   CO6 has 1 question — consider reinforcement."              │  │
│  │                                                              │  │
│  │  Module Coverage                                    [D] [92%]│  │
│  │  "Modules 1-3 covered evenly. 15 questions per module."      │  │
│  │                                                              │  │
│  │  Concept Diversity                                  [AI] [75%]│  │
│  │  "6 unique concepts identified. Moderate diversity."         │  │
│  │                                                              │  │
│  │  Academic Quality                                   [AI] [83%]│  │
│  │  "Question clarity: GOOD. Technical accuracy: GOOD.         │  │
│  │   No ambiguities detected."                                   │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  Slot Decision                                    [D]    │ │  │
│  │  │  [●] Regular  [○] Supplementary  [○] KT                 │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
PerPaperAnalysisPage
  ├── BankContextBreadcrumb (back to overview link)
  ├── VariantTabBar
  │   └── VariantTab[] (A, B, C — clickable)
  └── VariantAnalysisPanel
      ├── VariantHeader (name, generated date, paper ID)
      ├── IndexValueStrip (compact row of key indices)
      ├── AiCommentarySection [AI attributed]
      │   ├── BloomAnalysisCard
      │   ├── DifficultyAnalysisCard
      │   ├── CoCoverageCard
      │   ├── ModuleCoverageCard [Deterministic]
      │   ├── ConceptDiversityCard
      │   ├── AcademicQualityCard
      │   └── RegenerateSectionButton (per card)
      └── SlotDecisionIndicator
          └── SlotBadge[] (Regular, Supplementary, KT with active state)
```

### Variant Analysis Cards

Each AI commentary card follows a consistent template:

```
┌──────────────────────────────────────────────────┐
│  Bloom Analysis                          [AI] 82%│
├──────────────────────────────────────────────────┤
│  Content text here...                            │
│                                                  │
│  [Regenerate]                                    │
└──────────────────────────────────────────────────┘
```

Cards attributed as deterministic carry `[D]` instead of `[AI]`. Coverage
scores, difficulty scores, and duplicate risk are always deterministic.

### Slot Decision Awareness

The existing selection interface (Regular, Supplementary, KT paper slots) is
integrated into this page. When the Dean selects a variant for a slot, the Slot
Decision badge updates on that variant's panel. The selection state is shared
between the variant view and the slot selection card at the bottom.

### Empty and Error States Per Card

| State | Behavior |
|-------|----------|
| Loading | Skeleton text block (3 lines shimmer) |
| AI_PENDING | "Analysis in progress..." with spinner inside card |
| AI_FAILED | "AI interpretation unavailable. Showing deterministic data." |
| AI_UNAVAILABLE | "Ollama offline. Analysis not available for this module." |
| Data | Rendered text with attribution badge |

---

## 6. Page 5: Detailed Index Drill-Down

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Structures  →  Bloom Distribution Index               [Close]│
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Bloom Distribution Index (BDI)                      [AI] 85%│  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  Value: 0.74    |    Classification: EFFECTIVE          │  │  │
│  │  │  Confidence: 85% (HIGH)   |   Weight: 0.12             │  │  │
│  │  │  Formula: normalized_bloom_deviation v1.2               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Distribution:                                               │  │
│  │  Remember     ████████████░░░░░░░░░░  10%   (expected 10%)  │  │
│  │  Understand   ██████████████████████  22%   (expected 20%)  │  │
│  │  Apply        ████████████████████████ 24%   (expected 25%) │  │
│  │  Analyze      ████████████████████░░  18%   (expected 20%)  │  │
│  │  Evaluate     ████████████████░░░░░░  14%   (expected 15%)  │  │
│  │  Create       ████████████░░░░░░░░░░  12%   (expected 10%)  │  │
│  │                                                              │  │
│  │  Legend: ██ Actual   ░░ Expected                             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  AI Interpretation:                                [AI] [85%]│  │
│  │  "Bloom distribution is well-balanced with minor deviation   │  │
│  │   in Apply (1% below) and Understand (2% above). No          │  │
│  │   cognitive risk detected. LOTS/HOTS ratio is 56:44 which    │  │
│  │   indicates balanced cognition across lower and higher order  │  │
│  │   thinking skills."                                           │  │
│  │                                                              │  │
│  │  [Regenerate Interpretation]                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
IndexDrillDownPage
  ├── DrillDownBreadcrumb (bank name → index name)
  ├── IndexMetricHeader
  │   ├── IndexCode + Name
  │   ├── MetricValueBadge (large, color-coded)
  │   ├── ClassificationLabel
  │   ├── ConfidenceIndicator
  │   ├── WeightDisplay
  │   └── FormulaReference
  ├── DistributionBarChart (per-tool type)
  │   ├── BarRow[] (label, actual bar, expected bar, percentages)
  │   └── ChartLegend
  └── AiInterpretationPanel [AI attributed]
      ├── AIAttributionBadge
      ├── ConfidenceIndicator
      ├── InterpretationText
      └── RegenerateButton (per-panel)
```

### Bar Rendering

- Each bar is two rows: actual distribution (primary color) and expected
  distribution (muted, dashed overlay if different).
- Bar widths represent percentages (0-100% of total questions).
- Values shown as `XX% (expected YY%)`.
- Difference from expected shown as tooltip on hover.
- When actual matches expected (0% deviation), no overlay shown — just a
  "On target" label.

### Chart Fallback States

| State | Behavior |
|-------|----------|
| Loading | 6 skeleton bars with shimmer |
| Empty | "No distribution data available for this index" |
| Partial | Some tiers missing — show available data with note |
| Data | Full chart with bars |

---

## 7. Version History Panel

### ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  Analysis History                                     [▲ ▼] │
├──────────────────────────────────────────────────────────────┤
│  ● v.3  Jun 22, 2026  QPQI: 0.81  ← CURRENT               │
│       Model: qwen3.5:3b  |  Prompt: 2.1.0                   │
│       [Compare with previous ▼]                             │
│                                                             │
│  ● v.2  Jun 15, 2026  QPQI: 0.72                           │
│       Model: qwen3.5:3b  |  Prompt: 2.0.0                   │
│       [Compare with v.1]  [Compare with current]            │
│                                                             │
│  ● v.1  Jun 01, 2026  QPQI: 0.65                           │
│       Model: qwen3.5:3b  |  Prompt: 2.0.0                   │
│       [Compare with v.2]  [Compare with current]            │
├──────────────────────────────────────────────────────────────┤
│  When comparing v.3 vs v.2:                                 │
│  ┌──────────┬──────┬──────┬─────────┬──────────────┐       │
│  │ Metric   │ v.2  │ v.3  │ Delta   │ Classification│       │
│  ├──────────┼──────┼──────┼─────────┼──────────────┤       │
│  │ QPQI     │ 0.72 │ 0.81 │ +0.09   │ ▲ EFFECTIVE  │       │
│  │ CVI      │ 0.60 │ 0.80 │ +0.20   │ ▲ H.EFFECTIVE│       │
│  │ MII      │ 0.65 │ 0.85 │ +0.20   │ ▲ H.EFFECTIVE│       │
│  │ SCI      │ 0.80 │ 0.90 │ +0.10   │ ▲ H.EFFECTIVE│       │
│  │ BDI      │ 0.74 │ 0.74 │ 0.00    │ ─ EFFECTIVE  │       │
│  │ DBI      │ 0.70 │ 0.70 │ 0.00    │ ─ EFFECTIVE  │       │
│  └──────────┴──────┴──────┴─────────┴──────────────┘       │
│                                                             │
│  Root Cause: Module 4 questions added (CO coverage          │
│  improved from 60% to 80%). Prompt updated to 2.1.0.       │
└──────────────────────────────────────────────────────────────┘
```

### Version History States

| State | Behavior |
|-------|----------|
| Loading | Timeline skeleton: 3 rows of shimmer (circle + text) |
| Empty | "No previous versions. This is the first analysis." |
| Single | "Version 1 — initial analysis. No prior versions to compare." |
| Multiple | Full timeline with comparison buttons. Most recent marked CURRENT. |
| Error | "Failed to load version history. [Retry]" |

### Compare Dropdown Options

When version count is N:
- For version X where X > 1: "Compare with v.X-1" (default), "Compare with current"
- For version 1: "Compare with v.2" (only if N >= 2), "Compare with current"
- For current version: "Compare with previous" (default), dropdown for any older version

### Comparison Table in the Panel

The collapsible comparison table at the bottom shows deltas for the selected
version pair. It shows only metrics that changed (delta != 0) when collapsed,
or all metrics when expanded.

---

## 8. AI Content Attribution

### Visual Distinction Rules

Every piece of content in the workspace falls into one of three categories.
The attribution badge must be immediately visible so the Dean can assess
confidence in what they are reading.

| Category | Badge | Background | Border | Regenerate? |
|----------|-------|-----------|--------|-------------|
| AI-generated | `[AI]` + confidence % | Slightly tinted (1-2% opacity of accent color) | No special border | Yes |
| Deterministic | `[D]` | Standard surface | No special border | No |
| Deterministic with AI fallback | `[AI]` or `[D]` | Tinted if using AI, standard if deterministic | Dashed border when fallback active | Contextual |

### Attribution Badge Component

```
┌──────────┐
│  AI  85% │
└──────────┘
```

- `[AI]` in uppercase, bold, small font size.
- Confidence percentage next to it.
- Background: accent color at 10% opacity.
- Text: accent color.
- Tooltip on hover: "Generated by AI (qwen3.5:3b). Confidence based on evidence coverage."

```
┌──────┐
│  D   │
└──────┘
```

- `[D]` in uppercase, small font size.
- Background: neutral gray at 10% opacity.
- Tooltip on hover: "Deterministic calculation. Always reproducible."

### Regenerate Button

- Shown per AI section, not globally.
- Text: "Regenerate" or icon-only refresh arrow.
- On click: POST to `/api/question-banks/{id}/analysis/regenerate?module={moduleId}`.
- While regenerating: spinner, disabled state.
- After regeneration: section content updates, badge shows new timestamp.
- Regenerating one section does not affect other sections.

### Analysis Unavailable State

When the AI module failed or Ollama is unreachable:

```
┌──────────────────────────────────────────────┐
│  Bloom Analysis                     [AI] [--]│
├──────────────────────────────────────────────┤
│  Analysis unavailable — AI interpretation    │
│  offline. Showing deterministic data only.   │
│                                              │
│  [Retry]                                     │
└──────────────────────────────────────────────┘
```

- Badge shows `[--]` instead of confidence percentage.
- Content area shows standardized message.
- Retry button triggers a single-module regeneration attempt.

### Background Tinting

AI sections use `background-color: color-mix(in srgb, var(--accent), transparent 95%)`
or equivalent. The tint is subtle — barely noticeable in isolation, consistent
across all AI sections. Deterministic sections use the standard surface background.

---

## 9. State Management

Every component in the workspace explicitly defines its loading, empty, error,
and data states. The following tables enumerate states per component.

### IndexSummaryTable

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 11 skeleton rows with shimmer columns | None |
| Empty | "No analysis data available for this question bank." | Link to trigger analysis |
| Error | "Failed to load indices. [Retry]" | Retry button |
| Partial | Table renders available indices, missing ones show "--" | None |
| Data | Full table with color-coded rows | Click row for drill-down |

### ExecutiveSummaryPanel

| State | Visual | Actions |
|-------|--------|---------|
| Loading | Text skeleton (3 lines, varying widths) | None |
| AI_PENDING | Spinner + "Analysis in progress..." | None |
| AI_FAILED | "AI interpretation unavailable. Showing deterministic data only." | Retry button |
| AI_UNAVAILABLE | "Ollama offline. Deterministic mode." | Retry button |
| Data | Rendered summary with `[AI]` badge | Regenerate button |

### RiskRegisterPanel

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 3 skeleton rows | None |
| Empty (no risks) | Green banner: "No risks identified" | None |
| Empty (AI failed) | "Risk analysis unavailable. AI interpretation offline." | Retry button |
| Error | "Failed to load risk register. [Retry]" | Retry button |
| Data | Risk rows sorted by priority | Click for detail modal |

### RecommendationsPanel

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 3 skeleton cards | None |
| Empty (no recommendations) | "No recommendations at this time." | None |
| Empty (AI failed) | "Recommendations unavailable. AI offline." | Retry button |
| Error | "Failed to load recommendations. [Retry]" | Retry button |
| Data | Recommendation cards | Click for detail |

### AccreditationReadinessStrip

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 6 skeleton tiles with shimmer | None |
| Empty | "No CO data available." | None |
| Partial | Some tiles show data, some show "--" | None |
| Error | "Failed to load accreditation data. [Retry]" | Retry button |
| Data | CO tiles with progress bars | Click tile for CO detail |

### VersionHistoryPanel

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 3 skeleton timeline rows | None |
| Empty | "No previous versions. First analysis." | None |
| Single | "Version 1 — initial analysis." | None |
| Multiple | Timeline with compare buttons | Compare dropdown per version |
| Error | "Failed to load version history. [Retry]" | Retry button |

### VersionComparisonView

| State | Visual | Actions |
|-------|--------|---------|
| Loading | Two-column skeleton with metric rows | None |
| Empty (no comparison data) | "Comparison data unavailable." | Close button |
| Error | "Failed to load comparison. [Retry]" | Retry, Close buttons |
| Data | Side-by-side metrics with deltas | Close button |

### VariantAnalysisPanel

| State | Visual | Actions |
|-------|--------|---------|
| Loading | Tab bar + skeleton cards | None |
| Empty (no papers) | "No papers generated for this bank." | Link to generate papers |
| Error | "Failed to load variant data. [Retry]" | Retry button |
| Data | Active tab with analysis cards | Tab switch, regenerate per section |

### IndexDrillDownPage

| State | Visual | Actions |
|-------|--------|---------|
| Loading | Metric header skeleton + 6 bar skeletons | None |
| Empty (index not found) | "Index data not found for this analysis." | Back button |
| Error | "Failed to load index data. [Retry]" | Retry, Back buttons |
| Data | Full metric header + bars + AI panel | Regenerate interpretation |

### SlotDecisionIndicator

| State | Visual | Actions |
|-------|--------|---------|
| Loading | 3 skeleton slot badges | None |
| Empty (no selection) | "No slot assignment yet." | Dropdown select |
| Locked (submitted) | Green checkmark + "Assigned to [slot]" | None (read-only) |
| Submitted (awaiting confirm) | "Selection submitted. Awaiting confirmation." | None |
| Data | Active slot badges | Slot selection dropdown |

### RegenerateButton (per-section)

| State | Visual | Actions |
|-------|--------|---------|
| Idle | "Regenerate" | Click to trigger |
| Loading | Spinner + "Regenerating..." | Disabled |
| Success | Green checkmark + "Updated" (auto-dismiss 3s) | None |
| Error | Red text + "Failed. [Retry]" | Retry click |

### Overall Page States

At the page level (Page 2, 3, 4, 5), the following states apply:

| State | Visual | Notes |
|-------|--------|-------|
| Loading | Full-page skeleton with header + body shimmer | Shows within 200ms |
| Empty | "No analysis found. Run an analysis first." | With "Run Analysis" CTA |
| Partial | Not all sections loaded | Each section handles its own failure |
| Error | "Something went wrong" with details | Full-page error state |
| 404 (invalid bank) | "Question bank not found" | Redirect to dashboard |
| Data | All sections rendered | Normal operation |

---

## 10. State Machine for Analysis Lifecycle

The Dean workspace reads analysis status from the backend. It does not manage
the pipeline state directly, but it must render appropriately at every stage.

### Analysis Status State Machine

```
                        ┌──────────────────────────────────────────┐
                        │         QuestionBankAnalysis             │
                        │         (Backend state machine)          │
                        └──────────────────────────────────────────┘

INITIALIZED ──▶ EXTRACTING ──▶ COMPUTING ──▶ AI_PENDING ──▶ AI_COMPLETE ──▶ COMPLETE
                                            \                                /
                                             └──▶ FAILED (any step) ────────┘
```

### Dean Workspace Extended State Machine

The workspace adds client-side awareness of the analysis lifecycle, including
partial failure states that the backend signals:

```
IDLE ──▶ ANALYSIS_REQUESTED ──▶ IN_PROGRESS ──▶ COMPLETE
                                              ──▶ PARTIAL (some AI modules failed)
                                              ──▶ FAILED (deterministic metrics failed)
                     IN_PROGRESS ──▶ POLLING (client polling status endpoint)
```

### State Transition Table

| Backend Status | Workspace State | Dean Sees | Dean Can Do |
|----------------|-----------------|-----------|-------------|
| None (no analysis) | IDLE | "No analysis available" | Request analysis |
| INITIALIZED | ANALYSIS_REQUESTED | "Analysis requested" | Wait |
| EXTRACTING | IN_PROGRESS | Progress: "Extracting data..." | Wait |
| COMPUTING | IN_PROGRESS | Progress: "Computing metrics (phase 3/15)..." | Wait |
| AI_PENDING | IN_PROGRESS | Progress: "AI analysis in progress (phase 7/15)..." | Wait |
| AI_COMPLETE | IN_PROGRESS | Progress: "Assembling report..." | Wait |
| COMPLETE | COMPLETE | Full analysis rendered | Compare, drill down, regenerate |
| FAILED | FAILED | "Analysis failed" | Retry, view partial data if available |

### Partial Failure State

The backend can set `COMPLETE` even when some AI modules failed (see
`ai-analysis-subsystem.md`, Section 11 — Fallback Behavior). In this case:

```
Backend status: COMPLETE
Backend signals: { failedModules: ["risk-analysis", "recommendations"] }
Workspace renders: Full analysis with two sections showing AI_FAILED state
```

### Polling Strategy

When an analysis is IN_PROGRESS, the workspace polls:

```
GET /api/question-banks/{id}/analysis/status
  ─▶ { status, progress: { stage, stageIndex, totalStages, modulesComplete, modulesTotal } }
```

- Poll interval: every 5 seconds for the first 30 seconds, then every 15 seconds
  if still running.
- Max poll duration: 10 minutes. After that, show "Analysis is taking longer
  than expected. Check back later."
- On COMPLETE: stop polling, render full analysis.
- On FAILED: stop polling, show failure state.

### Regeneration Flow

```
Dean clicks "Regenerate Analysis"
  ─▶ Confirmation dialog: "This will create a new version."
  ─▶ POST /api/question-banks/{id}/analysis/regenerate
  ─▶ Response: { id, version: 4, status: "EXTRACTING", cacheHit: false }
  ─▶ UI transitions to IN_PROGRESS
  ─▶ Polling starts
  ─▶ On COMPLETE: new version loaded, comparison prompt shown
      "Analysis v.4 is ready. Compare with v.3?"
      [Compare Now] [Dismiss]
```

### Analysis Not Found Flow

When the Dean navigates to a bank URL with no analysis:

```
GET /api/question-banks/{id}/analysis ─▶ 404
  ─▶ UI: "This question bank has not been analyzed yet."
       [Run Analysis] button
  ─▶ POST /api/question-banks/{id}/analysis/regenerate ─▶ creates new analysis
  ─▶ UI transitions to the standard state machine flow
```

---

## 11. API Endpoints Table

### Dean Workspace API Surface

All endpoints are relative to the existing EMQPGS base URL. Authorization is
handled by `withApiHandler` and `AuthorizationService` (Dean role required).

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| GET | `/api/question-banks/{id}/analysis` | Load current (latest) full analysis | — | `AnalysisSnapshot` (see below) |
| GET | `/api/question-banks/{id}/analysis/versions` | List all analysis versions | — | `AnalysisVersion[]` |
| GET | `/api/question-banks/{id}/analysis/{versionId}` | Load a specific version by ID | — | `AnalysisSnapshot` for that version |
| GET | `/api/question-banks/{id}/analysis/compare?v1=X&v2=Y` | Compare two versions | `versionId` params | `ComparisonResult` |
| POST | `/api/question-banks/{id}/analysis/regenerate` | Trigger a new analysis run | `{ force?: boolean }` | `{ id, version, status, cacheHit }` |
| GET | `/api/question-banks/{id}/analysis/status` | Poll current analysis status | — | `{ status, progress }` |
| GET | `/api/question-banks/{id}/papers/{paperId}/analysis` | Per-paper variant analysis | — | `PaperAnalysis` |
| GET | `/api/question-banks/{id}/analysis/{versionId}/metric/{indexCode}` | Single metric detail | — | `UAFMetric` + `ConfidenceScore` |

### Response Shapes

#### AnalysisSnapshot

```typescript
interface AnalysisSnapshotResponse {
  id: string;                    // AnalysisId
  version: number;               // current version number
  status: AnalysisStatus;
  snapshot: {
    executiveSummary: string;
    finalVerdict: FinalVerdict;
    fullReport: Record<string, unknown>; // 15 phases
  };
  metrics: Array<{
    indexCode: IndexCode;
    value: number;
    classification: Classification;
    weight: number;
    weightedScore: number;
    formulaUsed: string;
    confidence: {
      score: number;
      percentage: number;
      classification: ConfidenceClassification;
      justification: string;
    } | null;
  }>;
  risks: Array<{
    id: string;
    finding: string;
    educationalRisk: string;
    institutionalRisk: string;
    priority: RiskPriority;
    riskType: RiskType;
    affectedModules: string[];
    affectedCOs: string[];
  }>;
  recommendations: Array<{
    id: string;
    finding: string;
    recommendation: string;
    priority: RiskPriority;
    impact: string;
    suggestedActions: string[];
  }>;
  versioning: {
    evaluationEngineVersion: string;
    promptVersion: string;
    analysisSchemaVersion: string;
    ollamaModel: string;
    ollamaContext: number;
    ollamaTemperature: number;
    evidenceHash: string;
    createdAt: string; // ISO 8601
  };
  aiStatus: {
    overall: "FULL" | "PARTIAL" | "UNAVAILABLE";
    failedModules: PromptModuleId[];
  };
}
```

#### AnalysisVersion

```typescript
interface AnalysisVersionResponse {
  id: string;
  versionNumber: number;
  status: AnalysisStatus;
  evidenceHash: string;
  evaluationEngineVersion: string;
  promptVersion: string;
  ollamaModel: string;
  createdAt: string; // ISO 8601
  aiStatus: "COMPLETE" | "PARTIAL" | "FAILED";
}
```

#### ComparisonResult

```typescript
interface ComparisonResult {
  versionA: {
    version: AnalysisVersionResponse;
    snapshot: AnalysisSnapshotResponse;
  };
  versionB: {
    version: AnalysisVersionResponse;
    snapshot: AnalysisSnapshotResponse;
  };
  deltas: MetricDelta[];
  classificationChanges: ClassificationChange[];
  changeReasonSummary: string | null; // AI-generated, null if unavailable
  rootCauses: string[];
}

interface MetricDelta {
  indexCode: IndexCode;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged" | "new" | "removed";
  oldClassification: Classification | null;
  newClassification: Classification | null;
}

interface ClassificationChange {
  indexCode: IndexCode;
  oldClassification: Classification;
  newClassification: Classification;
  levelsChanged: number; // positive = improved, negative = declined
}
```

---

## 12. Interaction Design

### Flow 1: Dean Lands on Dashboard

1. Dean navigates to `/dashboard/dean`.
2. Dashboard loads summary stats and two lists (pending, completed).
3. Dean sees pending analyses with status badges.
4. Dean clicks a bank row in the pending list.

→ Navigate to `/dashboard/dean/review?bank={bankId}`

### Flow 2: UAF Overview Loads

1. Page loads with loading skeleton.
2. `GET /api/question-banks/{id}/analysis` fires.
3. Response received: IndexSummaryTable renders, ExecutiveSummaryPanel renders.
4. Risk register and recommendations load in parallel.
5. Version history loads.
6. All sections settle into data state.

→ Dean sees the full bank overview.

### Flow 3: Dean Compares Versions

1. Dean clicks the version selector dropdown in the header.
2. Dropdown lists all versions with dates and QPQI values.
3. Dean selects "Compare with v.2".
4. A comparison overlay or split-view renders.
5. `GET /api/question-banks/{id}/analysis/compare?v1=2&v2=3` fires.
6. Side-by-side view shows all metrics with deltas.
7. Dean sees change reason summary at the bottom.

→ Dean clicks [Close] to return to overview.

### Flow 4: Dean Views Per-Paper Analysis

1. On the bank overview page, Dean clicks the "Papers" tab or "Variant A" link.
2. Page switches to per-paper mode.
3. Variant A analysis loads by default.
4. `GET /api/question-banks/{id}/papers/{paperId}/analysis` fires.
5. Analysis cards render: Bloom, Difficulty, CO Coverage, etc.
6. Dean clicks Variant B tab → Variant B analysis loads.
7. Dean sees slot decision at the bottom.

→ Dean switches between variants to compare.

### Flow 5: Dean Drills Into Index

1. In the IndexSummaryTable, Dean clicks the BDI row.
2. Navigation to `/dashboard/dean/review?bank={bankId}&index=BDI`.
3. Index drill-down page loads with distribution bars.
4. Dean sees AI interpretation panel.

→ Dean clicks [Close] or breadcrumb to return.

### Flow 6: Dean Regenerates Analysis

1. On the bank overview, Dean clicks "Regenerate Analysis" button.
2. Confirmation dialog: "This will create a new version of the analysis.
   Existing versions are preserved. Continue?"
3. Dean confirms.
4. `POST /api/question-banks/{id}/analysis/regenerate` fires.
5. Response returns immediately `{ status: "EXTRACTING" }`.
6. UI enters IN_PROGRESS state: all sections show loading/progress indicators.
7. Polling begins: `GET /api/question-banks/{id}/analysis/status` every 5 seconds.
8. Progress updates: "Computing metrics (phase 3/15)..."
9. On COMPLETE: poll stops, full analysis reloads.
10. Banner appears: "Analysis v.4 is ready. Compare with v.3? [Compare Now]"

→ Dean clicks [Compare Now] to see what changed.

### Flow 7: Dean Regenerates Single AI Section

1. On the executive summary panel, Dean clicks "Regenerate" button.
2. `POST /api/question-banks/{id}/analysis/regenerate?module=executive-summary` fires.
3. Only that section shows loading state.
4. On completion: section updates with new content, timestamp refreshes.
5. Other sections remain unchanged.

→ Dean sees updated executive summary without full re-analysis.

### Flow 8: Dean Views Empty State (No Analysis)

1. Dean navigates to a bank URL that has no analysis.
2. Page shows: "This question bank has not been analyzed yet."
3. Dean clicks [Run Analysis] button.
4. `POST /api/question-banks/{id}/analysis/regenerate` fires.
5. Flow continues as Flow 6 from step 6 onwards.

→ Full analysis renders on completion.

### Flow 9: Dean Views Error State (Ollama Down)

1. Dean opens a bank with a previous analysis.
2. Page loads with deterministic data.
3. AI-section cards show: "Ollama offline. Showing deterministic data only."
4. IndexSummaryTable and deterministic metrics render normally.
5. Dean clicks [Retry] on an AI section.
6. If Ollama responds, section updates with AI content.
7. If Ollama still down, section returns to error state.

→ Dean can still view all deterministic data, read previous AI content if cached.

### Flow 10: Slot Assignment (Existing)

1. Dean reviews three paper variants.
2. Dean selects one variant for Regular, one for Supplementary, one for KT.
3. Selections must be distinct across the three slots.
4. Dean clicks [Submit Selection].
5. Selection is locked. Read-only from this point.
6. Dean clicks [Next Review] to proceed to the next bank.

This flow already exists in the current `dean-review-workspace.tsx` component.
It is preserved and integrated with the per-paper variant analysis view.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Submit current action (regenerate, compare) |
| `Escape` | Close panel, dismiss dialog |
| `j` / `k` | Navigate down/up in pending list |
| `r` | Regenerate current analysis (with confirmation) |
| `v` | Open version selector |
| `1` `2` `3` | Switch variant A/B/C in per-paper view |

---

## 13. Out of Scope

The following are intentionally absent from this document:

- **Paper generation UI** — handled by the existing `DeanReviewWorkspace` component.
  This document extends it, not replaces it.
- **Dean role assignment** — handled by existing `ResponsibilityAssignment` and
  `AuthorizationService`. Not redefined here.
- **Authentication flows** — handled by existing Auth.js v5 + Custom JWT.
- **Paper export functionality** — handled by existing download routes.
- **Backend pipeline implementation** — defined in `ai-analysis-subsystem.md`.
- **Formula definitions** — defined in `uaf-engineering-specification.md`.
- **Database schema** — Prisma models defined in `ai-analysis-subsystem.md` Section 12.
- **Prompt content** — defined in the Prompt Specification document.
- **Event definitions** — domain events like `AnalysisCompleted` are separate.
- **Responsive layout below 768px** — the comparison view is not designed for
  mobile screens. A future mobile adaptation may collapse to stacked layout.
- **Real-time multi-user collaboration** — the workspace is single-user. Concurrent
  Dean reviews are not supported in this version.
- **Dark mode design tokens** — colors reference CSS variables. Dark mode values
  are defined in the design token system, not this document.

---

*End of Dean AI Review Workspace Architecture. All entity references trace to
`uaf-domain-model.md` without redefinition. All API endpoints trace to
`ai-analysis-subsystem.md` Section 13 without duplication.*
