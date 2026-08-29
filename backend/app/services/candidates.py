"""Candidate-centric assembly logic.

Each function takes a Supabase client and a resolved candidate row (from
repositories.resolve_candidate) and builds one Pydantic response object.
"""
from __future__ import annotations

from supabase import Client

from app.core.constants import JOURNEY_STAGES, STAGE_LABEL
from app.db import repositories as repo
from app.schemas.candidate import (
    CandidateDetail,
    CandidateDocument,
    CandidateNote,
    CandidateTask,
    RiskSummary,
)
from app.schemas.communication import (
    CandidateCommunications,
    ConversationThread,
    Message,
)
from app.schemas.engagement import (
    EngagementEvent,
    EngagementJourney,
    JourneyProgress,
    JourneyStep,
)

_OPEN_TASK_STATUSES = {"open", "in_progress"}
_PENDING_DOC_STATUSES = {"pending", "submitted", "rejected"}


def _risk_summary(row: dict | None) -> RiskSummary | None:
    if not row:
        return None
    return RiskSummary(
        level=row["level"],
        score=row["score"],
        factors=row.get("factors") or [],
        summary=row.get("summary"),
        source=row["source"],
        model=row.get("model"),
        updated_at=row.get("created_at"),
    )


def build_candidate_detail(db: Client, list_row: dict) -> CandidateDetail:
    candidate_id = list_row["id"]
    record = repo.get_candidate_record(db, candidate_id) or {}
    risk = repo.get_current_risk_assessment(db, candidate_id)
    notes = repo.list_notes(db, candidate_id)

    data = {
        **list_row,
        "employment_type": record.get("employment_type", "full_time"),
        "declined_at_stage": record.get("declined_at_stage"),
        "risk": _risk_summary(risk),
        "latest_note": CandidateNote.model_validate(notes[0]) if notes else None,
    }
    return CandidateDetail.model_validate(data)


def build_engagement_journey(db: Client, list_row: dict) -> EngagementJourney:
    candidate_id = list_row["id"]

    step_rows = {r["stage"]: r for r in repo.list_journey_steps(db, candidate_id)}
    steps: list[JourneyStep] = []
    for position, (stage, label) in enumerate(JOURNEY_STAGES, start=1):
        r = step_rows.get(stage, {})
        steps.append(
            JourneyStep(
                id=r.get("id"),
                stage=stage,
                label=label,
                status=r.get("status", "pending"),
                position=r.get("position", position),
                due_date=r.get("due_date"),
                started_at=r.get("started_at"),
                completed_at=r.get("completed_at"),
            )
        )

    completed = sum(1 for s in steps if s.status == "completed")
    in_progress = sum(1 for s in steps if s.status == "in_progress")
    pending = sum(1 for s in steps if s.status in ("pending", "skipped"))
    progress = JourneyProgress(
        total_steps=len(steps),
        completed=completed,
        in_progress=in_progress,
        pending=pending,
        percent_complete=round(100 * completed / len(steps)) if steps else 0,
    )

    timeline = [
        EngagementEvent.model_validate(e)
        for e in repo.list_engagement_events(db, candidate_id, limit=100)
    ]

    tasks = repo.list_tasks(db, candidate_id)
    upcoming = [
        CandidateTask.model_validate(t)
        for t in tasks
        if t["status"] in _OPEN_TASK_STATUSES
    ]

    docs = repo.list_documents(db, candidate_id)
    pending_docs = [
        CandidateDocument.model_validate(d)
        for d in docs
        if d["status"] in _PENDING_DOC_STATUSES
    ]

    return EngagementJourney(
        candidate_id=candidate_id,
        candidate_slug=list_row["slug"],
        current_stage=list_row["current_stage"],
        status=list_row["status"],
        steps=steps,
        progress=progress,
        timeline=timeline,
        risk=_risk_summary(repo.get_current_risk_assessment(db, candidate_id)),
        upcoming_tasks=upcoming,
        pending_documents=pending_docs,
    )


def build_candidate_communications(db: Client, list_row: dict) -> CandidateCommunications:
    candidate_id = list_row["id"]
    conversations = repo.list_conversations_for_candidate(db, candidate_id)
    messages = repo.list_messages_for_candidate(db, candidate_id)

    by_conv: dict[str, list[Message]] = {}
    for m in messages:
        by_conv.setdefault(m["conversation_id"], []).append(Message.model_validate(m))

    threads = [
        ConversationThread.model_validate({**c, "messages": by_conv.get(c["id"], [])})
        for c in conversations
    ]
    return CandidateCommunications(
        candidate_id=candidate_id,
        candidate_slug=list_row["slug"],
        conversations=threads,
    )
