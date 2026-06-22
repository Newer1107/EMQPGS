# Security Measures — Complete Inventory

> Every security control implemented in EMQPGS, organized by layer.
> Verified against implementation — all controls are active in production mode.

---

## 1. Authentication Layer

| Measure | Implementation | File |
|---------|---------------|------|
| Password hashing | bcrypt, cost factor 12 | `src/modules/users/service.ts` |
| JWT access tokens | HMAC-SHA256 via `jose`, 15min TTL | `src/lib/jwt.ts` |
| JWT refresh tokens | HMAC-SHA256, 7-day TTL, blacklist on logout | `src/lib/jwt.ts` |
| Token blacklisting | `RevokedToken` table by JTI | `src/lib/jwt.ts` |
| Session idle timeout | 30min default, enforced on refresh token verify | `src/lib/jwt.ts:78` |
| HttpOnly cookies | Access + refresh + workspace cookies all HttpOnly | `app/api/auth/login/route.ts` |
| CSRF protection | Double-submit cookie pattern, HMAC-SHA256 signed, SameSite=Strict | `src/lib/csrf.ts` |
| Rate limiting | In-memory Map, keyed SHA256(method:path:ip), configurable window | `src/lib/rate-limit.ts` |
| Trusted proxy IP | X-Forwarded-For first IP, fallback to X-Real-IP, then null | `src/lib/api-context.ts:21-24` |
| JTI session binding | Every JWT has unique `jti`, used for OTP/step-up binding | `src/lib/jwt.ts:22` |

---

## 2. Authorization Layer

| Measure | Implementation | File |
|---------|---------------|------|
| Centralized auth gate | `withApiHandler()` — rate limit → CSRF → JWT → responsibility → step-up → audit | `src/lib/api-handler.ts` |
| Responsibility-based model | Dynamic `ResponsibilityAssignment` records, not static roles | `src/lib/auth/authorization-service.ts` |
| Temporal scoping | `activeFrom`/`activeTo` on every assignment, soft-delete via `deletedAt` | `prisma/schema.prisma` |
| Scope isolation | INSTITUTION / DEPARTMENT / QUESTION_BANK scope levels | `prisma/schema.prisma` |
| DEAN scope fix | DEAN no longer automatically sees all departments (was a leak) | `src/modules/coordinator/department-utils.ts` |
| Workspace isolation | `emqpgs_active_ws` HttpOnly cookie, server-validated per request | `src/lib/auth/workspace-resolver.ts` |
| Mutable bank guard | `ensureQuestionBankMutable()` blocks mutations on LOCKED banks | `src/modules/question-banks/mutable-guard.ts` |
| Department access filter | COORDINATORs filtered by department scope via `DepartmentAccessUtils` | `src/modules/coordinator/department-utils.ts` |

---

## 3. Step-Up Authentication

| Measure | Implementation | File |
|---------|---------------|------|
| Email OTP | 6-digit codes via `crypto.randomInt(100000, 999999)` | `src/lib/auth/otp-service.ts` |
| OTP hashing | bcrypt (not SHA-256 — brute-force resistant) | `src/lib/auth/otp-service.ts:30` |
| Atomic single-use | `UPDATE OtpCode SET usedAt=NOW() WHERE id=X AND usedAt IS NULL` with affected-count check | `src/lib/auth/otp-service.ts:208-215` |
| Rate limiting | 5 attempts per code, auto-invalidation | `src/lib/auth/otp-service.ts:195-201` |
| Expiry | Configurable via `OTP_EXPIRY_SECONDS` (default 300 = 5 min) | `src/lib/auth/otp-service.ts` |
| Multi-factor binding | OTP bound to: user + action + resource + session (JTI) + browser fingerprint | `src/lib/auth/otp-service.ts` |
| Replay resistance | Atomic consumption prevents concurrent-use race condition | `src/lib/auth/otp-service.ts:208` |
| Browser fingerprint | SHA-256 hash of User-Agent + Accept-Language + platform headers | `src/lib/auth/browser-fingerprint.ts` |
| Step-up sessions | In-memory Map, 5min TTL, scoped to userId+action+resource+fingerprint | `src/lib/auth/step-up-service.ts` |
| Step-up storage abstraction | `StepUpStore` interface with `MemoryStepUpStore` (Redis upgrade path ready) | `src/lib/auth/step-up-store.ts` |
| Fingerprint mismatch check | Step-up verification fails if browser fingerprint differs | `src/lib/auth/step-up-service.ts:88-95` |
| Production SMTP requirement | Throws `AppError` if SMTP unconfigured in production (no silent console fallback) | `src/modules/notifications/email-service.ts:18-27` |
| Dev mode auto-approve | Pipeline executes, verification auto-approved (no duplicate code paths) | All services |

---

## 4. Audit System

| Measure | Implementation | File |
|---------|---------------|------|
| Hash chain integrity | SHA-256 linked list — each entry stores `previousHash` of the most recent | `src/lib/audit.ts` |
| Chain fork prevention | `@unique` constraint on `AuditLog.previousHash` | `prisma/schema.prisma` |
| Chain verification | `AuditService.verifyChain()` walks all entries, detects breaks/mismatches | `src/lib/auth/audit-service.ts` |
| Typed security events | `AuditService` with typed methods (otpRequested, paperDownloaded, etc.) | `src/lib/auth/audit-service.ts` |
| Automatic route audit | `withApiHandler` logs audit on every protected endpoint automatically | `src/lib/api-handler.ts:120-129` |
| 41+ audited actions | All CRUD operations, phase transitions, security events, login/logout | Throughout codebase |
| Correlation IDs | `correlationId` (UUID) on every API response + audit entry | `src/lib/api-handler.ts:33` |
| SecurityEventId | UUIDv4 spanning entire OTP→verify→download workflow | `src/lib/auth/security-event-id.ts` |
| Retry on conflict | 3 retries for Prisma transaction conflicts in audit writes | `src/lib/audit.ts:5` |
| COE audit viewer | Full searchable audit log at `/dashboard/coe/audit` | `app/(protected)/dashboard/coe/audit/` |

---

## 5. Watermarking

| Measure | Implementation | File |
|---------|---------------|------|
| Browser watermark | CSS diagonal overlay, semi-transparent text at -30° | `src/components/auth/watermark-overlay.tsx` |
| Browser content | "EMQPGS — CONFIDENTIAL · user · email · role · session · timestamp" | `src/lib/auth/watermark-service.ts` |
| Dynamic timestamp | Fresh timestamp every render — prevents screenshot reuse | `src/lib/auth/watermark-service.ts:55-61` |
| Non-interactive | `pointer-events: none`, `z-index: 9999` | `src/lib/auth/watermark-service.ts:80-112` |
| Screenshot visible | Diagonal repeating pattern visible in screenshots | `src/lib/auth/watermark-service.ts` |
| DOCX watermark | Every page: CONFIDENTIAL, downloaded by, email, timestamp, doc UUID, download UUID | `src/lib/auth/watermark-service.ts` |
| Integrated in layout | Rendered on ALL protected pages via `app/(protected)/layout.tsx` | `app/(protected)/layout.tsx` |
| Dev mode disabled | Returns empty string — no watermark in development | `src/lib/auth/watermark-service.ts:57-58` |

---

## 6. Download Tracking

| Measure | Implementation | File |
|---------|---------------|------|
| Unique Download UUID | UUIDv4 per download — forensic tracing to specific event | `src/lib/auth/watermark-service.ts:40-43` |
| PaperDownload table | Records: downloadId, paperId, variant, userId, IP, UA, session, reason, securityEventId | `prisma/schema.prisma` |
| Embedded in DOCX | Download UUID appears in DOCX watermark on every page | `src/modules/paper-generation/word-export.service.ts` |
| Audit integration | `PAPER_DOWNLOADED` event logged with downloadId in metadata | `src/lib/auth/audit-service.ts` |
| Download reason | Required before download: EXAM_PRINTING / QUALITY_REVIEW / ARCHIVE / OTHER | `src/components/auth/download-reason-dialog.tsx` |
| Security Dashboard | Shows recent downloads with user, paper, timestamp | `app/(protected)/dashboard/coe/security/page.tsx` |

---

## 7. Cache Control

| Measure | Implementation | File |
|---------|---------------|------|
| Edge-level no-store | `middleware.ts` sets `Cache-Control: no-store` on all `/api/` and `/dashboard/` routes | `middleware.ts:68-73` |
| API-level no-store | `withApiHandler` sets `Cache-Control: no-store` on EVERY response by default | `src/lib/api-handler.ts:162-172` |
| Multi-header defense | `Cache-Control` + `Pragma: no-cache` + `Expires: 0` + `Surrogate-Control: no-store` | `middleware.ts:70-72` |
| Opt-out available | Individual routes can set `cacheControl: false` in RouteOptions | `src/lib/api-handler.ts` |
| bfcache prevention | `no-store` disables back-forward cache in modern browsers | `middleware.ts` |

---

## 8. Typed Confirmation

| Measure | Implementation | File |
|---------|---------------|------|
| Type-to-confirm | Must type exact word (REVEAL/DOWNLOAD/USED) before confirm button activates | `src/components/auth/typed-confirm-modal.tsx` |
| Character-level feedback | Green border + check marks on correct partial input, red on wrong | `src/components/auth/typed-confirm-modal.tsx` |
| Enter to submit | Keyboard shortcut for fast workflow | `src/components/auth/typed-confirm-modal.tsx` |
| Dev mode bypass | Confirmation auto-filled in development mode | Via SecurityConfig |

---

## 9. Development Mode Protections

| Measure | Behavior | Implementation |
|---------|----------|---------------|
| Persistent banner | Amber/yellow banner: "⚠ DEVELOPMENT SECURITY MODE — OTP bypass enabled — Watermarks disabled — Not suitable for production" | `src/components/auth/dev-security-banner.tsx` |
| Not dismissible | z-index 10000, sticky top-0, no close button | `src/components/auth/dev-security-banner.tsx` |
| Production never shows | Banner hidden when `SECURITY_MODE=production` | `src/components/auth/dev-security-banner.tsx` |
| Pipeline still executes | All services called, only verification bypassed | All security services |
| Audit still active | All audit events recorded in dev mode (for testing) | All security services |

---

## 10. Production Mode Enforcements

| Measure | Behavior | Implementation |
|---------|----------|---------------|
| SMTP required | Throws AppError if unconfigured — no silent console fallback | `src/modules/notifications/email-service.ts` |
| OTP required | Step-up auth before sensitive actions | `src/lib/auth/step-up-service.ts` |
| Watermarks active | Browser + DOCX watermarks rendered | `src/lib/auth/watermark-service.ts` |
| Typed confirmation | Required for all destructive actions | `src/components/auth/typed-confirm-modal.tsx` |
| No-cache headers | Enforced on all confidential routes | `middleware.ts` + `src/lib/api-handler.ts` |

---

## 11. Lockdown Mode (Reserved)

| Measure | Architecture |
|---------|-------------|
| Downloads disabled | `SecurityFeatures.downloadsEnabled = false` → all download endpoints return 403 |
| Paper reveal disabled | `SecurityFeatures.paperRevealEnabled = false` → reveal endpoints blocked |
| OTP revocation | `EmergencyService.revokeOtps()` invalidates ALL pending OTPs |
| Session clearing | `StepUpService.clearAll()` removes all step-up sessions |
| Audit events | `LOCKDOWN_ACTIVATED` / `LOCKDOWN_DEACTIVATED` recorded |
| Two-person approval | `EmergencyApprovalService` — requires 2 distinct COE approvals |

---

## 12. Infrastructure Security

| Measure | Implementation |
|---------|---------------|
| CSP headers | `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'` |
| X-Frame-Options | `DENY` — prevents clickjacking |
| X-Content-Type-Options | `nosniff` — prevents MIME sniffing |
| Referrer-Policy | `same-origin` — no referrer leakage |
| Cross-Origin-Opener-Policy | `same-origin` — isolates browsing context |
| Cross-Origin-Resource-Policy | `same-origin` — prevents resource sharing |
| Input validation | Zod schemas on ALL mutation endpoints |
| Error handling | Structured error responses — no stack traces leaked |

---

## 13. Security Architecture Principles

```
1.  Centralized configuration       → SecurityConfig (3 modes, no NODE_ENV scattered)
2.  Decoupled from business services → Business code never imports security services
3.  Pipeline always executes         → No duplicate code paths for dev vs prod
4.  Single auth gate                 → withApiHandler for every protected route
5.  Defence in depth                 → middleware + API handler + service layer
6.  Least privilege                  → Scope-gated responsibility assignments
7.  Forensic traceability            → Download UUIDs, hash chain, SecurityEventIds
8.  Deterministic verification       → Same security check produces same result
9.  Privacy-preserving fingerprinting→ Hashed browser headers, not invasive tracking
10. Upgrade path ready               → StepUpStore interface, SearchStrategy interface
```
