# Learning Tracker

Production-oriented SDE-1 interview preparation tracker built as a full-stack TypeScript monorepo. The product is designed around one core job: telling you what to study today, adapting when life interrupts the plan, and keeping DSA as the top priority without turning missed days into impossible workloads.

## Current Repository Assessment

The repository was empty when implementation began:

- no existing frontend or backend
- no package manager lockfile
- no database configuration
- no environment setup
- no Git repository metadata

That means the current implementation establishes the Phase 1 foundation and intentionally chooses a stack that supports the later AI, email, analytics, and scheduling requirements without overcomplicating the MVP.

## Proposed Architecture

The project uses an `npm` workspace monorepo with clear separation of concerns:

- `apps/web`: React + Vite dashboard application
- `apps/api`: Fastify API for domain logic, planning, AI orchestration, email orchestration, and future schedulers
- `packages/shared`: shared types, constants, seed summaries, and planning primitives

Planned phase extensions:

- `packages/db`: Prisma schema, migrations, seed scripts
- `apps/worker` or scheduler module: recurring email jobs and weekly summaries
- AI service layer behind provider abstractions and structured prompt contracts

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Fastify, TypeScript, Zod
- Tooling: npm workspaces, Biome, Vitest
- Planned database: PostgreSQL + Prisma
- Planned AI integration: OpenAI server-side via service abstraction
- Planned email delivery: SMTP via replaceable email service adapter

## Folder Structure

```text
.
|-- apps
|   |-- api
|   `-- web
|-- docs
|   `-- architecture.md
|-- packages
|   |-- db
|   `-- shared
|-- .env.example
|-- biome.json
|-- package.json
`-- tsconfig.base.json
```

## Database Direction

Phase 2 will add a normalized PostgreSQL schema covering:

- users and settings
- study topics and subtopics
- daily plans and tasks
- problems, attempts, revisions, and confidence tracking
- projects and resume preparation
- analytics and email logs
- AI interactions and notification history

The design goal is single-user MVP simplicity with clean multi-user evolution later.

## Phase Plan

1. Repository inspection and architecture
2. Database schema, migrations, and seed data
3. Backend APIs and study tracking
4. Frontend dashboard and roadmap UI
5. Adaptive daily planner and rescheduling logic
6. Email reminder service and scheduler
7. AI service integration
8. Analytics
9. Testing hardening, security polish, and deployment documentation

## Implemented In Phase 1

- monorepo scaffold
- root tooling and scripts
- shared domain models and initial seed summary
- Fastify API with health and meta endpoints
- React dashboard shell focused on "What do I study today?"
- environment variable template
- architecture documentation

## Implemented In Phase 2

- Prisma/PostgreSQL database package in `packages/db`
- normalized schema for users, settings, roadmap topics, problems, revisions, plans, projects, resume, analytics, notifications, and AI interactions
- initial SQL migration
- deterministic seed data based on the current preparation state
- database workspace scripts for generate, validate, and seed

## Local Setup

```bash
cmd /c npm install
cmd /c npm run dev:web
cmd /c npm run dev:api
```

For validation:

```bash
cmd /c npm run lint
cmd /c npm run db:validate
cmd /c npm run db:generate
cmd /c npm run test
cmd /c npm run build
```

## Next Steps

Phase 3 will connect the API to Prisma and expose the first real study-tracking endpoints on top of the seeded schema.
