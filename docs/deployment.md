# Deployment

> Setup, environment configuration, deployment strategies, and operations.

---

## 1. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `AUTH_URL` | Yes | Canonical app URL (CSRF origin verification) |
| `AUTH_SECRET` | Yes | Auth.js secret (min 32 chars) |
| `JWT_ACCESS_SECRET` | Yes | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key (min 32 chars) |
| `CSRF_SECRET` | Recommended | Falls back to `AUTH_SECRET` if unset |
| `MINIO_*` | Yes | MinIO host, port, access/secret keys, SSL flag |
| `SMTP_*` | For email | SMTP host, port, user, app password |
| `OLLAMA_*` | Optional | Ollama URL, model name |
| `HEALTHCHECK_TOKEN` | Recommended | Shared secret for health endpoint |

All variables validated at startup by `src/lib/env.ts` using Zod.

---

## 2. Local Development

```bash
docker compose up -d mysql minio minio-init
npm ci
npm run prisma:migrate
npm run prisma:seed
npm run dev   # http://localhost:3000
```

---

## 3. Production

1. Set strong values for `AUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `HEALTHCHECK_TOKEN` (use `openssl rand -base64 32`)
2. Set `AUTH_URL` to the application's canonical URL
3. Use managed MySQL and object storage where available
4. Run at least one web replica
5. Ensure `mysqldump` is in PATH (Docker image includes `mysql-client`)
6. Ensure Ollama is reachable if AI analysis is used

```bash
npm run build
npm run prisma:deploy  # production migrations
npm run start
```

---

## 4. Database Commands

| Command | Purpose |
|---|---|
| `npm run prisma:migrate` | Apply pending migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:seed` | Seed demo data |

---

## 5. MinIO Buckets

| Bucket | Purpose |
|---|---|
| `question-bank-attachments` | Question attachments and assets |
| `generated-papers` | Generated paper PDFs |
| `exports` | Export artifacts (PDF, DOCX, ZIP) |
| `audit-files` | Audit log exports |
| `system-backups` | Database backup files |

Created by `minio-init` service in `docker-compose.yml`. Do not add buckets without updating that init step.

---

## 6. Monitoring

### Endpoints
- `GET /api/health` — health summary (token-gated with `x-health-token`)
- `GET /api/monitoring` — COE metrics dashboard payload

### What is monitored
- MySQL reachability and query latency
- MinIO bucket availability
- In-progress workflow counts (AI analysis, paper generation, exports, backups)
- Counts of users, banks, reports, exports, backups, stored objects

---

## Cross-References

| Topic | Document |
|---|---|
| Architecture | `docs/architecture.md` |
| Workflow | `docs/workflow.md` |
| Developer guide | `docs/developer-guide.md` |
| Glossary | `docs/glossary.md` |
