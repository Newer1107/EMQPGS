# Production Runbook

> **Part of the EMQPGS engineering handoff set**  
> Companion to: `PROJECT_HANDOFF.md` · `SYSTEM_ARCHITECTURE.md` · `DATABASE_REFERENCE.md` · `UI_UX_REDESIGN.md`

---

## 1. System Overview

| Component | Technology | Version | Criticality |
|---|---|---|---|
| Web server | Next.js 16 (App Router) | 16.2.7 | Primary |
| Database | MySQL 8 | 8.0+ | Primary |
| Object storage | MinIO (S3-compatible) | Latest | Primary |
| ORM | Prisma | 6.16.2 | Primary |
| Auth | Auth.js v5 (beta) + custom JWT | 5.0.0-beta.31 | Primary |
| AI analysis | Ollama (optional) | Latest | Secondary |
| Email | Nodemailer (optional) | 7.0+ | Secondary |

### Ports

| Service | Port | Protocol |
|---|---|---|
| Next.js app | 3000 (configurable via `PORT`) | HTTP/HTTPS |
| MySQL | 3306 | TCP |
| MinIO API | 9000 | HTTP |
| MinIO Console | 9001 | HTTP |
| Ollama | 11434 | HTTP |

---

## 2. Deployment

### Prerequisites

```bash
# Required
Node.js >= 20
MySQL 8.0+
MinIO or S3-compatible storage

# Optional
Ollama (for AI analysis)
SMTP server (for email notifications)
Sentry DSN (for error tracking)
```

### Environment Variables

```bash
# === Database ===
DATABASE_URL="mysql://user:password@host:3306/emqpgs"

# === Authentication (all require min 32 chars) ===
AUTH_SECRET="<random 32+ chars>"
JWT_ACCESS_SECRET="<random 32+ chars>"
JWT_REFRESH_SECRET="<random 32+ chars>"
CSRF_SECRET="<random 32+ chars>"

# === Application ===
NODE_ENV="production"
PORT=3000
HOSTNAME="0.0.0.0"
AUTH_URL="https://your-domain.com"
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
SESSION_IDLE_TIMEOUT_MINUTES=30

# === MinIO ===
MINIO_ENDPOINT="minio.example.com"
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY="<access-key>"
MINIO_SECRET_KEY="<secret-key>"
MINIO_REGION="us-east-1"
SIGNED_URL_EXPIRY_SECONDS=900

# === Ollama (optional) ===
OLLAMA_BASE_URL="http://ollama.example.com:11434"
OLLAMA_MODEL="llama3.1"

# === Email / SMTP (optional) ===
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="<app-password>"
SMTP_FROM="EMQPGS <noreply@emqpgs.local>"
GOOGLE_CLIENT_ID="<optional-oauth2>"
GOOGLE_CLIENT_SECRET="<optional-oauth2>"
GOOGLE_REFRESH_TOKEN="<optional-oauth2>"

# === Export / Backup ===
EXPORT_RETENTION_DAYS=30
BACKUP_RETENTION_DAYS=30
DEAN_REVIEW_REMINDER_DAYS=3

# === Monitoring ===
HEALTHCHECK_TOKEN="<shared-secret>"
SENTRY_DSN="<optional-sentry-dsn>"
```

### Installation Steps

```bash
# 1. Clone and install
git clone <repo>
cd emqpgs
npm ci

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Set up MySQL database
mysql -u root -p -e "CREATE DATABASE emqpgs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Run migrations
npm run prisma:deploy

# 5. Seed (if needed — creates demo data)
npm run prisma:seed

# 6. Set up MinIO
# Create these buckets manually (or they'll be auto-created on first use):
# question-bank-attachments
# generated-papers
# exports
# audit-files
# system-backups

# 7. Build and start
npm run build
npm run start
```

### Docker Deployment

```bash
# Start infrastructure
docker compose up -d mysql minio minio-init

# Build app image
docker build -t emqpgs:latest .

# Run
docker run -d \
  --name emqpgs \
  --env-file .env \
  -p 3000:3000 \
  emqpgs:latest
```

### Production Checklist

- [ ] All env vars set (especially secrets ≥ 32 chars)
- [ ] MySQL running with utf8mb4 charset
- [ ] MinIO buckets created
- [ ] `AUTH_URL` set to the public-facing URL
- [ ] `NODE_ENV=production`
- [ ] CSRF cookie set to `secure: true`
- [ ] Rate limiting configured (default 120/min is reasonable)
- [ ] Healthcheck token set if using external monitoring
- [ ] Migrations applied with `prisma migrate deploy` (not `dev`)
- [ ] SSL termination configured (reverse proxy or Next.js)
- [ ] Backup cron job configured

---

## 3. Backup Procedures

### Automated Backups (Via App)

The app has a `POST /api/backups` endpoint (COE-only) that:
1. Runs `mysqldump` against the database
2. Uploads the dump to MinIO `system-backups` bucket
3. Creates a `SystemBackup` record
4. Cleans up expired backups (older than `BACKUP_RETENTION_DAYS`)

### Manual Backup (Via Cron)

```bash
#!/bin/bash
# /etc/cron.daily/emqpgs-backup

DATE=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="/tmp/emqpgs-$DATE.sql"
LOG="/var/log/emqpgs-backup.log"

# Dump database
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  -u "$DB_USER" -p"$DB_PASS" \
  -h "$DB_HOST" \
  emqpgs > "$DUMP_FILE" 2>> "$LOG"

# Compress
gzip "$DUMP_FILE"

# Upload to MinIO (using mc client)
mc cp "$DUMP_FILE.gz" "minio/system-backups/"

# Clean up old backups (older than 30 days)
mc rm --recursive --older-than 30d "minio/system-backups/"

# Clean local temp
rm -f "$DUMP_FILE.gz"

echo "Backup completed: $DATE" >> "$LOG"
```

### Restore Procedure

```bash
# 1. Download latest backup from MinIO
mc cp "minio/system-backups/emqpgs-20260618-020000.sql.gz" /tmp/

# 2. Decompress
gunzip /tmp/emqpgs-20260618-020000.sql.gz

# 3. Restore
mysql -u root -p emqpgs < /tmp/emqpgs-20260618-020000.sql

# 4. Verify
npm run prisma:verify-client
# Check that key tables have expected data
mysql -u root -p -e "SELECT COUNT(*) FROM QuestionBank;" emqpgs
```

### Backup Retention Policy

| Type | Retention | Frequency |
|---|---|---|
| App backup (via API) | `BACKUP_RETENTION_DAYS` (default 30) | Manual/Triggered |
| Cron nightly | 30 days | Daily |
| Migration backups (auto by Prisma) | Until next migration | On each `migrate dev` |

---

## 4. Monitoring

### Healthcheck Endpoint

```
GET /api/health
Header: x-health-token: <HEALTHCHECK_TOKEN>
```

Returns:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "minio": "connected",
    "ollama": "connected | unavailable",
    "lastBackup": "2026-06-17T02:00:00.000Z",
    "totalBanks": 72,
    "lockedBanks": 10,
    "uptime": "3d 12h",
    "version": "0.1.0"
  }
}
```

### Key Metrics to Monitor

| Metric | What to Watch | Alert Threshold |
|---|---|---|
| DB connection | Connection pool exhaustion | > 80% of max_connections |
| Response time | API latency | > 2s p95 |
| Error rate | 5xx responses | > 1% of requests |
| Auth failures | Login failures | > 10/min |
| Rate limit hits | Requests blocked | > 100/min |
| Backup age | Last successful backup | > 48 hours |
| MinIO storage | Bucket utilization | > 80% of capacity |
| Unlocked banks | Banks stuck in phase | > 7 days in DRAFTING |
| Pending moderation | Questions unreviewed | > 50 per bank |

### Logging

The app uses a structured logger (`src/lib/logger.ts`). All API requests are logged with:

- `correlationId` (UUID per request)
- `method`, `path`
- `actorId`
- `statusCode`
- `duration` (implicit)

Log levels:
```
error   → Unhandled errors (500), DB errors (Pxxxx)
warn    → Validation errors, auth failures (401/403), business rule violations (409)
info    → API completions, audit events
debug   → Query logging (NODE_ENV=development only)
```

### Sentry Integration (Optional)

Set `SENTRY_DSN` in env. The app will automatically capture unhandled exceptions. No additional configuration needed.

---

## 5. Migration Management

### Safe Migration Workflow

```bash
# Development
npm run prisma:migrate          # Creates migration + applies
                                # Use during development only

# Staging/Production
npm run prisma:generate         # Regenerate client after pulling new code
npm run prisma:deploy           # Apply pending migrations (safe, non-interactive)
```

### Migration Do's and Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Test migrations on staging first | Run `migrate dev` on production |
| Make backward-compatible changes | Drop columns without verifying no code depends on them |
| Add columns as NULLable, then backfill | Add NOT NULL columns without defaults on existing tables |
| Use `prisma migrate deploy` for prod | Edit migration SQL files after they're applied |
| Keep migrations in version control | Squash migrations without testing |
| Document why each migration exists | Create empty/missing migration files |

### Handling a Broken Migration

```bash
# 1. If migration hasn't been applied yet:
prisma migrate reset    # Drops and recreates DB from schema (dev only!)

# 2. If migration was applied and caused issues:
# Roll back the migration SQL manually:
mysql -u root -p
USE emqpgs;
# Reverse the changes (e.g., ALTER TABLE ... ADD COLUMN)
DELETE FROM _prisma_migrations WHERE migration_name = 'migration_name_here';

# 3. Fix the migration file
# Edit the SQL, then re-apply with:
prisma migrate deploy
```

### Current Migration State

| Total | Applied | Pending | Drifted |
|---|---|---|---|
| 11 | 11 | 0 | 1 (Subject.semesterNumber) |

**Drift:** `Subject.semesterNumber` exists in DB but not in schema. Fix in Priority 1.

---

## 6. Recovery Procedures

### Application Crash

```bash
# 1. Check logs
journalctl -u emqpgs -n 100 --no-pager
# or
pm2 logs emqpgs --lines 100

# 2. Common causes and fixes
# Port conflict: change PORT in .env
# DB connection: verify DATABASE_URL is correct
# Missing env var: check all required vars set
# Prisma client mismatch: npm run prisma:generate

# 3. Restart
npm run start
# or
pm2 restart emqpgs
# or
systemctl restart emqpgs
```

### Database Unavailable

```bash
# 1. Check MySQL status
systemctl status mysql

# 2. Check connectivity
mysqladmin ping -h $DB_HOST -u $DB_USER -p$DB_PASS

# 3. Common fixes
# Start MySQL: systemctl start mysql
# Check disk space: df -h
# Check MySQL error log: tail -100 /var/log/mysql/error.log
# Verify credentials in .env
# Check max_connections: SHOW VARIABLES LIKE 'max_connections';
```

### MinIO Unavailable

```bash
# 1. Check MinIO status
systemctl status minio

# 2. Check endpoint
curl -I http://$MINIO_ENDPOINT:$MINIO_PORT/minio/health/live

# 3. Common fixes
# Start MinIO: docker compose start minio
# Check credentials in .env
# Check disk space on storage volume
# Verify buckets exist: mc ls minio
```

### Data Corruption Recovery

```bash
# 1. Identify when corruption occurred
# Check audit logs for unexpected modifications
# Check system backups for the last good state

# 2. Restore from backup
# See §3 Restore Procedure above

# 3. Verify integrity
# Check audit chain integrity (SHA-256 hashes)
# Verify counts: QuestionBank count, User count, etc.
# Spot-check a few question banks end-to-end
```

---

## 7. Operational Procedures

### Adding a New Academic Year

```
1. COE → Academic Years → Create New Year
2. COE → Batches → Update batch graduation years if needed
3. COE → Batch Semesters → Create semesters for the new year
4. COE → Curriculum → Verify subject mappings
5. COE → Exam Cycles → Create cycles for active batch semesters
6. Coordinator → Initialize question banks
7. Coordinator → Assign contributors and moderators
```

### Starting a New Exam Cycle

```
1. COE → Exam Cycles → Create (select batch → semester → exam type)
   → System auto-links curriculum subjects
2. Coordinator → Initialize question banks (one per linked subject)
3. Coordinator → Assign moderators and contributors
4. Contributors → Write and submit questions
5. Moderators → Review and approve/reject
6. Coordinator → Advance phases, trigger AI analysis
7. Coordinator → Approve bank, generate papers
8. Dean → Review and select variants
9. COE → Lock bank, export packets
```

### Onboarding a New Faculty Member

```
1. COE → Users → Create user (set role and department)
2. Coordinator → Assign to relevant question banks (if contributor)
   OR → Assign to departments (if coordinator)
   OR → Assign as moderator to banks (if moderator)
3. User logs in with provided credentials
4. User sees role-appropriate dashboard
```

### Offboarding a Faculty Member

```
1. COE → Users → Disable user
   → User can no longer log in
   → Existing questions remain (ownership transfer available)
2. Coordinator → Transfer question ownership if needed
3. Coordinator → Reassign moderator assignments if needed
```

---

## 8. Security Procedures

### Password Policy

| Policy | Value |
|---|---|
| Minimum length | 8 characters |
| Hashing algorithm | bcrypt, 12 rounds |
| Session idle timeout | 30 minutes |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days |
| Rate limit | 120 requests / 60s window |

### Audit Integrity

The audit log uses SHA-256 chain linking:

```
Entry N: integrityHash = SHA256(
    payload(actorId, action, entityType, entityId, metadata, ...)
    + previousHash from entry N-1
)
```

This means:
- Tampering with an old entry breaks the chain
- Any modification is detectable by recomputing hashes
- Serializable isolation prevents race conditions on chain links

### CSRF Protection

Double-submit cookie pattern:
1. Cookie set on login (via `GET /api/auth/csrf` or login response)
2. Client reads cookie value, sends as `x-csrf-token` header
3. Server verifies cookie === header + HMAC signature
4. Cookie rotates on refresh (24h max age, 1h refresh threshold)
5. Skipped for GET/HEAD/OPTIONS

### JWT Token Blacklist

On logout:
1. Token's `jti` is added to `RevokedToken` table
2. All subsequent requests verify blacklist
3. TTL matches original token expiry (auto-cleanup via `expiresAt`)
4. Blacklist is best-effort — tokens expire naturally if blacklist fails

---

## 9. Common Issues and Resolutions

### Seed fails with "Null constraint violation on `semesterNumber`"

**Root cause:** Schema drift — `Subject.semesterNumber` column exists in DB but not in Prisma schema.

**Fix:** Create migration to drop the column: `ALTER TABLE Subject DROP COLUMN semesterNumber;`

### Paper generation throws "Insufficient approved inventory"

**Root cause:** Paper generator needs at least 1 APPROVED question per (module × marks) combination (18 slots minimum). Banks with fewer approved questions fail.

**Workaround:** Ensure all slots are filled with APPROVED questions. Request contributors to add more questions for underrepresented (module, marks) combinations.

**Long-term fix:** Add fallback mode to paper generator — allow generation with gaps and emit warnings.

### Login returns 401 despite correct credentials

**Checklist:**
1. Is the user ACTIVE? (Check `User.status` in DB)
2. Is the password correct? (Can't verify — hash is one-way)
3. Is `AUTH_SECRET` consistent? (Token signed with one secret, verified with another)
4. Is the JWT clock skewed? (Server time might be off)
5. Are cookies enabled in the browser?

### Backup fails

**Checklist:**
1. Is `mysqldump` installed on the server?
2. Is `MYSQL_PWD` or `.my.cnf` configured for non-interactive access?
3. Is MinIO accessible from the app server?
4. Is there sufficient disk space for the dump file?
5. Check app logs for the specific error

### "Locked question bank cannot be modified" on legitimate operations

**Root cause:** The bank's `recordStatus` is LOCKED. Locking is irreversible by design.

**Check:**
1. Is this bank supposed to be editable? If yes, verify it was locked accidentally.
2. There is no unlock mechanism — this is intentional. Data integrity over convenience.

---

## 10. Capacity Planning

### Current Scale (Seed Data)

| Resource | Count |
|---|---|
| Users | 13 |
| Subjects | 38 |
| Question Banks | ~30 |
| Questions | ~500 |
| File Assets | ~45 (papers + reports) |
| Audit Logs | ~80 |
| Notifications | ~25 |

### Scaling Limits

| Component | Soft Limit | Hard Limit | Upgrade Path |
|---|---|---|---|
| MySQL connections | 10 (app pool) | 151 (default) | Increase `max_connections` |
| Prisma query size | N/A | 4MB (default) | Increase `max_allowed_packet` |
| MinIO storage | N/A | Disk space | Add more storage |
| Next.js memory | 512MB | Available RAM | Increase `NODE_OPTIONS=--max-old-space-size=4096` |
| API rate limit | 120/min | Configurable | Increase in env |
| Concurrent file uploads | MinIO limits | MinIO limits | Add MinIO nodes |

### Projected Growth

At a university with 10 departments × 6 semesters × 5 subjects × 3 exam types × 126 slots:
- ~11,000 question slots per year
- ~11,000 question revisions per year
- ~900 generated papers per year
- ~300 question banks per year
- ~50 users (faculty + admin)
- ~5 GB MinIO storage (papers + assets)

**At year 5:** ~1,500 banks, ~55,000 questions, ~25 GB storage. No architectural changes needed.

---

## 11. Infrastructure-as-Code Reference

### Docker Compose (`docker-compose.yml`)

```yaml
version: "3.8"
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: emqpgs
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  minio-init:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} &&
      mc mb myminio/question-bank-attachments --ignore-existing &&
      mc mb myminio/generated-papers --ignore-existing &&
      mc mb myminio/exports --ignore-existing &&
      mc mb myminio/audit-files --ignore-existing &&
      mc mb myminio/system-backups --ignore-existing
      "

volumes:
  mysql_data:
  minio_data:
```

---

*End of PRODUCTION_RUNBOOK.md*
