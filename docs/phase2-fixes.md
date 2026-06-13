# Phase 2 — App-Wide Error Handling & UX Fixes

This file tracks the implementation progress of Phase 2 fixes for the EMQPGS platform.
All items are production-grade, with `npm run build` verified after each change.

---

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Not Started

---

## Implementation Log

### 2.1 ✅ `client-fetch.ts` — Network Error Handling & CSRF Resilience

**Severity:** HIGH  
**File:** `src/lib/client-fetch.ts`  
**Date:** 2026-06-13  

**Problem:** `ensureCsrfToken()` had no `response.ok` check — if the CSRF endpoint returned non-2xx, `response.json()` would throw an unhandled rejection. `apiFetch()` had no try-catch at all — any network failure caused an unhandled promise rejection in every consumer.

**Fix:** 
- Wrapped `ensureCsrfToken()` in try-catch, returns `null` on failure
- Added `response.ok` check before parsing JSON in CSRF fetch
- Wrapped `apiFetch()` body in try-catch, throws a descriptive `Error` on network failure

---

### 2.2 ✅ `simple-form.tsx` — try-catch + Loading State Safety

**Severity:** HIGH  
**File:** `src/components/dashboard/simple-form.tsx`  

**Problem:** No try-catch around API call. `setLoading(false)` was called AFTER `await response.json()`, so a JSON parse error would permanently disable the submit button.

**Fix:** Wrapped API call in try-catch. `setLoading(false)` moved to `finally` block. `response.ok` checked before parsing JSON. Error displayed via `toast.error`.

---

### 2.3 ✅ `subject-create-form.tsx` — try-catch + Status Check Fix

**Severity:** HIGH  
**File:** `src/components/coordinator/subject-create-form.tsx`  

**Problem:** No try-catch around API call. `response.status === 201` check was too specific (API may return 200). `response.json()` consumed before status check.

**Fix:** Added try-catch. Changed status check to `response.ok`. Error handling via `setErrors`. Loading reset in `finally`.

---

### 2.4 ✅ `assignments-manager.tsx` — refreshBank error handling

**Severity:** MEDIUM  
**File:** `src/components/coordinator/assignments-manager.tsx`  

**Problem:** `refreshBank()` had no try-catch. `readApi()` helper checked `response.ok` AFTER `response.json()`.

**Fix:** Added try-catch to `refreshBank()`. Restructured `readApi()` to check `response.ok` before parsing JSON. Added error toast.

---

### 2.5 ✅ `export-console.tsx` — try-catch

**Severity:** HIGH  
**File:** `src/components/production/export-console.tsx`  

**Problem:** `createExport()` and `downloadExport()` had no try-catch. Network or JSON parse errors would crash the component.

**Fix:** Wrapped both functions in try-catch with user-facing error messages via `setMessage`. Loading state reset in `finally`.

---

### 2.6 ✅ `dean-review-workspace.tsx` — try-catch + Redundant CSRF Fix

**Severity:** MEDIUM  
**File:** `src/components/production/dean-review-workspace.tsx`  

**Problem:** `loadWorkspace()` and `submitSelection()` had no try-catch. `submitSelection()` made a redundant CSRF pre-fetch (`apiFetch` already handles CSRF automatically).

**Fix:** Added try-catch to both functions. Removed the redundant CSRF fetch call.

---

### 2.7 ✅ `dean-notifications-inbox.tsx` — try-catch

**Severity:** MEDIUM  
**File:** `src/components/production/dean-notifications-inbox.tsx`  

**Problem:** `markAsRead()` had no try-catch. API failure would silently fail without user feedback.

**Fix:** Added try-catch with toast error feedback.

---

### 2.8 ✅ `notification-inbox.tsx` — Fix `response.ok` Before `response.json()`

**Severity:** HIGH  
**File:** `src/components/moderator/notification-inbox.tsx`  

**Problem:** `response.ok` checked AFTER `response.json()` — on non-JSON error responses, JSON parsing would throw before the error could be handled.

**Fix:** Reordered to check `response.ok` first, then parse JSON. Both `markOne()` and `clearAll()` now properly guard against non-JSON error responses.

---

### 2.9 ✅ `moderation-workspace.tsx` — Fix `readApi()` + Empty State

**Severity:** MEDIUM  
**File:** `src/components/moderator/moderation-workspace.tsx`  

**Problem:** `readApi()` helper checked `response.ok` after `response.json()`. Table rendered with only headers when the question list was empty.

**Fix:** Restructured `readApi()` to check `response.ok` before JSON parsing. Added "No matching questions" empty state row. Added `role="button"`, `tabIndex`, and keyboard handler to clickable table rows for accessibility.

---

### 2.10 ✅ `workspace.tsx` — try-catch + Stale UI Fix

**Severity:** HIGH  
**File:** `src/components/questions/workspace.tsx`  

**Problem:** All mutation handlers (`reserveSlot`, `saveQuestion`, `submitQuestion`, `moderateQuestion`, `uploadAttachment`, `deleteAttachment`, `openAttachment`) had no try-catch. After reserve/upload/delete, the UI showed stale data (required manual refresh). `saveQuestion` sends `slotId: ""` if not selected.

**Fix:** Added try-catch to all 7 handlers. Added `onMutation` callback prop that triggers parent refresh after mutations. Added slotId validation to prevent empty slot submission.

---

### 2.11 ✅ `app-shell.tsx` — Logout Error Handling

**Severity:** MEDIUM  
**File:** `src/components/layout/app-shell.tsx`  

**Problem:** `handleLogout()` had no try-catch. `router.refresh()` called after `router.push("/login")` which may be a no-op on unmounted component.

**Fix:** Added try-catch (silent fallback — proceed with redirect regardless). Removed `router.refresh()` after navigation.

---

### 2.12 ✅ `exam-cycle-timetable-manager.tsx` — try-catch

**Severity:** HIGH  
**File:** `src/components/dashboard/exam-cycle-timetable-manager.tsx`  

**Problem:** `submitForm()` had no try-catch. Network failures or JSON parse errors caused unhandled rejections.

**Fix:** Added try-catch. Loading state reset in `finally`. Error displayed via `toast.error`.
