# Security Subsystem Implementation Report

## Overview

Complete security architecture for EMQPGS — examination paper protection in a real university workflow. Built as a permanent subsystem alongside Workspace, Authorization, and Paper Generation.

**Status**: 🟢 Implemented and verified — 25+ new files, 20+ modified, **50/50 tests passing**, TypeScript clean

**E2E Verification**: 38 checkpoints across 11 flows — 38/38 passing after gap fixes

---

## Architecture

```
Request → middleware.ts (JWT verify + Cache-Control: no-store)
              ↓
         withApiHandler (rate-limit → CSRF → responsibility → step-up → audit → cache)
              ↓
         SecurityConfig (single source of truth — 3 modes)
         ┌───────┼───────────┐
         ↓       ↓           ↓
    OtpService  StepUp    AuditService
    WatermarkService    EmergencyService
         ↓
    Business Services (security-agnostic)
```

### Security Mode Dispatch

```
SecurityConfig.getInstance()
    │
    ├── .mode → SecurityMode
    │   ├── DEVELOPMENT  → isAutoApproved=true, features.otpRequired=false
    │   ├── PRODUCTION   → isAutoApproved=false, features fully enforced
    │   └── LOCKDOWN     → downloadsEnabled=false, paperRevealEnabled=false
    │
    └── .getFeatures() → SecurityFeatures
        ├── otpRequired, stepUpRequired
        ├── browserWatermark, docxWatermark
        ├── typedConfirmation, noCacheHeaders
        ├── downloadsEnabled, paperRevealEnabled
        └── auditLogging
```

Every component queries SecurityConfig. Business services never inspect `process.env` or `NODE_ENV`.

---

## New Files Created

### `src/lib/auth/security-config.ts`
**Purpose**: Centralized runtime configuration — 3 modes, feature flags, env bootstrap + DB toggle.
**Design decisions**:
- Singleton pattern, resetInstance() for testing
- Two-layer config: env var → DB table overrides
- All config changes audited via AuditLog
- Development mode: pipeline still executes, only verification bypassed

### `src/lib/auth/otp-service.ts`
**Purpose**: Email-based one-time passwords for step-up authentication.
- 6-digit codes via `crypto.randomInt(100_000, 1_000_000)`
- bcrypt hashing (not SHA-256 — user requirement for brute-force resistance)
- Atomic single-use: `UPDATE ... WHERE usedAt IS NULL` with affected-count check
- Rate limiting: 5 attempts per code, then auto-invalidation
- Binding: user + purpose + resource + session (not generic "user verified")
- Dev mode: code "000000" auto-approves without email
- Production: throws if SMTP unconfigured (no silent ConsoleEmailProvider fallback)
- Email failure: falls back to password re-entry prompt

### `src/lib/auth/step-up-service.ts`
**Purpose**: In-memory step-up session manager for sensitive actions.
- Store: `Map<`${userId}:${action}:${resourceId}`, { verifiedAt, ttlMs }>`
- TTL: env `STEP_UP_TTL_SECONDS` (default 300 = 5 min)
- Resource-scoped: OTP for download Paper-A does NOT authorize download Paper-B
- Auto-cleanup: prunes stale entries every 100 writes
- Stats: `getActiveSessions(userId)` for Security Dashboard
- Dev mode: always returns verified
- Ponytail: in-memory sufficient for single-process. Upgrade path: Redis.

### `src/lib/auth/audit-service.ts`
**Purpose**: Typed event wrapper over hash-chained audit logging.
**Audited events**:
| Action | When |
|--------|------|
| `OTP_REQUESTED` | User requests OTP |
| `OTP_VERIFIED` | OTP verified successfully |
| `OTP_FAILED` | Invalid OTP, expired, rate-limited, replayed |
| `PAPER_REVEALED` | Paper content revealed |
| `PAPER_DOWNLOADED` | Paper downloaded (includes Download UUID) |
| `PAPER_REGENERATED` | Paper regenerated |
| `PAPER_APPROVED` | Dean approves paper selection |
| `PAPER_MARKED_USED` | COE marks paper as used |
| `SECURITY_CONFIG_CHANGED` | Runtime config toggled |
| `LOCKDOWN_ACTIVATED` / `DEACTIVATED` | Emergency state change |
| `EMERGENCY_OVERRIDE` | Emergency override used |

### `src/lib/auth/watermark-service.ts`
**Purpose**: Browser and DOCX watermark generation with forensic download tracking.
- `generateDownloadId()` — UUIDv4 per download
- `getBrowserWatermarkHTML(ctx)` — diagonal repeating CSS text
- `getDocxWatermarkText(ctx)` — per-page DOCX watermark content
- Dev mode: returns empty strings (watermark disabled)

### `src/lib/auth/emergency-service.ts`
**Purpose**: Lockdown and emergency controls.
- `activateLockdown(actorId)` — revokes all OTPs, clears sessions, sets mode
- `deactivateLockdown(actorId)` — returns to production
- `disableDownloads(actorId)` — toggles download permission
- `revokeOtps(actorId, userId?)` — revokes pending OTPs

### `middleware.ts`
**Purpose**: Edge-level security for all routes.
- JWT verification (redirects unauthenticated to /login)
- Cache-Control: no-store on all `/api/` and `/dashboard/` routes
- Security headers: Pragma, Expires, Surrogate-Control
- Public route whitelist: login, forgot-password, health, static assets
- Complements withApiHandler — NOT duplicate

### `app/api/auth/otp/request/route.ts`
POST handler. Accepts `{ purpose, resourceId? }`. Validates purpose-specific responsibility (DEAN for dean actions, COE for coe actions). Returns `{ expiresAt }` — NEVER the code.

### `app/api/auth/otp/verify/route.ts`
POST handler. Accepts `{ purpose, code, resourceId? }`. Calls OtpService.verify(). On success, calls StepUpService.setVerified(). Returns `{ verified: true }`.

### `app/api/auth/step-up/check/route.ts`
GET handler. Reads `action`, `resourceId?` query params. Returns `{ verified: boolean }`.

### `app/api/audit-logs/verify/route.ts`
GET handler (COE-only). Walks audit hash chain. Returns `{ intact: boolean, breaks: ChainBreak[] }`.

### `app/api/security/config/route.ts`
GET (COE-only): returns `{ mode, features, label }`.
PATCH (COE-only): accepts `{ key, value }`, updates runtime config.

### `src/components/auth/typed-confirm-modal.tsx`
Dialog that requires typing a specific word (REVEAL/DOWNLOAD/USED/ARCHIVE) to confirm. Optional OTP step-up step. Character-by-character matching feedback. Enter to submit, Escape to cancel. Auto-closes on success.

### `src/components/auth/otp-dialog.tsx`
6-digit OTP input with auto-advance, paste support, backspace-to-previous. States: requesting, input, verifying, error, rate_limited, expired, success. Auto-submits on 6 digits. Dev mode: pre-filled "000000".

### `src/components/auth/watermark-overlay.tsx`
Server component. CSS-only diagonal repeating watermark at 6% opacity. pointer-events:none. z-index:9999. Hidden in dev mode. Contains: user name, email, role, session, document ID, timestamp, "CONFIDENTIAL".

### `app/(protected)/dashboard/coe/security/page.tsx`
COE Security Dashboard. Server component with client sub-components. Sections:
- Security mode badge + toggle
- Stats: failed OTPs (24h), downloads (24h), chain status
- Recent security events table
- Actions: verify audit chain, toggle mode, lockdown controls
- All destructive actions use TypedConfirmModal

---

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `OtpCode`, `SecurityConfig`, `PaperDownload` models. `AuditLog` UNIQUE constraint on `previousHash`, `sessionId` field. |
| `src/lib/env.ts` | Added `SECURITY_MODE`, `OTP_EXPIRY_SECONDS`, `STEP_UP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS` env vars |
| `src/lib/constants.ts` | Added `ENTITY_TYPES` (OTP_CODE, SECURITY_CONFIG, PAPER_DOWNLOAD, SECURITY_EVENT), `SECURITY_ACTIONS`, `OTP_PURPOSES`, `CONFIRM_WORDS` |
| `src/lib/types.ts` | Added `StepUpDescriptor` type |
| `src/lib/api-handler.ts` | Integrated step-up guard, Cache-Control defaults, idle timeout, lockdown guards |
| `src/lib/api-context.ts` | Trusted proxy IP extraction, `getCurrentSessionId()` for JTI binding |
| `src/lib/audit.ts` | Added `sessionId` to `AuditParams` type and logging |
| `src/modules/coordinator/department-utils.ts` | Fixed DEAN INSTITUTION scope leak — DEAN no longer automatically sees all departments |
| `src/modules/notifications/email-service.ts` | Production mode throws `AppError` on missing SMTP (no silent console fallback) |
| `.env.example` | Added security env vars with documentation |
| `app/api/question-banks/[id]/papers/[variant]/export/route.ts` | Rewrote with `withApiHandler`, step-up guard, PaperDownload tracking, audit |
| `app/api/coe/papers/[id]/mark-used/route.ts` | Added `stepUp: "COE_MARK_USED"` and audit config |
| `app/api/question-banks/[id]/dean-review/route.ts` | Added `stepUp: "DEAN_APPROVE"` to POST |
| `src/modules/paper-generation/word-export.service.ts` | Added optional `watermarkLines` parameter, `paperId` in return type |
| `src/modules/paper-generation/tcet-template-builder.ts` | Added watermark header with repeating text per page |

---

## Database Changes

### New models

```prisma
model OtpCode {
  id           String   @id @default(cuid())
  userId       String
  purpose      String
  resourceId   String?
  sessionId    String?
  codeHash     String   // bcrypt
  expiresAt    DateTime
  attemptCount Int      @default(0)
  usedAt       DateTime?
  createdAt    DateTime @default(now())
}

model SecurityConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model PaperDownload {
  id             String   @id @default(cuid())
  downloadId     String   @unique  // UUIDv4 — embedded in DOCX
  paperId        String
  variant        String
  downloadedById String
  downloadedAt   DateTime @default(now())
  ipAddress      String?
  userAgent      String?
  sessionId      String?
  auditLogId     String?
}
```

### Modified model

```prisma
model AuditLog {
  // existing fields ...
  sessionId     String?   // NEW — for OTP binding
  previousHash  String?  @unique  // NEW — prevents chain forks
}
```

---

## Test Coverage

**File**: `tests/unit/security-subsystem.test.ts` — 36 tests, all passing

| Suite | Tests | Coverage |
|-------|-------|----------|
| SecurityConfig | 6 | Mode detection, features per mode, dev auto-approve, lockdown restrictions, singleton, `requireFeatureEnabled` |
| StepUpService | 12 | Set/verify, wrong action/resource/user, TTL expiry, `requireVerified` throws, clear, clearAll, `getActiveSessions` |
| OtpService | 3 | Code generation, dev auto-approve, audit logging |
| WatermarkService | 5 | Download ID UUIDv4 format, dev mode empty outputs, watermark text format |
| EmergencyService | 2 | Method existence, OTP revocation |
| AuditService | 2 | Singleton, typed event methods |
| Architecture invariants | 6 | middleware.ts structure, SECURITY_MODE vs NODE_ENV, Cache-Control in api-handler, bcrypt usage, SMTP enforcement, DEAN scope fix |

---

## End-to-End Flow

### Paper Download (COE, production mode)

```
1. COE clicks "Download" on a paper
2. TypedConfirmModal shows — type "DOWNLOAD" to proceed
3. OTP dialog requests OTP — POST /api/auth/otp/request { purpose: "COE_DOWNLOAD" }
4. OtpService.create() → bcrypt hash → stores in OtpCode → emails 6-digit code
5. COE enters code — POST /api/auth/otp/verify { purpose, code }
6. OtpService.verify() → bcrypt.compare → timingSafeEqual
7. Atomic UPDATE OtpCode SET usedAt=NOW() WHERE id=X AND usedAt IS NULL
8. StepUpService.setVerified(userId, "COE_DOWNLOAD", paperId)
9. Export route handler executes:
   a. StepUpService.requireVerified(userId, "COE_DOWNLOAD", paperId)
   b. WordExportService.export() → generates DOCX with watermark header
   c. WatermarkService.generateDownloadId() → UUIDv4
   d. PaperDownload record created with download UUID
   e. AuditService.paperDownloaded() → hash-chained audit event
   f. Returns DOCX binary with Cache-Control: no-store
```

### Development Mode Bypass

```
1. Same pipeline executes (middleware → withApiHandler → all services called)
2. SecurityConfig.isAutoApproved === true
3. OtpService.verify() returns true without DB check
4. StepUpService.requireVerified() returns immediately
5. WatermarkService returns empty strings
6. Typed confirmation auto-fills
7. Audit events still recorded for development verification
8. NO duplicate code paths, NO special developer APIs
```

---

## Hardening Tasks (Architecture)

### 1. StepUpStore Abstraction
`src/lib/auth/step-up-store.ts`
- `StepUpStore` interface with methods: `set`, `get`, `delete`, `deleteByPrefix`, `clear`, `entries`
- `MemoryStepUpStore` — in-memory Map implementation (default, single-process)
- RedisStepUpStore — future implementation (interface-ready, zero code changes to StepUpService)
- `StepUpService` now depends ONLY on the interface

### 2. Browser Fingerprint
`src/lib/auth/browser-fingerprint.ts`
- SHA-256 hash of User-Agent + Accept-Language + platform headers
- Privacy-friendly: only stable headers, stored as hash only
- Used in OTP binding (OtpCode.browserFingerprint) and step-up verification
- Verification fails if fingerprint doesn't match

### 3. Step-Up Browser Validation
`src/lib/auth/step-up-service.ts`
- `requireVerified()` now checks: userId + action + resourceId + browserFingerprint
- Key format: `${userId}:${action}:${resourceId}:${fingerprint}`
- Fingerprint mismatch throws `STEP_UP_FINGERPRINT_MISMATCH` and clears session

### 4. Dynamic Watermarks
`src/lib/auth/watermark-service.ts`
- `getBrowserWatermarkHTML()` accepts optional `timestamp` (defaults to `new Date()`)
- Each render gets a fresh timestamp — prevents screenshot reuse
- Optional `renderId` parameter adds uniqueness per render

### 5. Development Security Banner
`src/components/auth/dev-security-banner.tsx`
- Persistent amber/yellow banner at top of every protected page in dev mode
- Content: "⚠ DEVELOPMENT SECURITY MODE — OTP bypass enabled — Watermarks disabled"
- Not dismissible, z-index 10000, sticky top-0
- Integrated into `app/(protected)/layout.tsx`

### 6. Security Dashboard Intelligence
`src/lib/auth/anomaly-detection.ts`
- Detects: excessive OTP failures (>10 in 15min), high downloads (>20 in 1hr), repeated regeneration (>3 in 30min), off-hours activity, rapid downloads (>5 in 10min)
- Each detection returns `AnomalyEvent[]` with severity levels (LOW/MEDIUM/HIGH/CRITICAL)
- Queries AuditLog grouped by actor within configurable time windows

### 7. Paper Reveal Expiry
`src/lib/auth/reveal-session.ts`
- `RevealSessionManager` — in-memory Map of reveal sessions
- TTL: env `PAPER_REVEAL_TIMEOUT_MINUTES` (default 10 min)
- After expiry: paper auto-blurs/hides, fresh step-up required
- API endpoints: `POST /api/auth/reveal/start`, `POST /api/auth/reveal/check`

### 8. Download Reason
`src/components/auth/download-reason-dialog.tsx`
- Required before download: "Exam Printing", "Quality Review", "Archive", "Other"
- Stored in `PaperDownload.downloadReason` and AuditLog metadata
- Displayed in Security Dashboard

### 9. Security Event Correlation
`src/lib/auth/security-event-id.ts`
- `SecurityEventId` type (UUIDv4) generated at start of each security workflow
- Propagated through: OTP request → verify → download → audit → PaperDownload
- Reconstruct entire workflow from one ID — no timestamp reliance

### 10. Config Precedence Model
`src/lib/auth/security-config.ts`
Precedence (highest to lowest):
1. Environment variable (`SECURITY_MODE`) — MAXIMUM permitted security level
2. Database overrides (`SecurityConfig` table) — may ADD restrictions but never WEAKEN
3. Runtime defaults — fallback when nothing else is set
- `getEffectiveMode()` returns the MORE restrictive of env vs DB override

### 11. Two-Person Emergency Unlock
`prisma/schema.prisma` — `EmergencyApproval` model
- `EmergencyApprovalService` at `src/lib/auth/emergency-approval.ts`
- Workflow: User A requests → User B approves (must be different user) → action executes
- Statuses: PENDING → APPROVED/REJECTED/EXPIRED
- API: `POST /api/security/emergency` (request), `PATCH /api/security/emergency` (approve/reject)

### New Prisma Models/Fields
| Model | Field | Type | Purpose |
|-------|-------|------|---------|
| OtpCode | `browserFingerprint` | String? | Browser binding |
| AuditLog | `securityEventId` | String? | Workflow correlation |
| PaperDownload | `securityEventId` | String? | Workflow correlation |
| PaperDownload | `downloadReason` | String? | Download audit |
| EmergencyApproval | (full model) | — | Two-person approval |

### New API Routes
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/reveal/start` | Start paper reveal session |
| GET | `/api/auth/reveal/check` | Check reveal session validity |
| POST | `/api/security/config/mode` | Toggle security mode (COE) |
| POST | `/api/security/emergency` | Request emergency action |
| PATCH | `/api/security/emergency` | Approve/reject emergency |
| GET | `/api/security/anomalies` | Run anomaly detection checks |

### E2E Verification Results

**38 checkpoints across 11 flows — 38/38 PASS** after gap fixes.

| Flow | Checkpoints | Result |
|------|-------------|--------|
| Step-Up Auth with Browser Fingerprint | 5 | 5/5 ✅ |
| OTP with Browser Binding | 3 | 3/3 ✅ |
| SecurityEventId Propagation | 5 | 5/5 ✅ |
| Development Mode | 5 | 5/5 ✅ |
| Reveal Session | 4 | 4/4 ✅ |
| Download Reason | 3 | 3/3 ✅ |
| Emergency + Two-Person Approval | 3 | 3/3 ✅ |
| Anomaly Detection | 2 | 2/2 ✅ |
| Config Precedence | 2 | 2/2 ✅ |
| Security Dashboard | 2 | 2/2 ✅ |
| WatermarkService | 2 | 2/2 ✅ |
| Cross-Cutting (Routes + Components) | 2 | 2/2 ✅ |

### Gap Fixes Applied

| Gap | Files Changed | Fix |
|-----|--------------|-----|
| Browser fingerprint not extracted from headers | `otp/request/route.ts`, `otp/verify/route.ts`, `export/route.ts` | Added `getBrowserFingerprintFromRequest()` calls |
| Browser fingerprint not stored in DB | `otp-service.ts` | Added `browserFingerprint` to Prisma `otpCode.create()` |
| StepUpService not passed fingerprint | `otp/verify/route.ts`, `export/route.ts` | Added `browserFingerprint` to `setVerified()` and `requireVerified()` calls |
| SecurityEventId missing from export audit | `export/route.ts` | Captured via module-level variable in `getMetadata` closure |
| Anomaly detection disconnected from dashboard | `page.tsx`, `anomalies/route.ts` | Created API endpoint, added anomaly alerts with severity badges to dashboard |

### Test Coverage
- 50 tests (+14 from hardening) — all passing
- Coverage includes: MemoryStepUpStore, browser fingerprint mismatch, step-up with browser binding, reveal session expiry, dev banner, anomaly detection, download reason persistence, SecurityEventId

## Pre-Production Checklist

- [ ] `npx prisma migrate dev --name add_security_subsystem` (replace `db push`)
- [ ] Set `SECURITY_MODE=production` in production `.env`
- [ ] Configure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` for email delivery
- [ ] Set `TRUSTED_PROXY_IP` behind reverse proxy
- [ ] Tune `OTP_EXPIRY_SECONDS`, `STEP_UP_TTL_SECONDS`, `PAPER_REVEAL_TIMEOUT_MINUTES`
- [ ] Consider switching `bcryptjs` → `bcrypt` native for performance
- [ ] Reset and re-seed database (schema changes applied via `db push`)
- [ ] Verify all 50 security subsystem tests pass
