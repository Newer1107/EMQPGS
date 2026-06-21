# Security Architecture

## Overview

EMQPGS implements a multi-layered security architecture designed for examination paper protection in real university environments.

The goal is NOT to make paper leakage impossible (that is impossible once a trusted user can legitimately view a paper). Instead, the objectives are:

- **Minimize exposure** — Least privilege, need-to-know access
- **Enforce least privilege** — Role-based scoping with fine-grained authorization
- **Protect sensitive actions** — Step-up authentication before destructive operations
- **Make every action attributable** — Hash-chained immutable audit logging
- **Build deterrence** — Watermarks, download tracking, typed confirmation
- **Keep workflow practical** — Development mode for frictionless development

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    middleware.ts                               │
│  JWT verify → Cache-Control: no-store → Trusted proxy IP     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   withApiHandler                               │
│  Rate limit → CSRF → JWT → Responsibility → Step-Up → Audit  │
│  → Cache-Control (response)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Security Services                            │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────┐  │
│  │OtpService  │ │StepUp    │ │Audit    │ │Watermark      │  │
│  │            │ │Service   │ │Service  │ │Service        │  │
│  │bcrypt hash │ │In-memory │ │Hash     │ │Browser + DOCX │  │
│  │Atomic use  │ │Action-   │ │chain    │ │Download UUID  │  │
│  │Rate limit  │ │scoped    │ │verify   │ │Forensic trace │  │
│  └──────┬─────┘ └────┬─────┘ └────┬────┘ └───────┬───────┘  │
│         │            │            │              │           │
│         └────────────┴────────────┴──────────────┘           │
│                                │                              │
│                    SecurityConfig (single source of truth)     │
└──────────────────────────────────────────────────────────────┘
```

## Security Modes

The application runs in one of three modes, controlled by the `SECURITY_MODE` environment variable. All security components query this configuration. Business services never inspect environment variables directly.

### Development Mode (`development`)

**Purpose:** Frictionless development experience.

The security pipeline **still executes** — only the verification step is bypassed. This ensures no duplicate code paths and no special developer APIs.

| Feature | Behavior |
|---------|----------|
| Authentication | ✅ Works normally |
| Authorization | ✅ Works normally |
| Workspace resolution | ✅ Works normally |
| Audit logging | ✅ Still active |
| Security middleware | ✅ Still executes |
| Email OTP | ❌ NOT sent — auto-approved |
| Step-up auth | ❌ Auto-approved |
| Typed confirmation | ❌ Optional |
| Browser watermark | ❌ Disabled by default |
| DOCX watermark | ❌ Disabled by default |
| Cache-Control | ✅ Still applied |

### Production Mode (`production`)

**Purpose:** Full security enforcement in live deployment.

| Feature | Behavior |
|---------|----------|
| Email OTP | ✅ Required for sensitive actions |
| Step-up auth | ✅ Required before destructive operations |
| Browser watermark | ✅ Applied to confidential pages |
| DOCX watermark | ✅ Applied to every exported paper |
| Typed confirmation | ✅ Required for high-risk actions |
| Cache-Control | ✅ no-store on all confidential routes |
| Full audit logging | ✅ All sensitive events recorded |

### Lockdown Mode (`lockdown`)

**Purpose:** Emergency response (reserved for future full implementation).

| Feature | Behavior |
|---------|----------|
| Downloads | ❌ Disabled |
| Paper reveal | ❌ Disabled |
| Active OTPs | ❌ Revoked on activation |
| Fresh auth | ✅ Required |
| Emergency audit | ✅ Events created |

## Component Reference

### SecurityConfig

**File:** `src/lib/auth/security-config.ts`

Centralized security configuration. Singleton pattern. Two-layer override:
1. `SECURITY_MODE` env var (bootstrap)
2. `SecurityConfig` DB table (runtime)

```typescript
const cfg = SecurityConfig.getInstance();
const features = cfg.getFeatures();       // Feature set for current mode
const isAutoApproved = cfg.isAutoApproved; // True in development mode
const mode = cfg.mode;                     // SecurityMode enum
```

### OtpService

**File:** `src/lib/auth/otp-service.ts`

Email-based one-time password service.

- **Generation:** 6-digit codes via `crypto.randomInt(100000, 999999)`
- **Storage:** bcrypt hash (not SHA-256) with per-code salt
- **Binding:** user + purpose + resource + session + expiry
- **Consumption:** Atomic `UPDATE ... WHERE usedAt IS NULL`
- **Rate limiting:** 5 attempts per code, then invalidated
- **Replay protection:** Atomic single-use prevents concurrent consumption
- **Expiry:** Configurable via `OTP_EXPIRY_SECONDS` (default 300 = 5 min)
- **Email fallback:** Password re-entry if SMTP fails in production
- **Dev mode:** Auto-approves (code "000000") without email

```typescript
const otp = new OtpService();

// Request
const { expiresAt } = await otp.create({
  userId: "user-id",
  purpose: "COE_DOWNLOAD",
  resourceId: "paper-id",
  sessionId: "jti-from-jwt",
});

// Verify
await otp.verify({
  userId: "user-id",
  purpose: "COE_DOWNLOAD",
  resourceId: "paper-id",
  sessionId: "jti-from-jwt",
}, "483291");
```

### StepUpService

**File:** `src/lib/auth/step-up-service.ts`

In-memory step-up session manager.

- **Storage:** In-memory `Map<`${userId}:${action}:${resourceId}`, { verifiedAt, ttlMs }>`
- **TTL:** `STEP_UP_TTL_SECONDS` (default 300 = 5 min)
- **Scoping:** Per-user, per-action, per-resource
- **Auto-cleanup:** Prunes stale entries every 100 writes
- **Stats:** Query active sessions via `getActiveSessions()`
- **Dev mode:** Always returns verified

```typescript
const stepUp = new StepUpService();

// After OTP verification
stepUp.setVerified(userId, "COE_DOWNLOAD", paperId);

// Before sensitive action
stepUp.requireVerified(userId, "COE_DOWNLOAD", paperId);
```

### AuditService

**File:** `src/lib/auth/audit-service.ts`

Typed audit event service wrapping the hash-chained audit log.

**Audited events:**

| Event | When |
|-------|------|
| OTP_REQUESTED | User requests an OTP |
| OTP_VERIFIED | OTP verified successfully |
| OTP_FAILED | OTP verification failed |
| PAPER_REVEALED | Paper content revealed to user |
| PAPER_DOWNLOADED | Paper downloaded (with Download UUID) |
| PAPER_REGENERATED | Paper regenerated |
| PAPER_APPROVED | Dean approves paper selection |
| PAPER_MARKED_USED | COE marks paper as used in examination |
| QUESTIONS_REVEALED | Question text displayed |
| SECURITY_CONFIG_CHANGED | Runtime config updated |
| STEP_UP_SESSION_EXPIRED | Step-up session timed out |
| LOCKDOWN_ACTIVATED/DEACTIVATED | Lockdown mode toggled |
| EMERGENCY_OVERRIDE | Emergency override used |

```typescript
const audit = getAuditService();

await audit.paperDownloaded({
  actorId: userId,
  entityId: paperId,
  metadata: { downloadId, paperVariant },
  ipAddress: request.headers.get("x-forwarded-for"),
  userAgent: request.headers.get("user-agent"),
});
```

### WatermarkService

**File:** `src/lib/auth/watermark-service.ts`

Browser and DOCX watermark generation.

- **Browser watermark:** CSS diagonal overlay via pseudo-elements
- **DOCX watermark:** Text repeated on every page in the exported document
- **Download UUID:** Unique UUIDv4 per download for forensic tracing

### EmergencyService

**File:** `src/lib/auth/emergency-service.ts`

Emergency/Lockdown controls:

- `activateLockdown(actorId)` — Revoke all OTPs, clear sessions, disable downloads/reveals
- `deactivateLockdown(actorId)` — Return to production mode
- `disableDownloads(actorId)` — Disable paper downloads
- `revokeOtps(actorId, userId?)` — Revoke active OTPs

## OTP Flow

```
User clicks "Download" (COE action)
        │
        ▼
TypedConfirmModal: type "DOWNLOAD"
        │
        ▼
OTP Dialog: click "Request OTP"
        │
        ▼
POST /api/auth/otp/request { purpose: "COE_DOWNLOAD", resourceId: "paper-123" }
        │
        ├── OtpService.create() → bcrypt hash → stores in OtpCode table
        ├── Sends email with 6-digit code
        └── Returns { expiresAt } (NEVER the code)
        │
        ▼
User enters 6-digit code
        │
        ▼
POST /api/auth/otp/verify { purpose: "COE_DOWNLOAD", code: "483291", resourceId: "paper-123" }
        │
        ├── OtpService.verify() → bcrypt.compare
        ├── Atomic UPDATE ... WHERE usedAt IS NULL (replay prevention)
        ├── StepUpService.setVerified(userId, "COE_DOWNLOAD", paperId)
        └── Returns { verified: true }
        │
        ▼
Action proceeds
        │
        ├── withApiHandler checks StepUpService.requireVerified()
        ├── Creates PaperDownload record with unique UUID
        ├── WatermarkService generates Download UUID → embedded in DOCX
        └── AuditService.paperDownloaded() logged
```

## Step-Up Flow with Fallback

```
User triggers sensitive action
        │
        ▼
    withApiHandler
        │
        ├── Development mode? → Auto-approve, skip check
        ├── Lockdown mode and action disabled? → Throw FEATURE_DISABLED
        └── Production mode → Check StepUpService.requireVerified()
                │
                ├── Session exists and valid → Continue
                ├── Session expired → Throw STEP_UP_EXPIRED
                └── No session → Throw STEP_UP_REQUIRED → shows OTP dialog
                        │
                        ▼
                User requests OTP → verify → session created → retry action
```

## Development Mode Bypass

All security services follow the same pattern:

```typescript
// Inside every security service:
const cfg = SecurityConfig.getInstance();
if (cfg.isAutoApproved) {
  // Dev mode: log the event but skip verification
  await this.audit({ ... });
  return { autoApproved: true };
}
// Production mode: perform actual verification
```

This ensures:
- No duplicate code paths for dev vs prod
- Audit events are still recorded in dev for testing
- API responses are identical in shape (only verification differs)
- No special developer APIs that could accidentally ship to prod

## Roles and Permissions

| Role | Access | Restrictions |
|------|--------|-------------|
| CONTRIBUTOR | Own questions only | — |
| MODERATOR | Entire assigned bank | Read-only except moderation, audited viewing |
| COORDINATOR | Entire assigned bank | Never generated papers |
| DEAN | Generated papers, AI insights, traces | Step-up for reveal/approve/download |
| COE | Publication, downloads, mark used | Step-up for download/mark/archive |

## Download Tracking

Every paper download receives:

```
Download UUID: 550e8400-e29b-41d4-a716-446655440000
    ↓
Stored in PaperDownload table (forensic record)
    ↓
Embedded in DOCX watermark on every page
    ↓
Audit event: PAPER_DOWNLOADED with downloadId in metadata
```

This allows tracing leaked copies back to the specific download event.

## Cache Control

All confidential API responses include:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

Set centrally in:
1. `middleware.ts` — for all matched routes
2. `withApiHandler()` — for all API responses (default, opt-out via `cacheControl: false`)

## API Endpoints

### Auth Routes

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/auth/otp/request` | Request OTP code | JWT + DEAN/COE |
| POST | `/api/auth/otp/verify` | Verify OTP code | JWT + DEAN/COE |
| GET | `/api/auth/step-up/check` | Check step-up status | JWT + DEAN/COE |
| GET | `/api/security/config` | Read security config | COE only |
| PATCH | `/api/security/config` | Update runtime config | COE only |
| GET | `/api/audit-logs/verify` | Verify audit chain | COE only |
| GET | `/api/security/events` | Recent security events | COE only |
| GET | `/api/security/downloads` | Recent downloads | COE only |

## Database Schema

### OtpCode

| Column | Type | Description |
|--------|------|-------------|
| id | String (CUID) | Primary key |
| userId | String | User who requested the OTP |
| purpose | String | OTP purpose (DEAN_REVEAL, COE_DOWNLOAD, etc.) |
| resourceId | String? | Paper/Bank ID this OTP authorizes |
| sessionId | String? | JWT JTI of the session |
| codeHash | String | bcrypt hash of the 6-digit code |
| expiresAt | DateTime | Expiry timestamp |
| attemptCount | Int | Failed attempts (rate limiting) |
| usedAt | DateTime? | Single-use consumption timestamp |

### SecurityConfig

| Column | Type | Description |
|--------|------|-------------|
| key | String (unique) | Config key (e.g., "DOWNLOADS_ENABLED") |
| value | String | Config value |

### PaperDownload

| Column | Type | Description |
|--------|------|-------------|
| downloadId | String (unique) | UUIDv4 for forensic tracing |
| paperId | String | Paper that was downloaded |
| variant | String | Paper variant |
| downloadedById | String | User who downloaded |
| ipAddress | String? | Client IP |
| userAgent | String? | Client user agent |
| sessionId | String? | Session identifier |

## Deployment Checklist

### Development

```bash
# .env
SECURITY_MODE=development
```

### Production

```bash
# .env
SECURITY_MODE=production
SMTP_HOST=smtp.example.com
SMTP_USER=notifications@example.com
SMTP_PASS=...
OTP_EXPIRY_SECONDS=300        # 5 minutes
STEP_UP_TTL_SECONDS=300       # 5 minutes
OTP_MAX_ATTEMPTS=5
TRUSTED_PROXY_IP=loopback     # or the IP of your reverse proxy
```
