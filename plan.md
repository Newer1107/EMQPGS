# EMQPGS — Project Status & Improvement Plan

Last updated: 2026-06-14

---

# Current System Status

| Metric | Score | Notes |
|---|---|---|
| **Production Readiness** | 5/10 | Core blockers resolved. Remaining: passwordHash leak in mod/coord APIs (V2), lock bypass (V1), audit chain atomicity, rate limiter scaling. |
| **Security** | 5/10 | N1, H4, N13, N15, N14 fixed. V2 (6 routes leak passwordHash via `include: contributor: true`) and V1 (lock bypass) are open. |
| **Reliability** | 5/10 | C1, C2, C5, H1 fixed. Optimistic concurrency (H6) partially implemented — `version` fields and utilities exist but not universally adopted. |
| **Workflow Integrity** | 6.5/10 | C3 state machine + C4 coordinator decision path fixed. V1 (lock bypass) still open. |
| **Systems Health** | 5.4/10 | Weighted aggregate. |

---

# Completed Work

All verified complete. Phase 1 (P0) and selected P1 items from the remediation effort.

### Production Blockers (Phase 1 — P0)

| ID | Issue | Fix | Verified |
|---|---|---|---|
| C1 | `POST /api/users` always 500 — raw `password` spread to Prisma | Strip `password` before `create()`, hash separately | ✅ Tests pass |
| C2 | ZodError returned 500 instead of 400 | Added `ZodError` branch in `api-handler.ts` → 400 | ✅ Tests pass |
| C5 | `mysqldump` missing in Docker image | Added `apk add --no-cache mysql-client` to runner stage | ✅ Line present |
| H1 | CSRF `timingSafeEqual` crashed on length mismatch | Added length guard before comparison | ✅ Tests pass |
| N1 | Audit logs exposed `passwordHash` via `include: { actor: true }` | Changed to `select: { id, name, email, role }` | ✅ Tests pass |

### Security Improvements (Phase 1 — P1)

| ID | Issue | Fix | Verified |
|---|---|---|---|
| N3 | Slot override IDOR — no bank-assignment check | Added `ModeratorBankAssignment` lookup | ✅ Tests pass |
| N4 | Dean notifications targeted wrong COE | Uses `questionBank.subject.departmentId` | ✅ Tests pass |
| H2 | Audit auto-captured every request body | Replaced with explicit `getMetadata` callback per route | ✅ Tests pass |
| H4 | Stored XSS in name/hodName fields | Added `.regex(/^[^<>&"]+$/)` charset validation | ✅ Tests pass |
| N13 | CSP had `unsafe-eval` + broad `connect-src` | Removed `unsafe-eval`, tightened to `connect-src 'self'` | ✅ Tests pass |
| N15 | CSRF origin checked against `host` header | Now validates against `AUTH_URL` | ✅ Tests pass |
| N14 | ID fields had no `.min(1)` | Added `.min(1)` to all ID-like Zod fields | ✅ Tests pass |

### Workflow Integrity (Phase 1 — P1)

| ID | Issue | Fix | Verified |
|---|---|---|---|
| C3 | No state machine for QuestionBankStatus | Created `transitions.ts` with 10-state transition table; `isValidTransition()` enforced in `updateStatus()` | ✅ 34 tests |
| M7 | Moderator assignment was dead code | `assignModerator()` method + `POST /api/question-banks/[id]/assignments/moderator` route | ✅ 6 tests |
| N10 | Moderator assignment seed-only | Same as M7 — API now exists | ✅ |

### Infrastructure & Error Handling (Phase 1-2)

| Fix | Files |
|---|---|
| JWT signature verification in `proxy.ts` (jose `jwtVerify` instead of `atob`) | `proxy.ts` |
| Assignment scope fix — `deleteMany` scoped by `AssignmentRole.CONTRIBUTOR` | `src/modules/assignments/repository.ts` |
| SMTP OAuth2 email provider (nodemailer + Gmail OAuth2) | `src/modules/notifications/smtp-provider.ts` (new) |
| PDF page overflow fix (page breaks between questions) | `src/modules/production/document-service.ts` |
| Error boundaries (`app/error.tsx`, `app/(protected)/error.tsx`) | app layer |
| Loading skeletons (`app/loading.tsx`, `app/(protected)/loading.tsx`) | app layer |
| Network error handling across 12 components (try-catch + `response.ok` checks) | `src/components/**` |
| Optimistic concurrency utilities (`version` fields on QuestionBank, Question, ExamCycle, QuestionSlot) | `src/lib/optimistic-lock.ts`, `src/lib/db-helpers.ts` |
| DB indexes across 8 models | `prisma/schema.prisma` |
| Cursor pagination utility | `src/lib/pagination.ts` |
| Performance optimization — `select` instead of `include`, `groupBy` for dashboard summaries | `coordinator/service.ts`, `moderation/service.ts` |

---

# Remaining Work

### Known Open Issues (Critical/High)

| ID | Severity | Issue | Location |
|---|---|---|---|
| V1 | CRITICAL | `lockQuestionBank()` bypasses state machine via raw `prisma.questionBank.update()` — can lock from ANY state | `src/modules/coordinator/service.ts:422-428` |
| V2 | HIGH | `include: { contributor: true }` leaks `passwordHash` across 6 moderator/coordinator API routes | `src/modules/moderation/service.ts`, `src/modules/coordinator/service.ts` |
| V3 | MEDIUM | `include: { reviewedBy: true }` in dean review leaks full User object | `src/modules/production/service.ts:237` |
| H3 | HIGH | Audit chain forks under concurrency — `findFirst` then `create` is not atomic | `src/lib/audit.ts:15-46` |
| H5 | HIGH | In-memory rate limiter not multi-instance safe | `src/lib/rate-limit.ts` |
| H6 | MEDIUM | Optimistic concurrency not universally adopted — utilities exist but services don't consistently use them | Multiple services |

### Technical Debt (Medium)

| ID | Issue |
|---|---|
| M1 | Active exam cycle race — check-then-create without transaction |
| M2 | More indexes needed on unindexed `orderBy` columns (auditLogs, notifications) |
| M3 | Long-running sync operations (AI report, paper gen, export, backup) run inside HTTP requests |
| M4 | `Question.moduleNumber/marks/slotNumber` redundant with `QuestionSlot` — drift risk |
| M5 | No reconciler for stuck `PROCESSING` rows after server restart |
| M6 | `listSubjects` still has heavy nested includes — performance degrades at scale |
| N2 | Per-request DB lookup in `getCurrentUserFromCookies` — JWT already carries user data |
| N5 | Repository validation bypass risk — validations live in services, not repos |
| N6 | Inconsistent uniqueness patterns (upsert vs check-then-create) |
| N7 | CSRF cookie lacks `iat` — rotation leaves stale tokens valid for 24h |
| N8 | No cursor pagination — still `take: 100` on most list endpoints |
| N9 | Page auth relies solely on `proxy.ts` — no server-side re-check in layout |

### Low Priority

| ID | Issue |
|---|---|
| N11 | `Object.keys(input)` TS smell in audit metadata |
| N12 | CSRF token returned without validity check on read |

---

# Future Improvements

1. **Background job queue** — Move AI report, paper gen, export, backup to async workers (enables M3, M5 fixes).
2. **Redis-backed rate limiter** — Multi-instance safe with per-user keys.
3. **Audit chain atomicity** — Replace read-then-write with serializable transaction or append-only DB grants.
4. **Schema deduplication** — Drop `Question.moduleNumber/marks/slotNumber` (derive from `slotId` FK).
5. **Cursor pagination** — On every list endpoint.
6. **JWT-only user lookup** — Eliminate per-request DB fetch for user context.

---

# Known Risks

1. **PasswordHash leak (V2)** — Moderators and coordinators can see bcrypt hashes of contributors via the question API. Moderators are trusted but this is a data leak.
2. **Lock bypass (V1)** — Coordinator can lock a bank from any state, skipping moderation/AI/HOD sign-off.
3. **No scheduled backups** — Backups are manual/API-triggered only. No cron.
4. **Single-instance rate limiter** — If deployed across multiple replicas, rate limiting is per-instance, not global.
5. **In-request long operations** — AI report generation, paper generation, and exports run inside the HTTP request handler. Request timeouts can leave rows stuck in `PROCESSING` status with no recovery.

---

# Verification Audit Results

*Preserved from the independent verification audit conducted 2026-06-14.*

### Executive Summary

| Metric | Count |
|---|---|
| Total verified fixed | 14 |
| Total partially fixed | 1 (C4 — lockQuestionBank bypasses state machine) |
| Total not fixed | 3 (V1, V2, V3 — new discoveries) |
| Total regressions introduced | 0 |

### Test Evidence

- 107 unit tests across 13 files, all pass
- Tests cover: C1, C2, C3, C4, H1, N1, N3, N4, H2, H4, N13, N14, N15, M7/N10
- Additional tests for optimistic concurrency (H6), DB helpers, pagination utility
- No tests for V1 (lock bypass) or V2 (passwordHash leak in mod/coord APIs)

### Key Verification Notes

- **C4 is partially fixed**: `coordinatorDecision` APPROVED correctly sets status to `APPROVED` (not `LOCKED`). But `lockQuestionBank()` in `coordinator/service.ts` bypasses the state machine by calling raw `prisma.questionBank.update()` — it doesn't route through `QuestionBankService.updateStatus()` or `isValidTransition()`.
- **N1 is limited**: Audit endpoint fixed. But 6 moderator/coordinator routes still use `include: { contributor: true }` without a safe `select`, leaking `passwordHash` in API responses.
- Refer to the verification audit section and the original plan for detailed evidence per fix.
