# EMQPGS Architecture

## Layers

- `app/` - Next.js App Router pages and route handlers
- `src/modules/*` - feature services, repositories, validators, and workflow engines
- `src/lib/*` - auth, RBAC, CSRF, rate limiting, storage, logging, and shared infrastructure
- `prisma/` - schema, migrations, and seed data

## Core Modules

- `users`, `departments`, `exam-cycles`, `subjects`
- `question-banks`, `assignments`, `questions`, `notifications`
- `reports`, `ai`, `production`

## Cross-Cutting Concerns

- JWT auth with access + refresh cookies
- Auth.js credentials login
- RBAC via `proxy.ts` and `src/lib/api-handler.ts`
- CSRF validation for all mutating API calls
- In-process rate limiting
- Structured JSON logging
- Append-only audit log chain with integrity hash
- MinIO-only object storage with presigned URLs

## Question Bank State Machine

The question bank lifecycle is enforced via a code-level transition table (`src/modules/question-banks/transitions.ts`):

- 10 states: `DRAFT`, `IN_PROGRESS`, `UNDER_MODERATION`, `MODERATED`, `REPORT_GENERATED`, `AWAITING_HOD_SIGN`, `SIGNED_REPORT_UPLOADED`, `AWAITING_COORDINATOR_APPROVAL`, `APPROVED`, `LOCKED`
- Forward-only DAG: each status can only transition to specific next states
- Any status can fast-lock to `LOCKED` (emergency lock path)
- No exits from `LOCKED` (immutable once locked)
- Canonical lock: `PATCH /api/question-banks/[id]/lock` — the only way to reach `LOCKED`
- Coordinator decision APPROVED sets status to `APPROVED` (not `LOCKED`), requiring explicit lock step

## Production Flow

1. Contributors submit moderated questions
2. Moderator finalizes question bank
3. AI report is generated through Ollama + deterministic analytics
4. HOD signs the report and moderator uploads it
5. Coordinator approves the report (status → `APPROVED`)
6. Coordinator explicitly locks the bank (`PATCH /api/question-banks/[id]/lock`)
7. Paper generator creates `PAPER_A`, `PAPER_B`, `PAPER_C`
8. Dean reviews scores and maps papers to:
   - Regular Exam
   - Supplementary
   - KT
9. COE exports final PDF, DOCX, or ZIP bundles
10. COE backups and retention cleanup run directly through the application

## Cross-Cutting Concerns

- JWT auth with access + refresh cookies
- Auth.js credentials login
- RBAC via `proxy.ts` and `src/lib/api-handler.ts`
- CSRF validation for all mutating API calls (HMAC-SHA256, timing-safe, origin check vs `AUTH_URL`)
- In-process rate limiting
- Structured JSON logging
- Append-only audit log chain with integrity hash (request bodies NOT auto-captured)
- MinIO-only object storage with presigned URLs
- State transition enforcement at service layer (all status updates validated)
- Charset regex validation on free-text fields (stored XSS prevention)
- Non-empty ID validation via Zod `.min(1)`
