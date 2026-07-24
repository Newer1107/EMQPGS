# EMQPGS — Production Readiness Verification

> Generated: 2026-06-24  
> Method: 6 parallel audits + fix sprint (P0 + selected P1)

---

## Fixed Issues

### P0.1 — Contributor Draft Delete

**Files changed:**
| File | Change |
|------|--------|
| `src/modules/question-library/service.ts` | Added `delete()` method with owner + DRAFT-only guard |
| `app/api/question-library/[id]/route.ts` | Added `DELETE` handler with audit logging |
| `src/components/contributor/questions-list.tsx` | Added Delete button for DRAFT questions |

**Verification:**
- DELETE endpoint exists at `DELETE /api/question-library/[id]`
- Service checks `ownerId === ctx.userId` (ForbiddenError if not owner)
- Service rejects non-DRAFT status (AppError 409)
- Transactional: unassigns from slots first, then deletes (cascade handles revisions/events)
- Audit logged via `withApiHandler({ audit: { action: "QUESTION_DELETED" } })`
- UI shows "Delete" button for DRAFT questions with confirmation dialog
- UI reloads page on success (question disappears from list)

### P0.2 — Notification Center

**Files changed:**
| File | Change |
|------|--------|
| `app/api/notifications/route.ts` | Added cursor-based pagination (`?cursor=`), returns `unreadCount` in GET response |
| `src/modules/notifications/service.ts` | Added `listAfter()` for cursor pagination |
| `src/components/notifications/notification-bell.tsx` | New — notification bell with unread badge + dropdown + 30s polling |
| `src/components/layout/app-shell.tsx` | Replaced hardcoded red dot with `<NotificationBell />` |
| `app/(protected)/dashboard/notifications/page.tsx` | New — dedicated notification inbox page |

**Verification:**
- Bell icon in header with unread count badge
- Dropdown shows 5 most recent notifications
- 30-second polling for new notifications
- "View all" link to `/notifications` page
- Mark individual notification as read from dropdown
- Dedicated page at `GET /notifications` with full list + clear all
- Cursor pagination via `?cursor=<id>` query param

### P0.3 — Moderator Notified on Submission

**Files changed:**
| File | Change |
|------|--------|
| `src/modules/question-library/service.ts` | Added notification dispatch to assigned moderators after `submit()` |

**Verification:**
- After `submit()`, queries `ResponsibilityAssignment` for MODERATORs of the bank
- Creates `Notification` for each assigned moderator
- Title: "New question submitted for moderation"
- Action URL: `/dashboard/moderator/questions`
- Works for both fresh submissions (DRAFT->PENDING) and revision resubmits

### P0.4 — Wire createAndEmail()

**Files changed:**
| File | Change |
|------|--------|
| `src/modules/notifications/service.ts` | `create()` now auto-fetches user email and attempts email delivery |

**Verification:**
- Every `create()` call now fetches user email + name from DB
- Calls `emailService.sendNotificationEmail()` if email exists
- Failure is caught and logged (non-blocking — DB notification always succeeds)
- No caller changes needed — all existing notification paths get email for free

### P0.5 — Slot Ownership Validation

**Files changed:**
| File | Change |
|------|--------|
| `src/modules/question-slots/service.ts` | Added `ctx` param with ownership + status validation |
| `app/api/question-banks/[id]/slots/[slotId]/route.ts` | Passes `context.auth!.user.id` to service |

**Verification:**
- Contributor can only assign their own questions (`question.ownerId === ctx.userId`)
- Coordinator bypass: coordinators can assign any question
- Contributor can only assign DRAFT or REVISION_REQUESTED questions
- All existing checks preserved (slot exists, bank mutable, not locked, not duplicate)

### P1.2 — Contributor Moderation Timeline

**Files changed:**
| File | Change |
|------|--------|
| `app/(protected)/dashboard/contributor/questions/[id]/edit/page.tsx` | Fetches `ModerationEvent[]` and renders timeline |
| `src/components/contributor/moderation-timeline.tsx` | New — visual timeline component with icons + colors |

**Verification:**
- Shows all moderation events on the question edit page
- Each event shows action icon, label, timestamp, moderator name, remarks
- Vertical timeline with connecting lines
- Empty state: component returns null if no events

---

## Remaining Issues

| Priority | Issue | Reason Deferred |
|----------|-------|-----------------|
| P1.1 | My Subjects Page | Requires full implementation: assignment queries, progress stats, UI layout |
| P1.3 | Moderator Revision Diff | Needs diff engine to compare QuestionRevision snapshots |
| P1.4 | Contributor Coverage Dashboard | Needs new API endpoint + frontend charts |
| P2.1 | Loading States | Affects ~20+ pages |
| P2.2 | Error Boundaries | Audit required across all role directories |
| P2.3 | Pagination | Question Library, Audit Logs, History |
| P2.4 | Export Cleanup | Scheduled cleanup needs scheduler hook |

---

## Production Readiness

| Area | Status | Notes |
|------|--------|-------|
| Authentication | Production-ready | JWT, CSRF, OTP, step-up, blacklist, refresh, middleware |
| Authorization | Production-ready | RBAC via ResponsibilityAssignment + withApiHandler |
| Question Library | Ready | Draft delete added. All CRUD complete. |
| Moderation | Ready | Moderator notified on submission added. Timeline added. |
| Coordinator | Minor fix needed | Generate Papers button visible to coordinator but returns 403 |
| AI | Ready | Analysis pipeline, evaluation, all 26 metrics working |
| Paper Generation | Ready | Multi-variant, constraint engine, trace, explainability |
| Dean | Ready | All 18 capabilities verified |
| COE | Minor stubs | Batch History page, Paper Archive, Export console stubs |
| Security | One critical | Forgot-password email never sent |
| Notifications | Ready | Bell, dropdown, page, email auto-send, moderator notification |
| Audit | Ready | SHA-256 chain, verification, anomaly detection |
| Performance | In-memory rate limit | Redis needed for multi-process |
| Testing | 188 pass, 11 pre-existing failures | No regressions from this sprint |

**Files modified:** 14  
**APIs added:** `DELETE /api/question-library/[id]`, cursor pagination on `GET /api/notifications`  
**Components added:** `NotificationBell`, `ModerationTimeline`, `NotificationsPage`  

**3 must-fix items before production sign-off:**
1. Wire forgot-password email
2. Fix Generate Papers button gating for coordinator
3. Rebuild + restart after deploying all changes
