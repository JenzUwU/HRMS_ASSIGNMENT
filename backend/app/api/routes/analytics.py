"""Analytics routes. All data comes from real candidate and event rows.

    GET /api/v1/analytics/summary
    GET /api/v1/analytics/stage-funnel
    GET /api/v1/analytics/recruiter-conversion
    GET /api/v1/analytics/conversion-trend
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DB
from app.schemas.analytics import (
    AnalyticsSummary,
    ConversionTrendPoint,
    RecruiterConversionRow,
    StageFunnelRow,
)
from app.services import analytics as service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def analytics_summary(db: DB) -> AnalyticsSummary:
    return service.get_summary(db)


@router.get("/stage-funnel", response_model=list[StageFunnelRow])
def stage_funnel(db: DB) -> list[StageFunnelRow]:
    return service.get_stage_funnel(db)


@router.get("/recruiter-conversion", response_model=list[RecruiterConversionRow])
def recruiter_conversion(db: DB) -> list[RecruiterConversionRow]:
    return service.get_recruiter_conversion(db)


@router.get("/conversion-trend", response_model=list[ConversionTrendPoint])
def conversion_trend(db: DB) -> list[ConversionTrendPoint]:
    return service.get_conversion_trend(db)
