"""Builds the candidate context passed to the LLM.

Only engagement-relevant, non-sensitive fields are included. Internal ids,
email, phone, storage paths and any server credentials are deliberately left
out - the model never needs them and they should not leave the backend.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from app.core.constants import STAGE_LABEL
from app.db import repositories as repo

_MAX_EVENTS = 10
_MAX_MESSAGES = 10
_MAX_NOTES = 4
_MAX_TEXT = 500


def _iso(value: Any) -> str | None:
    return str(value) if value is not None else None


def _clip(text: str | None) -> str | None:
    if not text:
        return text
    return text if len(text) <= _MAX_TEXT else text[:_MAX_TEXT] + "…"


def build_candidate_context(db: Client, candidate: dict) -> dict[str, Any]:
    """`candidate` is a v_candidate_list row (from repo.resolve_candidate)."""
    cid = candidate["id"]

    steps = repo.list_journey_steps(db, cid)
    events = repo.list_engagement_events(db, cid, limit=_MAX_EVENTS)
    messages = repo.list_messages_for_candidate(db, cid)[-_MAX_MESSAGES:]
    tasks = repo.list_tasks(db, cid)
    documents = repo.list_documents(db, cid)
    notes = repo.list_notes(db, cid)[:_MAX_NOTES]
    risk = repo.get_current_risk_assessment(db, cid)

    return {
        "candidate": {
            "name": candidate["full_name"],
            "role": candidate["role"],
            "department": candidate.get("department"),
            "location_city": candidate.get("location_city")
            or candidate.get("location"),
            "source": candidate.get("source"),
            "employment_type": candidate.get("employment_type", "full_time"),
        },
        "timeline_position": {
            "status": candidate["status"],
            "current_stage": candidate["current_stage"],
            "current_stage_label": STAGE_LABEL.get(
                candidate["current_stage"], candidate["current_stage"]
            ),
            "offer_date": _iso(candidate.get("offer_date")),
            "joining_date": _iso(candidate.get("joining_date")),
            "days_until_joining": candidate.get("joining_in_days"),
            "days_since_last_interaction": candidate.get("days_since_interaction"),
            "last_interaction_channel": candidate.get("last_interaction_channel"),
            "engagement_score": candidate.get("engagement_score"),
        },
        "recruiter": {"name": candidate.get("recruiter_name")},
        "journey_steps": [
            {
                "stage": STAGE_LABEL.get(s["stage"], s["stage"]),
                "status": s["status"],
                "due_date": _iso(s.get("due_date")),
                "completed_at": _iso(s.get("completed_at")),
            }
            for s in steps
        ],
        "journey_progress": {
            "steps_completed": candidate.get("steps_completed"),
            "steps_total": candidate.get("steps_total"),
        },
        "recent_events": [
            {
                "type": e["event_type"],
                "actor": e["actor"],
                "title": e["title"],
                "description": _clip(e.get("description")),
                "occurred_at": _iso(e.get("occurred_at")),
            }
            for e in events
        ],
        "recent_messages": [
            {
                "direction": m["direction"],
                "actor": m["actor"],
                "channel": m["channel"],
                "is_internal_note": m.get("is_internal_note", False),
                "subject": m.get("subject"),
                "body": _clip(m["body"]),
                "sent_at": _iso(m.get("sent_at")),
            }
            for m in messages
        ],
        "open_tasks": [
            {
                "title": t["title"],
                "detail": _clip(t.get("detail")),
                "status": t["status"],
                "priority": t.get("priority"),
                "due_date": _iso(t.get("due_date")),
            }
            for t in tasks
            if t["status"] in ("open", "in_progress")
        ],
        "documents": [
            {"type": d["doc_type"], "status": d["status"]} for d in documents
        ],
        "hr_notes": [
            {"body": _clip(n["body"]), "created_at": _iso(n.get("created_at"))}
            for n in notes
        ],
        "current_risk": (
            {
                "level": risk["level"],
                "score": risk["score"],
                "factors": risk.get("factors") or [],
                "source": risk["source"],
            }
            if risk
            else None
        ),
        "interaction_counts": {
            "messages_on_record": len(messages),
            "events_on_record": len(events),
        },
    }
