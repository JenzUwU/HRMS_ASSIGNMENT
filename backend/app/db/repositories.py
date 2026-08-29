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
    return _run(
        db.table("conversations")
        .select("*")
        .eq("candidate_id", str(candidate_id))
        .order("last_message_at", desc=True)
    ).data or []


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
