-- 001_initial_schema.sql
-- Post-Offer Engagement HRMS: initial database schema (Phase 1).
-- Target: Supabase PostgreSQL (Postgres 15+).
--
-- Notes:
--   * gen_random_uuid() is in Postgres core since 13, so no extension is required.
--   * Email columns use plain TEXT (no citext), with a UNIQUE constraint.
--   * The circular reference between candidates.current_risk_assessment_id and
--     risk_assessments.candidate_id is handled by creating candidates first
--     without that foreign key, then adding the constraint after risk_assessments
--     exists (see the ALTER TABLE near the end of this file). The relationship is
--     kept fully enforced, not weakened.

begin;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

create type engagement_stage as enum (
  'offer_accepted', 'welcome_sent', 'documentation',
  'manager_intro', 'pre_joining', 'joined'
);

create type stage_status as enum (
  'pending', 'in_progress', 'completed', 'skipped'
);

create type candidate_status as enum (
  'offer_accepted', 'active', 'joined', 'declined'
);

create type risk_level as enum ('low', 'medium', 'high');

create type employment_type as enum (
  'full_time', 'part_time', 'contract', 'intern'
);

create type candidate_source as enum (
  'linkedin', 'referral', 'naukri', 'indeed',
  'company_site', 'agency', 'other'
);

create type comm_channel as enum ('email', 'whatsapp', 'sms');

create type message_direction as enum ('inbound', 'outbound');

create type message_status as enum (
  'draft', 'scheduled', 'sent', 'delivered', 'read', 'failed'
);

create type message_actor as enum ('candidate', 'recruiter', 'system');

create type template_category as enum (
  'welcome', 'documentation_reminder', 'pre_joining_checkin',
  'manager_intro', 'joining_instructions', 'custom'
);

create type event_type as enum (
  'offer_accepted', 'welcome_sent', 'document_requested', 'document_uploaded',
  'document_verified', 'reminder_sent', 'manager_intro_scheduled',
  'manager_intro_done', 'checkin_call', 'resource_shared', 'candidate_replied',
  'note_added', 'risk_flagged', 'joined', 'offer_declined'
);

create type event_actor as enum ('candidate', 'hr', 'system');

create type document_type as enum (
  'aadhaar', 'pan', 'address_proof', 'bank_details', 'education', 'experience'
);

create type document_status as enum (
  'pending', 'submitted', 'verified', 'rejected'
);

create type task_status as enum ('open', 'in_progress', 'done', 'dismissed');

create type task_priority as enum ('low', 'medium', 'high');

create type task_source as enum ('manual', 'automation', 'ai');

create type assessment_source as enum ('ai', 'manual', 'rule');

create type ai_output_kind as enum (
  'next_action', 'interaction_summary', 'message_draft', 'risk_explanation'
);

create type ai_output_status as enum (
  'suggested', 'accepted', 'overridden', 'dismissed'
);

-- ============================================================================
-- 2. updated_at TRIGGER FUNCTION
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 3. TABLES  (created in foreign-key-safe order)
-- ============================================================================

-- 3.1 recruiters -------------------------------------------------------------
create table recruiters (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  initials    text not null,
  email       text not null unique,
  department  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger recruiters_set_updated_at
  before update on recruiters
  for each row execute function set_updated_at();

-- 3.2 candidates ------------------------------------------------------------
-- current_risk_assessment_id is added as a real FK after risk_assessments
-- is created (see section 5).
create table candidates (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  full_name                 text not null,
  initials                  text not null,
  email                     text not null unique,
  phone                     text,
  role                      text not null,
  department                text,
  employment_type           employment_type not null default 'full_time',
  location                  text not null,
  location_city             text,
  source                    candidate_source not null default 'other',
  recruiter_id              uuid not null references recruiters(id) on delete restrict,
  offer_date                date not null,
  joining_date              date not null,
  status                    candidate_status not null default 'offer_accepted',
  current_stage             engagement_stage not null default 'offer_accepted',
  risk_level                risk_level not null default 'low',
  risk_score                int not null default 0 check (risk_score between 0 and 100),
  engagement_score          int check (engagement_score between 0 and 100),
  current_risk_assessment_id uuid,
  last_interaction_at       timestamptz,
  last_interaction_channel  comm_channel,
  next_action               text,
  next_action_source        assessment_source,
  declined_at_stage         engagement_stage,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint candidates_join_after_offer check (joining_date >= offer_date)
);

create trigger candidates_set_updated_at
  before update on candidates
  for each row execute function set_updated_at();

-- 3.3 candidate_journey_steps ---------------------------------------------
create table candidate_journey_steps (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  stage         engagement_stage not null,
  status        stage_status not null default 'pending',
  position      smallint not null check (position between 1 and 6),
  due_date      date,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (candidate_id, stage)
);

create trigger candidate_journey_steps_set_updated_at
  before update on candidate_journey_steps
  for each row execute function set_updated_at();

-- 3.4 message_templates --------------------------------------------------
create table message_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     template_category not null,
  channel      comm_channel not null,
  subject      text,
  body         text not null,
  is_active    boolean not null default true,
  usage_count  int not null default 0 check (usage_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger message_templates_set_updated_at
  before update on message_templates
  for each row execute function set_updated_at();

-- 3.5 conversations -----------------------------------------------------
create table conversations (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references candidates(id) on delete cascade,
  channel               comm_channel not null,
  subject               text not null,
  last_message_at       timestamptz,
  last_message_preview  text,
  unread_count          int not null default 0 check (unread_count >= 0),
  is_online             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (candidate_id, channel)
);

create trigger conversations_set_updated_at
  before update on conversations
  for each row execute function set_updated_at();

-- 3.6 messages --------------------------------------------------------
create table messages (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null references conversations(id) on delete cascade,
  candidate_id         uuid not null references candidates(id) on delete cascade,
  direction            message_direction not null,
  channel              comm_channel not null,
  actor                message_actor not null,
  sender_name          text not null,
  sender_recruiter_id  uuid references recruiters(id) on delete set null,
  subject              text,
  body                 text not null,
  status               message_status not null default 'sent',
  is_ai_generated      boolean not null default false,
  is_internal_note     boolean not null default false,
  template_id          uuid references message_templates(id) on delete set null,
  sent_at              timestamptz,
  scheduled_for        timestamptz,
  created_at           timestamptz not null default now()
);

-- 3.7 engagement_events ---------------------------------------------
create table engagement_events (
  id                      uuid primary key default gen_random_uuid(),
  candidate_id            uuid not null references candidates(id) on delete cascade,
  event_type              event_type not null,
  stage                   engagement_stage,
  actor                   event_actor not null default 'system',
  channel                 comm_channel,
  title                   text not null,
  description             text,
  occurred_at             timestamptz not null,
  created_by_recruiter_id uuid references recruiters(id) on delete set null,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now()
);

-- 3.8 candidate_notes ---------------------------------------------
create table candidate_notes (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references candidates(id) on delete cascade,
  author_recruiter_id  uuid references recruiters(id) on delete set null,
  body                 text not null,
  is_pinned            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger candidate_notes_set_updated_at
  before update on candidate_notes
  for each row execute function set_updated_at();

-- 3.9 tasks -----------------------------------------------------
create table tasks (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references candidates(id) on delete cascade,
  assigned_recruiter_id uuid references recruiters(id) on delete set null,
  title                 text not null,
  detail                text,
  related_stage         engagement_stage,
  priority              task_priority not null default 'medium',
  status                task_status not null default 'open',
  source                task_source not null default 'manual',
  due_date              date,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- 3.10 risk_assessments ---------------------------------------
create table risk_assessments (
  id                      uuid primary key default gen_random_uuid(),
  candidate_id            uuid not null references candidates(id) on delete cascade,
  level                   risk_level not null,
  score                   int not null check (score between 0 and 100),
  factors                 text[] not null default '{}',
  summary                 text,
  source                  assessment_source not null,
  model                   text,
  created_by_recruiter_id uuid references recruiters(id) on delete set null,
  is_current              boolean not null default false,
  created_at              timestamptz not null default now()
);

-- exactly one current assessment per candidate
create unique index risk_assessments_one_current_per_candidate
  on risk_assessments (candidate_id)
  where is_current;

-- 3.11 documents --------------------------------------------
create table documents (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  doc_type      document_type not null,
  status        document_status not null default 'pending',
  storage_path  text,
  notes         text,
  requested_at  timestamptz,
  submitted_at  timestamptz,
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (candidate_id, doc_type)
);

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- 3.12 ai_recommendations ----------------------------------
create table ai_recommendations (
  id                       uuid primary key default gen_random_uuid(),
  candidate_id             uuid not null references candidates(id) on delete cascade,
  kind                     ai_output_kind not null,
  payload                  jsonb not null,
  model                    text,
  prompt_context           jsonb,
  status                   ai_output_status not null default 'suggested',
  hr_override_text         text,
  is_current               boolean not null default false,
  resolved_by_recruiter_id uuid references recruiters(id) on delete set null,
  resolved_at              timestamptz,
  created_at               timestamptz not null default now()
);

-- at most one current recommendation per candidate per kind
create unique index ai_recommendations_one_current_per_kind
  on ai_recommendations (candidate_id, kind)
  where is_current;

-- ============================================================================
-- 4. RESOLVE CIRCULAR REFERENCE
-- ============================================================================
-- risk_assessments now exists, so the candidates -> risk_assessments link
-- can be added as a real, enforced foreign key.
alter table candidates
  add constraint candidates_current_risk_assessment_id_fkey
  foreign key (current_risk_assessment_id)
  references risk_assessments(id)
  on delete set null;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

-- candidates: list, filters, sort
create index candidates_recruiter_id_idx      on candidates (recruiter_id);
create index candidates_status_idx            on candidates (status);
create index candidates_risk_level_idx        on candidates (risk_level);
create index candidates_current_stage_idx     on candidates (current_stage);
create index candidates_joining_date_idx      on candidates (joining_date);
create index candidates_offer_date_idx        on candidates (offer_date);
create index candidates_role_idx              on candidates (role);
create index candidates_last_interaction_idx  on candidates (last_interaction_at desc);
create index candidates_name_lower_idx        on candidates (lower(full_name));
create index candidates_current_risk_assessment_idx on candidates (current_risk_assessment_id);

-- candidate_journey_steps
create index cjs_candidate_id_idx  on candidate_journey_steps (candidate_id);
create index cjs_stage_status_idx  on candidate_journey_steps (stage, status);

-- engagement_events
create index ee_candidate_time_idx on engagement_events (candidate_id, occurred_at desc);
create index ee_event_type_idx     on engagement_events (event_type);
create index ee_occurred_at_idx    on engagement_events (occurred_at);

-- conversations
create index conv_candidate_id_idx     on conversations (candidate_id);
create index conv_last_message_at_idx  on conversations (last_message_at desc);
create index conv_channel_idx          on conversations (channel);

-- messages
create index msg_conversation_time_idx on messages (conversation_id, sent_at);
create index msg_candidate_id_idx      on messages (candidate_id);
create index msg_status_idx            on messages (status);
create index msg_scheduled_for_idx     on messages (scheduled_for) where scheduled_for is not null;

-- message_templates
create index mt_category_idx  on message_templates (category);
create index mt_is_active_idx on message_templates (is_active);

-- candidate_notes
create index cn_candidate_time_idx on candidate_notes (candidate_id, created_at desc);

-- tasks
create index tasks_candidate_id_idx on tasks (candidate_id);
create index tasks_status_idx       on tasks (status);
create index tasks_due_date_idx     on tasks (due_date);
create index tasks_assigned_idx     on tasks (assigned_recruiter_id);
create index tasks_source_idx       on tasks (source);

-- risk_assessments
create index ra_candidate_time_idx on risk_assessments (candidate_id, created_at desc);

-- documents
create index doc_candidate_id_idx on documents (candidate_id);
create index doc_status_idx       on documents (status);

-- ai_recommendations
create index ai_candidate_kind_idx on ai_recommendations (candidate_id, kind);
create index ai_status_idx         on ai_recommendations (status);

-- ============================================================================
-- 6. READ-MODEL VIEWS
-- ============================================================================

-- 6.1 v_candidate_list: one denormalized row per candidate for the
--     candidates table and dashboard tables.
create view v_candidate_list as
select
  c.id,
  c.slug,
  c.full_name,
  c.initials,
  c.email,
  c.phone,
  c.role,
  c.department,
  c.location,
  c.location_city,
  c.source,
  c.recruiter_id,
  r.full_name  as recruiter_name,
  r.initials   as recruiter_initials,
  c.offer_date,
  c.joining_date,
  (c.joining_date - current_date)                 as joining_in_days,
  c.status,
  c.current_stage,
  c.risk_level,
  c.risk_score,
  c.engagement_score,
  c.last_interaction_at,
  c.last_interaction_channel,
  case
    when c.last_interaction_at is null then null
    else extract(day from (now() - c.last_interaction_at))::int
  end                                             as days_since_interaction,
  c.next_action,
  c.next_action_source,
  (
    select count(*) from candidate_journey_steps s
    where s.candidate_id = c.id and s.status = 'completed'
  )                                               as steps_completed,
  6                                               as steps_total,
  (
    select count(*) from tasks t
    where t.candidate_id = c.id and t.status in ('open', 'in_progress')
  )                                               as open_tasks,
  (
    select coalesce(sum(cv.unread_count), 0) from conversations cv
    where cv.candidate_id = c.id
  )                                               as unread_messages
from candidates c
join recruiters r on r.id = c.recruiter_id;

-- 6.2 v_stage_funnel: candidates reaching each engagement stage, and how
--     many declined at each stage. Feeds the funnel and stage drop-off widgets.
create view v_stage_funnel as
with stage_list as (
  select * from (values
    ('offer_accepted'::engagement_stage, 1),
    ('welcome_sent',   2),
    ('documentation',  3),
    ('manager_intro',  4),
    ('pre_joining',    5),
    ('joined',         6)
  ) as s(stage, position)
),
stage_rank as (
  select
    c.id,
    case c.current_stage
      when 'offer_accepted' then 1
      when 'welcome_sent'   then 2
      when 'documentation'  then 3
      when 'manager_intro'  then 4
      when 'pre_joining'    then 5
      when 'joined'         then 6
    end as current_rank,
    c.declined_at_stage
  from candidates c
)
select
  sl.stage,
  sl.position,
  (select count(*) from stage_rank sr where sr.current_rank >= sl.position)   as candidates_reached,
  (select count(*) from stage_rank sr where sr.declined_at_stage = sl.stage)  as declined_at_stage
from stage_list sl
order by sl.position;

-- 6.3 v_recruiter_conversion: offered vs joined per recruiter.
create view v_recruiter_conversion as
select
  r.id                                                   as recruiter_id,
  r.full_name                                            as recruiter_name,
  r.initials,
  count(c.id)                                            as offered,
  count(c.id) filter (where c.status = 'joined')         as joined,
  count(c.id) filter (where c.status = 'declined')       as declined,
  round(
    100.0 * count(c.id) filter (where c.status = 'joined')
    / nullif(count(c.id), 0)
  , 1)                                                    as offer_to_join_rate
from recruiters r
left join candidates c on c.recruiter_id = r.id
group by r.id, r.full_name, r.initials
order by r.full_name;

-- 6.4 v_conversion_trend_weekly: cumulative offer-to-join conversion by week,
--     bucketed on offer_date. Feeds the conversion trend line chart.
create view v_conversion_trend_weekly as
with weeks as (
  select generate_series(
    date_trunc('week', coalesce((select min(offer_date) from candidates), current_date)::timestamp),
    date_trunc('week', current_date::timestamp),
    interval '1 week'
  )::date as week_start
)
select
  w.week_start,
  (w.week_start + 6)                                                      as week_end,
  count(c.id) filter (
    where date_trunc('week', c.offer_date::timestamp)::date = w.week_start
  )                                                                       as offered_in_week,
  count(c.id) filter (
    where date_trunc('week', c.offer_date::timestamp)::date <= w.week_start
  )                                                                       as cumulative_offered,
  count(c.id) filter (
    where c.status = 'joined'
      and date_trunc('week', c.offer_date::timestamp)::date <= w.week_start
  )                                                                       as cumulative_joined,
  round(
    100.0 * count(c.id) filter (
      where c.status = 'joined'
        and date_trunc('week', c.offer_date::timestamp)::date <= w.week_start
    )
    / nullif(count(c.id) filter (
      where date_trunc('week', c.offer_date::timestamp)::date <= w.week_start
    ), 0)
  , 1)                                                                    as cumulative_conversion_rate
from weeks w
left join candidates c on true
group by w.week_start
order by w.week_start;

commit;
