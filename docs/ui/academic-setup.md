# Academic Setup UI

> Last updated: 2026-06-18
> Refactored: workflow-oriented navigation, merged curriculum, batch workspace tabs

---

## Navigation Architecture

### Sidebar (Before)

```
Academic Setup:
• Academic Units
• Programmes
• Curriculum Schemes
• Curriculum Subjects
• Batches
• Batch Semesters
• Teaching Groups
```

### Sidebar (After)

```
Academic Setup:
• Academic Setup (dashboard)
• Academic Units
• Programmes
• Curriculum
• Batches
```

Removed from sidebar (now child screens):
- Curriculum Schemes → inside Curriculum
- Curriculum Subjects → inside Curriculum
- Batch Semesters → inside Batch workspace
- Teaching Groups → inside Batch workspace

---

## Page Hierarchy

```
Academic Setup Dashboard (/dashboard/coe/academic-setup)
  │
  ├── Academic Units (/dashboard/coe/academic-units)
  │     └── (standalone CRUD — "who teaches what")
  │
  ├── Programmes (/dashboard/coe/programmes)
  │     └── (standalone CRUD — "what degrees exist")
  │
  ├── Curriculum (/dashboard/coe/curriculum)
  │     ├── Select Programme → Select Scheme → Semester tabs
  │     └── Add/remove subjects per semester
  │
  └── Batches (/dashboard/coe/batches)
        ├── List all batches
        └── Batch Workspace (/dashboard/coe/batches/[id])
              ├── Overview (key info cards)
              ├── Semesters (timeline, activate/complete)
              ├── Teaching Groups (rename, activate/deactivate)
              └── History (placeholder for future)
```

---

## User Workflow

```
1. Academic Setup Dashboard
   → See setup progress, summary counts, next actions
   ↓

2. Academic Units
   → Define ES&H, Computer Engineering, IT...
   → "Next step: Go to Programmes"
   ↓

3. Programmes
   → Define BE Computer Engineering, BE IT...
   → "Next step: Go to Curriculum"
   ↓

4. Curriculum
   → Select a scheme (e.g. "2025 Scheme")
   → Click semester tabs (1-8)
   → Add subjects to each semester
   → "Next step: Go to Batches"
   ↓

5. Batches
   → Create a batch (auto-creates semesters)
   → Click a batch name to open its workspace
   ↓

6. Batch Workspace
   → Overview: see key info at a glance
   → Semesters: view timeline, highlight current
   → Teaching Groups: rename/activate (if enabled)
   → History: reserved for future use
```

---

## Backend APIs Used

| Page | API Endpoints |
|------|---------------|
| Academic Setup Dashboard | `GET /api/academic-units`, `/api/programmes`, `/api/batches`, `prisma` queries |
| Academic Units | `GET /api/academic-units`, `POST /api/academic-units` |
| Programmes | `GET /api/programmes`, `POST /api/programmes` |
| Curriculum | `GET /api/curriculum-schemes`, `GET /api/curriculum-subjects`, `POST /api/curriculum-subjects` |
| Batches (list) | `GET /api/batches`, `POST /api/batches` |
| Batch Overview | `prisma.batch.findUnique` |
| Batch Semesters | `prisma.batchSemester.findMany` |
| Batch Teaching Groups | `prisma.teachingGroup.findMany` |

---

## UX Principles Applied

1. **No database terminology** — never say "entity", "record", "foreign key", "ID", "relation"
2. **Task-oriented pages** — every page represents a real college task, not a database table
3. **Guided workflow** — "Next step" links at the bottom of each page lead users naturally
4. **Setup progress** — the dashboard shows checkmarks for completed steps
5. **Merged screens** — Curriculum Schemes + Subjects merged into one semester-tabbed experience
6. **Workspace model** — each Batch is its own workspace with tabs, not a flat list
7. **"What is this?"** — every page includes a plain-English description
8. **Child screens** — Semesters, Teaching Groups are child pages accessible within the Batch workspace, not separate sidebar entries

---

## Future Improvements (before ExamCycle integration)

| Improvement | Effort | Notes |
|-------------|--------|-------|
| Batch creation: add teaching groups toggle in form | Low | Currently requires ID fields; needs select dropdown for programme/scheme |
| Edit/delete for academic units, programmes, schemes | Low | Currently only create via SimpleForm; needs action buttons |
| Curriculum: inline add subject within semester tab | Medium | Currently opens a separate form; could be inline |
| Batch dates: inline edit in semester timeline | Medium | Currently read-only; needs date picker |
| Teaching groups: inline rename | Low | Currently read-only; needs edit button |
| Responsive layout for mobile | Medium | Tables need horizontal scroll on small screens |
