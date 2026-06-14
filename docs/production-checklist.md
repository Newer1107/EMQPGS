# Production Checklist

## Before Go-Live

- Run `npm run lint`
- Run `npm run test`
- Run `npm run build`
- Run `npx prisma generate`
- Run `npm run prisma:deploy`
- Confirm `.env` contains all required production secrets
- Confirm MinIO buckets exist, including `system-backups`
- Confirm Ollama is reachable from the application runtime
- Confirm backup execution can invoke `mysqldump`
- Confirm monitoring endpoints reflect direct workflow execution

## Functional Validation

- Login, logout, forgot password, reset password
- Question contribution and moderation
- AI report generation
- Signed HOD report upload
- Coordinator approval and locking
- Paper generation A/B/C
- Dean selection submission
- COE PDF, DOCX, and ZIP export
- Export download and print flow
- Monitoring page loads
- Health endpoint responds

## Security Validation

- CSRF token required on mutating routes (timing-safe comparison, origin check vs `AUTH_URL`)
- Unauthorized export requests return `403`
- Rate limit returns `429` when exceeded
- Locked banks reject edits (immutability enforced at service layer)
- Audit log entries are created for security-critical actions (request body NOT auto-captured)
- Zod validation errors return `400` (not `500`)
- Free-text fields reject HTML tags (charset regex validation)
- Question bank status transitions enforce state machine (invalid transitions return `409`)
- Coordinator decision APPROVED sets status to `APPROVED` (not `LOCKED`); lock must be explicit
- Moderator slot override gated by `ModeratorBankAssignment`
