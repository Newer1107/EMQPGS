# Production Checklist

## Before Go-Live

- Run `npm run lint`
- Run `npm run test`
- Run `npm run build`
- Run `npx prisma generate`
- Run `npm run prisma:deploy`
- Confirm `.env` contains all required production secrets
- Confirm MinIO buckets exist, including `system-backups`
- Confirm worker process is running
- Confirm AI analysis worker can reach Ollama
- Confirm backup worker can execute `mysqldump`

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

- CSRF token required on mutating routes
- Unauthorized export requests return `403`
- Rate limit returns `429` when exceeded
- Locked banks reject edits
- Audit log entries are created for security-critical actions
