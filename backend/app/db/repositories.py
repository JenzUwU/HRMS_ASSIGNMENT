"""
Data access layer.

Every function takes a Supabase ``Client`` and returns plain dicts / lists of
dicts (or None). Routes and services map these to Pydantic response models.
PostgREST errors are translated to ``UpstreamError`` so callers never see the
SDK exception type.
"""
from __future__ import annotations

import calendar
from datetime import date
from typing import Any
from uuid import UUID

import time

from postgrest import APIError
from supabase import Client

from app.core.errors import UpstreamError
from app.core.logging import logger

Row = dict[str, Any]

_MAX_ATTEMPTS = 3


def _run(query) -> Any:
    """Execute a PostgREST query, retrying transient transport failures.

    A long-lived server can hold a pooled connection that the Supabase edge has
    already closed (GOAWAY / ConnectionTerminated). Those raise httpx errors and
    clear on a fresh connection, so we retry. PostgREST APIErrors (bad SQL, RLS)
    are not retried.
    """
    last: Exception | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return query.execute()
        except APIError as exc:
            # A real PostgREST error (bad column, RLS, constraint). Not retryable.
            raise UpstreamError(f"Database request failed: {exc.message}") from exc
        except Exception as exc:  # noqa: BLE001
            # Transport / protocol failures (ConnectionTerminated, timeouts,
            # HTTP/2 stream resets). These clear on a fresh connection.
            last = exc
            if attempt < _MAX_ATTEMPTS:
                logger.warning(
                    "Supabase call failed (attempt %d/%d): %s: %s",
                    attempt, _MAX_ATTEMPTS, type(exc).__name__, exc,
                )
                time.sleep(0.25 * attempt)
                continue
    raise UpstreamError(f"Could not reach the database: {last}") from last


# ---------------------------------------------------------------------------
# candidates
# ---------------------------------------------------------------------------

_CANDIDATE_LIST_VIEW = "v_candidate_list"


def list_candidates(
    db: Client,
    *,
    joining_month: str | None = None,
    recruiter_id: UUID | None = None,
    role: str | None = None,
    risk_level: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Row], int]:
    q = db.table(_CANDIDATE_LIST_VIEW).select("*", count="exact")

    if joining_month:
        year, month = (int(p) for p in joining_month.split("-"))
        first = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        last = date(year, month, last_day)
        q = q.gte("joining_date", first.isoformat()).lte("joining_date", last.isoformat())
    if recruiter_id:
        q = q.eq("recruiter_id", str(recruiter_id))
    if role:
        q = q.eq("role", role)
    if risk_level:
        q = q.eq("risk_level", risk_level)
    if status:
        q = q.eq("status", status)
    if search:
        q = q.ilike("full_name", f"%{search}%")

    offset = (page - 1) * page_size
    q = q.order("last_interaction_at", desc=True).range(offset, offset + page_size - 1)

    res = _run(q)
    return res.data or [], res.count or 0


def get_candidate_list_row(db: Client, candidate_id: UUID) -> Row | None:
    res = _run(
        db.table(_CANDIDATE_LIST_VIEW).select("*").eq("id", str(candidate_id)).limit(1)
    )
    return res.data[0] if res.data else None


def get_candidate_record(db: Client, candidate_id: UUID) -> Row | None:
    res = _run(
        db.table("candidates").select("*").eq("id", str(candidate_id)).limit(1)
    )
    return res.data[0] if res.data else None


def _looks_like_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def resolve_candidate(db: Client, ref: str) -> Row | None:
    """Resolve a path parameter that may be either a UUID or a candidate slug.

    Returns the v_candidate_list row (or None). Callers use row['id'] (the UUID)
    for any follow-up child queries.
    """
    column = "id" if _looks_like_uuid(ref) else "slug"
    res = _run(
        db.table(_CANDIDATE_LIST_VIEW).select("*").eq(column, ref).limit(1)
    )
    return res.data[0] if res.data else None


def get_recruiter(db: Client, recruiter_id: UUID | str) -> Row | None:
    res = _run(
        db.table("recruiters").select("*").eq("id", str(recruiter_id)).limit(1)
    )
    return res.data[0] if res.data else None


def list_recruiters(db: Client) -> list[Row]:
    return _run(db.table("recruiters").select("*").order("full_name")).data or []


def get_recruiter_by_email(db: Client, email: str) -> Row | None:
    """Match an authenticated HR user to their recruiter profile by email."""
    res = _run(
        db.table("recruiters").select("*").eq("email", email.lower().strip()).limit(1)
    )
    return res.data[0] if res.data else None


def insert_recruiter(db: Client, fields: dict[str, Any]) -> Row:
    """Provision a recruiter profile for a newly registered HR user. Reuses the
    existing recruiters table; no schema change."""
    res = _run(db.table("recruiters").insert(fields))
    if not res.data:
        raise UpstreamError("Failed to create the recruiter profile.")
    return res.data[0]


# ---------------------------------------------------------------------------
# risk
# ---------------------------------------------------------------------------

def get_current_risk_assessment(db: Client, candidate_id: UUID) -> Row | None:
    res = _run(
        db.table("risk_assessments")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .eq("is_current", True)
        .limit(1)
    )
    return res.data[0] if res.data else None


def list_risk_assessments(db: Client, candidate_id: UUID) -> list[Row]:
    return _run(
        db.table("risk_assessments")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("created_at", desc=True)
    ).data or []


# ---------------------------------------------------------------------------
# notes
# ---------------------------------------------------------------------------

def list_notes(db: Client, candidate_id: UUID) -> list[Row]:
    rows = _run(
        db.table("candidate_notes")
        .select("*, author:recruiters(full_name, initials)")
        .eq("candidate_id", str(candidate_id))
        .order("created_at", desc=True)
    ).data or []
    for row in rows:
        author = row.pop("author", None) or {}
        row["author_name"] = author.get("full_name")
        row["author_initials"] = author.get("initials")
    return rows


# ---------------------------------------------------------------------------
# engagement journey
# ---------------------------------------------------------------------------

def list_journey_steps(db: Client, candidate_id: UUID) -> list[Row]:
    return _run(
        db.table("candidate_journey_steps")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("position")
    ).data or []


def list_engagement_events(db: Client, candidate_id: UUID, limit: int = 50) -> list[Row]:
    return _run(
        db.table("engagement_events")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("occurred_at", desc=True)
        .limit(limit)
    ).data or []


# ---------------------------------------------------------------------------
# communications
# ---------------------------------------------------------------------------

def list_conversations_for_candidate(db: Client, candidate_id: UUID) -> list[Row]:
    res = _run(
        db.table("conversations")
        .select(_CONV_SELECT)
        .eq("candidate_id", str(candidate_id))
        .order("last_message_at", desc=True)
    )
    return [_flatten_conversation(r) for r in (res.data or [])]


def list_messages_for_candidate(db: Client, candidate_id: UUID) -> list[Row]:
    return _run(
        db.table("messages")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("sent_at")
    ).data or []


_CONV_SELECT = (
    "*, candidate:candidates(full_name, initials, slug, role, "
    "location_city, status, current_stage)"
)


def _flatten_conversation(row: Row) -> Row:
    cand = row.pop("candidate", None) or {}
    row["candidate_name"] = cand.get("full_name")
    row["candidate_initials"] = cand.get("initials")
    row["candidate_slug"] = cand.get("slug")
    row["candidate_role"] = cand.get("role")
    row["candidate_location_city"] = cand.get("location_city")
    row["candidate_status"] = cand.get("status")
    row["candidate_current_stage"] = cand.get("current_stage")
    return row


def list_conversations(db: Client, *, page: int = 1, page_size: int = 20) -> tuple[list[Row], int]:
    offset = (page - 1) * page_size
    res = _run(
        db.table("conversations")
        .select(_CONV_SELECT, count="exact")
        .order("last_message_at", desc=True)
        .range(offset, offset + page_size - 1)
    )
    return [_flatten_conversation(r) for r in (res.data or [])], res.count or 0


def get_conversation(db: Client, conversation_id: UUID) -> Row | None:
    res = _run(
        db.table("conversations")
        .select(_CONV_SELECT)
        .eq("id", str(conversation_id))
        .limit(1)
    )
    return _flatten_conversation(res.data[0]) if res.data else None


def list_messages_for_conversation(db: Client, conversation_id: UUID) -> list[Row]:
    return _run(
        db.table("messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("sent_at")
    ).data or []


# ---------------------------------------------------------------------------
# tasks / documents / templates
# ---------------------------------------------------------------------------

def list_tasks(db: Client, candidate_id: UUID) -> list[Row]:
    return _run(
        db.table("tasks")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("due_date")
    ).data or []


def list_documents(db: Client, candidate_id: UUID) -> list[Row]:
    return _run(
        db.table("documents")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("doc_type")
    ).data or []


def list_message_templates(db: Client) -> list[Row]:
    return _run(
        db.table("message_templates").select("*").order("category")
    ).data or []


# ---------------------------------------------------------------------------
# analytics
# ---------------------------------------------------------------------------

def _count(db: Client, table: str, build=None) -> int:
    q = db.table(table).select("id", count="exact")
    if build:
        q = build(q)
    return _run(q).count or 0


def analytics_summary(db: Client) -> Row:
    today = date.today().isoformat()

    total_offered = _count(db, "candidates")
    joined = _count(db, "candidates", lambda q: q.eq("status", "joined"))
    declined = _count(db, "candidates", lambda q: q.eq("status", "declined"))
    high_risk = _count(db, "candidates", lambda q: q.eq("risk_level", "high"))

    def joining_within(days: int) -> int:
        end = (date.today().toordinal() + days)
        end_iso = date.fromordinal(end).isoformat()
        return _count(
            db,
            "candidates",
            lambda q: q.gte("joining_date", today)
            .lte("joining_date", end_iso)
            .neq("status", "joined"),
        )

    total_events = _count(db, "engagement_events")
    avg_engagement_frequency = (
        round(total_events / total_offered, 1) if total_offered else 0.0
    )
    # joined / offered: a point-in-time snapshot while the pipeline is still moving.
    conversion = round(100.0 * joined / total_offered, 1) if total_offered else 0.0
    # joined / (joined + declined): conversion among candidates who have resolved.
    resolved = joined + declined
    resolved_rate = round(100.0 * joined / resolved, 1) if resolved else 0.0
    in_progress = total_offered - resolved

    return {
        "total_offered": total_offered,
        "joined": joined,
        "declined": declined,
        "in_progress": in_progress,
        "offer_to_join_conversion": conversion,
        "resolved_conversion_rate": resolved_rate,
        "high_risk_candidates": high_risk,
        "joining_next_7_days": joining_within(7),
        "joining_next_15_days": joining_within(15),
        "joining_next_30_days": joining_within(30),
        "average_engagement_frequency": avg_engagement_frequency,
    }


def stage_funnel(db: Client) -> list[Row]:
    return _run(db.table("v_stage_funnel").select("*").order("position")).data or []


def recruiter_conversion(db: Client) -> list[Row]:
    return _run(
        db.table("v_recruiter_conversion").select("*").order("recruiter_name")
    ).data or []


def conversion_trend(db: Client) -> list[Row]:
    return _run(
        db.table("v_conversion_trend_weekly").select("*").order("week_start")
    ).data or []


# ---------------------------------------------------------------------------
# AI writes (recommendations + risk assessments)
#
# Both tables keep history: previous rows stay, only the is_current flag moves.
# The unique partial indexes (ai_recommendations_one_current_per_kind,
# risk_assessments_one_current_per_candidate) require clearing the old current
# row BEFORE inserting the new one.
# ---------------------------------------------------------------------------

def list_ai_recommendations(
    db: Client, candidate_id: UUID | str, *, kind: str | None = None
) -> list[Row]:
    q = (
        db.table("ai_recommendations")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("created_at", desc=True)
    )
    if kind:
        q = q.eq("kind", kind)
    return _run(q).data or []


def get_current_ai_recommendation(
    db: Client, candidate_id: UUID | str, kind: str
) -> Row | None:
    res = _run(
        db.table("ai_recommendations")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .eq("kind", kind)
        .eq("is_current", True)
        .limit(1)
    )
    return res.data[0] if res.data else None


def insert_ai_recommendation(
    db: Client,
    *,
    candidate_id: UUID | str,
    kind: str,
    payload: dict[str, Any],
    prompt_context: dict[str, Any] | None,
    model: str | None,
    status: str = "suggested",
) -> Row:
    cid = str(candidate_id)
    _run(
        db.table("ai_recommendations")
        .update({"is_current": False})
        .eq("candidate_id", cid)
        .eq("kind", kind)
        .eq("is_current", True)
    )
    res = _run(
        db.table("ai_recommendations").insert(
            {
                "candidate_id": cid,
                "kind": kind,
                "payload": payload,
                "prompt_context": prompt_context,
                "model": model,
                "status": status,
                "is_current": True,
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to persist the AI recommendation.")
    return res.data[0]


def insert_risk_assessment(
    db: Client,
    *,
    candidate_id: UUID | str,
    level: str,
    score: int,
    factors: list[str],
    summary: str,
    model: str | None,
    source: str = "ai",
) -> Row:
    cid = str(candidate_id)
    _run(
        db.table("risk_assessments")
        .update({"is_current": False})
        .eq("candidate_id", cid)
        .eq("is_current", True)
    )
    res = _run(
        db.table("risk_assessments").insert(
            {
                "candidate_id": cid,
                "level": level,
                "score": score,
                "factors": factors,
                "summary": summary,
                "source": source,
                "model": model,
                "is_current": True,
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to persist the risk assessment.")
    new_row = res.data[0]

    # Keep the denormalized fields on candidates in sync so v_candidate_list,
    # the dashboard and the candidate list all reflect the new assessment.
    _run(
        db.table("candidates")
        .update(
            {
                "current_risk_assessment_id": new_row["id"],
                "risk_level": level,
                "risk_score": score,
            }
        )
        .eq("id", cid)
    )
    return new_row


# ---------------------------------------------------------------------------
# automated engagement sweep (services/engagement_rules.py)
# ---------------------------------------------------------------------------

def list_automation_eligible_candidates(
    db: Client,
    *,
    joining_within_days: int,
    stale_after_days: int,
    today: date | None = None,
    limit: int = 25,
) -> list[Row]:
    """v_candidate_list rows matching the pre-joining no-interaction rule:

        status not in ('joined', 'declined')
        AND today <= joining_date <= today + joining_within_days
        AND (last_interaction_at IS NULL
             OR last_interaction_at < now() - stale_after_days days)
    """
    from datetime import datetime, timedelta, timezone

    today = today or date.today()
    window_end = (today + timedelta(days=joining_within_days)).isoformat()
    stale_cutoff = (
        datetime.now(timezone.utc) - timedelta(days=stale_after_days)
    ).isoformat()

    res = _run(
        db.table(_CANDIDATE_LIST_VIEW)
        .select("*")
        .not_.in_("status", ["joined", "declined"])
        .gte("joining_date", today.isoformat())
        .lte("joining_date", window_end)
        .or_(
            f"last_interaction_at.is.null,last_interaction_at.lt.{stale_cutoff}"
        )
        .order("joining_date")
        .limit(limit)
    )
    return res.data or []


def count_candidates(db: Client) -> int:
    return _count(db, "candidates")


def has_open_automation_task(db: Client, candidate_id: UUID | str) -> bool:
    res = _run(
        db.table("tasks")
        .select("id", count="exact")
        .eq("candidate_id", str(candidate_id))
        .eq("source", "automation")
        .in_("status", ["open", "in_progress"])
        .limit(1)
    )
    return (res.count or 0) > 0


def recent_automation_event_exists(
    db: Client, candidate_id: UUID | str, *, rule: str, since_iso: str
) -> bool:
    res = _run(
        db.table("engagement_events")
        .select("id, metadata, occurred_at")
        .eq("candidate_id", str(candidate_id))
        .eq("event_type", "reminder_sent")
        .gte("occurred_at", since_iso)
        .order("occurred_at", desc=True)
        .limit(10)
    )
    for row in res.data or []:
        meta = row.get("metadata") or {}
        if meta.get("automation") and meta.get("rule") == rule:
            return True
    return False


def insert_task(
    db: Client,
    *,
    candidate_id: UUID | str,
    title: str,
    detail: str | None,
    related_stage: str | None,
    priority: str,
    source: str,
    due_date: str | None,
    assigned_recruiter_id: UUID | str | None = None,
) -> Row:
    res = _run(
        db.table("tasks").insert(
            {
                "candidate_id": str(candidate_id),
                "assigned_recruiter_id": str(assigned_recruiter_id)
                if assigned_recruiter_id
                else None,
                "title": title,
                "detail": detail,
                "related_stage": related_stage,
                "priority": priority,
                "status": "open",
                "source": source,
                "due_date": due_date,
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to create the task.")
    return res.data[0]


def insert_engagement_event(
    db: Client,
    *,
    candidate_id: UUID | str,
    event_type: str,
    stage: str | None,
    actor: str,
    channel: str | None,
    title: str,
    description: str | None,
    occurred_at: str,
    metadata: dict[str, Any] | None = None,
) -> Row:
    res = _run(
        db.table("engagement_events").insert(
            {
                "candidate_id": str(candidate_id),
                "event_type": event_type,
                "stage": stage,
                "actor": actor,
                "channel": channel,
                "title": title,
                "description": description,
                "occurred_at": occurred_at,
                "metadata": metadata or {},
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to record the engagement event.")
    return res.data[0]


# ---------------------------------------------------------------------------
# write endpoints (services/mutations.py)
# ---------------------------------------------------------------------------

def insert_note(
    db: Client,
    *,
    candidate_id: UUID | str,
    body: str,
    is_pinned: bool = False,
    author_recruiter_id: UUID | str | None = None,
) -> Row:
    res = _run(
        db.table("candidate_notes").insert(
            {
                "candidate_id": str(candidate_id),
                "body": body,
                "is_pinned": is_pinned,
                "author_recruiter_id": str(author_recruiter_id)
                if author_recruiter_id
                else None,
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to save the note.")
    row = res.data[0]
    row["author_name"] = None
    row["author_initials"] = None
    return row


def update_candidate(
    db: Client, candidate_id: UUID | str, fields: dict[str, Any]
) -> Row:
    """Patch a subset of candidates columns and return the refreshed list row."""
    if fields:
        _run(
            db.table("candidates")
            .update(fields)
            .eq("id", str(candidate_id))
        )
    row = get_candidate_list_row(db, candidate_id)  # type: ignore[arg-type]
    if row is None:
        raise UpstreamError("Candidate disappeared after update.")
    return row


def get_journey_step(
    db: Client, candidate_id: UUID | str, stage: str
) -> Row | None:
    res = _run(
        db.table("candidate_journey_steps")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .eq("stage", stage)
        .limit(1)
    )
    return res.data[0] if res.data else None


def upsert_journey_step(
    db: Client,
    *,
    candidate_id: UUID | str,
    stage: str,
    position: int,
    status: str,
    started_at: str | None,
    completed_at: str | None,
) -> Row:
    cid = str(candidate_id)
    existing = get_journey_step(db, cid, stage)
    values = {
        "status": status,
        "started_at": started_at,
        "completed_at": completed_at,
    }
    if existing:
        res = _run(
            db.table("candidate_journey_steps")
            .update(values)
            .eq("id", existing["id"])
        )
    else:
        res = _run(
            db.table("candidate_journey_steps").insert(
                {
                    "candidate_id": cid,
                    "stage": stage,
                    "position": position,
                    **values,
                }
            )
        )
    if not res.data:
        raise UpstreamError("Failed to update the journey step.")
    return res.data[0]


def get_or_create_conversation(
    db: Client, *, candidate_id: UUID | str, channel: str, subject: str
) -> Row:
    cid = str(candidate_id)
    res = _run(
        db.table("conversations")
        .select("*")
        .eq("candidate_id", cid)
        .eq("channel", channel)
        .limit(1)
    )
    if res.data:
        return res.data[0]
    created = _run(
        db.table("conversations").insert(
            {"candidate_id": cid, "channel": channel, "subject": subject}
        )
    )
    if not created.data:
        raise UpstreamError("Failed to open a conversation.")
    return created.data[0]


def insert_message(
    db: Client,
    *,
    conversation_id: UUID | str,
    candidate_id: UUID | str,
    channel: str,
    body: str,
    subject: str | None,
    is_internal_note: bool,
    is_ai_generated: bool,
    sent_at: str,
    sender_name: str = "HR",
) -> Row:
    res = _run(
        db.table("messages").insert(
            {
                "conversation_id": str(conversation_id),
                "candidate_id": str(candidate_id),
                "direction": "outbound",
                "channel": channel,
                "actor": "recruiter",
                "sender_name": sender_name,
                "subject": subject,
                "body": body,
                "status": "sent",
                "is_ai_generated": is_ai_generated,
                "is_internal_note": is_internal_note,
                "sent_at": sent_at,
            }
        )
    )
    if not res.data:
        raise UpstreamError("Failed to send the message.")
    return res.data[0]


def touch_conversation(
    db: Client, conversation_id: UUID | str, *, preview: str, at: str
) -> None:
    _run(
        db.table("conversations")
        .update({"last_message_at": at, "last_message_preview": preview[:180]})
        .eq("id", str(conversation_id))
    )


def get_ai_recommendation(db: Client, recommendation_id: UUID | str) -> Row | None:
    res = _run(
        db.table("ai_recommendations")
        .select("*")
        .eq("id", str(recommendation_id))
        .limit(1)
    )
    return res.data[0] if res.data else None


def update_ai_recommendation(
    db: Client,
    recommendation_id: UUID | str,
    *,
    status: str,
    hr_override_text: str | None,
    resolved_at: str,
) -> Row:
    values: dict[str, Any] = {"status": status, "resolved_at": resolved_at}
    if hr_override_text is not None:
        values["hr_override_text"] = hr_override_text
    res = _run(
        db.table("ai_recommendations")
        .update(values)
        .eq("id", str(recommendation_id))
    )
    if not res.data:
        raise UpstreamError("Failed to update the recommendation.")
    return res.data[0]


def get_risk_assessment(db: Client, assessment_id: UUID | str) -> Row | None:
    res = _run(
        db.table("risk_assessments")
        .select("*")
        .eq("id", str(assessment_id))
        .limit(1)
    )
    return res.data[0] if res.data else None


# ---------------------------------------------------------------------------
# candidate creation (services/candidate_admin.py)
# ---------------------------------------------------------------------------

def slug_exists(db: Client, slug: str) -> bool:
    res = _run(
        db.table("candidates").select("id", count="exact").eq("slug", slug).limit(1)
    )
    return (res.count or 0) > 0


def email_in_use(db: Client, email: str) -> bool:
    res = _run(
        db.table("candidates")
        .select("id", count="exact")
        .eq("email", email.lower())
        .limit(1)
    )
    return (res.count or 0) > 0


def insert_candidate(db: Client, fields: dict[str, Any]) -> Row:
    res = _run(db.table("candidates").insert(fields))
    if not res.data:
        raise UpstreamError("Failed to create the candidate.")
    # Return the denormalized list row so callers can build CandidateDetail.
    row = get_candidate_list_row(db, res.data[0]["id"])
    if row is None:
        raise UpstreamError("Candidate was created but could not be read back.")
    return row


# ---------------------------------------------------------------------------
# outbound email (services/email.py, api/routes/webhooks.py)
#
# Reuses the existing `messages` / `conversations` / `engagement_events` tables
# unchanged. The Resend provider message id has no dedicated column, so it is
# stored in the companion engagement_events.metadata (jsonb) alongside the
# persisted message.
# ---------------------------------------------------------------------------

def insert_outbound_email(
    db: Client,
    *,
    conversation_id: UUID | str,
    candidate_id: UUID | str,
    sender_name: str,
    sender_recruiter_id: UUID | str | None,
    subject: str,
    body: str,
    is_ai_generated: bool,
    sent_at: str,
) -> Row:
    res = _run(
        db.table("messages").insert(
            {
                "conversation_id": str(conversation_id),
                "candidate_id": str(candidate_id),
                "direction": "outbound",
                "channel": "email",
                "actor": "recruiter",
                "sender_name": sender_name,
                "sender_recruiter_id": (
                    str(sender_recruiter_id) if sender_recruiter_id else None
                ),
                "subject": subject,
                "body": body,
                "status": "sent",
                "is_ai_generated": is_ai_generated,
                "sent_at": sent_at,
            }
        )
    )
    if not res.data:
        raise UpstreamError("The email was sent but could not be stored.")
    return res.data[0]


def find_email_event_by_provider_id(
    db: Client, provider_message_id: str
) -> Row | None:
    """The engagement_events row written when an outbound email was sent,
    matched on metadata.provider_message_id. Used by the delivery webhook and by
    inbound reply threading (In-Reply-To / References point at our Message-ID)."""
    res = _run(
        db.table("engagement_events")
        .select("id, candidate_id, metadata")
        .eq("metadata->>provider_message_id", provider_message_id)
        .order("occurred_at", desc=True)
        .limit(1)
    )
    return res.data[0] if res.data else None


# ---------------------------------------------------------------------------
# inbound email (services/inbound_email.py)
#
# Reuses the same messages / conversations / engagement_events tables. The
# inbound RFC Message-ID has no dedicated column, so it is stored in the
# companion engagement_events.metadata for idempotent re-polling.
# ---------------------------------------------------------------------------

def get_candidate_by_email(db: Client, email: str) -> Row | None:
    """Resolve a candidate from a raw email address (case-insensitive)."""
    res = _run(
        db.table("candidates").select("*").eq("email", email.lower().strip()).limit(1)
    )
    return res.data[0] if res.data else None


def find_inbound_event_by_message_id(db: Client, inbound_message_id: str) -> Row | None:
    """The companion event for an already-ingested inbound reply, if any."""
    res = _run(
        db.table("engagement_events")
        .select("id, candidate_id, metadata")
        .eq("metadata->>inbound_message_id", inbound_message_id)
        .limit(1)
    )
    return res.data[0] if res.data else None


def insert_inbound_email(
    db: Client,
    *,
    conversation_id: UUID | str,
    candidate_id: UUID | str,
    sender_name: str,
    subject: str | None,
    body: str,
    received_at: str,
) -> Row:
    """Persist a candidate email reply. direction=inbound, channel=email,
    actor=candidate. status uses 'delivered' (the message_status enum has no
    'received' value and cannot be altered here)."""
    res = _run(
        db.table("messages").insert(
            {
                "conversation_id": str(conversation_id),
                "candidate_id": str(candidate_id),
                "direction": "inbound",
                "channel": "email",
                "actor": "candidate",
                "sender_name": sender_name,
                "subject": subject,
                "body": body,
                "status": "delivered",
                "sent_at": received_at,
            }
        )
    )
    if not res.data:
        raise UpstreamError("The inbound reply could not be stored.")
    return res.data[0]


# ---------------------------------------------------------------------------
# recruiter notifications (services/recruiter_notify.py)
#
# Persisted as engagement_events rows (metadata.notification=True). This is both
# the in-app bell feed and the dedup record; no new table.
# ---------------------------------------------------------------------------

def find_notification_event(db: Client, notification_key: str) -> Row | None:
    """The recruiter-notification event for this key, if one was already sent."""
    res = _run(
        db.table("engagement_events")
        .select("id, candidate_id, metadata")
        .eq("metadata->>notification_key", notification_key)
        .limit(1)
    )
    return res.data[0] if res.data else None


def list_notification_events(db: Client, *, limit: int = 30) -> list[Row]:
    """Recent recruiter-notification events, newest first, with candidate name.

    No recruiter filter yet (auth is a later phase), so the bell shows every
    recruiter's notifications.
    """
    res = _run(
        db.table("engagement_events")
        .select(
            "id, candidate_id, event_type, title, description, occurred_at, "
            "metadata, candidate:candidates(full_name, slug, initials)"
        )
        .eq("metadata->>notification", "true")
        .order("occurred_at", desc=True)
        .limit(limit)
    )
    rows = res.data or []
    for row in rows:
        cand = row.pop("candidate", None) or {}
        row["candidate_name"] = cand.get("full_name")
        row["candidate_slug"] = cand.get("slug")
        row["candidate_initials"] = cand.get("initials")
    return rows
