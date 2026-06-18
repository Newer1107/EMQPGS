# EMQPGS — Examination Management & Question Paper Generation System

A full-stack web application for managing the complete lifecycle of academic examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL 8 · MinIO object storage · Auth.js v5 credentials + custom JWT · Ollama (optional)

---

## Quick Start

```bash
docker compose up -d mysql minio minio-init
npm ci
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`. Login with `coe@emqpgs.local` / `Password@123`.

---

## What This System Does

EMQPGS follows a 4-phase question bank workflow:

1. **DRAFTING** — Contributors create questions and assign them to bank slots
2. **MODERATION** — Moderators review and approve/reject questions
3. **APPROVAL** — AI analysis runs, papers are generated, coordinator makes final decision
4. **COMPLETE** — Dean reviews variants, COE exports packets, cycle closes

Five roles control access: **COE** (system admin), **COORDINATOR** (academic manager), **CONTRIBUTOR** (question author), **MODERATOR** (quality reviewer), **DEAN** (final reviewer).

---

## Five-Minute Overview

### Core concepts

- **QuestionLibraryItem** — A standalone, reusable question. Belongs to a `SubjectVersion`. Can be in multiple banks simultaneously.
- **QuestionSlot** — The **sole** linkage between a bank and a question. Each slot is a position defined by `(moduleNumber, marks, slotNumber)`. No join table exists.
- **QuestionBank** — Container per `(Subject, ExamCycle)` pair. Has two orthogonal state axes: phase (DRAFTING → MODERATION → APPROVAL → COMPLETE) and record status (ACTIVE / LOCKED).
- **ReadinessEngine** — Reports whether a bank meets requirements to advance. Does **not** auto-advance — the coordinator always advances manually.
- **ApprovalDecision** — Write-once record. Created when coordinator approves (→COMPLETE) or rejects (→MODERATION loopback).

### Key invariants

- One bank per (subject, exam cycle)
- One slot position per bank — `@@unique([questionBankId, moduleNumber, marks, slotNumber])`
- LOCKED banks reject all mutations
- ApprovalDecision is immutable after creation
- MinIO buckets: exactly 5

### Seed users

All passwords: `Password@123`

| Email | Role | Department |
|---|---|---|
| `coe@emqpgs.local` | COE | — |
| `coordinator.aids@emqpgs.local` | COORDINATOR | AIDS |
| `moderator.aids@emqpgs.local` | MODERATOR | AIDS |
| `contributor{1,2,3}.aids@emqpgs.local` | CONTRIBUTOR | AIDS |
| `dean@emqpgs.local` | DEAN | — |

27 active exam cycles (ENDSEM, 2026-2027, 9 departments × 3 semesters). Nine departments: AIDS, AIML, COMP, CSEC, CIVL, ENCS, INFO, IOT, MME.

---

## Documentation

| Document | What it covers |
|---|---|
| **`docs/architecture.md`** | Domain model, RBAC matrix, core concepts, invariants, limitations |
| **`docs/workflow.md`** | Phase transitions, ReadinessEngine, locking, approval, paper generation, full walkthrough |
| **`docs/database.md`** | All 36 models, 28 enums, relationships, invariants |
| **`docs/api.md`** | All 70 route files with request/response shapes, permissions, error codes |
| **`docs/developer-guide.md`** | Onboarding, module patterns, common workflows, testing, debugging |
| **`docs/deployment.md`** | Environment variables, setup, production deployment, monitoring |
| **`docs/glossary.md`** | Domain terms and concepts |

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (auto-generates Prisma client) |
| `npm run build` | Production build |
| `npm run start` | Production start |
| `npm run test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Apply pending migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:seed` | Seed demo data |
