# EMQPGS Architecture

## Layers

- `app/` — Next.js App Router pages and route handlers
- `src/modules/*` — feature services, repositories, validators, and workflow engines
- `src/lib/*` — auth, RBAC, CSRF, rate limiting, queues, storage, logging, and shared infrastructure
- `prisma/` — schema, migrations, and seed data
- `workers/` — BullMQ worker bootstrap

## Core Modules

- `users`, `departments`, `exam-cycles`, `subjects`
- `question-banks`, `assignments`, `questions`, `notifications`
- `reports`, `ai`, `production`

## Cross-Cutting Concerns

- JWT auth with access + refresh cookies
- Auth.js credentials login
- RBAC via `proxy.ts` and `src/lib/api-handler.ts`
- CSRF validation for all mutating API calls
- Redis-backed rate limiting
- Structured JSON logging
- Append-only audit log chain with integrity hash
- MinIO-only object storage with presigned URLs

## Production Flow

1. Contributors submit moderated questions
2. Moderator finalizes question bank
3. AI report is generated through Ollama + deterministic analytics
4. HOD signs the report and moderator uploads it
5. Coordinator approves and locks the bank
6. Paper generator creates `PAPER_A`, `PAPER_B`, `PAPER_C`
7. Dean reviews scores and maps papers to:
   - Regular Exam
   - Supplementary
   - KT
8. COE exports final PDF, DOCX, or ZIP bundles
9. Cleanup and backup workers manage retention and nightly backups
