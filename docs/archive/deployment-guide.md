# Deployment Guide

## Development

1. Copy `.env` and adjust values for your environment (no `.env.example` exists — the committed `.env` is the reference)
2. Run `docker compose up -d mysql minio minio-init`
3. Run `npm ci` (postinstall runs Prisma generate + verify)
4. Run `npm run prisma:migrate`
5. Run `npm run prisma:seed`
6. Run `npm run dev`

## Staging

1. Build the container image from `Dockerfile`
2. Push with `.github/workflows/deploy.yml`
3. Provide staging secrets for database, MinIO, and Auth
4. Start the `app` service from `docker-compose.yml`
5. Run `npm run prisma:deploy`
6. Verify:
   - `GET /api/health`
   - `GET /api/monitoring`
   - MinIO bucket provisioning

## Production

1. Set strong values for:
   - `AUTH_SECRET`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CSRF_SECRET`
   - `HEALTHCHECK_TOKEN`
2. Set `AUTH_URL` to the application's canonical URL (used for CSRF origin verification — must match what the browser sees)
3. Use managed MySQL and object storage where available
4. Run at least one web replica
5. Ensure `mysqldump` is available in the runtime environment for backups (Docker image includes `mysql-client`)
6. Ensure Ollama is reachable if AI analysis is enabled
7. Trigger and verify backups from the application
8. Monitor `/api/monitoring` and workflow activity after release

### Notes

- There is no `.env.example` file in the repository; the committed `.env` is the only env file. Copy it and adjust secrets for production.
- `CSRF_SECRET` falls back to `AUTH_SECRET` if unset (dev convenience only — always set explicitly in production).
