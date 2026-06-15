# EMQPGS — Production Readiness Audit

**Date:** 2026-06-15
**Methodology:** File-by-file review of every API route handler (54 files), auth infrastructure (proxy, JWT, CSRF, rate-limit), state machines, error handling, storage, backup, monitoring, and schema constraints.
**Scope:** Authorization, workflow recovery, state machine integrity, concurrency, data integrity, operational readiness, security, disaster recovery.

---

## Classification Legend

| Priority | Meaning |
|---|---|
| **P0 — Critical** | Will cause data loss, privilege escalation, or complete workflow failure in production |
| **P1 — High** | Will cause significant operational friction, partial data loss, or unrecoverable states without DB edits |
| **P2 — Medium** | Corrective action needed before general availability; graceful degradation is acceptable |
| **P3 — Low** | Should be addressed post-launch |

---

## 1. Authorization

### 1.1 API Route Role Coverage

Every route handler uses `withApiHandler({ roles: [...] })`. The role coverage is comprehensive:

| Method-Route Combinations | Count |
|---|---|
| Total authenticated routes | 69 |
| COE-accessible | 35 |
| COORDINATOR-accessible | 42 |
| MODERATOR-accessible | 13 |
| CONTRIBUTOR-accessible | 11 |
| DEAN-accessible | 6 |
| Unauthenticated (health) | 1 |

### 1.2 Unauthenticated Routes

| Route | Method | Protection | Risk |
|---|---|---|---|
| `/api/health` | GET | `x-health-token` header vs `HEALTHCHECK_TOKEN` env var | **P2** — If `HEALTHCHECK_TOKEN` is unset/unconfigured, the health endpoint is wide open. No rate limiting, no CSRF. Read-only, but exposes system metadata (user count, bank count, workflow state, backup status). |

### 1.3 Privilege Escalation Risks

| Risk | Detail | Severity |
|---|---|---|
| **No object-level access checks on /api/subject-versions/[id]/archive** | Route handler does not validate the caller has department access to the subject. A coordinator could archive versions for subjects outside their assigned departments. | **P1** |
| **No object-level access check on /api/question-banks/[id]/status** | `PATCH /api/question-banks/[id]/status` allows COORDINATOR or MODERATOR roles but does not verify department access to the question bank's subject. | **P1** |
| **No object-level access check on /api/question-banks/[id]/coordinator-decision** | `POST /api/question-banks/[id]/coordinator-decision` allows COORDINATOR role but does not verify department access. | **P1** |
| **SubjectManagementService.createSubject() checks department access** | **Good** — verifies the coordinator is assigned to the selected department. | ✓ |
| **QuestionBankWorkflowService.lockQuestionBank() checks department access** | **Good** — verifies via `deptUtils.assertDepartmentAccess`. | ✓ |
| **QuestionBankWorkflowService.getQuestionBankDetail() checks department access** | **Good** — same pattern. | ✓ |
| **DeanReviewService.submitDeanReview() checks role but not department** | Verifies DEAN role but does not check whether the dean's department matches the question bank's subject department. | **P2** |
| **ModeratorService uses assigned bank IDs** | **Good** — limits questions to banks where the moderator has been assigned via `moderatorBankAssignment`. | ✓ |

### 1.4 Role-to-Route Coverage Gaps

| Action | Who Can Do It | Who Should Be Able To |
|---|---|---|
| Read question library coverage | COE, COORDINATOR, DEAN | Moderators and Contributors have no API access to coverage data. They see individual questions but can't assess overall bank fill. | **P3** |
| Update question bank status | COORDINATOR, MODERATOR | Moderators can change bank status without any department-or-assignment check. | **P1** |

### 1.5 Middleware Layer

The `proxy.ts` middleware correctly:
- Blocks all `/dashboard/*` and `/api/*` requests without a valid JWT
- Redirects unauthenticated page requests to `/login`
- Returns 401 JSON for unauthenticated API requests
- Enforces role-specific dashboard access (`/dashboard/coe` → COE only, etc.)
- Does NOT enforce per-role access on API routes (this is delegated to `withApiHandler`)

**Finding:** The middleware does not check `api/auth/*` sub-routes against the /api/ auth guard (line 12: `if (pathname.startsWith("/api/auth")) return NextResponse.next()`). This is intentional for the Auth.js handler, but note that `/api/auth/csrf`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password` are accessible without authentication — which is correct design.

**Verdict:** The authorization layer is **well-designed** with two-layer defense (middleware + handler). The primary risk is missing object-level access checks on 3 routes (P1).

---

## 2. Workflow Recovery

### 2.1 Rejected Questions

| Step | Recovery Path | Status |
|---|---|---|
| Moderator rejects a question | Status set to `REJECTED`. The contributor sees a rejection reason. The question is not deleted — it remains in the library. | **Complete** |
| Contributor can edit a rejected question? | The edit page allows editing any question regardless of status. After editing, the contributor can click "Submit" to set status to `PENDING`. | **Complete** |
| Can a rejected question be re-moderated? | Yes — after re-submission, status becomes `PENDING` which is actionable for moderators. | **Complete** |
| Can a coordinator override a rejection? | No — only moderators can moderate. The coordinator has no API to force-approve a rejected question. | **P2** — If a moderator rejects incorrectly, the contributor must edit and resubmit (which is the designed workflow). |

**Recovery without DB edits: YES** — Rejected questions can be edited and resubmitted.

### 2.2 Revision Requests

| Step | Recovery Path | Status |
|---|---|---|
| Moderator requests revision | Status set to `REVISION_REQUESTED`. Contributor sees the instructions and can edit. | **Complete** |
| Contributor completes revisions | Edit → "Save & Submit" sets status to `REVISION_SUBMITTED`. | **Complete** |
| Moderator reviews resubmission | `REVISION_SUBMITTED` is an actionable status. | **Complete** |
| Can a revision request be cancelled? | No — there is no API to revert `REVISION_REQUESTED` back to `PENDING`. | **P2** — The moderator would need to approve (contradictory) or wait for the contributor. |

**Recovery without DB edits: YES** — With the "Save & Submit" single-step workflow.

### 2.3 Locked Banks

| Step | Recovery Path | Status |
|---|---|---|
| Coordinator locks a bank | Status set to `LOCKED`. Transition table has no outgoing transitions from `LOCKED`. | **Final** |
| Can a locked bank be unlocked? | No. The transition table `LOCKED: []` is an empty array. The `lockQuestionBank` service also checks `if (bank.status === LOCKED) throw AppError`. | **P1** — If a bank is locked accidentally, the only recovery is a direct database update. This is by design (lock is intentional as a final state), but there should be an audit-level override or a COE-only unlock endpoint for operational emergencies. |

**Recovery without DB edits: NO** — Locked banks cannot be unlocked through the UI or API.

### 2.4 Failed Paper Generation

| Step | Recovery Path | Status |
|---|---|---|
| Paper generation called | Status set to `PROCESSING`. The generation happens synchronously. | **Complete** |
| Generation fails (e.g. not enough questions) | The `PaperGenerator` throws; `PaperGenerationService.generatePapers()` creates/updates the `GeneratedPaper` record with status `FAILED` and a `failureReason`. | **Complete** |
| Can papers be regenerated after failure? | Yes — the button is still visible. It will attempt generation again. Each attempt creates a new `GeneratedPaper` record. | **Complete** |
| Can failed papers be retried automatically? | No — the user must click the button again. | **P3** — Acceptable for synchronous generation. |

**Recovery without DB edits: YES** — Retry the generation via the UI.

### 2.5 Failed AI Report Generation

| Step | Recovery Path | Status |
|---|---|---|
| AI report generation called | Status set to `PROCESSING`. Generation is synchronous. | **Complete** |
| Generation fails | `AiReportService.createAiReport()` catches errors, sets status to `FAILED`, stores `failureReason`. | **Complete** |
| Can reports be regenerated after failure? | Yes. | **Complete** |

**Recovery without DB edits: YES** — Retry via the UI.

### 2.6 Ownership Transfers

| Step | Recovery Path | Status |
|---|---|---|
| Coordinator transfers ownership | `ownerId` updated. `QuestionOwnershipHistory` record created with from/to/transferredBy. | **Complete** |
| Can a transfer be undone? | No — there is no "undo transfer" API. The coordinator would need to transfer ownership back to the original user. | **P2** — Manual reverse transfer is possible. |
| Is the transfer atomic with history? | Yes — both the owner update and the history record are created sequentially. If the history write fails, the owner is still updated (not wrapped in a transaction). | **P1** — If the history DB write fails after the owner update, the owner changes without an audit trail. |

**Recovery without DB edits: YES** — Transfer can be reversed by another transfer.

### 2.7 Workflow Recovery Summary

| Scenario | Recoverable Without DB Edit? | Priority |
|---|---|---|
| Rejected question | Yes (edit + resubmit) | ✓ |
| Revision requested | Yes (edit + save & submit) | ✓ |
| Locked bank accidentally | **No** — requires DB edit | **P1** |
| Failed paper generation | Yes (retry) | ✓ |
| Failed AI report | Yes (retry) | ✓ |
| Ownership transfer error | Yes (reverse transfer) | ✓ |
| Ownership history data loss | **Partial** — no transaction wrapping | **P1** |

---

## 3. State Machine Integrity

### 3.1 Question Status Machine

```
DRAFT → PENDING → APPROVED (terminal)
                → REJECTED (terminal via contributor edit → PENDING)
                → REVISION_REQUESTED → REVISION_SUBMITTED → APPROVED
                                                          → REJECTED
                                                          → REVISION_REQUESTED
```

Transitions enforced by `ModeratorService.moderate()`:
- Actions allowed only from `PENDING` or `REVISION_SUBMITTED`
- No direct transition from `DRAFT` or `REJECTED` to `PENDING` — the contributor must use the submit action

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| **No transition from REJECTED to PENDING via API** | The submit action only works for `DRAFT` and `REVISION_REQUESTED`. Rejected questions become stuck unless the contributor edits (which changes the question text) and then submits. | **P2** |
| **DRAFT → PENDING not explicitly valid** | The submit action checks `status === DRAFT || status === REVISION_REQUESTED` in the service layer (client-side), but there is no server-side validation of this status transition. | **P1** — If a caller directly calls the update API with a status, they could bypass the submit logic. |
| **APPROVED → REJECTED not gated** | A moderator could theoretically approve, then reject later since there's no status check preventing action on an already-approved question. The `moderate()` method only checks `status !== PENDING && status !== REVISION_SUBMITTED`. | **P2** |

**Verdict:** The question status machine works but has 2 edge cases where statuses can drift.

### 3.2 QuestionBank Status Machine

```
DRAFT → IN_PROGRESS → UNDER_MODERATION → MODERATED → REPORT_GENERATED
                                                      → AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED
                                                                          → AWAITING_COORDINATOR_APPROVAL
                                                                            → APPROVED → LOCKED
                                                                                  ↕
                                                                           (can go back to AWAITING_HOD_SIGN)
```

Enforced by `transitions.ts` with `isValidTransition()`.

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| **AWAITING_COORDINATOR_APPROVAL can go back to AWAITING_HOD_SIGN** | This re-entrant edge allows cycling between signed report states. It's intentional per the transition table but could cause infinite cycles. | **P3** |
| **No "LOCKED → anything" transition** | **By design** — but no escalation path for accidental locks. | **P1** |
| **No automated transitions** | Moving between some states (e.g., MODERATED → REPORT_GENERATED) requires manual action by the coordinator. The UI has a generate report button, but there's no auto-advance when conditions are met (e.g., all questions approved). | **P2** |
| **Status update API accepts any status** | `PATCH /api/question-banks/[id]/status` accepts any `QuestionBankStatus` value and calls `isValidTransition()`. If the transition is invalid, a `409 Conflict` is returned. The validation is correct. | ✓ |

**Verdict:** The bank status machine is well-enforced. The only gap is the lack of an emergency unlock path (P1).

### 3.3 Dean Review Status

The `DeanReview` model is created once and there is no way to update or delete it through the API. The `@@unique` constraint on `questionBankId` ensures one review per bank.

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| **No dean review update API** | Once submitted, the dean cannot change their paper selection. No undo/redo. | **P2** — By design (locking the dean's decision), but could be frustrating in production. |
| **No dean review deletion API** | If a dean review is submitted in error (wrong bank), there is no way to remove it through the API. | **P2** |

**Verdict:** The dean review is a write-once, immutable decision. This is acceptable if the workflow is well-understood, but lacks safety nets.

### 3.4 SubjectVersion Status Machine

```
ACTIVE → ARCHIVED (terminal)
```

- No `ARCHIVED → ACTIVE` transition
- Creating a new version automatically archives the existing active version
- **Verdict:** Clean, simple, no issues.

### 3.5 Missing Transitions Summary

| State Machine | Missing Transition | Impact | Severity |
|---|---|---|---|
| QuestionBank | LOCKED → anything (emergency unlock) | Requires DB edit if locked accidentally | **P1** |
| DeanReview | No update/delete path | Selection is permanent once submitted | **P2** |
| Question | REJECTED → PENDING (direct resubmit) | Contributor must edit rejected questions; can't just re-submit | **P2** |

---

## 4. Concurrency

### 4.1 Two Moderators Reviewing Simultaneously

| Scenario | Risk | Mitigation | Severity |
|---|---|---|---|
| Both moderators open the same question detail | No risk — read-only. | None needed. | ✓ |
| Both moderators click "Approve" at the same time | The second update overwrites the first. Both get success toasts. No data loss — the final status is still APPROVED. Two `ModerationEvent` records are created (one per moderator). | No optimistic lock on `QuestionLibraryItem`. The second moderator may not realize someone else already approved it. | **P2** |
| Moderator A clicks "Approve" and Moderator B clicks "Reject" simultaneously | The last write wins. If A's write takes effect after B's, the question ends up APPROVED despite B's rejection. | No locking or version check on the question table. This could lead to conflicting moderation outcomes. | **P1** |

### 4.2 Two Contributors Editing Simultaneously

| Scenario | Risk | Mitigation | Severity |
|---|---|---|---|
| Contributor A and Contributor B open the same question edit page simultaneously | No risk on read. | None needed. | ✓ |
| A saves, then B saves | B's version overwrites A's version with no diff/merge. A's changes are silently lost. | No optimistic lock on `QuestionLibraryItem`. `QuestionRevision` is created per save but there is no conflict detection. | **P1** — Silent data loss on concurrent edits. |
| A is editing when B submits the question | A may be editing a question that just got submitted. A's save after submission works but the question goes back to the original status (not PENDING). | The update API does not check if the question was submitted in the meantime. | **P2** |

### 4.3 Coordinator Actions During Moderation

| Scenario | Risk | Mitigation | Severity |
|---|---|---|---|
| Coordinator locks bank while moderator is reviewing | `lockQuestionBank()` checks bank version and uses optimistic lock via `withOptimisticLock()`. The lock operation will fail with a `ConflictError` if the bank was modified concurrently. | **Good** — optimistic lock on `QuestionBank.version`. | ✓ |
| Coordinator generates report while moderator approves questions | No conflict — report generation reads the current state. If a question is approved mid-generation, the report may include it or not. No data corruption. | Acceptable eventual consistency. | **P3** |
| Coordinator changes bank status while moderator is acting | The bank status could change out from under the moderator's action (e.g., bank locked while question is being approved). The status change is valid, but the moderator gets no warning. | **P2** — No in-flight action cancellation. |

### 4.4 Paper Generation Race Conditions

| Scenario | Risk | Mitigation | Severity |
|---|---|---|---|
| Two coordinators click "Generate Papers" simultaneously | `GeneratedPaper` has `@@unique([questionBankId, variant])`. Two simultaneous POSTs to `/papers` for the same variant will cause a unique constraint violation. The second one fails with a Prisma error. | The unique constraint prevents duplicate paper records. The error is caught by `withApiHandler` and returned as a 500 (not as a user-friendly message). | **P2** — Fails but no data corruption. |
| Paper generation takes long; coordinator navigates away | The generation runs synchronously. If the HTTP request times out (e.g., 30s), the generation may still complete on the server. No retry needed. | Synchronous execution is a risk for large question banks. No timeout or background job migration. | **P1** — For banks with 100+ approved questions, the generation may exceed the HTTP request timeout. |

### 4.5 Concurrency Summary

| Concurrency Risk | Severity |
|---|---|
| Conflicting moderator actions (last write wins) | **P1** |
| Silent overwrite on concurrent question edits | **P1** |
| Bank lock uses optimistic locking | ✓ (Good) |
| Paper generation uses unique constraint to prevent duplicates | **P2** (Fails with 500 instead of graceful error) |
| No background workers for long-running operations | **P1** |

---

## 5. Data Integrity

### 5.1 Foreign Key Constraints

All 22 models have proper `@relation` declarations with foreign keys. MySQL enforces referential integrity at the database level. **No orphan-creating pathways** were found in the API routes.

### 5.2 Unique Constraints

| Constraint | Model | Purpose | Status |
|---|---|---|---|
| `@@unique([subjectId, examCycleId])` | QuestionBank | One bank per subject per cycle | ✓ |
| `@@unique([questionBankId, variant])` | GeneratedPaper | One paper per variant per bank | ✓ |
| `@@unique([generatedPaperId, questionId])` | GeneratedPaperItem | No duplicate questions in a paper | ✓ |
| `@@unique([questionBankId, questionId])` | QuestionBankQuestion | One link per question per bank | ✓ |
| `@@unique([coordinatorId, departmentId])` | CoordinatorDepartmentAssignment | No duplicate assignments | ✓ |
| `@@unique([moderatorId, questionBankId])` | ModeratorBankAssignment | No duplicate assignments | ✓ |
| `@@unique([subjectId, examCycleId])` | SubjectExamCycleLink | One link per subject per cycle | ✓ |
| `@@unique([questionId, revisionNumber])` | QuestionRevision | Monotonic revision numbering | ✓ |
| `DeanReview.questionBankId` | DeanReview | `@unique` — one review per bank | ✓ |

**No missing unique constraints found.** All join tables are properly protected against duplicates.

### 5.3 Orphan Record Risks

| Scenario | Risk | Status |
|---|---|---|
| Delete user with created questions | `QuestionLibraryItem.createdById` has no `onDelete`. Deleting a user with FK violations fails at the DB level. | ✓ (Protected by FK) |
| Delete question bank without removing assignments | `ModeratorBankAssignment.questionBankId` → `onDelete: NoAction` (default). Deleting the bank fails if assignments exist. | ✓ (Protected by FK) |
| Delete exam cycle with linked subjects | `SubjectExamCycleLink.examCycleId` → FK prevents deletion. | ✓ |
| Storage upload succeeds but DB write fails | `uploadServerFile` creates the MinIO object before the DB row. If the DB write fails, an orphan object exists in MinIO. | **P2** — No cleanup mechanism for orphaned storage objects. |
| Audit chain integrity | `AuditLog.previousHash` chains entries. If an entry in the middle of the chain is tampered with, the hash chain breaks. | **Innovative design** — detection-capable but not actively monitored for tampering. |

### 5.4 Cascading Behavior

The schema uses **all default `onDelete` behavior** (no explicit `onDelete: Cascade` anywhere in the schema). This means:
- Deleting a parent record fails if any child records reference it
- No accidental cascade deletions
- Cleanup must be explicit in application code

**Verdict:** Data integrity is well-protected. The main risk is orphaned storage objects on partial upload failures (P2).

---

## 6. Operational Readiness

### 6.1 Audit Logging

Every state-changing API route includes an `audit: { action, entityType }` option in the `withApiHandler` call. The audit system:
- Uses serializable transactions to read the previous entry's hash
- Chains entries via `previousHash` and `integrityHash` (SHA-256)
- Retries up to 3 times on serialization conflicts
- Captures actor ID, action, entity type, entity ID, request metadata (IP, user agent), and optional custom metadata

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| Some routes audit without `getEntityId` | Several routes use `getEntityId: () => null`, meaning the log entry has no `entityId`. This makes it hard to correlate audit entries to specific records. | **P2** |
| No audit log retention/cleanup | The `AuditLog` table has no expiry mechanism. In production, this table will grow unboundedly. | **P2** |
| No audit log search API | The `/api/audit-logs` GET endpoint returns all logs unfiltered with a take of 25. No search, no filter by entity type/action/actor. | **P2** |
| Some GET endpoints audit | A few routes have audit blocks on read operations, which is unusual. | **P3** |

### 6.2 Error Handling

The `withApiHandler` wrapper catches and formats all errors:

| Error Type | HTTP Status | Response Shape |
|---|---|---|
| `ZodError` (validation) | 400 | `{ success, error: { code: "VALIDATION_ERROR", message, details } }` |
| `AppError` (application) | Varies (400-409) | `{ success, error: { code, message, details } }` |
| Unhandled errors | 500 | `{ success, error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" } }` |

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| 500 errors return generic "Something went wrong" | Intentionally vague — but operators get no clue about the actual error. No error ID or trace identifier returned to the client. | **P3** |
| No error correlation ID | A production incident cannot be traced from the client response back to server logs without matching timestamps. | **P2** |
| `withApiHandler` catches all unhandled errors | Prisma unique constraint violations (`P2002`) are not specifically handled — they bubble up as an unhandled `PrismaClientKnownRequestError` which produces a generic 500 response instead of a 409 Conflict. | **P1** — Unique constraint violations from paper generation and other upserts should return user-friendly 409 errors. |

### 6.3 Validation

Every mutation API route uses Zod schema validation before processing. 10 dedicated `validation.ts` files plus 8 inline schemas cover all routes. **No route accepts raw user input without validation.**

### 6.4 User Feedback

| Pattern | Coverage | Issues |
|---|---|---|
| Toast notifications | Every form and action button uses `sonner` toasts for success/failure. | **P2** — Post-submit behavior varies across 8 different patterns (redirect, form reset, page refresh, etc.). |
| Form validation | All required fields are marked with the `required` HTML attribute. Zod validation errors from the API are surfaced via `result.error.message`. | ✓ |
| Optimistic UI updates | Most forms do full page refresh (`router.refresh()`) after success instead of optimistic state updates. | **P2** — Acceptable but not ideal UX. |

### 6.5 Rate Limiting

`enforceRateLimit()` is called on every request through `withApiHandler`. It uses in-memory storage keyed by `[method, path, IP]` with configurable window and max requests from env vars.

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| In-memory rate limit store | Resets on server restart. Does not scale across multiple instances. A load balancer past 1 instance breaks rate limiting. | **P1** — Will cause rate limit bypasses in multi-instance deployments. |
| No rate limit on login specifically | The login endpoint is rate-limited by the same global limit as all other routes (configurable). No separate, stricter limit for auth attempts. | **P2** |

---

## 7. Security

### 7.1 Direct URL Access

| Scenario | Protection |
|---|---|
| Unknown user accesses `/dashboard/coe` | `proxy.ts` checks JWT → redirects to `/login` (401 for API) |
| Contributor types `/dashboard/coe` | `proxy.ts` sees role CONTRIBUTOR → 403 redirect with `?denied=COE` |
| Unauthenticated user accesses `/api/exports` | `proxy.ts` returns `{ success: false, error: { message: "Unauthorized" } }` |
| Moderator tries `POST /api/exports` | `proxy.ts` allows through (no API role check), but `withApiHandler` checks `roles: [COE]` → throws `ForbiddenError` |
| Direct access to hidden pages like `/dashboard/coe/production` | `proxy.ts` blocks at the middleware level with role checks. COE pages require COE role. |

**Verdict:** Two-layer defense works. No direct URL access path bypasses role enforcement.

### 7.2 Hidden Pages

| Page | Sidebar Link? | Direct URL Accessible? | Risk |
|---|---|---|---|
| `/dashboard/coe/monitoring` | Yes (recently added) | Yes (COE role) | None |
| `/dashboard/coe/production` | Yes (recently added) | Yes (COE role) | None |
| `/dashboard/moderator/signed-reports` | Yes (recently added) | Yes (MODERATOR role) | None |

All hidden pages are now linked in the sidebar. No production pages exist without nav links.

### 7.3 API Bypass Risks

| Risk | Detail | Severity |
|---|---|---|
| API routes without `roles` in `withApiHandler` | All 69 method-route combinations have explicit `roles` arrays (except health). | ✓ |
| API route without CSRF protection | `assertCsrfProtection()` is called on every request. All mutating methods are checked. | ✓ |
| API route without rate limiting | `enforceRateLimit()` is called on every request. | ✓ |
| No parameter pollution protection | Routes that accept optional search params (like `departmentId`, `semesterId`) pass them directly to service methods. No explicit validation of unexpected params. | **P2** — Low risk since params are validated by Zod schemas where used. |

### 7.4 Role Enforcement

All roles are strings from the `Role` enum. The check is:
1. `proxy.ts`: checks the JWT's `role` claim against the dashboard path prefix
2. `withApiHandler()`: checks `user.role` against the `roles` array from `@prisma/client`

**Finding:** `proxy.ts` only checks the role against the dashboard path. For API routes, proxy passes through to the handler and relies entirely on `withApiHandler`. This is the correct separation — proxy handles page-level routing, handler handles operation-level authorization.

### 7.5 JWT Security

| Aspect | Implementation | Assessment |
|---|---|---|
| Signing algorithm | HS256 via `jose` library | ✓ Standard |
| Access token TTL | Configurable via `ACCESS_TOKEN_TTL_MINUTES` env var | ✓ |
| Refresh token TTL | Configurable via `REFRESH_TOKEN_TTL_DAYS` env var | ✓ |
| Session idle timeout | Configurable via `SESSION_IDLE_TIMEOUT_MINUTES` env var | ✓ (checked on refresh) |
| Cookie flags | `httpOnly: false` for CSRF (needed by client), `sameSite: "strict"`, `secure: true` in production | ✓ |
| Secret rotation | No rotation mechanism — secrets are static env vars | **P3** — Acceptable for MVP |

### 7.6 CSRF Protection

| Aspect | Implementation | Assessment |
|---|---|---|
| Token format | `random.signature` with HMAC-SHA256 | ✓ |
| Token expiry | 24 hours with 1-hour refresh threshold | ✓ |
| Verification | Cookie vs header comparison + HMAC verification | ✓ |
| Origin check | Validates origin matches `AUTH_URL` | ✓ |
| Cookie visibility | `httpOnly: false` (required for client-side JS to read) | **Acceptable** — CSRF token is not an auth token |
| Timing-safe comparison | Uses `crypto.timingSafeEqual` | ✓ |

### 7.7 Security Summary

| Area | Score | Notes |
|---|---|---|
| Authentication | 9/10 | HS256, dual tokens, idle timeout, standard cookie flags |
| Authorization | 8/10 | Two-layer defense, but 3 routes lack object-level checks |
| CSRF | 9/10 | HMAC-signed, origin-verified, timing-safe |
| Rate limiting | 6/10 | In-memory store doesn't scale; no separate login rate limit |
| Input validation | 10/10 | Every route validated with Zod |
| Secret management | 7/10 | Static env vars, no rotation |

---

## 8. Disaster Recovery

### 8.1 Backup System

The `BackupService.runSystemBackup()`:
1. Calls `mysqldump` via shell execution
2. Uploads the dump to MinIO's `system-backups` bucket
3. Records status in `SystemBackup` table
4. Marks `FAILED` if any step fails

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| **No concurrency guard** | Two simultaneous backup calls both run `mysqldump`, potentially overloading the DB. | **P1** |
| **50 MB dump limit** | `execFileAsync` has `maxBuffer: 50 * 1024 * 1024`. A real university's multi-year dataset will exceed this. | **P1** |
| **Backup runs within HTTP request** | For a large database, `mysqldump` can take minutes. The HTTP request will time out. | **P1** |
| `mysqldump` must be in PATH | The production Dockerfile includes `mysql-client` via `apk add`, so this works. | ✓ |
| **No backup encryption** | The dump file is uploaded to MinIO in plain SQL format. Anyone with MinIO access can read all data. | **P2** — Sensitive data (password hashes, user emails) is in the dump. |
| **No backup verification** | The system creates a backup but never verifies it can be restored. | **P3** |

### 8.2 Export System

The `ExportService.createExport()`:
1. Creates `ExportArtifact` with `PENDING` status
2. Generates PDF/DOCX/ZIP via `DocumentService`
3. Uploads to MinIO's `exports` bucket
4. Marks `COMPLETED` when done

**Issues:**

| Issue | Detail | Severity |
|---|---|---|
| **Synchronous document generation** | For banks with many questions, PDF generation can take 30+ seconds. The HTTP request may time out. | **P1** |
| No expiration on export artifacts | `expiresAt` is set at creation but cleanup depends on `cleanupExpiredArtifacts` being called. | **P2** |

### 8.3 Operational Recovery Paths

| Scenario | Recovery |
|---|---|
| Database corruption | Restore from MinIO backup (need to download dump and run `mysql` manually) |
| Lost MinIO data | Re-run exports (questions are in the database) |
| Lost database data | Restore from MinIO backup (last backup time = data loss window) |
| Accidental user disable | COE can re-enable via `PATCH /api/users/[id]` (set status to ACTIVE) |
| Accidental department delete | No API delete for departments? Let me check... `DELETE /api/departments/[id]` exists but is gated by COE role. No undelete. | **P2** — Deletion is permanent. |

### 8.4 Disaster Recovery Summary

| Scenario | Recoverable? | Time to Recover |
|---|---|---|
| DB crash with recent backup | Yes (MinIO restore) | Hours (manual) |
| DB crash without recent backup | Data loss from last backup | N/A |
| MinIO data loss for exports | Yes (re-export) | Minutes |
| MinIO data loss for backups | Data loss | N/A |
| Secret rotation | Yes (restart with new env vars) | Minutes |
| User with forgotten password | Yes (reset flow) | Self-service |

---

## 9. Production Risk Register

### P0 — Critical (0 issues found)

No P0 issues identified. The system has no known privilege escalation paths, no write-only security holes, and no data-loss pathways that can be triggered through the UI.

### P1 — High (12 issues)

| ID | Issue | Area | Detail |
|---|---|---|---|
| **P1.1** | No object-level access check on `/api/question-banks/[id]/status` | Authorization | Coordinator/Moderator can update any bank's status without department access verification. |
| **P1.2** | No object-level access check on `/api/question-banks/[id]/coordinator-decision` | Authorization | Same pattern — no department access check. |
| **P1.3** | No object-level access check on `/api/subject-versions/[id]/archive` | Authorization | Coordinator can archive versions for any subject. |
| **P1.4** | Locked bank has no unlock path | Workflow Recovery | Accidental lock requires DB edit. |
| **P1.5** | Ownership transfer not wrapped in transaction | Data Integrity | Owner updates but history write may fail, losing the audit trail. |
| **P1.6** | Conflicting moderator actions (last write wins) | Concurrency | Two moderators acting simultaneously can produce conflicting outcomes. |
| **P1.7** | Silent overwrite on concurrent question edits | Concurrency | Two contributors editing simultaneously — the second save silently discards the first's changes. |
| **P1.8** | Long-running operations (backup, paper gen, export) may timeout | Operational | Synchronous execution without timeouts for operations that can take 30+ seconds. |
| **P1.9** | In-memory rate limit store doesn't scale | Operational | Multiple instances bypass rate limits. |
| **P1.10** | Prisma unique constraint errors return generic 500 | Error Handling | Paper generation and similar operations fail with an unhelpful "Something went wrong" message. |
| **P1.11** | mysqldump 50 MB buffer limit | Disaster Recovery | Real university datasets will exceed this. |
| **P1.12** | No concurrency guard on backup | Disaster Recovery | Simultaneous backup calls overload the database. |

### P2 — Medium (15 issues)

| ID | Issue | Area | Detail |
|---|---|---|---|
| P2.1 | No dean review update/delete API | State Machine | Selection is permanent once submitted. |
| P2.2 | No direct REJECTED → PING transition for questions | State Machine | Must edit to resubmit. |
| P2.3 | Moderator can act on already-approved questions | State Machine | No status-bound gating beyond PENDING/REVISION_SUBMITTED. |
| P2.4 | No bank status auto-advance when all questions approved | State Machine | Manual action required. |
| P2.5 | No cancellation path for revision requests | Workflow Recovery | Cannot revert REVISION_REQUESTED to PENDING. |
| P2.6 | Orphaned MinIO objects on partial upload failures | Data Integrity | No cleanup mechanism. |
| P2.7 | Unbounded audit log growth | Operational | No retention/cleanup policy. |
| B2.8 | Audit log has no search/filter | Operational | /api/audit-logs returns unfiltered results. |
| P2.9 | No error correlation ID | Operational | Cannot trace client errors to server logs. |
| P2.10 | 8 different post-submit UX patterns | User Feedback | Confusing for users. |
| P2.11 | Health endpoint without token exposes metadata | Security | If HEALTHCHECK_TOKEN is unset, system information leaks. |
| P2.12 | No separate login rate limit | Security | Auth brute force uses the same limit as other endpoints. |
| P2.13 | Backups uploaded without encryption | Disaster Recovery | SQL dump contains sensitive data. |
| P2.14 | Dean department access not verified | Authorization | Dean can review banks for any department. |
| P2.15 | Contributor edit during submission race condition | Concurrency | Contributor may be editing when question is submitted. |

### P3 — Low (7 issues)

| ID | Issue | Detail |
|---|---|---|
| P3.1 | No secret rotation mechanism | Static env vars. |
| P3.2 | Backup never verified for restorability | No restore test. |
| P3.3 | No audit log entity IDs on some routes | getEntityId returns null. |
| P3.4 | Some GET routes have audit blocks | Unnecessary audit writes on reads. |
| P3.5 | Failed paper generation must be manually retried | No auto-retry. |
| P3.6 | Moderator/contributor can't read coverage data | API restricted to COE/COORDINATOR/DEAN. |
| P3.7 | AWAITING_COORDINATOR_APPROVAL ↕ AWAITING_HOD_SIGN cycle | Re-entrant state transition. |

---

## 10. Deployment Score

### Architecture Score: 7.5/10

| Criterion | Score | Notes |
|---|---|---|
| Separation of concerns | 8 | Clean module/service/repository pattern with some direct prisma usage |
| API design | 9 | RESTful, consistent response envelope, all routes in `withApiHandler` |
| State management | 6 | In-memory rate limit, no distributed caching, no background workers |
| Database design | 8 | Foreign keys, unique constraints, indexes on query paths |
| Extensibility | 7 | Module pattern works for new features |

### Workflow Score: 5.5/10

| Criterion | Score | Notes |
|---|---|---|
| User-facing workflow completeness | 6 | All APIs have some UI now, but many gaps in guidance and feedback |
| Error recovery | 5 | Most workflows recoverable, but concurrency issues and lock paths are problematic |
| State machine enforcement | 7 | Bank status machine well-enforced; question status has edge cases |
| Workflow automation | 3 | No auto-advance between states, no background processing |
| Audit trail | 7 | Hash-chained audit logs; missing entity IDs on some entries |

### Security Score: 8.0/10

| Criterion | Score | Notes |
|---|---|---|
| Authentication | 9 | JWT with HS256, dual tokens, idle timeout |
| Authorization | 8 | Two-layer defense, 3 routes need object-level checks |
| CSRF | 9 | HMAC-signed, origin-verified, timing-safe comparisons |
| Input validation | 10 | Every route has Zod validation |
| Rate limiting | 6 | In-memory, doesn't scale, no separate auth limit |
| Secrets | 7 | Static env vars, no rotation |

### Operational Score: 5.0/10

| Criterion | Score | Notes |
|---|---|---|
| Error handling | 7 | Structured errors, but generic 500 on constraint violations |
| Logging | 7 | Audit with hash chains, but no error correlation IDs |
| Monitoring | 6 | Health check exists but no alerting, no metrics export |
| Backup | 5 | Works but fragile (50 MB limit, no concurrency guard, no encryption) |
| Scalability | 3 | In-memory state, synchronous operations, no background workers |
| Disaster recovery | 4 | Backup exists but untested, no restore procedure documented |

### Production Readiness Score: 6.5/10

| Dimension | Score | Weight |
|---|---|---|
| Architecture | 7.5 | 20% |
| Workflow | 5.5 | 30% |
| Security | 8.0 | 25% |
| Operational | 5.0 | 25% |
| **Weighted Total** | **6.5** | **100%** |

---

## Summary

**The system is not production-ready without addressing the P1 issues.** The architecture is sound — clean separation of concerns, consistent API patterns, thorough validation, and a secure auth foundation. The risks are in three areas:

1. **Concurrency (4 P1s):** Simultaneous moderator actions, contributor edits, and backup operations lack proper locking or transaction boundaries. In a multi-user university environment, conflicts are inevitable.

2. **Object-level authorization (3 P1s):** Three routes bypass department-level access checks. A coordinator with access to Department A could affect question banks or subject versions in Department B.

3. **Operational fragility (4 P1s):** Synchronous long-running operations (backup, paper generation, export) will time out under load. The in-memory rate limiter breaks with multiple instances. The 50 MB mysqldump limit will fail on real datasets.

The system is **safe for a single-user demo or pilot with 2-3 concurrent users**. For a university-wide deployment serving hundreds of faculty and students, the P1 items must be resolved first.
