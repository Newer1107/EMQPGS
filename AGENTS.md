<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EMQPGS — agent notes

Examination Management & Question Paper Generation System. Next.js 16 App Router + Prisma + MySQL + Auth.js (credentials) + custom JWT cookies + MinIO + optional Ollama. Five roles: COE, COORDINATOR, MODERATOR, CONTRIBUTOR, DEAN.

## Start here

- `README.md` — full feature/API/env reference (current).
- `docs/architecture/system-overview.md` — domain model, service boundaries, data flow, auth model, audit model.
- `docs/domains/` — per-domain deep dives (academic, question, exam, production).
- `docs/api/reference.md` — current API route table with roles, schemas, and services.
- `docs/rbac-matrix.md` — role capability matrix.
- `docs/developer/onboarding.md` — 30-minute orientation.

## Commands

All commands run from repo root.

| Task | Command |
|---|---|
| Dev server | `npm run dev` (auto: `prisma:generate` → `prisma:verify-client` → `next dev`) |
| Production build | `npm run build` |
| Production start | `npm run start` (auto: prisma generate/verify + `next start`) |
| Lint | `npm run lint` (ESLint, `eslint .`) |
| All tests | `npm run test` (Vitest) |
| Watch tests | `npm run test:watch` |
| One test file | `npx vitest run tests/unit/slot-template.test.ts` |
| Pattern match | `npx vitest run -t "slot generation"` |
| Generate Prisma client | `npm run prisma:generate` |
| Dev migration | `npm run prisma:migrate` |
| Prod migration | `npm run prisma:deploy` |
| Seed | `npm run prisma:seed` |

No `typecheck` script. `tsconfig.json` has `noEmit: true`; rely on `next build` and the editor. There is no separate `format` script.

Required command order on a fresh checkout: `docker compose up -d mysql minio minio-init` → `npm ci` (runs `postinstall` = prisma generate + verify) → `npm run prisma:migrate` → `npm run prisma:seed` → `npm run dev`.

## Next.js 16 quirks (this is NOT the Next.js you know)

- Middleware lives in `proxy.ts` (not `middleware.ts`) and exports a function literally named `proxy`. Don't rename it to `middleware`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- App Router is under `app/`. Pages: `app/(protected)/dashboard/<role>/...`, public: `app/login`, `app/forgot-password`, `app/reset-password`. Root page redirects `/` → `/login`.
- API routes: `app/api/**/route.ts` — 63 files, ~95 endpoints. Always wrap handlers with `withApiHandler` from `@/lib/api-handler`. Do not call services directly from `route.ts` without the wrapper (it owns RBAC, CSRF, rate limit, audit logging, error formatting).
- Security headers (CSP, X-Frame-Options, etc.) are set globally in `next.config.ts`. Don't duplicate them in route handlers.
  - CSP `script-src` adds `'unsafe-eval'` in development (`NODE_ENV=development`) for webpack HMR / React dev tools. This is stripped in production — do not weaken the production path.

## Prisma client gotchas

- `postinstall`, `dev`, `build`, and `start` all run `npm run prisma:verify-client` (`scripts/verify-prisma-client.cjs`). The script will fail the process if any of these are true:
  - Client not generated.
  - `node_modules/.prisma/client/schema.prisma` differs from `prisma/schema.prisma` (run `prisma generate`).
  - Generated client was built with `copyEngine: false` (i.e. Accelerate / no-engine mode). Never pass `--no-engine` or set `PRISMA_CLIENT_ENGINE_TYPE=accelerate`-style env vars — this app needs the local query engine.
  - No local engine binary present (e.g. `query_engine-windows.dll.node` on Windows or `libquery_engine-*`).
- The Prisma client singleton is `prisma` from `@/lib/db`. Do not instantiate `new PrismaClient()` ad hoc — except in `prisma/seed.ts`, which is the only sanctioned script that uses its own client.
- `app/api/auth/login/route.ts` calls `prisma.user.update` directly. That's an exception to the "go through services" rule, not a precedent.

## Architecture rules (enforced by pattern, not by tooling)

- Feature modules: `src/modules/<feature>/` with `service.ts`, `repository.ts`, `validation.ts`. New features follow the same shape.
- Repositories extend `BaseRepository` (`src/modules/shared/base-repository.ts`) and own raw Prisma calls + transactions. Services own business logic and call repositories.
- Every API boundary is validated with Zod (see `src/modules/*/validation.ts`). Route handlers call `<schema>.parse(await parseJson(request))` inside `withApiHandler`.
- All request metadata (IP, user agent) flows through `getRequestMeta()` in `src/lib/api-context.ts`. `withApiHandler` feeds it into `logAudit` automatically when you pass the `audit:` option.
- RBAC is two-layer: `proxy.ts` does route-level role gating for `/dashboard/<role>` and `/api/**`; `withApiHandler({ roles: [...] })` does operation-level gating. Object-level checks (e.g. "moderator can only see their assigned banks") live in services.

## Domain invariants (do not break)

- **126-slot template.** The paper generator uses a 126-entry template (6 modules × 3 marks × 7 slots) as a computational pattern. `buildQuestionSlotTemplate()` in `src/modules/questions/slot-template.ts` generates it. The template is NOT a persisted grid of pre-allocated slots — questions are linked to banks via the `QuestionBankQuestion` join table. `tests/unit/slot-template.test.ts` locks the shape in.
- Question bank status transitions are enforced by a transition table in `src/modules/question-banks/transitions.ts`. `QuestionBankService.updateStatus()` validates via `isValidTransition()`. The coordinator's `lockQuestionBank()` in `src/modules/coordinator/service.ts` is the **canonical lock path** — it requires `examCycle.status === ACTIVE` and `examCycle.endDate`. Coordinator APPROVED decisions set status to `APPROVED`, not `LOCKED`.
- **Moderator assignment** is now a first-class API: `POST /api/question-banks/[id]/assignments/moderator` (COORDINATOR-only). Validates MODERATOR role and prevents duplicates. Sends `ACTION_REQUIRED` notification.
- **Module/marks invariants.** Question `marks` is one of `2 | 5 | 10`. Question `module` is `1..6`. `rbtLevel` is `L1..L6`. `courseOutcome` is `CO1..CO6`. All are Prisma enums — TypeScript will catch a bad value at compile time.
- **MinIO buckets.** Exactly six: `question-bank-attachments`, `signed-reports`, `generated-papers`, `exports`, `audit-files`, `system-backups`. Created by the `minio-init` service in `docker-compose.yml` (idempotent — uses `mc mb -p ... || true`). Don't add new buckets without updating that init step.
- **No background workers / no BullMQ / no Redis.** The `workers/` directory exists but is empty (reserved). AI reports, paper generation, exports, backups, and cleanup all run synchronously inside the request that triggers them or via service calls. Don't introduce a queue.

## Auth, cookies, CSRF

- Auth.js v5 (`next-auth@5.0.0-beta.31`) provides the credentials provider only. Token issuance + cookie management are custom (`src/lib/jwt.ts`, `src/lib/csrf.ts`).
- Cookie names (defined in `src/lib/constants.ts`): `emqpgs_access_token`, `emqpgs_refresh_token`, `emqpgs_csrf_token`. The `proxy.ts` middleware reads `ACCESS_COOKIE`. Don't switch to Auth.js's default session cookie.
- CSRF: every non-GET request must send the `x-csrf-token` header matching the `emqpgs_csrf_token` cookie. Server verifies HMAC-SHA256 against `CSRF_SECRET` and checks origin/referer against `AUTH_URL`. Origin check will fail in dev if you set `AUTH_URL` to anything other than what the browser actually visits.
- `withApiHandler` calls `assertCsrfProtection` before your handler runs. You don't need to call it again.
- `src/lib/client-fetch.ts` is the browser wrapper that auto-injects the CSRF header. Use it on the client; don't hand-roll `fetch` against `/api/**` from a component.
- Rate limit is in-memory, per `[method, path, ip]` tuple, default 120 req / 60s. Resets on server restart. Not multi-instance safe — if you scale out, replace `src/lib/rate-limit.ts` with a Redis-backed implementation.

## Environment

- `src/lib/env.ts` Zod-parses every env var at module load. App refuses to start if any required var is missing or malformed. Required (min 32 chars): `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`. Plus `DATABASE_URL`, `AUTH_URL`.
- `CSRF_SECRET` falls back to `AUTH_SECRET` if unset (see `src/lib/env.ts`). Useful for dev; do not rely on it in production.
- There is no `.env.example` in the repo (the README references one but it doesn't exist). The committed `.env` is the only env file. Treat it as already-valid local config.
- Backups call `mysqldump` via shell — it must be in `$PATH`. The production `Dockerfile` is `node:24-alpine` and now includes `mysql-client` via `apk add --no-cache mysql-client`.
- Ollama is optional. Deterministic analysis (`src/modules/reports/analysis-engine.ts`) runs without it; Ollama only adds a natural-language summary overlay.

## Seed users

`npm run prisma:seed` creates these (all password `Password@123`):
- `coe@emqpgs.local` (COE)
- `coordinator@emqpgs.local` (COORDINATOR)
- `moderator@emqpgs.local` (MODERATOR)
- `contributor@emqpgs.local` (CONTRIBUTOR)
- `dean@emqpgs.local` (DEAN)

Plus 2 departments (CSE, ECE), 1 active exam cycle, 1 subject, 1 question bank with all 126 slots, and a coordinator↔CSE assignment.

## Testing

- Vitest with Node environment, `tests/setup.ts` provides default env vars. `DATABASE_URL` defaults to `mysql://emqpgs:emqpgs@localhost:3306/emqpgs` — integration tests hit a real MySQL. If you don't have one running, the unit tests in `tests/unit/` still pass; integration/permission tests will fail.
- Tests live under `tests/{unit,integration,permission}/`. Mock Prisma, MinIO, and Ollama per file when needed.
- Path alias: `@/` → `src/`. Both `tsconfig.json` and `vitest.config.ts` set it up.

## README drift — trust the schema

The README is now authoritative. When in doubt, read `prisma/schema.prisma`. Alignments verified:

| Topic | README says | Schema says |
|---|---|---|
| `ExamType` values | `ISE_1`, `ISE_2`, `ENDSEM`, `SUPPLEMENTARY`, `KT` | Same — aligned |
| `QuestionBankStatus` values | Full 10-state flow documented | `DRAFT`, `IN_PROGRESS`, `UNDER_MODERATION`, `MODERATED`, `REPORT_GENERATED`, `AWAITING_HOD_SIGN`, `SIGNED_REPORT_UPLOADED`, `AWAITING_COORDINATOR_APPROVAL`, `APPROVED`, `LOCKED` |
| `QuestionStatus` values | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `REVISION_SUBMITTED` | Same — aligned |
| RBAC table | 5 roles, full capability matrix | accurate, see `docs/rbac-matrix.md` for the canonical version |
| API endpoint count | "~95 operations across 63 route files" | verified |
| `.env.example` | does not exist in repo | does not exist — use `.env` directly |

## Style and conventions

- No comments in code unless asked (matches your standing rule).
- Module names: lowercase, kebab-case for multi-word (`question-banks`, `exam-cycles`).
- Prisma enum values are SCREAMING_SNAKE.
- Service classes take their dependencies via constructor with defaults (see `QuestionService`). Don't new up services in route handlers — declare a module-scope instance like the existing routes do.
- Use `Role` from `@prisma/client`, not string literals, for role checks.

## Things that will silently break if you don't know

- Forgetting to run `npm run prisma:generate` after editing `schema.prisma` → `verify-prisma-client` fails the build with a clear message; read it.
- Adding a `middleware.ts` file → ignored, and you'll wonder why your auth checks don't run. Use `proxy.ts`.
- Calling a service directly from `route.ts` without `withApiHandler` → no CSRF, no rate limit, no audit, no consistent error shape. Every existing route uses the wrapper; new routes must too.
- Editing the slot template or its length invariant → breaks `slot-template.test.ts` and downstream paper generation.
- Assuming `pnpm` or `yarn` work — `package.json` and `Dockerfile` are npm-only.
