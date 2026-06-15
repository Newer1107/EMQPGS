# ADR-003: Removal of the signed report workflow

**Status:** Accepted (implemented)
**Date:** 2026-06-14

---

## Problem

The system had a signed report workflow where:
1. After AI analysis and paper generation, the bank entered `AWAITING_HOD_SIGN`
2. The HOD (Head of Department) would sign a PDF report
3. The moderator would upload the signed report to MinIO (`signed-reports` bucket)
4. The bank auto-advanced to `SIGNED_REPORT_UPLOADED`
5. Then the coordinator could approve or reject

This workflow was complex, had low adoption, and created several issues:
- Required a `SignedReport` entity and `signedReportAssetId`/`signedReportUploadedAt` fields on QuestionBank
- Required a dedicated MinIO bucket
- Required 3 API endpoints (presign, upload, confirm)
- The HOD signing step was a manual, offline process — no digital signature mechanism existed
- The state machine complexity added no value: an approved bank with AI report and papers already has everything needed
- `SIGNED_REPORT_UPLOADED` auto-advanced to `AWAITING_COORDINATOR_APPROVAL` but the code also had a separate status update step, creating ambiguity

## Alternatives considered

1. **Keep the workflow but implement digital signatures** — Add actual cryptographic signing. Over-engineered for the current use case.

2. **Simplify to a single step** — Keep the upload but remove the multi-state progression. Still adds complexity.

3. **Remove entirely** — Coordinator approval happens directly from `APPROVAL` phase. No PDF signing needed.

## Decision

Remove the signed report workflow entirely.

Deleted:
- `SignedReport` model (never existed in schema, but fields did)
- `signedReportAssetId` and `signedReportUploadedAt` from QuestionBank
- `signed-reports` MinIO bucket
- `POST /api/question-banks/[id]/signed-report`
- `POST /api/question-banks/[id]/signed-report/presign`
- `ReportService.uploadSignedReport()`
- `SIGNED_REPORT_UPLOADED`, `AWAITING_HOD_SIGN`, `AWAITING_COORDINATOR_APPROVAL` enum values (part of ADR-002)
- Frontend pages for signed report upload
- Sidebar "Signed Reports" link (dead, to be removed)

## Consequences

**Positive:**
- Removed 1 entity, 3 API endpoints, 1 MinIO bucket, 1 service method
- Simplified state machine (ADR-002)
- Coordinator now approves directly from `APPROVAL` phase
- No offline HOD dependency

**Negative:**
- No mechanism for HOD review/signoff before final approval
- If HOD signoff is required by policy, the system no longer enforces it
- Existing `AWAITING_HOD_SIGN` banks in the database need data migration
