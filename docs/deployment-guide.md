# Deployment Guide

## Development

1. Copy `.env.example` to `.env`
2. Run `docker compose up -d mysql redis minio minio-init`
3. Run `npm ci`
4. Run `npx prisma generate`
5. Run `npm run prisma:migrate`
6. Run `npm run prisma:seed`
7. Run `npm run dev`
8. Run `npm run worker` in a second terminal

## Staging

1. Build the container image from `Dockerfile`
2. Push with `.github/workflows/deploy.yml`
3. Provide staging secrets for database, Redis, MinIO, and Auth
4. Start `app` and `worker` services from `docker-compose.yml`
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
2. Use managed MySQL, Redis, and object storage where available
3. Run at least one web replica and one worker replica
4. Ensure Ollama is reachable if AI analysis is enabled
5. Confirm nightly backup worker registration
6. Confirm retention cleanup worker registration
7. Monitor `/api/monitoring` and queue depth after release
