"""Candidate resource routes.

    GET /api/v1/candidates
    GET /api/v1/candidates/{candidate_id}
    GET /api/v1/candidates/{candidate_id}/engagement
    GET /api/v1/candidates/{candidate_id}/communications
    GET /api/v1/candidates/{candidate_id}/tasks
    GET /api/v1/candidates/{candidate_id}/documents
    GET /api/v1/candidates/{candidate_id}/notes

{candidate_id} accepts the UUID primary key or the candidates.slug.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import DB, CandidateRow
from app.db import repositories as repo
from app.schemas.candidate import (
    CandidateDetail,
    CandidateDocument,
    CandidateListItem,
    CandidateNote,
    CandidateTask,
)
from app.schemas.common import Paginated
from app.schemas.communication import CandidateCommunications, Message
from app.schemas.engagement import EngagementJourney
from app.schemas.mutations import (
    CreateMessageRequest,
    CreateNoteRequest,
    CreateTaskRequest,
    RiskRecord,
    UpdateCandidateRequest,
    UpdateJourneyStepRequest,
)
from app.services import candidates as service
from app.services import mutations as write_service

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=Paginated[CandidateListItem])
def list_candidates(
    db: DB,
    joining_month: str | None = Query(
        None, pattern=r"^\d{4}-\d{2}$", description="Filter by joining month, format YYYY-MM"
    ),
    recruiter_id: UUID | None = Query(None),
    role: str | None = Query(None),
    risk_level: str | None = Query(None, pattern=r"^(low|medium|high)$"),
    status: str | None = Query(
        None, pattern=r"^(offer_accepted|active|joined|declined)$"
    ),
    search: str | None = Query(None, min_length=1, max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Paginated[CandidateListItem]:
    rows, total = repo.list_candidates(
        db,
        joining_month=joining_month,
        recruiter_id=recruiter_id,
        role=role,
        risk_level=risk_level,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    )
    return Paginated[CandidateListItem](
        items=[CandidateListItem.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate: CandidateRow, db: DB) -> CandidateDetail:
    return service.build_candidate_detail(db, candidate)


@router.get("/{candidate_id}/engagement", response_model=EngagementJourney)
def get_candidate_engagement(candidate: CandidateRow, db: DB) -> EngagementJourney:
    return service.build_engagement_journey(db, candidate)


@router.get("/{candidate_id}/communications", response_model=CandidateCommunications)
def get_candidate_communications(candidate: CandidateRow, db: DB) -> CandidateCommunications:
    return service.build_candidate_communications(db, candidate)


@router.get("/{candidate_id}/tasks", response_model=list[CandidateTask])
def get_candidate_tasks(candidate: CandidateRow, db: DB) -> list[CandidateTask]:
    return [CandidateTask.model_validate(t) for t in repo.list_tasks(db, candidate["id"])]


@router.get("/{candidate_id}/risk/history", response_model=list[RiskRecord])
def get_candidate_risk_history(
    candidate: CandidateRow, db: DB
) -> list[RiskRecord]:
    return [
        RiskRecord.model_validate(r)
        for r in repo.list_risk_assessments(db, candidate["id"])
    ]


@router.get("/{candidate_id}/documents", response_model=list[CandidateDocument])
def get_candidate_documents(candidate: CandidateRow, db: DB) -> list[CandidateDocument]:
    return [
        CandidateDocument.model_validate(d)
        for d in repo.list_documents(db, candidate["id"])
    ]


@router.get("/{candidate_id}/notes", response_model=list[CandidateNote])
def get_candidate_notes(candidate: CandidateRow, db: DB) -> list[CandidateNote]:
    return [CandidateNote.model_validate(n) for n in repo.list_notes(db, candidate["id"])]


# --- write endpoints ---------------------------------------------------------


@router.patch("/{candidate_id}", response_model=CandidateDetail)
def patch_candidate(
    candidate: CandidateRow, db: DB, body: UpdateCandidateRequest
) -> CandidateDetail:
    return write_service.update_candidate(db, candidate, body)


@router.post("/{candidate_id}/notes", response_model=CandidateNote, status_code=201)
def create_candidate_note(
    candidate: CandidateRow, db: DB, body: CreateNoteRequest
) -> CandidateNote:
    return write_service.create_note(db, candidate, body)


@router.post("/{candidate_id}/tasks", response_model=CandidateTask, status_code=201)
def create_candidate_task(
    candidate: CandidateRow, db: DB, body: CreateTaskRequest
) -> CandidateTask:
    return write_service.create_task(db, candidate, body)


@router.post(
    "/{candidate_id}/messages", response_model=Message, status_code=201
)
def create_candidate_message(
    candidate: CandidateRow, db: DB, body: CreateMessageRequest
) -> Message:
    return write_service.create_message(db, candidate, body)


@router.patch(
    "/{candidate_id}/journey/{stage}", response_model=EngagementJourney
)
def patch_journey_step(
    candidate: CandidateRow, db: DB, stage: str, body: UpdateJourneyStepRequest
) -> EngagementJourney:
    return write_service.update_journey_step(db, candidate, stage, body)
