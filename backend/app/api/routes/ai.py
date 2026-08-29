"""AI engagement routes (Groq-backed).

    POST /api/v1/candidates/{candidate_id}/ai/message       draft an outreach message
    POST /api/v1/candidates/{candidate_id}/ai/summary       summarize interactions
    POST /api/v1/candidates/{candidate_id}/ai/next-action   recommend the next action
    POST /api/v1/candidates/{candidate_id}/ai/risk          classify joining risk

{candidate_id} accepts the UUID primary key or the candidates.slug, resolved by
the shared dependency. Each endpoint runs the AI pipeline, persists the
validated result (ai_recommendations / risk_assessments, history preserved),
and returns the application schema - never the raw Groq body.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import DB, CandidateRow
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.db import repositories as repo
from app.services import recruiter_notify
from app.schemas.ai import (
    AIMeta,
    CandidateAiInsights,
    DraftMessageRequest,
    DraftMessageResponse,
    InteractionSummaryResponse,
    NextBestActionResponse,
    RiskClassificationResponse,
)
from app.schemas.mutations import AIRecommendationRecord
from app.services import ai as ai_service
from app.services import ai_insights

router = APIRouter(prefix="/candidates/{candidate_id}/ai", tags=["ai"])


def _persist_recommendation(
    db: DB, candidate_id: str, kind: str, payload: dict, prompt_context: dict
) -> tuple[bool, str | None]:
    try:
        row = repo.insert_ai_recommendation(
            db,
            candidate_id=candidate_id,
            kind=kind,
            payload=payload,
            prompt_context=prompt_context,
            model=settings.groq_model,
        )
        return True, row["id"]
    except AppError as exc:
        # Generation already succeeded; a persistence failure must not lose the
        # result. Surface it as not-persisted and keep going.
        logger.warning("Could not persist %s recommendation: %s", kind, exc.code)
        return False, None


@router.get("/insights", response_model=CandidateAiInsights)
def get_ai_insights(candidate: CandidateRow, db: DB) -> CandidateAiInsights:
    """Aggregate the persisted AI outputs (risk, interaction summary, next
    action, override state, history) for the AI Insights UI. Read-only: no Groq
    call and nothing is written."""
    return ai_insights.build_insights(db, candidate)


@router.get("/recommendations", response_model=list[AIRecommendationRecord])
def ai_recommendations(
    candidate: CandidateRow,
    db: DB,
    kind: str | None = Query(None),
    current_only: bool = Query(False),
) -> list[AIRecommendationRecord]:
    rows = repo.list_ai_recommendations(db, candidate["id"], kind=kind)
    if current_only:
        rows = [r for r in rows if r.get("is_current")]
    return [AIRecommendationRecord.model_validate(r) for r in rows]


@router.post("/message", response_model=DraftMessageResponse)
def ai_draft_message(
    candidate: CandidateRow, db: DB, body: DraftMessageRequest
) -> DraftMessageResponse:
    result, ctx = ai_service.draft_message(
        db, candidate, channel=body.channel, purpose=body.purpose
    )
    persisted, record_id = _persist_recommendation(
        db, candidate["id"], "message_draft", result.model_dump(mode="json"), ctx
    )
    return DraftMessageResponse(
        result=result,
        meta=AIMeta(
            model=settings.groq_model, persisted=persisted, record_id=record_id
        ),
    )


@router.post("/summary", response_model=InteractionSummaryResponse)
def ai_summary(candidate: CandidateRow, db: DB) -> InteractionSummaryResponse:
    result, ctx = ai_service.summarize_interactions(db, candidate)
    persisted, record_id = _persist_recommendation(
        db,
        candidate["id"],
        "interaction_summary",
        result.model_dump(mode="json"),
        ctx,
    )
    return InteractionSummaryResponse(
        result=result,
        meta=AIMeta(
            model=settings.groq_model, persisted=persisted, record_id=record_id
        ),
    )


@router.post("/next-action", response_model=NextBestActionResponse)
def ai_next_action(candidate: CandidateRow, db: DB) -> NextBestActionResponse:
    result, ctx = ai_service.recommend_next_action(db, candidate)
    persisted, record_id = _persist_recommendation(
        db, candidate["id"], "next_action", result.model_dump(mode="json"), ctx
    )
    return NextBestActionResponse(
        result=result,
        meta=AIMeta(
            model=settings.groq_model, persisted=persisted, record_id=record_id
        ),
    )


@router.post("/risk", response_model=RiskClassificationResponse)
def ai_risk(candidate: CandidateRow, db: DB) -> RiskClassificationResponse:
    result, _ctx, corrections = ai_service.classify_risk(db, candidate)

    persisted = False
    record_id: str | None = None
    try:
        row = repo.insert_risk_assessment(
            db,
            candidate_id=candidate["id"],
            level=result.level.value,
            score=result.score,
            factors=result.factors,
            summary=result.summary,
            model=settings.groq_model,
            source="ai",
        )
        persisted, record_id = True, row["id"]
        if result.level.value == "high":
            # Notify the assigned recruiter. Best-effort; deduped by assessment id.
            recruiter_notify.notify_high_risk(
                db, candidate, assessment_id=row["id"], summary=result.summary
            )
    except AppError as exc:
        logger.warning("Could not persist risk assessment: %s", exc.code)

    return RiskClassificationResponse(
        result=result,
        meta=AIMeta(
            model=settings.groq_model,
            persisted=persisted,
            record_id=record_id,
            corrections=corrections,
        ),
    )
