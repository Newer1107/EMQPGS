# API Documentation

## Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/csrf`

## Admin

- `GET/POST /api/users`
- `PATCH /api/users/[id]`
- `GET/POST /api/departments`
- `PATCH/DELETE /api/departments/[id]`
- `GET/POST /api/exam-cycles`
- `PATCH /api/exam-cycles/[id]`
- `GET/POST /api/subjects`
- `PATCH /api/subjects/[id]`
- `GET/POST /api/question-banks`
- `PATCH /api/question-banks/[id]/status`
- `GET/POST /api/assignments`
- `GET /api/audit-logs`
- `GET /api/dashboard`
- `GET /api/notifications`

## Question Contribution

- `GET/POST /api/question-slots`
- `POST /api/question-slots/[id]/override` (moderator only, gated by `ModeratorBankAssignment`)
- `GET/POST /api/questions`
- `GET/PATCH /api/questions/[id]`
- `POST /api/questions/[id]/submit`
- `POST /api/questions/[id]/moderate`
- `GET/POST /api/questions/[id]/attachments`
- `POST /api/questions/[id]/attachments/presign`
- `PATCH/DELETE /api/question-attachments/[id]`
- `GET /api/question-attachments/[id]/download`

## Assignments

- `POST /api/question-banks/[id]/assignments/moderator` — assign moderator to bank (validates MODERATOR role, prevents duplicates)

## Reports and Papers

- `GET/POST /api/question-banks/[id]/reports`
- `POST /api/question-banks/[id]/signed-report/presign`
- `POST /api/question-banks/[id]/signed-report`
- `POST /api/question-banks/[id]/coordinator-decision`
- `GET/POST /api/question-banks/[id]/papers`
- `GET/POST /api/question-banks/[id]/dean-review`

## Production

- `GET/POST /api/exports`
- `GET /api/exports/[id]/download`
- `POST /api/backups`
- `GET /api/monitoring`
- `GET /api/health`

## Security Defaults

- All mutating routes require CSRF token (HMAC-SHA256, cookie + header, timing-safe)
- CSRF origin check uses `AUTH_URL` (not `host` header)
- Rate limiting is enforced in the shared API handler (120 req/60s default)
- Export and backup routes are COE-only
- Signed URLs expire using `SIGNED_URL_EXPIRY_SECONDS`
- Zod validation errors return 400 (not 500, no stack trace leak)
- Free-text fields validated with charset regex (stored XSS prevention)
- All ID fields validated with `.min(1)` (non-empty guard)
- Audit logs do not auto-capture request bodies
- Question bank state transitions enforced via transition table (10 states, forward-only DAG)
