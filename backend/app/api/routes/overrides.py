"""HR override routes.

    PATCH /api/v1/ai-recommendations/{recommendation_id}   accept | dismiss | override
    PATCH /api/v1/risk-assessments/{assessment_id}         manual risk override

An override never mutates the original AI output:
  * ai_recommendations.payload is left untouched; only status / hr_override_text
    / resolved_at change.
  * a risk override inserts a NEW risk_assessments row (source='manual') and the
    previous AI row is kept as is_current=false (existing history mechanism).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DB
from app.schemas.mutations import (
    AIRecommendationPatch,
    AIRecommendationRecord,
    RiskAssessmentPatch,
    RiskOverrideResponse,
)
from app.services import mutations as write_service

router = APIRouter(tags=["overrides"])


@router.patch(
    "/ai-recommendations/{recommendation_id}",
    response_model=AIRecommendationRecord,
)
def patch_ai_recommendation(
    recommendation_id: UUID, db: DB, body: AIRecommendationPatch
) -> AIRecommendationRecord:
    return write_service.override_ai_recommendation(
        db, str(recommendation_id), body
    )


@router.patch(
    "/risk-assessments/{assessment_id}", response_model=RiskOverrideResponse
)
def patch_risk_assessment(
    assessment_id: UUID, db: DB, body: RiskAssessmentPatch
) -> RiskOverrideResponse:
    return write_service.override_risk(db, str(assessment_id), body)
