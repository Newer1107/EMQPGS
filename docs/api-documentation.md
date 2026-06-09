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
- `POST /api/question-slots/[id]/override`
- `GET/POST /api/questions`
- `GET/PATCH /api/questions/[id]`
- `POST /api/questions/[id]/submit`
- `POST /api/questions/[id]/moderate`
- `GET/POST /api/questions/[id]/attachments`
- `POST /api/questions/[id]/attachments/presign`
- `PATCH/DELETE /api/question-attachments/[id]`
- `GET /api/question-attachments/[id]/download`

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

- All mutating routes require CSRF token
- Rate limiting is enforced in the shared API handler
- Export and backup routes are COE-only
- Signed URLs expire using `SIGNED_URL_EXPIRY_SECONDS`
