# Phase 1 — Security & Infrastructure Fixes

This file tracks the implementation progress of Phase 1 fixes for the EMQPGS platform.
All items are production-grade, with `npm run build` verified after each change.

---

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Not Started

---

## Implementation Log

### 1.1 ✅ `proxy.ts` — JWT Signature Verification

**Severity:** CRITICAL  
**File:** `proxy.ts`  
**Date:** 2026-06-13  

**Problem:** `readRoleFromToken()` used `atob()` to decode the JWT payload without verifying the HMAC signature. An attacker could forge a cookie with any role and bypass frontend route protection.

**Fix:** Replaced `atob()` decoding with proper `jwtVerify()` from the `jose` library. The function is now `async` and verifies the token against `JWT_ACCESS_SECRET` before trusting the `role` claim. Invalid/forged tokens are rejected with `undefined`, causing the middleware to redirect to `/login`.

**Key changes:**
- `readRoleFromToken` is now `async` and uses `jwtVerify()`
- `proxy()` is now `async` to await the role check
- Invalid tokens trigger a 401 for API routes or redirect to `/login` for page routes

---

### 1.2 ✅ `assignments/repository.ts` — `replaceAssignments` Scope Fix

**Severity:** HIGH  
**File:** `src/modules/assignments/repository.ts`  
**Date:** 2026-06-13

**Problem:** `deleteMany` on `questionBankId` deleted ALL assignments (both `CONTRIBUTOR` and `MODERATOR`) then re-created only contributor ones. This silently wiped moderator assignments.

**Fix:** Added `assignmentRole: AssignmentRole.CONTRIBUTOR` filter to the `deleteMany` call.

---

### 1.3 ✅ `production/service.ts` — `mysqldump` Password Exposure

**Severity:** HIGH  
**File:** `src/modules/production/service.ts`  
**Date:** 2026-06-13

**Problem:** Database password was passed as `--password=${...}` CLI argument to `mysqldump`, visible to all system processes via `ps`/`/proc`.

**Fix:** Removed `--password` from CLI args and passed the password via the `MYSQL_PWD` environment variable instead, which is process-scoped and not visible in process listings.

---

### 1.4 ✅ `document-service.ts` — PDF Page Overflow

**Severity:** HIGH  
**File:** `src/modules/production/document-service.ts`  
**Date:** 2026-06-13  

**Problem:** When text exceeded one page, the code reset `y = 1120` on the same page instead of calling `pdf.addPage()`. Content overwrote previously drawn text, producing garbled PDFs.

**Fix:** Extracted an `ensureSpace()` closure that calls `pdf.addPage()` and resets `y` when the remaining vertical space is insufficient. Each question block now triggers a page break if needed.

---

### 1.5 ✅ SMTP OAuth2 Email Provider

**Severity:** HIGH  
**Files:** `src/modules/notifications/smtp-provider.ts` (new), `src/modules/notifications/email-service.ts`, `src/lib/env.ts`, `.env`  
**Date:** 2026-06-13  

**Problem:** All emails were silently logged to console via `ConsoleEmailProvider`. No actual email delivery existed.

**Fix:** Created `SmtpEmailProvider` using `nodemailer` with Gmail OAuth2 authentication. The provider uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` for OAuth2 token generation via `nodemailer`'s built-in support. Falls back to `ConsoleEmailProvider` if SMTP credentials are not configured.

**New dependency:** `nodemailer` (^7.0.0), `@types/nodemailer` (dev)

---

### 1.6 ✅ `error.tsx` — Error Boundaries

**Severity:** HIGH  
**Files:** `app/error.tsx` (new), `app/(protected)/error.tsx` (new)  
**Date:** 2026-06-13  

**Problem:** Zero error boundaries anywhere in the app. Any unhandled error resulted in a white-screen Next.js error page with no recovery path.

**Fix:** Created root and protected-route error boundary components with "Try again" and "Go home" actions, plus console error logging for debugging.

---

### 1.7 ✅ `loading.tsx` — Loading Skeletons

**Severity:** HIGH  
**Files:** `app/loading.tsx` (new), `app/(protected)/loading.tsx` (new)  
**Date:** 2026-06-13  

**Problem:** No loading states at any route level. Slow server components delayed page render with no visual feedback.

**Fix:** Created root loading spinner and protected-route skeleton layout matching the AppShell structure.

---

### 1.8 ✅ `README.md` — SMTP/OAuth2 Documentation

**Severity:** MEDIUM  
**File:** `README.md`  
**Date:** 2026-06-13  

**Problem:** README had no documentation for email/SMTP configuration.

**Fix:** Added SMTP OAuth2 environment variables section with detailed setup instructions for Gmail OAuth2 (Google Cloud Console → OAuth Playground workflow).
