# Architecture Notes

## Why This Stack

The workspace started empty, so the stack was chosen to satisfy these constraints:

- fast to iterate locally
- strong TypeScript support across client and server
- straightforward future integration with PostgreSQL, OpenAI, and SMTP
- enough structure for a serious portfolio project without forcing an overengineered enterprise setup on day one

## Monorepo Layout

### `apps/web`

Responsibilities:

- dashboard experience
- roadmap and plan views
- problem tracker UI
- analytics and settings UI
- future interview and mock assessment flows

### `apps/api`

Responsibilities:

- study planning and rescheduling logic
- validation and business rules
- AI orchestration
- email orchestration
- persistence-facing application services
- future auth and rate limiting

### `packages/shared`

Responsibilities:

- shared TypeScript domain types
- topic priority definitions
- initial planning defaults
- seedable study metadata

## Planned Data Model

The normalized schema will be built around these aggregates:

- `User`, `UserSettings`, `Goal`
- `StudyTopic`, `SubTopic`, `TopicProgress`
- `Problem`, `ProblemAttempt`, `Revision`
- `DailyPlan`, `DailyTask`, `StudySession`
- `Project`, `ResumeProfile`, `ResumeItem`
- `Notification`, `EmailLog`, `AIInteraction`

## API Direction

The API will stay REST-oriented for now:

- simple frontend consumption
- easy testability
- clean mapping to scheduled jobs and future mobile clients

Example route groups:

- `/api/dashboard`
- `/api/topics`
- `/api/problems`
- `/api/plans`
- `/api/revisions`
- `/api/projects`
- `/api/interviews`
- `/api/analytics`
- `/api/ai`
- `/api/email`

## Adaptive Planning Principles

The most important non-functional rule is product behavior:

- missed work rolls forward intelligently
- the system does not shame the user
- DSA remains the highest-priority bucket
- remaining time and dependency order matter
- weak areas get surfaced without collapsing the whole schedule

Phase 5 will formalize this as deterministic planning heuristics first, then AI-assisted recommendation overlays later.
