# Post-Offer Engagement HRMS

A full-stack application for managing candidates in the gap between **offer
acceptance and joining** — the window where silent drop-off is most expensive.
It tracks each candidate's engagement journey, surfaces joining-risk signals,
generates AI-assisted recruiter messaging and analysis (Groq), and runs an
automated rule that flags quiet pre-joiners and drafts a follow-up.

---

## 1. Project overview

Recruiters use the app to:

- track offered candidates and their post-offer engagement journey (6 stages);
- see completed / pending steps, tasks and documents per candidate;
- read a per-candidate communication thread (email / WhatsApp / SMS);
- get **AI drafts** (message, interaction summary, next best action) and an
  **AI risk classification**, all of which require HR review;
- record **HR overrides** on AI recommendations and on risk, without destroying
  the original AI output;
- run (or schedule) an **automated engagement sweep** that finds pre-joining
  candidates who have gone quiet and creates a follow-up task + AI draft.

## 2. Architecture

```
Browser ──HTTP──> Next.js (SSR + client)
                     │  lib/api.ts  (typed, one fn per endpoint, via apiFetch)
                     ▼
              FastAPI  (app/api/routes → app/services → app/db/repositories)
                     │                                   │
                     ▼                                   ▼
                  Groq API                          Supabase (Postgres)
              (openai/gpt-oss-20b)          (only app/db/supabase.py imports SDK)
```

- **One direction of trust.** The browser never holds DB or Groq credentials.
  FastAPI is the only tier that talks to Supabase or Groq.
- **Strict layering in the backend:** routes do request/response + call a
  service; services hold business logic; repositories are the only place that
  builds Supabase queries; `app/db/supabase.py` is the only module that imports
  the Supabase SDK; `app/services/groq_client.py` is the only module that
  imports the Groq SDK.
- **Every request body is a Pydantic model** (`extra="forbid"` on mutations and
  AI I/O). **Every response is a typed schema.** Errors flow through a single
  `AppError` hierarchy → `{ "detail", "code" }` envelope.

## 3. Repository structure

```
backend/
  app/
    main.py                 FastAPI app + lifespan (starts scheduler, no-op unless enabled)
    api/
      deps.py               get_db, get_candidate_or_404 (UUID or slug)
      router.py             include_router for every route module
      routes/               health, candidates, communications, analytics,
                            reference, ai, overrides, automation, webhooks
    core/                   config (typed settings), errors, logging, constants
    db/
      supabase.py           the ONLY Supabase SDK import
      repositories.py       all query building; returns plain dicts
    schemas/                Pydantic response + request models
    services/
      candidates.py         read-model assembly (detail, journey, comms)
      analytics.py          analytics rollups
      ai_context.py         builds the PII-light candidate context for prompts
      ai_prompts.py         guard-railed system prompts
      groq_client.py        the ONLY Groq SDK import; JSON-mode call + retry
      ai.py                 pipeline: context → prompt → Groq → validate → business rules
      mutations.py          write-side business logic (notes, status, journey, messages, overrides)
      candidate_admin.py    candidate creation (slug/initials/recruiter defaults)
      resend_client.py      the ONLY Resend SDK import; send_email + webhook verify
      email.py              outbound email business logic (validate → send → persist)
      engagement_rules.py   the automated engagement rule + sweep
      scheduler.py          in-process asyncio loop that only calls the sweep
  tests/                    pytest (offline; Groq + Supabase faked)
  Dockerfile
frontend/
  src/
    app/                    App Router pages (dashboard, candidates, candidates/[id],
                            engagement-journey, communication, analytics, automation, auth)
    components/             layout, ui, charts, dashboard, candidates (AI panel, overrides)
    lib/
      api-client.ts         apiFetch<T> + ApiError
      api.ts                one typed function per endpoint (GET + mutations + AI + automation)
      ai-error.ts           maps backend error codes → short user copy
  Dockerfile
supabase/
  migrations/001_initial_schema.sql
  seed.sql
docker-compose.yml
architecture.md              design-phase notes (superseded by this file where they disagree)
```

## 4. Database schema

Postgres (Supabase). One migration, `supabase/migrations/001_initial_schema.sql`.
**No schema changes were made for the AI / automation / frontend-integration
work** — everything reuses existing tables and enums.

Core tables: `recruiters`, `candidates`, `candidate_journey_steps`,
`message_templates`, `conversations`, `messages`, `engagement_events`,
`candidate_notes`, `tasks`, `risk_assessments`, `documents`,
`ai_recommendations`.

Key design points:

- **`candidates`** carries denormalized `risk_level`, `risk_score`,
  `engagement_score`, `last_interaction_at`, `last_interaction_channel`,
  `current_stage`, `next_action` so list/dashboard reads are one query.
- **History with a moving flag.** `risk_assessments` and `ai_recommendations`
  keep every row; a partial unique index enforces exactly one `is_current` per
  candidate (`risk_assessments`) / per candidate+kind (`ai_recommendations`).
  Writing a new one clears the old current row first.
- **`ai_recommendations`** has `status` (`suggested|accepted|overridden|
  dismissed`), `hr_override_text`, `payload` (the raw validated AI output — never
  mutated by an override), `prompt_context`, `model`.
- **`tasks.source`** is `manual|automation|ai`; the sweep uses `automation`.
- **`engagement_events.metadata`** (jsonb) carries automation provenance
  (`automation: true`, `rule`, `task_id`, …).
- Read-model views: `v_candidate_list`, `v_stage_funnel`,
  `v_recruiter_conversion`, `v_conversion_trend_weekly`.

## 5. API architecture

Base path `/api/v1`. `{candidate_id}` accepts a UUID **or** the `candidates.slug`.

**Reads**

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/candidates` (filters, pagination) |
| GET | `/candidates/{id}` · `/engagement` · `/communications` · `/tasks` · `/documents` · `/notes` · `/risk/history` |
| GET | `/candidates/{id}/ai/recommendations` (`?kind=&current_only=`) |
| GET | `/communications` · `/communications/{conversation_id}` |
| GET | `/analytics/summary` · `/stage-funnel` · `/recruiter-conversion` · `/conversion-trend` |
| GET | `/recruiters` · `/message-templates` |
| GET | `/automation/status` |

**Writes**

| Method | Path | Purpose |
|---|---|---|
| POST | `/candidates` | create a candidate (HR "Add Candidate") |
| POST | `/candidates/{id}/notes` | create HR note |
| PATCH | `/candidates/{id}` | status and/or preferred channel |
| POST | `/candidates/{id}/tasks` | create a follow-up task (quick actions) |
| POST | `/candidates/{id}/messages` | internal note / non-email message |
| POST | `/candidates/{id}/communications/email` | **send a real email to the candidate via Resend** + persist |
| PATCH | `/candidates/{id}/journey/{stage}` | set a journey step's status |
| POST | `/candidates/{id}/ai/message` · `/summary` · `/next-action` · `/risk` | generate + persist |
| PATCH | `/ai-recommendations/{id}` | HR `accept` / `dismiss` / `override` |
| PATCH | `/risk-assessments/{id}` | HR manual risk override |
| POST | `/automation/run-engagement-sweep` | run the sweep now (manual/API trigger) |
| POST | `/webhooks/resend` | Resend **delivery-status** webhook (Svix-signed, public; 401 if secret unset) |

## 6. Frontend architecture

- **Next.js 16 App Router, React 19, TypeScript, Tailwind v4** (`@theme` in
  `globals.css`, no `tailwind.config`).
- Server components fetch on the server for first paint (dashboard, candidate
  detail, journey). Interactive pieces are **client islands** (`CandidateAiPanel`,
  `HrNotesCard`, `RiskOverrideControl`, `AttentionTable`, the communication page,
  the automation page).
- **All HTTP goes through `lib/api.ts` → `apiFetch` → `ApiError`.** No `fetch()`
  scattered in components; no duplicated error handling.
- After a successful mutation, client islands call `router.refresh()` so the
  server-rendered data re-fetches; local state is only a fast-path mirror.
- `lib/ai-error.ts` turns backend error **codes** into short user-facing copy;
  raw messages / stack traces are never shown.
- Auth is still a **local mock** (`lib/mock-auth.ts`) — see Limitations.

## 7. AI architecture

Pipeline (identical shape for all four AI functions), in `app/services/ai.py`:

```
candidate row
  → ai_context.build_candidate_context()   PII-light: name/role/timeline/notes,
                                            NO email / phone / id; text clipped
  → ai_prompts.<task>_prompt(schema)       guard-railed system prompt + JSON schema
  → groq_client.structured_completion()    JSON mode, 429 backoff + one transient retry
  → json.loads + Pydantic model_validate   (extra="forbid")
  → ONE corrective reprompt if invalid     then AIInvalidOutputError
  → business validation                    (see §10, §11)
  → return (model, prompt_context)
```

Routes then persist the validated result to `ai_recommendations` /
`risk_assessments` (history preserved) and return the app schema — **the raw
Groq body never leaves `ai.py`**.

Structured output models (`app/schemas/ai.py`, all `extra="forbid"`):
`PersonalizedMessage`, `InteractionSummary`, `NextBestAction`,
`RiskClassification`.

## 8. Groq integration

- SDK isolated in `app/services/groq_client.py`. `GROQ_API_KEY` comes from the
  environment only, is never logged, and is never sent to the browser.
- Model from `GROQ_MODEL` (default `openai/gpt-oss-20b`). It is **not** hardcoded
  anywhere in the frontend; the UI shows whatever `model` value the backend
  recorded on each recommendation.
- `get_groq()` raises `AINotConfiguredError` (503) when the key is unset — the
  rest of the app keeps working.
- One controlled retry on a transient upstream failure or unparseable body;
  `RateLimitError` gets a `retry-after`-aware sleep (capped 12 s) then one retry,
  otherwise `AIUpstreamError` (502).

## 9. Structured output validation

Three layers, in order:

1. **JSON mode** (`response_format={"type": "json_object"}`) — the provider is
   asked for a JSON object.
2. **Pydantic** `model_validate` with `extra="forbid"` — wrong types, out-of-range
   numbers (`score` 0–100, `confidence` 0–1), bad enums (`channel`, `level`), and
   any unexpected key are rejected. One corrective reprompt, then
   `AIInvalidOutputError` (502).
3. **Business validation** (see §10–11).

This is deliberately **not** provider-native JSON-schema enforcement (see
Limitations).

## 10. AI hallucination safeguards

- Context is **PII-light**: the model gets role, department, city, journey
  position, recent event/message summaries and HR notes — never email, phone or
  IDs — and long fields are clipped.
- Prompts explicitly instruct the model **not to invent facts** and not to assume
  a specific concern unless the context shows one.
- The message endpoint forces the returned `channel` to match what HR asked for,
  and strips a subject for non-email channels.
- Every generated artifact is labelled a **draft / assistive output** in the UI
  and is only ever persisted as a `suggested` recommendation — never sent or
  acted on automatically.

## 11. Risk classification

`POST /candidates/{id}/ai/risk` → `RiskClassification` (level, score 0–100,
factors, summary, recommended_action). Business rules in `ai.classify_risk`:

- **Score is authoritative.** If the model's `level` disagrees with its `score`
  band (`<40` low, `40–69` medium, `≥70` high), the level is snapped to the band
  and the change is reported in `meta.corrections`.
- **Thin-evidence guard.** A `high` with essentially no interaction history
  (0 messages, ≤1 event) is downgraded to `medium` and the score capped at 60.

Persisted to `risk_assessments` with `source='ai'`; `candidates.risk_level` /
`risk_score` / `current_risk_assessment_id` are kept in sync.

## 12. HR overrides

**AI recommendation** — `PATCH /ai-recommendations/{id}` with
`action: accept | dismiss | override` (+ `override_text` for override).
Only `status`, `hr_override_text`, `resolved_at` change; **`payload` (the
original AI output) is never touched.**

**Risk** — `PATCH /risk-assessments/{id}` with `level` + `reason` (+ optional
`score`). This **inserts a new `risk_assessments` row** with `source='manual'`;
the previous AI row is kept as `is_current=false`. The response returns both the
new manual assessment and the preserved previous AI assessment. The UI (candidate
detail → *HR Risk Override*, and the dashboard *Mark attention resolved* action)
makes the AI-vs-manual distinction explicit.

## 13. Automated engagement rule

Rule id `pre_joining_no_interaction` (`app/services/engagement_rules.py`).
A candidate is eligible when **all** hold:

1. `status` is not `joined` and not `declined`;
2. `today ≤ joining_date ≤ today + 7` days (`AUTOMATION_JOINING_WINDOW_DAYS`);
3. no interaction in the last 5 days (`AUTOMATION_NO_INTERACTION_DAYS`), where
   "interaction" = `candidates.last_interaction_at`; **NULL counts as eligible**
   (never interacted).

Eligibility is filtered in SQL **and** re-checked in Python (`evaluate_candidate`)
so a stale view row can't be acted on. For each eligible candidate the sweep:

1. drafts a personalized message via the **existing** `ai.draft_message` service;
2. creates a `tasks` row (`source='automation'`, priority `high` if joining ≤ 3
   days else `medium`);
3. persists the draft to `ai_recommendations` (`kind='message_draft'`);
4. records an `engagement_events` row (`event_type='reminder_sent'`,
   `actor='system'`, `metadata.automation=true`, `metadata.rule=…`).

`POST /automation/run-engagement-sweep` returns
`{ scanned, eligible, processed, skipped, failed, results:[…] }`. It supports
`{ "dry_run": true }` (evaluate only, no writes) and `{ "limit": N }`.

**Scheduling.** `app/services/scheduler.py` is an in-process asyncio loop started
from the FastAPI lifespan. It **only** calls the sweep — no rule logic lives
there. It is **disabled by default** (`AUTOMATION_ENABLED=false`). See
Limitations for why this is a prototype convenience, not a production scheduler.
The **Automation** page in the UI shows status / last run and can trigger a
(dry) sweep manually.

## 14. Deduplication

Before acting on a candidate the sweep skips it when **either**:

- an `open`/`in_progress` task with `source='automation'` already exists for them
  (HR still owes the follow-up); or
- a matching automation `engagement_events` row exists within the last
  `AUTOMATION_DEDUP_DAYS` (3) days.

A candidate re-qualifies automatically once the task is closed **and** the dedup
window has passed **and** the rule still matches. A real candidate reply moves
`last_interaction_at` forward and drops them from the eligible set on the next
run. One candidate failing (AI or DB error) is isolated — it is marked `failed`
with a reason and the sweep continues.

## 15. Error handling

One hierarchy (`app/core/errors.py`), one JSON envelope `{ "detail", "code" }`:

| Exception | Status | `code` |
|---|---|---|
| `NotFoundError` | 404 | `not_found` |
| `DatabaseNotConfiguredError` | 503 | `database_not_configured` |
| `UpstreamError` | 502 | `upstream_error` |
| `AINotConfiguredError` | 503 | `ai_not_configured` |
| `AIUpstreamError` | 502 | `ai_upstream_error` |
| `AIInvalidOutputError` | 502 | `ai_invalid_output` |

Repositories translate `postgrest.APIError` → `UpstreamError` and retry transient
transport failures 3×. The frontend (`lib/ai-error.ts`) maps codes to short copy:
503 → "AI is not configured right now.", 429/502 → "AI service is temporarily
unavailable. Please try again.", `ai_invalid_output` → "AI returned an invalid
result. Please try again."

## 16. Analytics

`app/services/analytics.py` + four Postgres views. `/analytics/summary` gives
totals, offer→join conversion (point-in-time **and** among resolved candidates),
high-risk count, joining-in-7/15/30-days, average engagement frequency.
`/stage-funnel`, `/recruiter-conversion`, `/conversion-trend` feed the dashboard
and analytics charts. All from real candidate/event rows.

## 17. Local development setup

Prereqs: Python 3.11, Node 22, a Supabase project, a Groq API key.

**Database**

```bash
# in the Supabase SQL editor, run:
supabase/migrations/001_initial_schema.sql
supabase/seed.sql
```

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate on *nix
pip install -r requirements.txt
cp .env.example .env              # then fill SUPABASE_URL, SUPABASE_SECRET_KEY, GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:8000/api/v1
npm run dev                       # http://localhost:3000
```

## 18. Environment variables

**Backend** (`backend/.env`, never committed)

| Var | Notes |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | server-side only; without them data endpoints return 503 |
| `SUPABASE_PUBLISHABLE_KEY` | reserved for a future auth phase, unused |
| `GROQ_API_KEY` | server-side only; without it AI endpoints return 503 |
| `GROQ_MODEL` | default `openai/gpt-oss-20b` |
| `GROQ_TIMEOUT_SECONDS`, `GROQ_MAX_RETRIES` | defaults 30 / 1 |
| `RESEND_API_KEY` | server-side only; without it the email endpoint returns 503 |
| `RESEND_FROM_EMAIL` | sender address on a domain **verified in your Resend account** |
| `RESEND_FROM_NAME` | default `HR` |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret (`whsec_…`); unset ⇒ `/webhooks/resend` rejects every call (401) |
| `RESEND_TIMEOUT_SECONDS` | Resend HTTP timeout, default 30 |
| `BACKEND_CORS_ORIGINS` | comma-separated, default `http://localhost:3000` |
| `AUTOMATION_ENABLED` | default `false` (in-process scheduler) |
| `AUTOMATION_INTERVAL_MINUTES` / `_JOINING_WINDOW_DAYS` / `_NO_INTERACTION_DAYS` / `_DEDUP_DAYS` / `_MAX_CANDIDATES_PER_RUN` | 360 / 7 / 5 / 3 / 25 |

**Frontend** (`frontend/.env.local`)

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | browser-visible API base, default `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | display name |
| `API_INTERNAL_BASE_URL` | server-only; used for RSC fetches inside Docker (`http://backend:8000/api/v1`) |

No secrets are baked into any Docker image; `.env` / `.env.local` are
git-ignored (only `*.env.example` templates are committed).

## 19. Docker setup

```bash
# backend/.env must exist and contain SUPABASE_* and GROQ_API_KEY
docker compose build
docker compose up
```

- **backend** — `python:3.11-slim`, non-root, `uvicorn` on `:8000`, healthcheck
  `GET /api/v1/health`.
- **frontend** — multi-stage Node 22 build → Next.js **standalone** output,
  non-root, `node server.js` on `:3000`, healthcheck `GET /login`. Browser URL
  (`NEXT_PUBLIC_API_BASE_URL`) is baked at build time; RSC fetches use
  `API_INTERNAL_BASE_URL=http://backend:8000/api/v1`.
- **Supabase stays external** — only its URL + secret key are injected into the
  backend container.

## 20. Testing

Backend: `cd backend && python -m pytest` — **63 tests, offline** (Groq, Supabase
and Resend are all faked; no email is sent, no network call is made).

- `test_engagement_rules.py` (18) — the 8 required rule cases + eligibility
  edges, dedup double-run, per-candidate failure isolation, dry-run.
- `test_ai_pipeline.py` (13) — valid structured output, extra-field rejection,
  corrective reprompt (fail→recover), invalid enum, out-of-range score,
  risk level↔score snap, thin-evidence downgrade, missing API key,
  upstream retry (fail→raise and fail→recover).
- `test_mutations.py` (13) — note + task + status + preferred-channel + journey
  step + message (interaction vs internal-note) + AI-recommendation override
  (not-found / requires-text / payload-preserved / accept) + risk override
  (not-found / original-AI-preserved).
- `test_routes.py` (11) — via `TestClient`: unknown-candidate 404, invalid body
  422, extra field 422, bad status enum 422, note created 201, AI 404 /
  `ai_not_configured` 503 / `ai_upstream_error` 502, recommendations list.
- `test_email.py` (13) — **missing Resend key → 503**; candidate with no /
  invalid email rejected; route `404` unknown candidate; route `422` invalid
  body / extra field; **Resend success → message persisted** (recipient taken
  from the candidate record, provider id on the companion event, interaction
  updated); **Resend failure → 502, nothing persisted**; request-model
  validation (bad `reply_to`, subject bounds, strip); **AI-draft id flows into
  the send** (`is_ai_generated`, recommendation marked accepted); candidate
  creation (slug/initials/recruiter default, bad email); new-candidate journey
  with no step rows.

Frontend: `npm run lint` and `npx tsc --noEmit` are clean; `npm run build`
succeeds. There is no component test runner in the project; API error mapping and
mutation flows are covered by the backend route tests and by manual verification.

## 21. Known limitations

- **No real authentication.** Login/signup are a local mock
  (`frontend/src/lib/mock-auth.ts`, `localStorage`). There is no auth on the API
  and no Supabase RLS enforcement — the backend uses the Supabase **secret** key
  and reads every row. Any deployment needs real auth + RLS first.
- **Groq free tier ~8000 TPM.** Each AI call sends ~4 k tokens of context, so a
  full sweep over many candidates will 429 on later candidates. The code handles
  it (marks `failed`, continues; backoff + one retry) but a large live run is
  throttled. Use `limit` or space runs out.
- **Model choice.** `openai/gpt-oss-20b` is used because the development Groq key
  has no access to `llama-3.3-*` (returns 404). A stronger model would improve
  draft quality with no code change (`GROQ_MODEL`).
- **JSON mode + Pydantic, not provider-native JSON schema.** Validation is
  enforced app-side (parse → `model_validate` → one reprompt) rather than by a
  strict provider grammar. Robust in practice; not a hard guarantee.
- **In-process scheduler.** `AUTOMATION_ENABLED=true` runs an asyncio loop inside
  the API process: not durable (timer resets on restart), and with >1 worker each
  worker runs its own loop (dedup keeps it *safe* but wasteful). Production should
  keep it off and drive `POST /automation/run-engagement-sweep` from an external
  scheduler (cron / Cloud Scheduler / a worker).
- **Automation dedup is a heuristic, not a lock.** Two sweeps racing within the
  same second could both pass the check. Fine at a 6-hour cadence; not for
  high-frequency triggering.
- **`event_type='reminder_sent'`** is the closest existing enum for an automation
  event — there is no dedicated `automation_triggered` type. Provenance lives in
  `metadata`.
- **Risk classifier** is a single LLM call with light business rules — a
  heuristic decision aid, not a validated model. AI outputs always require HR
  review; the UI says so.
- **Supabase is an external dependency.** If unconfigured, data endpoints return
  503 by design.
- **`docker compose build` / `up` were not run in the authoring environment**
  (no Docker CLI available there). The Dockerfiles/compose follow standard
  patterns and the standalone build + healthcheck paths were verified manually.
- **Real email — sending domain must be verified in Resend.** The Resend API key
  authenticates and one real end-to-end send was completed and delivered through
  `resend_client.send_email` (Resend `id` `4729fbd8-…`, and via the endpoint
  itself). But the configured `RESEND_FROM_EMAIL` (`…@svcet.ac.in`) is **not a
  verified domain**, so with the shipped `.env` the endpoint correctly returns
  `502 email_upstream_error` ("The svcet.ac.in domain is not verified"). To send
  to the candidate address, verify a domain in the Resend dashboard and set
  `RESEND_FROM_EMAIL` to an address on it. No code change.
- **No provider-message-id column.** The `messages` table has no field for the
  Resend id (no migration was added for this feature). The id is returned in the
  API response and stored in the companion `engagement_events.metadata`; the
  delivery webhook correlates on that.
- **Inbound email (candidate replies) is deferred.** This phase implements
  outbound + delivery-status only. Receiving replies as new inbound messages
  would need a `provider_message_id` column for threading/idempotency; documented
  as future work. `RESEND_WEBHOOK_SECRET` config is wired and ready.
- **Delivery webhook** needs a public HTTPS URL (tunnel or deployment) to receive
  Resend calls, and `RESEND_WEBHOOK_SECRET` set (empty in the shipped `.env`).

## 22. Production considerations

- Real auth (Supabase Auth or an IdP) + RLS; move the backend to the
  **publishable** key + per-user JWT for user-scoped reads, keep the secret key
  only for privileged jobs.
- Run the sweep from an external scheduler; make it idempotent with a DB-level
  advisory lock or a unique constraint on `(candidate_id, rule, day)`.
- Put Groq calls behind a queue/worker with a token budget and per-tenant rate
  limiting; cache context; consider batching.
- Observability: structured request logs, error tracking, Groq latency/error
  metrics, sweep run history in a table (not just in-memory `_LAST_RUN`).
- Migrations via the Supabase CLI in CI; seed only in non-prod.
- CDN + `next start` behind a reverse proxy; separate the browser and internal
  API origins properly.

## 23. Scaling to 1M candidates

- **Reads:** `v_candidate_list` recomputes subquery counts per row — replace with
  materialized columns/telemetry tables updated by triggers or a job; the
  denormalized fields on `candidates` already point this way. Add covering
  indexes for the list filters (recruiter, status, risk, joining_date) — present
  today — and keyset pagination instead of `OFFSET`.
- **Analytics:** move the four views to materialized views or a nightly rollup
  table; the weekly-trend view in particular is O(weeks × candidates).
- **Automation:** the sweep must page through eligible candidates and enqueue
  work, not process inline. One producer query (indexed on
  `status, joining_date, last_interaction_at`) → a job queue → N workers with a
  shared Groq token budget. Dedup becomes a unique constraint.
- **AI:** cache context and de-dupe identical requests; a nightly batch for
  summaries/risk, on-demand only for messages. Store embeddings if similarity
  search is added.
- **DB:** partition `engagement_events` and `messages` by month; archive cold
  candidates; connection pooling (PgBouncer / Supabase pooler) — the repository
  layer already retries pooled-connection resets.

## 24. Security considerations

- Secrets live only in `backend/.env` / the backend container env — never in the
  frontend bundle, an image layer, or git (`.gitignore` blocks `.env*`, allows
  `*.env.example`).
- The Groq key is never logged and never returned; only the **model name** is
  surfaced.
- AI context is PII-light (no email/phone/id to the model).
- Mutation bodies are `extra="forbid"` Pydantic models; path params are typed
  (`UUID`), enums are pattern/`Literal` constrained.
- CORS is an explicit allow-list.
- Error responses never include stack traces or DB messages (the generic
  handler returns `internal_error`).
- **Gaps (see Limitations):** no authn/authz, no RLS, no rate limiting on the
  API, no CSRF concerns yet because there are no cookies/sessions.

## 25. Design trade-offs

| Decision | Why | Cost |
|---|---|---|
| Denormalized fields on `candidates` | one-query list/dashboard reads | writes must keep them in sync (they do) |
| History via moving `is_current` flag | full audit trail, simple "current" read | every write is clear-then-insert (2 statements) |
| JSON mode + Pydantic + one reprompt | provider-agnostic, transparent, testable | not a hard schema guarantee |
| Score-authoritative risk with level snap | model self-contradiction can't persist | trusts the number over the label |
| In-process scheduler, off by default | zero infra for the demo; sweep logic stays in the service | not production-grade; documented |
| `reminder_sent` for automation events | no schema change | semantic approximation; provenance in metadata |
| Client islands + `router.refresh()` | keep SSR first paint, minimal client JS | a refresh round-trip after each mutation |
| Repositories return plain dicts | one place to swap the data source | schemas re-validate on the way out |
| Risk override = new manual row | original AI assessment provably preserved | the "current" risk can flip source ai↔manual |

## 26. Email integration

Epitaxy sends **real transactional email through Resend**, server-side only.

**Flow.** Communication composer → `lib/api.sendCandidateEmail` →
`POST /api/v1/candidates/{id}/communications/email` → `services/email.send_candidate_email`
→ `services/resend_client.send_email` (the **only** module that imports the Resend
SDK) → Resend API → candidate inbox.

- The **recipient is always the candidate record's `email`** — never a field from
  the request body. HR cannot send to an arbitrary address.
- Request is validated: subject 1–200, body 1–20000, optional `reply_to`
  (`EmailStr`), unknown keys rejected, email format checked server-side, plain
  text only (HTML is generated from the escaped text, not accepted as input).
- **On Resend failure the API returns `502 email_upstream_error` and nothing is
  persisted** — no fake "sent" message. Missing key → `503 email_not_configured`.
- On success the message is stored in `messages` (`direction=outbound`,
  `channel=email`, `status=sent`, `is_ai_generated` when an AI draft id was
  passed), a companion `engagement_events` row carries the Resend message id
  (the `messages` table has no column for it — **no migration was added**), the
  conversation is touched, and `candidates.last_interaction_at` is updated (same
  rule the rest of the app uses for outbound messages).
- `RESEND_API_KEY` is read from the environment only — never logged, never
  returned, never placed in an error message; SDK exceptions are caught and
  re-raised without their text.

**AI drafts.** The existing Groq endpoint (`POST …/ai/message`) is unchanged.
The composer's "AI draft" button fills subject + body from its response and
records the recommendation id; HR edits, then clicks Send. **AI never sends —
HR is always the final sender.** Sending an AI draft marks that recommendation
`accepted`.

**Automation.** The engagement sweep still only creates a task + AI draft. It
does **not** auto-send. HR reviews the task and sends from the composer.

**Delivery-status webhook** (`POST /api/v1/webhooks/resend`) — Svix
signature-verified against `RESEND_WEBHOOK_SECRET` (rejects every call with
`401` when the secret is unset; an unverified payload is never trusted). It
records `email.sent / delivered / bounced / failed` as timeline events,
correlated to the outbound email by the Resend id in that email's event
metadata. Needs a public HTTPS URL to receive Resend's calls.

**Deferred:** receiving candidate replies as inbound messages (would need a
`provider_message_id` column for threading/idempotency). Config for it
(`RESEND_WEBHOOK_SECRET`) is wired and ready.

### Setup

```bash
# backend/.env  (already configured locally; placeholders in .env.example)
RESEND_API_KEY=re_...                     # server-side only, never commit
RESEND_FROM_EMAIL=hr@your-verified-domain # a domain VERIFIED in your Resend account
RESEND_FROM_NAME=HR
RESEND_WEBHOOK_SECRET=whsec_...           # optional, for the delivery webhook
RESEND_TIMEOUT_SECONDS=30

# Resend dashboard → Domains → add + verify your sending domain (DNS records),
# then set RESEND_FROM_EMAIL to an address on it. Until the domain is verified
# Resend rejects the send and the API returns 502 (surfaced, not faked).

cd backend  && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
# Communication → pick candidate → Email → (optional) AI draft → edit → Send
```

**Auth is still a local mock** and intentionally out of scope.
