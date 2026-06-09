# Architecture Overview

## Layers

- `app/`: App Router UI and route handlers
- `src/modules/*`: feature-based repositories, validation, and services
- `src/lib/*`: cross-cutting concerns like auth, audit, storage, DB, Redis, and error handling
- `prisma/`: schema and seed data

## Patterns

- Clean Architecture-inspired separation between transport, business logic, and persistence
- Repository pattern for Prisma access
- Service layer for orchestration
- DTO validation through Zod
- RBAC checks through `withApiHandler` and `proxy.ts`
- Audit logging through `logAudit`
- Global API error handling through `withApiHandler`

## Phase 1 Scope

- Administrative setup and identity management
- Department, cycle, subject, and question-bank scaffolding
- Assignment orchestration with notifications
- MinIO-only upload preparation using presigned URLs
