# Production Domain

## Services

The production domain consists of four service files that handle the terminal stages of the exam lifecycle.

### DeanReviewService
- **File:** `src/modules/production/dean-review.service.ts`
- **Responsibilities:**
  - `getDeanDashboardData()` — returns pending/completed reviews for the dean's department
  - `getDeanReviewWorkspace()` — returns bank detail with paper variants, scores, recommendations
  - `submitDeanReview()` — validates and persists dean's variant selections

### ExportService
- **File:** `src/modules/production/export.service.ts`
- **Responsibilities:**
  - `listCoeOverview()` — returns all banks with their export readiness status
  - `listExportArtifacts()` — lists existing exports for a bank
  - `createExport()` — generates PDF/DOCX/ZIP, stores in MinIO, creates ExportArtifact record
  - `createExportDownloadLink()` — returns presigned download URL

### MonitoringService
- **File:** `src/modules/production/monitoring.service.ts`
- **Responsibilities:**
  - `getObservabilityOverview()` — returns MySQL reachability, MinIO status, workflow counts, system metrics
  - Used by both `GET /api/health` and `GET /api/monitoring`

### BackupService
- **File:** `src/modules/production/backup.service.ts`
- **Responsibilities:**
  - `runSystemBackup()` — calls `mysqldump`, stores in MinIO `system-backups` bucket, creates SystemBackup record
  - Runs synchronously within the HTTP request

### DocumentService
- **File:** `src/modules/production/document-service.ts`
- **Responsibilities:**
  - `createCombinedPdf(papers)` — generates a multi-page PDF with page breaks between questions
  - `createCombinedDocx(papers)` — generates DOCX format
  - `createZipBundle([pdf, docx, manifest.json])` — generates ZIP with all formats + manifest

## Entities

### DeanReview
- **Fields:** `id`, `questionBankId` (unique), `regularPaper` (PaperVariant), `supplementaryPaper` (PaperVariant), `ktPaper` (PaperVariant), `reviewedById`, `notes?`, `reviewedAt`
- **Write-once:** No update or delete API. Once submitted, the dean's selection is final.

### ExportArtifact
- **Fields:** `id`, `questionBankId`, `generatedById?`, `format` (PDF/DOCX/ZIP), `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId?`, `metadata?`, `expiresAt`
- **Expiry:** Artifacts have an `expiresAt` timestamp. Cleanup via `cleanupExpiredArtifacts()`.

### SystemBackup
- **Fields:** `id`, `status` (PENDING/COMPLETED/FAILED/EXPIRED), `fileAssetId?`, `triggeredById?`, `metadata?`, `failureReason?`, `expiresAt`, `startedAt`, `completedAt?`
- **Backup method:** `mysqldump` shell execution, output uploaded to MinIO `system-backups` bucket

## Workflows

### Dean Review
```
Dean → /dashboard/dean/review?bank=XXX
  → DeanReviewWorkspace client component
    → GET /api/question-banks/[id]/dean-review — fetches bank with papers
    → Dean sees 3 paper cards (A, B, C) with coverage/difficulty/quality scores
    → Dean selects variants for 3 exam slots via dropdowns
    → POST /api/question-banks/[id]/dean-review — submits selection
      → Validates: distinct variants, all belong to this bank
      → Creates DeanReview record (immutable)
      → Notifications: COE (ACTION_REQUIRED), coordinators + self (SUCCESS)
```

### Export
```
COE → /dashboard/coe/production
  → ExportConsole component
    → COE selects bank + format (PDF, DOCX, or ZIP)
    → Fills metadata (examDate, duration, maximumMarks, instructions, institutionName)
    → POST /api/exports
      → Validates DeanReview exists for the bank
      → Generates document(s) via DocumentService
      → Uploads to MinIO (exports bucket)
      → Creates ExportArtifact record (COMPLETED)
    → GET /api/exports/[id]/download — returns presigned download URL
```

### Monitoring
```
COE → GET /api/health or GET /api/monitoring
  → MonitoringService.getObservabilityOverview()
    → Returns:
      - MySQL connectivity + basic query latency
      - MinIO bucket availability
      - Workflow counts: AI reports in progress, paper generations, exports, backups
      - System counts: users, banks, reports, exports, backups, stored objects
```

### Backup
```
COE → POST /api/backups
  → BackupService.runSystemBackup()
    → Creates SystemBackup record (PENDING)
    → execFile('mysqldump', [...] ) with maxBuffer 50MB
    → Uploads dump to MinIO (system-backups bucket)
    → Marks COMPLETED (or FAILED with reason)
```

## Invariants

- DeanReview is write-once per bank — no undo, no edit API
- Export requires a DeanReview to exist for the bank
- Exports generate synchronously — large banks may cause request timeouts
- Backups run synchronously — `mysqldump` with 50MB buffer limit
- Monitoring and health routes share the same service and return the same data
- All production services call Prisma directly (no repository layer for production domain)
