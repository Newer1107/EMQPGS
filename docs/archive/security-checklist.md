# Security Checklist

## Authentication & Sessions

- JWT access and refresh cookies are `httpOnly`, `Secure`, `SameSite=Lax`
- Refresh tokens enforce session idle timeout (default 30 min from last activity)
- Access tokens are short-lived (default 15 minutes)
- Password hashing uses bcrypt with 12 salt rounds
- User creation strips `passwordHash` from response payloads to prevent accidental exposure
- Forgot-password tokens have 30-minute expiry; hashed with SHA-256 before storage

## CSRF Protection

- HMAC-SHA256 signed token in `emqpgs_csrf_token` cookie + `x-csrf-token` header
- All non-GET API requests require CSRF verification
- `timingSafeEqual` comparison includes length guard (`Buffer.alloc`) to prevent timing attacks on mismatched-length inputs
- Origin/referer header verified against the configured `AUTH_URL` (not the `host` header, preventing host-injection attacks)
- CSRF secret falls back to `AUTH_SECRET` if `CSRF_SECRET` is unset (dev only)

## Rate Limiting

- In-memory rate limiter with SHA-256 hashed client keys (per `[method, path, ip]` tuple)
- Default: 120 requests per 60-second window (configurable via env vars)
- Applied to all API routes through `withApiHandler()`
- Non-distributed — replace with Redis-backed implementation for multi-instance deployments

## Input Validation

- Zod schemas validate all request bodies, query parameters, and path parameters
- Invalid inputs return HTTP 400 (not 500), preventing stack trace exposure
- All ID fields validated with `.min(1)` (non-empty string guard)
- Free-text fields validated with charset regex patterns to prevent stored XSS
- HTML tag characters (`<`, `>`) in free-text fields trigger validation rejection

## Access Control

- Two-layer RBAC: `proxy.ts` (route-level) + `withApiHandler()` (operation-level)
- Object-level authorization for question views, attachment downloads, and moderator slot overrides
- Export downloads are COE-only
- Moderator slot override checks `ModeratorBankAssignment` — only moderators explicitly assigned to a bank can override slots
- Dean notifications are scoped to the dean's own department via `departmentId`

## Question Bank Integrity

- Phase transitions enforced via a code-level transition table (`src/modules/question-banks/transitions.ts`)
- 4 phases (DRAFTING → MODERATION → APPROVAL → COMPLETE) with rejection loopback from APPROVAL to MODERATION
- RecordStatus (ACTIVE/LOCKED/ARCHIVED) is orthogonal to phase
- Locked question banks are immutable: no edits, no new questions, no moderation, no overrides
- Canonical lock path: `PATCH /api/question-banks/[id]/lock`; unlock API exists for recovery
- Coordinator decision APPROVED sets phase to `COMPLETE` (not `LOCKED`), requiring an explicit lock step

## Audit Trail

- Append-only audit log with SHA-256 hash chain (`previousHash` + `integrityHash`)
- Request body is NOT automatically captured in audit metadata (prevents accidental logging of sensitive data)
- IP address and user agent recorded for every mutating operation
- Audit logs viewable only by COE users

## Security Headers

- Content-Security-Policy: tightened to include explicit `script-src 'self'` (no `unsafe-eval` in production), restricted `connect-src`, and `frame-ancestors 'none'`
  - **Development exception**: `'unsafe-eval'` is added to `script-src` when `NODE_ENV=development` for Next.js webpack HMR and React dev tools. This is stripped in production builds.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone, geolocation all set to `()`

## Infrastructure

- Generic storage presign access is restricted for export and backup buckets
- Presigned object URLs use short expiry windows (default: 900 seconds)
- Database backup uses `MYSQL_PWD` environment variable (not CLI `--password`) to prevent password exposure in process listings
- Health endpoint supports optional shared-secret header
- Docker production image includes `mysql-client` for `mysqldump` execution
- Environment variable validation at startup via Zod — app refuses to start with missing/invalid configuration
