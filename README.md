# EMQPGS

Examination Management & Question Paper Generation System built on Next.js, Prisma, MySQL, Redis, Auth.js, and MinIO.

This repository currently includes:

- Phase 1 platform foundation
- Phase 2 question contribution and moderation system

## Core Capabilities

## Design System

The current UI uses a project-wide **Minimalist Monochrome** design system with:

- pure black and white hierarchy
- serif-led editorial typography
- zero border radius
- sharp line-based structure instead of shadows
- high-contrast inverted surfaces for emphasis
- subtle paper/grid/noise textures for depth
- uppercase mono labels for metadata and navigation
- oversized display typography for key views and role dashboards

Theme implementation is centralized through:

- `app/globals.css`
- `app/layout.tsx`
- `src/components/ui/*`
- `src/components/layout/app-shell.tsx`

This keeps visual changes maintainable and avoids one-off styling drift.

### Platform Foundation

- Role-based administrative dashboards for `COE`, `Coordinator`, `Moderator`, `Contributor`, and `Dean`
- User management with department and role assignment
- Department management
- Exam cycle management
- Subject management
- Question bank lifecycle management
- Teacher assignment workflows
- JWT-based login, logout, forgot password, reset password, and refresh token support
- Audit logging across key system events
- MinIO-backed file storage using presigned URLs only

### Question Contribution & Moderation

- 6-module question bank grid for every subject/question bank
- 7 slots each for `2`, `5`, and `10` mark questions per module
- Total of `126` slot coordinates per question bank
- Slot reservation engine with collision prevention and moderator override
- Contributor visibility restrictions
- Moderator full visibility and full edit access
- Coordinator read-only monitoring access
- Question lifecycle from draft to submission, approval, rejection, and revision requests
- Attachment upload, preview/download, replace, and delete for images, diagrams, and PDFs
- In-app notifications plus email abstraction layer
- Moderation dashboard and contributor workspace

## Tech Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Lightweight `shadcn/ui`-style reusable UI primitives

### Backend

- Next.js route handlers
- Prisma ORM
- MySQL 8
- Redis client wiring

### Authentication

- Auth.js
- Custom JWT access and refresh cookies

### Storage

- MinIO
- S3-compatible presigned upload and download URLs

### Tooling

- Docker
- Docker Compose
- Vitest
- ESLint

## Architecture

## Layering

- `app/` — App Router pages and API route handlers
- `src/lib/` — shared infrastructure, auth, storage, DB, Redis, errors, audit
- `src/modules/` — feature modules with validation, repositories, services, and workflow logic
- `prisma/` — schema, migrations, and seed data
- `docs/` — RBAC and architecture notes

### Patterns Used

- Clean Architecture-inspired separation
- Feature-based module organization
- Repository pattern for data access
- Service layer for orchestration and business logic
- DTO validation with Zod
- Proxy-based RBAC gatekeeping
- Central API error handling
- Explicit audit logging

## Roles and Permissions

See `docs/rbac-matrix.md`.

### High-level Summary

- `COE` — user management, departments, exam cycles, audit oversight
- `Coordinator` — subjects, question banks, assignments, read-only contribution monitoring
- `Moderator` — full question visibility, slot override, edit, approve/reject/revision actions
- `Contributor` — own slot reservation, own questions only, submission and revision handling
- `Dean` — readiness and approval visibility

## Question Bank Structure

Each question bank is initialized with:

- `6` modules
- `7 × 2-mark questions` per module
- `7 × 5-mark questions` per module
- `7 × 10-mark questions` per module

Total question coordinates per question bank:

- `6 × (7 + 7 + 7) = 126`

These coordinates are materialized as `QuestionSlot` rows.

## Question Model

Each question stores:

- Question text
- Module number
- Marks
- Slot number
- CO mapping
- RBT level
- Teaching index
- Difficulty level
- Contributor
- Status
- Moderator remark

### Supported CO Values

- `CO1`
- `CO2`
- `CO3`
- `CO4`
- `CO5`
- `CO6`

### Supported RBT Values

- `L1`
- `L2`
- `L3`
- `L4`
- `L5`
- `L6`

### Question Statuses

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `REVISION_REQUESTED`

## Slot Reservation Rules

- One contributor can own one slot coordinate at a time
- A claimed slot is locked
- A slot with an existing question cannot be claimed by another contributor
- Moderators can override reservation conflicts
- Coordinators are read-only observers

## Visibility Rules

### Contributor

- Can see only own questions
- Cannot view another contributor’s question content
- Can edit own non-approved questions

### Moderator

- Can see all questions
- Can edit all questions
- Can approve, reject, or request revision
- Can override slot reservations

### Coordinator

- Can see overall contribution progress
- Read-only

## Attachment Management

Attachments are stored in MinIO and represented through:

- `FileAsset`
- `QuestionAttachment`

Supported workflows:

- Upload via presigned URL
- Attach to question
- Preview/download via presigned URL
- Replace existing attachment
- Delete attachment relation

No local file storage is used.

## Notifications

### In-app

- Stored in `Notification`
- Used for assignments, moderation outcomes, and revision requests

### Email

- Abstracted behind `EmailProvider`
- Default implementation logs to console
- Ready to swap for SMTP, SES, or another provider

## Audit Logging

Tracked events include:

- Login
- Logout
- User creation and updates
- Subject creation
- Assignment changes
- Question created
- Question edited
- Question submitted
- Question approved
- Question rejected
- Question revision requested

## Database Models

Current Prisma models include:

- `User`
- `Department`
- `ExamCycle`
- `Subject`
- `QuestionBank`
- `TeacherAssignment`
- `Notification`
- `AuditLog`
- `FileAsset`
- `QuestionSlot`
- `Question`
- `QuestionAttachment`

## API Surface

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Admin

- `GET/POST /api/users`
- `PATCH /api/users/[id]`
- `GET/POST /api/departments`
- `PATCH/DELETE /api/departments/[id]`
- `GET/POST /api/exam-cycles`
- `PATCH /api/exam-cycles/[id]`
- `GET/POST /api/subjects`
- `PATCH /api/subjects/[id]`
- `GET/POST /api/question-banks`
- `PATCH /api/question-banks/[id]/status`
- `GET/POST /api/assignments`
- `GET /api/audit-logs`
- `GET /api/dashboard`
- `GET /api/notifications`

### Contribution & Moderation

- `GET/POST /api/question-slots`
- `POST /api/question-slots/[id]/override`
- `GET/POST /api/questions`
- `GET/PATCH /api/questions/[id]`
- `POST /api/questions/[id]/submit`
- `POST /api/questions/[id]/moderate`
- `GET/POST /api/questions/[id]/attachments`
- `POST /api/questions/[id]/attachments/presign`
- `PATCH/DELETE /api/question-attachments/[id]`
- `GET /api/question-attachments/[id]/download`
- `POST /api/storage/presign`

## UI Pages

### Shared Role Dashboards

- `/dashboard/coe`
- `/dashboard/coordinator`
- `/dashboard/moderator`
- `/dashboard/contributor`
- `/dashboard/dean`

### Admin Workflows

- `/dashboard/coe/users`
- `/dashboard/coe/departments`
- `/dashboard/coe/exam-cycles`
- `/dashboard/coe/audit`
- `/dashboard/coordinator/subjects`
- `/dashboard/coordinator/question-banks`
- `/dashboard/coordinator/assignments`

### Question Contribution & Moderation

- `/dashboard/contributor/questions`
- `/dashboard/moderator/questions`
- `/dashboard/coordinator/questions`

## Local Development

### Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop

### Environment

Copy `.env.example` to `.env`.

Required keys:

- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_REGION`

### Start Infrastructure

```bash
docker compose up -d mysql redis minio minio-init
```

### Generate Prisma Client

```bash
npm run prisma:generate
```

### Apply Migrations

```bash
npm run prisma:migrate
```

### Seed Data

```bash
npm run prisma:seed
```

### Start App

```bash
npm run dev
```

## Seed Users

- `coe@emqpgs.local`
- `coordinator@emqpgs.local`
- `moderator@emqpgs.local`
- `contributor@emqpgs.local`
- `dean@emqpgs.local`

Default password:

- `Password@123`

## Storage Buckets

- `question-bank-attachments`
- `signed-reports`
- `generated-papers`
- `exports`
- `audit-files`

## Tests

### Run All Tests

```bash
npm run test
```

### Included Coverage

- Unit tests for slot generation
- Permission tests for contribution/moderation visibility
- Integration-style service tests for question lifecycle orchestration

## Validation and Quality

Verified commands:

- `npm run lint`
- `npm run test`
- `npm run build`

## Important Implementation Notes

- Protected dashboards are request-time rendered to avoid build-time DB coupling
- Presigned URLs are used for upload and download flows
- Current email delivery is abstracted and defaults to console logging
- The current authentication stack uses Auth.js plus explicit JWT cookie flows for the custom route handlers
- The contribution workspace pages currently load seeded role examples server-side for demonstration; authenticated API actions still execute using the logged-in user cookies

## Project Documents

- Architecture overview: `docs/architecture.md`
- RBAC matrix: `docs/rbac-matrix.md`

## Next Suggested Steps

- Add real SMTP or transactional email provider
- Add richer question editing UX with prefilled forms and inline updates
- Add pagination and filtering for large question banks
- Add E2E browser tests
- Add report generation and HOD signing workflows in the next phase
