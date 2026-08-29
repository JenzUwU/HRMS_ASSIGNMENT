"""Write-side business logic.

Routes stay thin: they resolve the candidate (shared dependency), pass the
validated request model here, and return the typed result. All Supabase access
goes through app/db/repositories.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

from supabase import Client

from app.core.constants import JOURNEY_STAGES
from app.core.errors import NotFoundError, UpstreamError
from app.db import repositories as repo
from app.schemas.candidate import CandidateDetail, CandidateNote, CandidateTask
from app.schemas.communication import Message
from app.schemas.engagement import EngagementJourney
from app.schemas.mutations import (
    AIRecommendationPatch,
    AIRecommendationRecord,
    CreateMessageRequest,
    CreateNoteRequest,
    CreateTaskRequest,
    RiskAssessmentPatch,
    RiskOverrideResponse,
    RiskRecord,
    UpdateCandidateRequest,
    UpdateJourneyStepRequest,
)
from app.services import candidates as read_service

_STAGE_POSITION = {stage: i for i, (stage, _label) in enumerate(JOURNEY_STAGES, start=1)}
_BAND_SCORE = {"low": 20, "medium": 55, "high": 85}
_ACTION_STATUS = {"accept": "accepted", "dismiss": "dismissed", "override": "overridden"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- notes ---------------------------------------------------------------

def create_note(
    db: Client, candidate: dict, req: CreateNoteRequest
) -> CandidateNote:
    row = repo.insert_note(
        db,
        candidate_id=candidate["id"],
        body=req.body,
        is_pinned=req.is_pinned,
    )
    try:
        repo.insert_engagement_event(
            db,
            candidate_id=candidate["id"],
            event_type="note_added",
            stage=candidate.get("current_stage"),
            actor="hr",
            channel=None,
            title="Internal note added",
            description=req.body[:280],
            occurred_at=_now(),
            metadata={"note_id": row["id"]},
        )
    except UpstreamError:
        # The note is saved; a timeline entry is best-effort.
        pass
    return CandidateNote.model_validate(row)


# --- candidate status / preferred channel ---------------------------

def update_candidate(
    db: Client, candidate: dict, req: UpdateCandidateRequest
) -> CandidateDetail:
    fields: dict = {}
    if req.preferred_channel is not None:
        fields["last_interaction_channel"] = req.preferred_channel.value
    if req.status is not None:
        fields["status"] = req.status
        if req.status == "joined":
            fields["current_stage"] = "joined"

    updated = repo.update_candidate(db, candidate["id"], fields)

    if req.status in ("joined", "declined"):
        try:
            repo.insert_engagement_event(
                db,
                candidate_id=candidate["id"],
                event_type="joined" if req.status == "joined" else "offer_declined",
                stage=updated.get("current_stage"),
                actor="hr",
                channel=None,
                title="Candidate joined" if req.status == "joined" else "Offer declined",
                description=f"Status set to {req.status} by HR.",
                occurred_at=_now(),
                metadata={"source": "hr_manual"},
            )
        except UpstreamError:
            pass

    return read_service.build_candidate_detail(db, updated)


# --- journey step ---------------------------------------------------

def update_journey_step(
    db: Client, candidate: dict, stage: str, req: UpdateJourneyStepRequest
) -> EngagementJourney:
    if stage not in _STAGE_POSITION:
        raise NotFoundError("Journey stage", stage)

    now = _now()
    started_at = now if req.status in ("in_progress", "completed") else None
    completed_at = now if req.status == "completed" else None

    existing = repo.get_journey_step(db, candidate["id"], stage)
    if existing:
        started_at = existing.get("started_at") or started_at
        if req.status != "completed":
            completed_at = None

    repo.upsert_journey_step(
        db,
        candidate_id=candidate["id"],
        stage=stage,
        position=_STAGE_POSITION[stage],
        status=req.status,
        started_at=started_at,
        completed_at=completed_at,
    )

    # Keep candidates.current_stage pointed at the furthest active stage.
    if req.status in ("in_progress", "completed"):
        cur_pos = _STAGE_POSITION.get(candidate.get("current_stage"), 0)
        if _STAGE_POSITION[stage] > cur_pos:
            repo.update_candidate(db, candidate["id"], {"current_stage": stage})

    try:
        repo.insert_engagement_event(
            db,
            candidate_id=candidate["id"],
            event_type="note_added",
            stage=stage,
            actor="hr",
            channel=None,
            title=f"Journey step '{stage}' set to {req.status}",
            description=None,
            occurred_at=now,
            metadata={"journey_step": stage, "status": req.status, "source": "hr_manual"},
        )
    except UpstreamError:
        pass

    fresh = repo.resolve_candidate(db, candidate["id"]) or candidate
    return read_service.build_engagement_journey(db, fresh)


# --- messages -----------------------------------------------------

def create_message(
    db: Client, candidate: dict, req: CreateMessageRequest
) -> Message:
    channel = req.channel.value
    conv = repo.get_or_create_conversation(
        db,
        candidate_id=candidate["id"],
        channel=channel,
        subject=req.subject or f"Conversation with {candidate['full_name']}",
    )
    now = _now()
    row = repo.insert_message(
        db,
        conversation_id=conv["id"],
        candidate_id=candidate["id"],
        channel=channel,
        body=req.body,
        subject=req.subject,
        is_internal_note=req.is_internal_note,
        is_ai_generated=req.is_ai_generated,
        sent_at=now,
    )
    repo.touch_conversation(db, conv["id"], preview=req.body, at=now)

    if not req.is_internal_note:
        # A real outbound message counts as an interaction.
        repo.update_candidate(
            db,
            candidate["id"],
            {"last_interaction_at": now, "last_interaction_channel": channel},
        )
    else:
        try:
            repo.insert_engagement_event(
                db,
                candidate_id=candidate["id"],
                event_type="note_added",
                stage=candidate.get("current_stage"),
                actor="hr",
                channel=channel,
                title="Internal note added in conversation",
                description=req.body[:280],
                occurred_at=now,
                metadata={"message_id": row["id"]},
            )
        except UpstreamError:
            pass

    return Message.model_validate(row)


# --- tasks (quick actions) ------------------------------------

def create_task(
    db: Client, candidate: dict, req: CreateTaskRequest
) -> CandidateTask:
    row = repo.insert_task(
        db,
        candidate_id=candidate["id"],
        assigned_recruiter_id=candidate.get("recruiter_id"),
        title=req.title,
        detail=req.detail,
        related_stage=req.related_stage or candidate.get("current_stage"),
        priority=req.priority,
        source="manual",
        due_date=req.due_date,
    )
    return CandidateTask.model_validate(row)


# --- AI recommendation HR override --------------------------

def override_ai_recommendation(
    db: Client, recommendation_id: str, req: AIRecommendationPatch
) -> AIRecommendationRecord:
    row = repo.get_ai_recommendation(db, recommendation_id)
    if row is None:
        raise NotFoundError("AI recommendation", recommendation_id)

    if req.action == "override" and not (req.override_text or "").strip():
        raise UpstreamError("override_text is required when action is 'override'.")

    updated = repo.update_ai_recommendation(
        db,
        recommendation_id,
        status=_ACTION_STATUS[req.action],
        hr_override_text=req.override_text if req.action == "override" else None,
        resolved_at=_now(),
    )
    # payload (the original AI output) is never modified here.
    return AIRecommendationRecord.model_validate(updated)


# --- risk HR override --------------------------------------

def override_risk(
    db: Client, assessment_id: str, req: RiskAssessmentPatch
) -> RiskOverrideResponse:
    row = repo.get_risk_assessment(db, assessment_id)
    if row is None:
        raise NotFoundError("Risk assessment", assessment_id)

    candidate_id = row["candidate_id"]
    previous = repo.get_current_risk_assessment(db, candidate_id)

    new_row = repo.insert_risk_assessment(
        db,
        candidate_id=candidate_id,
        level=req.level,
        score=req.score if req.score is not None else _BAND_SCORE[req.level],
        factors=["HR manual override"],
        summary=req.reason,
        model=None,
        source="manual",
    )
    return RiskOverrideResponse(
        result=RiskRecord.model_validate(new_row),
        previous_ai_assessment=(
            RiskRecord.model_validate(previous) if previous else None
        ),
    )
