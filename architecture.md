# Post-Offer Engagement HRMS Architecture

## 1. Project Overview

This project is a full-stack HR application for managing candidates between offer acceptance and joining.

The platform is designed to help recruiters:

- Track offered candidates and their post-offer engagement.
- Monitor completed and pending engagement steps.
- Identify potential joining-risk signals.
- Generate and review AI-powered engagement recommendations.
- Manage candidate communications.
- Track recruiter actions and follow-ups.
- Provide HR analytics around offer-to-join conversion and engagement.

The architecture in this document combines the requirements of the technical assignment with the implementation structure of the project. Items marked as **Planned** are requirements that are not yet implemented.

---

## 2. Technical Requirements

The assignment requires:

- React / Next.js frontend.
- Python or Node.js backend.
- SQL database.
- REST APIs.
- LLM integration.
- Input/output validation and error handling.
- Environment variables for secrets.
- Docker support.
- At least 50 seeded candidate records.
- README with setup instructions and architecture notes.

The selected implementation stack is:

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Implemented |
| Styling | Tailwind CSS v4 | Implemented |
| Backend | FastAPI, Python 3.11 | Foundation implemented |
| Validation | Pydantic | Implemented in backend foundation |
| Database | Supabase PostgreSQL | Planned |
| AI | Groq | Planned |
| Charts | Recharts + hand-built SVG/CSS visuals | Implemented |
| Icons | Heroicons Solid | Implemented |
| REST API | FastAPI | Health endpoint implemented; resource APIs planned |
| Docker | Docker support | Planned |

---

## 3. Core Product Requirements

### Candidate Tracking

The system must track offered candidates with:

- Name
- Role
- Offer date
- Joining date
- Recruiter
- Location
- Engagement status
- Last interaction date
- Risk level
- Notes

### Engagement Journey

The required journey is:

```text
Offer Accepted
      ↓
Welcome
      ↓
Documentation
      ↓
Manager Introduction
      ↓
Pre-Joining Check-in
      ↓
Joining
```

HR must be able to view completed and pending engagement steps for each candidate.

HR must also be able to update:

- Candidate status
- Recruiter notes
- Engagement steps
- AI recommendations

---

## 4. AI Requirements

Groq is the selected LLM provider.

The AI layer must support:

### Personalized Communication

Generate candidate-facing communication for:

- Email
- WhatsApp

Examples include:

- Welcome messages
- Documentation reminders
- Pre-joining check-ins
- Manager introduction messages

### Interaction Summarization

Summarize previous candidate interactions so recruiters can quickly understand the conversation history.

### Next Best Action

Recommend the next engagement action for a candidate based on available candidate context and engagement history.

### Joining-Risk Detection

Detect possible joining-risk signals from candidate responses.

Risk must be classified as:

```text
Low
Medium
High
```

Example from the assignment:

A candidate saying they are still figuring out relocation and accommodation should be recognized as a potential concern, with an appropriate recruiter follow-up recommended.

### Structured AI Output

AI responses must be structured and validated before being stored or displayed.

Pydantic schemas will be used for backend validation of AI outputs.

### Human Override

HR must be able to override:

- AI recommendations
- AI risk classification

The AI recommendation is therefore advisory rather than authoritative.

---

## 5. Database Architecture

Supabase PostgreSQL is the planned SQL database.

The database should represent the core HR domain rather than storing all information in one candidate table.

The planned data areas include:

- Candidates
- Engagement journey stages
- Engagement events
- Communications
- Message threads
- Message templates
- HR notes
- Tasks / pending actions
- Analytics source data

Candidate documents are associated with the documentation stage and can use Supabase Storage when implemented.

### Seed Data Requirement

The assignment explicitly requires:

**At least 50 seeded candidate records.**

The seed dataset should be realistic and varied enough to exercise the complete UI and analytics.

It should include variation in:

- Engagement stage
- Engagement status
- Risk level
- Recruiter
- Role
- Location
- Offer date
- Joining date
- Last interaction
- Engagement progress
- Communication history
- Pending actions
- Notes
- Relevant engagement events

The seed data must preserve valid relationships between candidates and their related records.

The exact database schema and 50-record seed dataset are **not yet implemented**.

---

## 6. Frontend Architecture

The frontend uses the Next.js App Router.

### Routes

| Route | Purpose |
|---|---|
| `/` | Redirect to login |
| `/login` | Login interface |
| `/dashboard` | HR overview and engagement metrics |
| `/candidates` | Candidate listing, filtering and risk visibility |
| `/candidates/[id]` | Candidate details and engagement information |
| `/engagement-journey` | Engagement journey and timeline |
| `/communication` | Candidate communication workspace |
| `/analytics` | HR analytics and conversion metrics |

### Candidate Dashboard

The candidate dashboard must expose:

- Joining date
- Engagement progress
- Last interaction
- Next action
- Risk level

Required filters:

- Joining month
- Recruiter
- Role
- Risk level
- Engagement status

### Candidate Detail Page

The candidate detail view must expose:

- Offer details
- Engagement timeline
- Conversation history
- AI summary
- Current risk
- Recommended next action
- Recruiter notes

### Analytics Dashboard

Required analytics include:

- Total offered candidates
- Offer-to-join conversion
- Candidates joining in the next 7 days
- Candidates joining in the next 15 days
- Candidates joining in the next 30 days
- High-risk candidates
- Average engagement frequency
- Stage drop-offs
- Recruiter-wise offer-to-join rate

---

## 7. UI Design System

The reference screenshots are the visual source of truth.

### Color Palette

| Token | Hex |
|---|---|
| Orange | `#FC8019` |
| Charcoal | `#2B2520` |
| Cream / Background | `#FFF8F2` |
| Peach | `#FFE4D0` |
| Teal / Success | `#2FA58D` |
| Coral / Danger | `#E85D4A` |
| Primary Text | `#292929` |
| Secondary Text | `#747474` |
| Warning | `#F2A516` |

### Typography

- Sora for headings and prominent numbers.
- Inter for body and interface text.

### Icons

The platform uses solid / filled icons.

Heroicons Solid is the selected icon library.

The Login page uses a simple solid orange product mark with a transparent background.

### General Visual Language

- Warm cream page background.
- White cards.
- Rounded corners.
- Subtle shadows.
- Generous spacing.
- Orange primary actions.
- Teal for positive/completed states.
- Coral for high-risk/danger states.
- Peach for soft section backgrounds and status treatments.

---

## 8. Backend Architecture

FastAPI is the backend framework.

The backend is organized into:

```text
backend/
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py
    │   └── logging.py
    ├── api/
    │   ├── router.py
    │   └── routes/
    ├── schemas/
    ├── services/
    └── db/
```

### API Layer

API routes should be grouped by domain.

Planned resource areas include:

- Candidates
- Engagement
- Communication
- Analytics
- AI

The currently implemented endpoint is:

```text
GET /api/v1/health
```

The resource APIs have not yet been implemented.

### Pydantic Validation

Pydantic is used for backend request and response schemas.

Validation is important for:

- API request payloads.
- API response contracts.
- Candidate updates.
- Engagement updates.
- AI structured output.
- Risk classification.
- Error handling around invalid data.

---

## 9. API Requirements

The assignment requires clean APIs for:

- Candidate creation.
- Candidate retrieval.
- Candidate filtering.
- Candidate updates.
- Engagement events.
- AI analysis.

The intended flow is:

```text
Next.js
   ↓
REST API
   ↓
FastAPI route
   ↓
Pydantic validation
   ↓
Service layer
   ↓
Supabase / Groq
```

The frontend should not directly access the database or Groq SDK.

---

## 10. Supabase Architecture

Supabase is the planned persistence layer.

### PostgreSQL

PostgreSQL will store:

- Candidate records.
- Engagement journey stages/events.
- Communications and message threads.
- Message templates.
- HR notes.
- Tasks and pending actions.
- Analytics source data.

### Authentication

Supabase Auth is planned to replace the current fake login.

The intended architecture is:

```text
Frontend
   ↓
Supabase session/token
   ↓
FastAPI
   ↓
Token verification
   ↓
Protected API
```

### Storage

Supabase Storage is planned for candidate documents associated with the documentation stage.

Examples from the assignment context include:

- Aadhaar
- PAN
- Address proof
- Bank details

### Row Level Security

RLS can be used to scope access by recruiter or role when authentication and authorization are implemented.

### Integration Boundary

The backend database layer is:

```text
backend/app/db/supabase.py
```

Routes and services should not directly import the Supabase SDK.

---

## 11. Groq Architecture

Groq is the selected AI provider.

The intended flow is:

```text
FastAPI route
      ↓
AI service
      ↓
Groq
      ↓
Structured AI response
      ↓
Pydantic validation
      ↓
Application / database
```

The integration boundary is:

```text
backend/app/services/ai.py
```

The frontend should never call the Groq SDK directly.

Planned AI operations include:

- Personalized message generation.
- Interaction summarization.
- Next-action recommendation.
- Joining-risk detection.
- Risk explanation.

---

## 12. Risk Classification

Risk is represented as:

```text
Low
Medium
High
```

Risk detection should consider signals from candidate engagement and communication history.

The AI classification must be validated before being used by the application.

HR must be able to override the AI classification.

The exact production risk model has not yet been implemented.

The system should document limitations because AI-generated risk classification can be incomplete, context-dependent, or incorrect.

---

## 13. Automated Engagement Workflow

The assignment requires at least one automated engagement rule.

Required example:

```text
IF
candidate joins within 7 days
AND
candidate has had no interaction within the last 5 days

THEN
flag candidate
generate personalized message
create follow-up action for HR
```

Actual message sending is optional. Simulation is acceptable.

This workflow should eventually be implemented as backend business logic or a scheduled/background process.

---

## 14. Current Data Flow

Currently the frontend uses local mock data.

```text
Next.js page
    ↓
src/lib/mock-data.ts
    ↓
UI components
```

The API client exists but is not currently used by the pages.

The intended migration is:

```text
Next.js page
    ↓
apiFetch()
    ↓
FastAPI
    ↓
service
    ↓
Supabase
```

AI requests will additionally flow through:

```text
FastAPI
    ↓
AI service
    ↓
Groq
```

---

## 15. Current Repository Structure

```text
HRMS_ASSIGNMENT/
├── README.md
├── architecture.md
├── .gitignore
├── HRMS-SWIGGY-PAGES-UI/
│   └── UI reference screenshots
│
├── frontend/
│   ├── .env.example
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── public/
│   │   └── brand-mark.png
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── layout/
│       │   ├── ui/
│       │   └── charts/
│       ├── features/
│       ├── hooks/
│       ├── lib/
│       └── types/
│
└── backend/
    ├── .env.example
    ├── requirements.txt
    ├── README.md
    └── app/
        ├── main.py
        ├── api/
        │   ├── router.py
        │   └── routes/
        │       └── health.py
        ├── core/
        ├── schemas/
        ├── services/
        │   └── ai.py
        └── db/
            └── supabase.py
```

---

## 16. Environment Variables

### Frontend

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_APP_NAME
```

### Backend

```text
APP_NAME
ENVIRONMENT
DEBUG
API_V1_PREFIX
BACKEND_CORS_ORIGINS
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_PUBLISHABLE_KEY
GROQ_API_KEY
GROQ_MODEL
```

Supabase uses the new API key system. `SUPABASE_SECRET_KEY` (`sb_secret_...`) is
the backend key that replaces the legacy `service_role` key.
`SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) replaces the legacy `anon` key
and is reserved for a future auth phase. The frontend holds no Supabase keys.

Secrets must remain in environment variables and must not be committed to Git.

---

## 17. Current Implementation Status

### Implemented

- Next.js frontend.
- Seven main UI pages.
- Shared application shell.
- Candidate mock data.
- Dashboard visuals.
- Candidate listing.
- Candidate details.
- Engagement journey UI.
- Communication UI.
- Analytics UI.
- Solid icon system.
- Design tokens.
- FastAPI application foundation.
- Health API.
- Pydantic foundation.
- Frontend TypeScript validation.
- Next.js production build.
- ESLint validation.
- Architecture documentation.
- Supabase database schema (supabase/migrations/001_initial_schema.sql): 21 enums, 12 tables, 37 indexes, updated_at trigger, 4 read-model views.
- Seed dataset (supabase/seed.sql): 55 candidates and ~1900 related rows.
- Supabase server-side client (backend/app/db/supabase.py) using the Supabase secret key (new API key system).
- Data access layer (backend/app/db/repositories.py).
- Candidate REST APIs: list (filtered, paginated), detail, engagement, communications, tasks, documents, notes.
- Communication REST APIs: conversation list and thread.
- Analytics REST APIs: summary, stage funnel, recruiter conversion, conversion trend.
- Reference REST APIs: recruiters, message templates.
- Consistent error handling: 404 not found, 422 validation, 502 upstream, 503 database not configured.

### Not Yet Implemented

- Supabase authentication.
- Supabase storage.
- RLS.
- AI REST APIs.
- Groq integration.
- Structured AI response implementation.
- AI risk classification.
- AI recommendation generation.
- Automated engagement rule.
- Frontend-to-backend data integration (pages still read src/lib/mock-data.ts).
- Migration and seed applied to the live Supabase project (requires the project owner).
- Real authentication and route protection.
- Complete table sorting/pagination interactions.
- Communication tab content switching.
- Engagement Journey tab content switching.
- Automated tests.
- Docker support.

---

## 18. Engineering Decisions

### Frontend / Backend Separation

The frontend and backend are separate applications.

This keeps UI concerns separate from:

- Business logic.
- Database access.
- AI integration.
- Validation.

### Service Boundaries

Routes should remain thin.

Business logic belongs in services.

Database access belongs in the database layer.

Groq access belongs in the AI service.

### Validation

Pydantic provides explicit contracts between API inputs/outputs and application logic.

AI output should never be trusted blindly. It must be validated before being displayed or persisted.

### Mock-to-Real Migration

The current mock-data implementation allows the UI to be developed independently.

Once APIs are implemented, page-level mock-data imports should be replaced with API calls while keeping component interfaces stable where possible.

### ADR 001: FastAPI is the sole database boundary

**Status:** Accepted (Phase 2).

**Context:** There was an open question about whether the Next.js frontend should
call Supabase directly (using the Supabase JS client and RLS) or go through
FastAPI. This decision was pending a discussion that is no longer being waited on.

**Decision:** The frontend never talks to Supabase. Every read and write goes:

```text
Next.js  ->  api-client.ts  ->  FastAPI (/api/v1/...)  ->  app/db/supabase.py
         ->  Supabase Postgres  ->  Pydantic response  ->  JSON  ->  Next.js
```

FastAPI is the only tier that holds Supabase credentials, and it uses the
Supabase secret key (`SUPABASE_SECRET_KEY`, new API key system, replaces the
legacy service_role key). The Supabase SDK is imported in exactly one module,
`backend/app/db/supabase.py`. Routes depend on `app/db/repositories.py`, which
depends on that module. PostgREST and transport errors are translated to the
application error vocabulary in the repository layer.

**Consequences:**

- One place to add auth, rate limiting, caching, and audit logging.
- The frontend bundle never contains a database key.
- Slightly more code than direct Supabase calls: a route, a Pydantic schema, and
  a repository function per resource.
- RLS is not relied on for security in this phase because only the trusted
  backend connects. RLS and Supabase Auth remain planned for a later phase.

### ADR 002: Analytics aggregation lives in SQL views

**Status:** Accepted (Phase 1 and 2).

**Decision:** The funnel, recruiter conversion, and weekly conversion trend are
computed by database views (`v_stage_funnel`, `v_recruiter_conversion`,
`v_conversion_trend_weekly`). The API reads and shapes them; it does not
recompute aggregates in Python. Summary counts use PostgREST `count=exact`.

**Consequences:** Consistent numbers, less Python, and the same views can back a
future report export. The tradeoff is that analytics logic is split between SQL
and the API layer.

---

## 19. Production Considerations

If this platform were scaled to 1 million candidates, the architecture would need additional consideration around:

- Database indexing.
- Pagination and cursor-based retrieval.
- Query optimization.
- Background jobs.
- Caching.
- Asynchronous AI processing.
- Rate limiting.
- Queue-based communication workflows.
- Observability.
- Role-based access.
- Audit logging.
- Storage lifecycle management.

These are architectural considerations rather than current implementation requirements.

---

## 20. Future / Bonus Features

The assignment lists the following as bonus opportunities:

- Configurable engagement workflows or background jobs.
- Email / WhatsApp integration.
- Recruiter notifications.
- Audit trail.
- Role-based access.
- Thoughtful AI guardrails.
- AI observability.

These should only be implemented after the core assignment functionality is working.

---

## 21. Development Priority

The project should prioritize working functionality over additional visual polish.

Recommended implementation order:

```text
1. Supabase schema
2. 50+ candidate seed dataset
3. FastAPI candidate APIs
4. Engagement APIs
5. Communication APIs
6. Analytics APIs
7. Frontend API integration
8. Groq structured AI
9. Risk classification + recommendations
10. Automated engagement rule
11. Authentication / authorization
12. Docker
13. Tests
14. Final README and demo preparation
```

This order establishes the persistent data model before building dependent API and AI functionality.

---

## 22. Documentation Requirements

The final README should explain:

- Setup instructions.
- Architecture and database schema.
- AI flow.
- How structured AI output is validated.
- How joining-risk classification works and its limitations.
- How the automated engagement workflow works.
- Key engineering trade-offs.
- What would be improved for production.
- What would change at 1 million candidates.

`architecture.md` provides the deeper architecture reference, while `README.md` should remain focused on setup and concise project-level documentation.

---

## 23. Source of Truth

The following sources have different purposes:

1. **Technical assignment**: source of truth for required functionality and evaluation criteria.
2. **UI reference screenshots**: source of truth for visual design.
3. **Existing source code**: source of truth for what is actually implemented.
4. **This architecture document**: consolidated technical reference that distinguishes implemented functionality from planned functionality.

No planned feature should be described as implemented until it exists and has been validated.
