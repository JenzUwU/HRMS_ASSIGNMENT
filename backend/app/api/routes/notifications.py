"""Recruiter notification feed for the in-app bell.

    GET /api/v1/notifications

Backed by engagement_events rows written by services/recruiter_notify.py
(metadata.notification=True). No recruiter filter yet (auth is a later phase),
so every recruiter's notifications are returned.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import DB
from app.db import repositories as repo
from app.schemas.notification import RecruiterNotification

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[RecruiterNotification])
def list_notifications(
    db: DB, limit: int = Query(30, ge=1, le=100)
) -> list[RecruiterNotification]:
    rows = repo.list_notification_events(db, limit=limit)
    out: list[RecruiterNotification] = []
    for r in rows:
        meta = r.get("metadata") or {}
        out.append(
            RecruiterNotification(
                id=str(r["id"]),
                candidate_id=str(r["candidate_id"]),
                candidate_name=r.get("candidate_name"),
                candidate_slug=r.get("candidate_slug"),
                candidate_initials=r.get("candidate_initials"),
                kind=meta.get("notification_kind") or "general",
                title=r.get("title") or "Candidate needs attention",
                reason=meta.get("reason"),
                recommended_action=meta.get("recommended_action"),
                email_sent=bool(meta.get("email_sent")),
                occurred_at=r["occurred_at"],
            )
        )
    return out
