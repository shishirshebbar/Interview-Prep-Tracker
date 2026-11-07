# Learning Tracker

A personal SDE-1 interview-preparation tracker built around a practical daily question: **what should I study today?** It prioritizes DSA, balances the weekday 90-minute schedule against the longer weekend window, and carries forward at most one unfinished task instead of stacking missed work.

## Repository assessment

This repository is an established TypeScript monorepo, not an empty project:

- `apps/web`: React 19, Vite, TypeScript, and Vitest
- `apps/api`: Fastify 5 REST API with Zod validation
- `packages/shared`: shared planning and revision domain logic
- `packages/db`: Prisma 6 schema, PostgreSQL migration, and seed
- npm workspaces, Biome, and TypeScript build/type-check scripts

The database schema already contains the broader product model (projects, resume, analytics, notifications, and AI interactions). The current application is a working single-user MVP for the dashboard, roadmap, daily plan, problems, and revisions. Email delivery, recurring jobs, AI endpoints, project/resume editing, mock assessments, interview sessions, and analytics charts are not yet implemented; their schema/configuration fields alone do not enable those features.

## Features

- **Adaptive deterministic planner:** DSA-first weekday/weekend task allocations, due revision reminders, exact seeded DSA problem suggestions, and bounded carry-over of one unfinished task (up to 10 minutes).
- **Non-binary task tracking:** mark a block completed, partially completed, or skipped and record study minutes.
- **Roadmap:** view topic status, completion, estimated hours, priority, and study notes.
- **Problem tracker:** filter by topic/status, update problem status, record successful attempts, and enter a confidence score.
- **Spaced revision:** confidence maps to the configurable `[1, 3, 7, 14, 30]`-day intervals by default; due items can be marked reviewed.
- **Dashboard:** progress by area, streak, study minutes, problems solved, topic count, and due revisions.
- **Current-date seed:** database seed dates and the default one-month preparation window are relative to the day the seed command runs.

## Architecture

```text
React/Vite web app ── REST/JSON ── Fastify API ── Prisma ── PostgreSQL
                                       │
                                shared domain logic
```

The API is the only layer that accesses Prisma. The planner and revision interval calculation live in `packages/shared` so they can be tested independently. The current single-user repository selects the earliest-created user; authentication and multi-user scoping are not implemented.

## Data model

The Prisma schema is normalized around `User` and `UserSettings`, `StudyTopic` and `TopicProgress`, `Problem` and `ProblemAttempt`, `Revision`, `DailyPlan` and `DailyTask`, and supporting `StudySession`, `Project`, `ResumeProfile`/`ResumeItem`, `Goal`, `AnalyticsSnapshot`, `Notification`/`EmailLog`, and `AIInteraction` entities. Relations and indexes are defined in [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma); the initial migration is under [`packages/db/prisma/migrations`](./packages/db/prisma/migrations).

## API

All routes are prefixed with `/api`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/meta` | Schedule and seed metadata |
| GET | `/dashboard` | Dashboard metrics |
| GET | `/topics` | Roadmap topics and progress |
| GET | `/problems` | Problems; filters: `topic`, `status`, `difficulty`, `platform` |
| PATCH | `/problems/:id/status` | Update a problem status |
| POST | `/problems/:id/attempt` | Record an attempt and confidence-based revision |
| GET | `/daily-plan?date=YYYY-MM-DD` | Get or generate a date's plan |
| POST | `/daily-plan/generate` | Idempotently get or generate a plan; optional `{ "date": "YYYY-MM-DD" }` |
| PATCH | `/daily-plan/tasks/:id` | Record task status and optional actual minutes |
| GET | `/revisions/due?date=YYYY-MM-DD` | List pending revisions due by the date |
| PATCH | `/revisions/:id/complete` | Mark a revision reviewed |

Dates use the configured `TIMEZONE` when the API chooses the current date; persisted plan dates are keyed by calendar day. Invalid route input is validated with Zod.

## Local setup

Requirements: Node.js 20+, npm, and PostgreSQL.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to your PostgreSQL database, for example:

   ```text
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/learning_tracker?schema=public
   ```

   Replace the placeholders locally; do not commit `.env`.

3. Generate the Prisma client, create/apply the development migration, and seed the database:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   **Warning:** `npm run db:seed` clears existing tracker rows before inserting the sample profile. Use it only for a disposable development database.

4. Start the API and web app in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev:web
   ```

   The API defaults to `http://localhost:4000`; Vite defaults to `http://localhost:5173`. Set `VITE_API_BASE_URL` if the API runs elsewhere.

## Environment variables

| Variable | Purpose | Default / status |
|---|---|---|
| `NODE_ENV` | API mode | `development` |
| `API_PORT` / `WEB_PORT` | Local service ports | `4000` / `5173` |
| `VITE_API_BASE_URL` | Browser API origin | `http://localhost:4000` |
| `DATABASE_URL` | PostgreSQL connection string | Required for database operations |
| `TIMEZONE` | Current-day calculation | `Asia/Kolkata` |
| `DEFAULT_WEEKDAY_START` | Weekday start time | `22:15` |
| `DEFAULT_WEEKDAY_STUDY_MINUTES` | Weekday capacity | `90` |
| `DEFAULT_WEEKEND_STUDY_MINUTES` | Weekend capacity | `480` |
| `DEFAULT_TARGET_ROLE` | New-profile target | `SDE-1` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Reserved for planned server-side AI integration | No AI service is currently wired |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_TO` | Reserved for planned SMTP integration | No email service or scheduler is currently wired |
| `EMAIL_REMINDER_CRON`, `WEEKLY_EMAIL_CRON` | Planned reminder schedules | No worker currently consumes them |

Never put provider credentials in `VITE_*` variables or frontend source.

## Development and validation

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run db:validate
```

The test suite includes unit tests for planning allocation, carry-over, timezone date calculation, and revision intervals, plus API and UI tests. API tests use an in-memory repository fixture and do not require a running PostgreSQL instance.

## Deployment notes

Deploy the Vite frontend as static assets and the Fastify API as a Node.js service. Provision PostgreSQL separately, configure the production `DATABASE_URL`, and run `prisma migrate deploy` against the production schema before starting the API. Configure the web API origin with `VITE_API_BASE_URL` at build time. The current project has no production authentication, worker/scheduler, email delivery, or AI provider integration; do not expose a shared personal deployment as a multi-user service until those are implemented.

## Security and known limitations

- Provider secrets are server-side environment variables and are not read by the web bundle.
- The app is currently single-user and has no authentication; the CORS policy and deployment posture should be tightened before public hosting.
- Email and AI variables in `.env.example` are placeholders, not evidence of working integrations.
- The seed command is destructive and intended only for a fresh local database.
- Adaptive rescheduling is deterministic and intentionally bounded; it does not yet analyze study history or interview dates with an AI provider.

See [`docs/architecture.md`](./docs/architecture.md) for implementation boundaries and extension points.
