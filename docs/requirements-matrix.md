# Requirements Matrix

This matrix consolidates the markdown documentation in the repository and maps each requirement to the current codebase.

## Roles And Core Routes

| Feature / Workflow | Source Doc(s) | Expected Behavior | Current Implementation Hook | Gap Category | Required Remediation |
|---|---|---|---|---|---|
| COE dashboard shell | `README.md`, `role-coe.md` | Role label, nav, user footer, sign out | `app/(protected)/layout.tsx`, `src/components/layout/app-shell.tsx` | Partial | Keep nav aligned to docs and preserve role-aware access denial |
| Coordinator dashboard | `role-coordinator.md` | Subjects, question banks, assignments, read-only question visibility | `app/(protected)/dashboard/coordinator/*` | Partial | Add stronger subject-cycle and assignment UX, department scoping |
| Moderator dashboard | `role-moderator.md` | Review queue plus approved/rejected visibility | `app/(protected)/dashboard/moderator/*` | Partial | Maintain filtered status views and improve moderation history UX |
| Contributor dashboard | `role-contributor.md` | My subjects, submit question, my submissions | `app/(protected)/dashboard/contributor/*` | Partial | Keep dedicated routes and refine subject/slot guidance |
| Dean dashboard | `role-dean.md` | Readiness overview and reports / review | `app/(protected)/dashboard/dean/*` | Partial | Strengthen readiness metrics to match doc expectations |

## APIs And Workflow Actions

| Feature / Workflow | Source Doc(s) | Expected Behavior | Current Implementation Hook | Gap Category | Required Remediation |
|---|---|---|---|---|---|
| Auth login/logout/refresh/reset | `app-flow.md`, `docs/api-documentation.md` | Cookie-based auth with CSRF and reset flow | `app/api/auth/*`, `src/lib/auth.ts`, `src/lib/api-handler.ts` | Complete | Verify behavior continuously in regression tests |
| COE user CRUD | `role-coe.md`, `app-flow.md` | Create, update, deactivate users without leaking password data | `app/api/users*`, `src/modules/users/*` | Partial | Keep sanitize/select logic and add richer admin UI controls |
| Department management | `role-coe.md`, `app-flow.md` | Create, edit, deactivate departments | `app/api/departments*`, `src/modules/departments/*` | Partial | Docs mention `description`; schema still uses `hodName` and `isActive` |
| Exam cycle management | `role-coe.md`, `app-flow.md` | Create/update/activate/close cycles with conflict checks | `app/api/exam-cycles*`, `src/modules/exam-cycles/*` | Partial | Docs and schema disagree on fields (`name`, `ODD/EVEN`, dates) |
| Subject management | `role-coordinator.md`, `app-flow.md` | Create, edit, deactivate, and link subjects to cycles | `app/api/subjects*`, `src/modules/subjects/*` | Partial | Add cycle-linking UX/state if docs remain authoritative |
| Question bank initialization | `role-coordinator.md`, `app-flow.md` | Subject-cycle bank creation with 126-slot template | `app/api/question-banks*`, `src/modules/question-banks/*`, `src/modules/questions/slot-template.ts` | Complete | Keep slot-grid generation verified |
| Assignment management | `role-coordinator.md`, `app-flow.md` | Assign moderators/contributors and notify them | `app/api/assignments/route.ts`, `src/modules/assignments/*` | Partial | Improve module-level visibility and reassignment UX |
| Question draft/submit/revise | `role-contributor.md`, `app-flow.md` | Contributor owns own content only | `app/api/questions*`, `src/modules/questions/*` | Partial | Docs mention `PENDING/REVISION_SUBMITTED`; code collapses into current status model |
| Moderation actions | `role-moderator.md`, `app-flow.md` | Approve, reject, request revision, override | `app/api/questions/[id]/moderate`, `app/api/question-slots/[id]/override` | Partial | Improve status segmentation and audit visibility |
| AI analysis | `role-coordinator.md`, `role-coe.md`, `app-flow.md` | Generate report and storage artifacts | `app/api/question-banks/[id]/reports`, `src/modules/reports/service.ts` | Complete | Continue documenting direct execution instead of queued work |
| Paper generation | `role-coordinator.md`, `role-dean.md`, `app-flow.md` | Generate A/B/C papers with scoring | `app/api/question-banks/[id]/papers`, `src/modules/reports/service.ts` | Complete | Continue verifying balance and usage tracking |
| Dean review | `role-dean.md`, `app-flow.md` | Distinct regular/supplementary/KT selection | `app/api/question-banks/[id]/dean-review`, `src/modules/production/service.ts` | Complete | Add stronger UI validation feedback if needed |
| COE exports | `role-coe.md`, `app-flow.md` | PDF/DOCX/ZIP exports via MinIO | `app/api/exports*`, `src/modules/production/service.ts` | Complete | Continue verifying object authorization and download flow |
| COE monitoring and health | `role-coe.md`, `docs/monitoring-guide.md` | Report real service/workflow health | `app/api/monitoring`, `app/api/health`, `src/modules/production/service.ts` | Partial | Continue aligning docs away from queue/worker expectations |
| Backups | `role-coe.md`, `app-flow.md` | Manual backup and retention visibility | `app/api/backups`, `src/modules/production/service.ts` | Partial | No scheduler exists; backup remains manual/app-triggered |

## Security And Ops

| Feature / Workflow | Source Doc(s) | Expected Behavior | Current Implementation Hook | Gap Category | Required Remediation |
|---|---|---|---|---|---|
| RBAC on pages and APIs | `docs/rbac-matrix.md`, role docs | Role-safe dashboards and routes | `proxy.ts`, `src/lib/api-handler.ts` | Partial | Continue replacing any seed-user or cross-role shortcuts |
| CSRF on mutations | `docs/security-checklist.md` | Required token for non-GET changes | `src/lib/client-fetch.ts`, `src/lib/csrf.ts`, `src/lib/api-handler.ts` | Complete | Keep in regression verification |
| Signed URL controls | `docs/security-checklist.md`, role docs | MinIO access scoped by role and entity | `src/lib/storage/*`, attachment/export routes | Complete | Keep object-level authorization checks exercised |
| Rate limiting | `docs/security-checklist.md` | Shared API throttling | `src/lib/rate-limit.ts` | Partial | Current implementation is in-process, not distributed |
| Deployment readiness | `README.md`, `docs/deployment-guide.md`, `docs/production-checklist.md` | Buildable app with documented runtime requirements | Docker, compose, env docs, health routes | Partial | Manual backup/cleanup and schema-doc mismatches remain open |
