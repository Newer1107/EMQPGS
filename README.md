# EMQPGS Phase 1

Phase 1 establishes the platform foundation for the Examination Management & Question Paper Generation System.

## Included

- Next.js App Router with TypeScript and Tailwind
- Clean Architecture-inspired feature modules
- Prisma schema for MySQL 8
- Redis-ready infrastructure
- Auth.js support plus JWT access and refresh token flows
- RBAC-aware API handlers and middleware
- Audit logging
- MinIO presigned upload support
- Role-specific dashboards for COE, Coordinator, Moderator, Contributor, and Dean

## Quick Start

1. Copy `.env.example` to `.env`
2. Start infrastructure with `docker compose up -d mysql redis minio minio-init`
3. Generate Prisma client with `npm run prisma:generate`
4. Create migrations with `npm run prisma:migrate`
5. Seed data with `npm run prisma:seed`
6. Start the app with `npm run dev`

Seed login:

- `coe@emqpgs.local`
- `Password@123`

## Buckets

- `question-bank-attachments`
- `signed-reports`
- `generated-papers`
- `exports`
- `audit-files`

## RBAC Summary

- `COE`: users, departments, exam cycles, audit oversight
- `Coordinator`: subjects, question banks, assignments
- `Moderator`: moderation workflow visibility
- `Contributor`: contribution workflow visibility
- `Dean`: approval and reporting visibility
