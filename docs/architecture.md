# Architecture

## Current stack

The project is an npm-workspace TypeScript monorepo. The frontend is React/Vite, the backend is Fastify with Zod request validation, domain helpers are in `packages/shared`, and PostgreSQL persistence is provided through Prisma in `packages/db`.

```text
apps/web (React) -> /api REST (Fastify) -> TrackerRepository -> Prisma -> PostgreSQL
                                       -> @tracker/shared planning/revision logic
```

`TrackerRepository` is the persistence boundary used by API routes. The production implementation in `apps/api/src/lib/repository.ts` uses Prisma; API tests inject an in-memory implementation. This keeps domain-route tests independent of a running database.

## Implemented product behavior

- The planner builds a daily schedule from the user's weekday/weekend availability, topic progress, open problem list, and due revisions.
- DSA receives the largest allocation. Completed topics are excluded from topic selection; critical/high-priority unfinished areas are chosen first.
- Study blocks fit within available minutes and are split into at-most-60-minute sessions.
- A new plan may carry forward one unfinished task from the most recent plan within seven days. The carry-over is capped at ten minutes; the remaining old tasks do not accumulate.
- Task outcomes distinguish `COMPLETED`, `PARTIALLY_COMPLETED`, and `SKIPPED`; actual study time and completion metrics are persisted.
- Problem-attempt confidence selects a configured revision interval. Recording a new confidence score supersedes older pending revisions for that problem.
- Calendar-day calculation uses `TIMEZONE` for the default single-user profile. Plan dates are stored as UTC calendar-day keys, rather than server-local timestamps.

The planner is deterministic. It does not claim to learn completion rates, detect weakness from long-term history, or automatically change the roadmap based on interviews. Those require additional product logic and persisted measurements.

## Data model

The schema separates:

- identity and preferences: `User`, `UserSettings`, `Goal`
- roadmap: `StudyTopic`, `TopicProgress`
- practice: `Problem`, `ProblemAttempt`, `Revision`
- planning: `DailyPlan`, `DailyTask`, `StudySession`
- interview material: `Project`, `ResumeProfile`, `ResumeItem`
- future integrations/metrics: `AnalyticsSnapshot`, `Notification`, `EmailLog`, `AIInteraction`

The initial PostgreSQL migration is maintained alongside `packages/db/prisma/schema.prisma`. Seed dates are relative to the day the seed command runs. Seeding deletes existing tracker data and must only be used with a disposable database.

## API conventions

- REST routes return JSON and use `/api` prefixes.
- Zod validates query parameters and request bodies before repository calls.
- The personal MVP selects the earliest-created user; it is not suitable for untrusted multi-user access without authentication and authorization.
- Database/provider errors should propagate to Fastify's error handler rather than being converted to success-shaped responses.

Current route groups cover health/meta, dashboard, topics, problems/attempts, daily plans/tasks, and due revisions. AI, email, project/resume editing, analytics, mock assessments, and interview-mode routes remain future work; schema fields and environment placeholders are not integrations.

## Security and deployment boundaries

- Provider keys must remain in server-side environment variables and must never use `VITE_` names.
- The current API has no authentication and permissive development CORS. Restrict CORS and add authentication/authorization before exposing it publicly.
- There is no background worker yet. Email cron environment variables are placeholders and are not consumed.
- Production deployment requires PostgreSQL migrations via `prisma migrate deploy` before serving API traffic.
