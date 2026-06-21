# EMQPGS — Examination Management & Question Paper Generation System

A full-stack web application for managing the complete lifecycle of academic examination question papers — from subject setup and question contribution through moderation, AI analysis, paper generation, dean review, and export.

**Stack:** Next.js 16 (App Router) · Prisma ORM · MySQL 8 · MinIO object storage · Auth.js v5 + Custom JWT · Ollama (optional)

---

## Features

- **Responsibility-based authorization**: Dynamic responsibility assignments replace static roles. A single user can hold multiple responsibilities (Coordinator, Moderator, Contributor) simultaneously with different scopes.
- **Annual question banks**: One bank per (Batch Semester, Subject) — reused across ISE-1, ISE-2, ENDSEM
- **Automatic initialization**: Banks auto-created when a batch semester is activated
- **Four-phase question bank lifecycle**: DRAFTING → MODERATION → APPROVAL → COMPLETE
- **126-slot template**: 6 modules × 3 marks × 7 slots — questions are a repository, not consumed by paper generation
- **Module-aware paper generation**: ISE-1 uses modules 1-3, ISE-2 uses modules 4-6, ENDSEM uses modules 1-6
- **QuestionUsageHistory**: Tracks which questions were used across which exam cycles — prevents reuse
- **AI-powered analysis**: Optional Ollama integration for bank coverage, RBT level distribution, and quality scoring
- **Automated paper generation**: Balanced paper variants (A, B, C) with coverage, difficulty, and duplicate risk scoring
- **Dean review workspace**: Side-by-side paper comparison with variant selection
- **Export pipeline**: PDF/DOCX/ZIP packet generation with MinIO storage
- **Audit trail**: SHA-256 hash-chained immutable audit logs
- **Responsibility-gated APIs**: Every endpoint authorized via centralized AuthorizationService

---

## Authorization Model

EMQPGS uses a **responsibility-based authorization** model. A User is simply a person — their access is determined by dynamic `ResponsibilityAssignment` records.

```
User (Identity)
    ↓
ResponsibilityAssignment[]
    ↓
Workspace (active assignment context)
    ↓
AuthorizationService (permission checks)
```

### Responsibilities

| Type | Scope | Description |
|------|-------|-------------|
| COE | Institution | System administration |
| DEAN | Institution | Final paper review |
| COORDINATOR | Department | Academic management |
| MODERATOR | Question Bank | Quality assurance |
| CONTRIBUTOR | Question Bank | Question creation |

A single user can hold multiple responsibilities simultaneously (e.g., Coordinator in Computer Engineering AND Moderator for a specific question bank). The workspace selector lets users switch between their active responsibilities without logging out.

---

## Question Bank Lifecycle

```mermaid
flowchart LR
    A[DRAFTING] -->|Coordinator sends| B[MODERATION]
    B -->|All questions moderated| C[APPROVAL]
    C -->|Coordinator approves| D[COMPLETE]
    C -->|Coordinator rejects| B
    D -->|Dean reviews| E[EXPORTED]
```

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Frontend["Next.js 16 App Router"]
        Pages["Dashboard Pages<br/>(COE, Coordinator,<br/>Contributor, Moderator, Dean)"]
        Components["Shared Components<br/>(MetricTile, SlotMatrix,<br/>EmptyState, LoadingSkeleton)"]
        Forms["Form Components<br/>(QuestionForm, SubjectForm,<br/>BankActionsPanel)"]
    end

    subgraph Backend["Next.js API Routes"]
        API["70+ Endpoints<br/>withApiHandler<br/>Role + CSRF + RateLimit"]
        Services["Service Layer<br/>(28 Modules)"]
        Repos["Repository Layer<br/>(Prisma Wrappers)"]
    end

    subgraph Storage["Data Layer"]
        MySQL[("MySQL 8<br/>Prisma ORM")]
        MinIO[("MinIO Object Store<br/>5 Buckets")]
    end

    subgraph AI["AI Layer (Optional)"]
        Ollama["Ollama<br/>(llama3.1)"]
    end

    Frontend --> API
    API --> Services
    Services --> Repos
    Repos --> MySQL
    API --> MinIO
    Services --> AI
```

---

## Database Domain Relationships

```mermaid
erDiagram
    Department ||--o{ CurriculumScheme : defines
    CurriculumScheme ||--o{ CurriculumSubject : maps
    CurriculumSubject }o--|| Subject : places
    Subject ||--o{ QuestionBank : contains
    Subject ||--o{ SubjectVersion : versions
    SubjectVersion ||--o{ QuestionLibraryItem : library
    QuestionBank ||--o{ QuestionSlot : slots
    QuestionSlot ||--o| QuestionLibraryItem : assigned
    User ||--o{ ResponsibilityAssignment : responsibilities
    QuestionBank ||--o{ GeneratedPaper : papers
    QuestionBank ||--o{ DeanReview : review
    QuestionBank ||--o{ ApprovalDecision : decision
    Department ||--o{ Batch : cohorts
    Batch ||--o{ BatchSemester : semesters
    BatchSemester ||--o{ QuestionBank : owns
    BatchSemester ||--o{ ExamCycle : schedules
    ExamCycle ||--o{ SubjectExamCycleLink : links
```

---

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant Login
    participant DB
    participant AWS as ActiveWorkspaceService
    participant AuthZ as AuthorizationService

    User->>Login: Login (email + password)
    Login->>DB: Verify credentials (bcrypt)
    DB-->>Login: User
    Login->>DB: Load ResponsibilityAssignments
    DB-->>Login: []
    Login-->>User: tokens (identity only)

    Note over User,AuthZ: Dashboard resolution

    User->>AWS: GET /dashboard
    AWS->>DB: Read active workspace cookie
    DB-->>AWS: assignmentId or null
    alt No active workspace, 1 responsibility
        AWS->>AWS: Auto-activate (set cookie)
        AWS-->>User: Redirect to dashboard
    else No active workspace, 2+ responsibilities
        AWS-->>User: Workspace picker
        User->>AWS: POST /api/auth/workspace
        AWS->>DB: Validate assignment
        AWS->>AWS: Set active workspace cookie
        AWS-->>User: Redirect to dashboard
    else Active workspace cookie exists
        AWS->>DB: Validate still active
        DB-->>AWS: assignment
        AWS-->>User: Redirect to dashboard
    end

    Note over User,AuthZ: Subsequent requests

    User->>AuthZ: API request
    AuthZ->>AuthZ: Verify JWT
    AuthZ->>AuthZ: Read active workspace cookie
    AuthZ->>AuthZ: Check responsibility + scope
    AuthZ-->>User: Authorized response
```

### Workspace Flow

```
Login → POST /api/auth/login
  ↓
Load ResponsibilityAssignments
  ↓
0 → /no-access
1 → auto-activate (set HttpOnly cookie) → /dashboard/{type}
2+ → /workspace-select
  ↓
User picks → POST /api/auth/workspace { assignmentId }
  ↓
Server validates ownership + activity
  ↓
Sets emqpgs_active_ws cookie (HttpOnly, signed path)
  ↓
Redirects to /dashboard/{type}
  ↓
AppShell reads cookie server-side → renders correct nav
```

Workspace switching follows the same POST flow — no URL parameters, no localStorage, no JWT refresh required.

The server is always authoritative. The active workspace is persisted in an HttpOnly cookie, validated on every request. Switching workspaces is a single POST call.
```

---

## Question Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create
    DRAFT --> PENDING: Submit
    PENDING --> APPROVED: Moderator approves
    PENDING --> REJECTED: Moderator rejects
    PENDING --> REVISION_REQUESTED: Moderator requests revision
    REVISION_REQUESTED --> REVISION_SUBMITTED: Resubmit
    REVISION_SUBMITTED --> APPROVED: Moderator approves
    REVISION_SUBMITTED --> REJECTED: Moderator rejects
    REVISION_SUBMITTED --> REVISION_REQUESTED: Another revision
    APPROVED --> REVISION_REQUESTED: Coordinator edits (auto-revert)
    DRAFT --> DRAFT: Edit
    REVISION_REQUESTED --> REVISION_REQUESTED: Edit
```

---

## Paper Generation Workflow

```mermaid
flowchart LR
    A[Coordinator selects questions] --> B[AI analysis runs]
    B --> C[Deterministic report built]
    C --> D{Ollama available?}
    D -->|Yes| E[AI overlay added]
    D -->|No| F[Deterministic only]
    E --> G[Paper generated (A, B, C)]
    F --> G
    G --> H[PDF stored in MinIO]
    H --> I[Dean reviews variants]
    I --> J[Papers assigned: Regular, Supp, KT]
    J --> K[COE exports packets]
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| ORM | Prisma 6 |
| Database | MySQL 8 |
| Auth | NextAuth v5 + Custom JWT (jose) |
| Object Storage | MinIO (AWS S3 compatible) |
| AI (Optional) | Ollama (llama3.1) |
| PDF Generation | pdf-lib |
| DOCX Generation | docx |
| UI | Tailwind CSS 4 + shadcn/ui |
| Icons | Lucide React |
| Testing | Vitest |
| Validation | Zod 4 |

---

## Demo Credentials

All passwords: `Password@123`

| Email | Responsibility | Scope |
|---|---|---|
| `coe@emqpgs.local` | COE | Institution |
| `dean@emqpgs.local` | DEAN | Institution |
| `coordinator.comp@emqpgs.local` | COORDINATOR | COMP Department |
| `coordinator.extc@emqpgs.local` | COORDINATOR | EXTC Department |
| `coordinator.hns@emqpgs.local` | COORDINATOR | HNS Department |
| `moderator.comp1@emqpgs.local` | — | (assigned to banks at runtime) |
| `contributor1.comp@emqpgs.local` | — | (assigned to banks at runtime) |

---

## Quick Start

### Prerequisites

- Node.js 24+
- Docker (for MySQL + MinIO)
- npm

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/emqpgs.git
cd emqpgs
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your secrets (see .env.example for guidance)

# Start infrastructure
docker compose up -d mysql minio minio-init

# Run migrations and seed
npm run prisma:migrate
npm run prisma:seed

# Start development server
npm run dev
```

Open `http://localhost:3000`. Login with any demo credential above.

### Docker Deployment

```bash
# Full stack (app + MySQL + MinIO)
docker compose up -d --build

# Run migrations
docker compose exec app npm run prisma:deploy

# Seed data
docker compose exec app npm run prisma:seed
```

---

## Project Structure

```
emqpgs/
├── app/
│   ├── api/                 # 70+ API route files
│   ├── login/               # Authentication pages
│   └── (protected)/
│       └── dashboard/
│           ├── coe/          # COE dashboard (21 pages)
│           ├── coordinator/  # Coordinator dashboard (9 pages)
│           ├── contributor/  # Contributor workflow (4 pages)
│           ├── moderator/    # Moderator dashboard (7 pages)
│           └── dean/         # Dean dashboard (6 pages)
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── forms/           # Business form components
│   │   ├── layout/          # App shell, sidebar, navigation
│   │   ├── dashboard/       # Dashboard-specific components
│   │   └── workspace/       # Workspace picker, switcher
│   ├── lib/
│   │   ├── auth/            # Authorization layer
│   │   │   ├── responsibility-resolver.ts
│   │   │   ├── workspace-resolver.ts
│   │   │   └── authorization-service.ts
│   │   ├── api-context.ts   # Request context (no role)
│   │   ├── api-handler.ts   # Centralized auth gate
│   │   └── types.ts         # Actor, AuthContext types
│   └── modules/             # 28 service modules
├── prisma/
│   ├── schema.prisma        # ResponsibilityAssignment model
│   ├── migrations/
│   └── seed.ts              # Responsibility-based seed data
├── tests/
│   ├── unit/                # 19 test files, 126 tests
│   └── e2e-validation.mjs   # API-level workflow validation
├── docs/
│   ├── architecture.md      # Domain model, responsibilities
│   ├── workflow.md          # Phase transitions, state machines
│   ├── database.md          # All models, relationships, enums
│   ├── api.md               # API reference
│   ├── deployment.md        # Environment, production setup
│   ├── developer-guide.md   # Onboarding, patterns, debugging
│   └── glossary.md          # Domain terminology
└── docker-compose.yml       # MySQL 8 + MinIO + App
```

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Production start |
| `npm run test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Apply pending migrations (dev) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:seed` | Seed demo data |

---

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E validation (requires running server)
node tests/e2e-validation.mjs
```

---

## Security

- **Password hashing**: bcrypt with cost factor 12
- **JWT**: HMAC-SHA256 with separate secrets for access and refresh tokens (no role in payload)
- **CSRF**: Double-submit cookie pattern (HMAC-signed tokens)
- **Rate limiting**: Per-IP, per-endpoint (configurable window)
- **Audit trail**: SHA-256 hash-chained immutable log entries
- **Authorization**: Centralized `AuthorizationService` — responsibility-gated via `withApiHandler`
- **Workspace isolation**: Client sends only `assignmentId`; server validates ownership, activity, and scope
- **Input validation**: Zod schemas on all mutation endpoints
- **Department isolation**: ResponsibilityAssignment scopes define access (homeDepartment is informational only)
- **Session management**: Idle timeout, refresh token rotation, blacklist

---

## Future Roadmap

- Async paper generation pipeline
- ContributorBankAssignment UI for coordinator bulk assignment
- Cross-paper comparison in dean review workspace
- Moderator queue prioritization with urgency indicators
- COE institutional readiness dashboard (phase distribution, stalled detection)
- Redis-backed rate limiting for multi-process deployments
- Gradual question bank locking and archival workflow

---


