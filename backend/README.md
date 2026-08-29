# HRMS Backend (FastAPI)

FastAPI is the API boundary. The frontend calls FastAPI over HTTP; FastAPI is the
only tier that talks to Supabase and the only tier that holds the Supabase secret key.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env
# edit .env: set SUPABASE_URL and SUPABASE_SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs
Health: http://localhost:8000/api/v1/health

Data endpoints return HTTP 503 (`database_not_configured`) until `SUPABASE_URL`
and `SUPABASE_SECRET_KEY` are set. The database schema and seed live in
`../supabase/` and must be applied to the Supabase project first.

## Layout

| Path | Responsibility |
| --- | --- |
| `app/main.py` | App factory, CORS, lifespan, error handlers, router mount |
| `app/core/config.py` | Typed settings from environment |
| `app/core/errors.py` | Error types and exception handlers |
| `app/core/constants.py` | Domain constants (journey stages) |
| `app/api/router.py` | Aggregates all versioned routers under `/api/v1` |
| `app/api/deps.py` | Shared dependencies (DB client, candidate resolver) |
| `app/api/routes/` | One module per resource group |
| `app/schemas/` | Pydantic response models (the API contract) |
| `app/services/` | Assembly and business logic, kept out of routes |
| `app/db/supabase.py` | The only module that imports the Supabase SDK |
| `app/db/repositories.py` | Query functions, SDK errors translated here |

## Endpoints (all under `/api/v1`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/candidates` | Filtered, paginated candidate list |
| GET | `/candidates/{candidate_id}` | Candidate detail (UUID or slug) |
| GET | `/candidates/{candidate_id}/engagement` | Engagement journey |
| GET | `/candidates/{candidate_id}/communications` | Conversations with messages |
| GET | `/candidates/{candidate_id}/tasks` | Tasks |
| GET | `/candidates/{candidate_id}/documents` | Documents |
| GET | `/candidates/{candidate_id}/notes` | HR notes |
| GET | `/communications` | Cross-candidate conversation list |
| GET | `/communications/{conversation_id}` | One conversation thread |
| GET | `/analytics/summary` | Dashboard and analytics KPIs |
| GET | `/analytics/stage-funnel` | Stage funnel and drop-offs |
| GET | `/analytics/recruiter-conversion` | Offer to join rate per recruiter |
| GET | `/analytics/conversion-trend` | Weekly conversion trend |
| GET | `/recruiters` | Recruiter list |
| GET | `/message-templates` | Message template list |

## Error contract

Every error returns `{"detail": "...", "code": "..."}`.

| Status | Code | Meaning |
| --- | --- | --- |
| 404 | `not_found` | Candidate or conversation does not exist |
| 422 | (FastAPI default) | Invalid query or path parameter |
| 502 | `upstream_error` | Database request or connection failed |
| 503 | `database_not_configured` | Supabase env vars are not set |

Groq (`app/services/ai.py`) is still a stub. AI routes are a later phase.
