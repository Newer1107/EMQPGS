# EMQPGS

Examination Management & Question Paper Generation System built with Next.js, TypeScript, Prisma, MySQL, Redis, Auth.js, BullMQ, MinIO, and Ollama.

## Status

This repository now includes:

- Phase 1: platform foundation and administration
- Phase 2: question contribution and moderation
- Phase 3: AI analysis, paper generation, dean review, exports, security hardening, observability, and deployment assets

## Tech Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Reusable `shadcn/ui`-style primitives

### Backend

- Next.js route handlers
- Prisma ORM
- MySQL 8
- Redis
- BullMQ

### Authentication

- Auth.js credentials provider
- JWT access and refresh cookies
- CSRF-protected mutating APIs

### Storage

- MinIO
- Presigned upload and download URLs
- Server-side artifact uploads for generated files

### AI and Documents

- Ollama for AI analysis overlays
- `pdf-lib` for PDF generation
- `docx` for DOCX generation
- `jszip` for ZIP bundles

## Roles

- `COE`
- `COORDINATOR`
- `MODERATOR`
- `CONTRIBUTOR`
- `DEAN`

Detailed permissions: `docs/rbac-matrix.md`

## Architecture

### Layering

- `app/` — pages and APIs
- `src/modules/` — feature modules
- `src/lib/` — cross-cutting infrastructure
- `prisma/` — schema, migrations, seed
- `workers/` — BullMQ workers
- `docs/` — architecture, security, monitoring, deployment

### Patterns

- feature-based modular architecture
- repository and service layers
- Zod validation
- centralized API error handling
- RBAC checks in proxy and route handlers
- structured logging
- append-only audit trail hashing

See:

- `docs/architecture.md`
- `docs/architecture-diagram.md`

## Core Features

### Administration

- user management
- department management
- exam cycle management
- subject management
- question bank creation
- teacher assignment workflows

### Question Contribution

- 6 modules per subject
- 7 slots each for `2`, `5`, and `10` mark questions
- total `126` slot coordinates per question bank
- contributor-only visibility for owned questions
- moderator full visibility and override
- coordinator read-only visibility

### Moderation

- approve
- reject
- request revision
- notifications and email abstraction
- attachment management with MinIO

### AI Analysis

- deterministic report generation for:
  - module coverage
  - CO coverage
  - RBT distribution
  - difficulty distribution
  - duplicate detection
  - missing areas
  - quality findings
  - Bloom’s balance
- Ollama summary overlay
- JSON and PDF report storage in MinIO

### Paper Generation

- generates `PAPER_A`, `PAPER_B`, `PAPER_C`
- enforces:
  - no duplicates
  - module balance
  - historical exclusion
  - cross-paper uniqueness
  - inventory warnings
  - usage priority
- tracks:
  - `usageCount`
  - `lastUsedExam`
  - `lastUsedYear`
  - `lastUsedSemester`
  - `lastUsedType`

### Dean Review

- dean receives Papers A, B, and C
- each paper exposes:
  - coverage score
  - difficulty score
  - quality score
  - duplicate risk
  - recommendation
- dean must select:
  - regular exam paper
  - supplementary paper
  - KT paper

### COE Production Controls

- view generated papers
- view AI reports
- view dean selections
- export PDF
- export DOCX
- export ZIP
- print via PDF download flow

### Security Hardening

- role-based access verification
- object-level authorization for exports
- CSRF protection
- rate limiting
- secure headers
- short-lived signed URLs
- append-only audit logs
- session idle timeout
- immutable locked banks

### Observability and Ops

- structured logs
- `/api/health`
- `/api/monitoring`
- queue monitoring
- MinIO monitoring
- MySQL monitoring
- nightly backup queue
- retention cleanup queue

## Storage Buckets

- `question-bank-attachments`
- `signed-reports`
- `generated-papers`
- `exports`
- `audit-files`
- `system-backups`

## Main APIs

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/csrf`

### Reports and Papers

- `GET/POST /api/question-banks/[id]/reports`
- `GET/POST /api/question-banks/[id]/papers`
- `GET/POST /api/question-banks/[id]/dean-review`

### Production

- `GET/POST /api/exports`
- `GET /api/exports/[id]/download`
- `POST /api/backups`
- `GET /api/monitoring`
- `GET /api/health`

Full reference: `docs/api-documentation.md`

## Protected Pages

### COE

- `/dashboard/coe`
- `/dashboard/coe/users`
- `/dashboard/coe/departments`
- `/dashboard/coe/exam-cycles`
- `/dashboard/coe/audit`
- `/dashboard/coe/production`
- `/dashboard/coe/monitoring`

### Coordinator

- `/dashboard/coordinator`
- `/dashboard/coordinator/subjects`
- `/dashboard/coordinator/question-banks`
- `/dashboard/coordinator/assignments`
- `/dashboard/coordinator/questions`

### Moderator

- `/dashboard/moderator`
- `/dashboard/moderator/questions`

### Contributor

- `/dashboard/contributor`
- `/dashboard/contributor/questions`

### Dean

- `/dashboard/dean`
- `/dashboard/dean/review`

## Environment Variables

Required or supported keys are documented in `.env.example`.

Important additions for production:

- `CSRF_SECRET`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_TOKEN_TTL_DAYS`
- `SESSION_IDLE_TIMEOUT_MINUTES`
- `SIGNED_URL_EXPIRY_SECONDS`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_REQUESTS`
- `INSTITUTION_NAME`
- `EXPORT_RETENTION_DAYS`
- `BACKUP_RETENTION_DAYS`
- `HEALTHCHECK_TOKEN`

## Local Development

### Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop
- optional Ollama local runtime

### Start Infra

```bash
docker compose up -d mysql redis minio minio-init
```

### Install and Generate

```bash
npm ci
npx prisma generate
```

### Migrate and Seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

### Start App and Worker

```bash
npm run dev
npm run worker
```

## Seed Users

- `coe@emqpgs.local`
- `coordinator@emqpgs.local`
- `moderator@emqpgs.local`
- `contributor@emqpgs.local`
- `dean@emqpgs.local`

Default password:

- `Password@123`

## Docker and Deployment

- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

Deployment details:

- `docs/deployment-guide.md`
- `docs/production-checklist.md`

## Monitoring and Security Docs

- `docs/security-checklist.md`
- `docs/monitoring-guide.md`

## Tests

Run:

```bash
npm run test
```

Coverage currently includes:

- slot generation
- permissions
- question lifecycle
- report analysis
- paper generation
- locked-bank behavior

## Verified Commands

- `npm run lint`
- `npm run build`
- `npx prisma generate` with `PRISMA_GENERATE_NO_ENGINE=1`

## Notes

- workers register nightly backup and retention cleanup schedules
- backup execution expects `mysqldump` to be available in the runtime environment
- AI analysis expects Ollama to be reachable at `OLLAMA_BASE_URL`
