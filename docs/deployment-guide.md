# Deployment Guide

## Development

1. Copy `.env.example` to `.env`
2. Run `docker compose up -d mysql minio minio-init`
3. Run `npm ci`
4. Run `npx prisma generate`
5. Run `npm run prisma:migrate`
6. Run `npm run prisma:seed`
7. Run `npm run dev`

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
2. Use managed MySQL and object storage where available
3. Run at least one web replica
4. Ensure Ollama is reachable if AI analysis is enabled
5. Trigger and verify backups from the application
6. Monitor `/api/monitoring` and workflow activity after release
