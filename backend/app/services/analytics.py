"""Analytics assembly. Thin wrappers that validate view rows into schemas."""
from __future__ import annotations

from supabase import Client

from app.db import repositories as repo
from app.schemas.analytics import (
    AnalyticsSummary,
    ConversionTrendPoint,
    RecruiterConversionRow,
    StageFunnelRow,
)


def get_summary(db: Client) -> AnalyticsSummary:
    return AnalyticsSummary.model_validate(repo.analytics_summary(db))


def get_stage_funnel(db: Client) -> list[StageFunnelRow]:
    return [StageFunnelRow.model_validate(r) for r in repo.stage_funnel(db)]


def get_recruiter_conversion(db: Client) -> list[RecruiterConversionRow]:
    return [RecruiterConversionRow.model_validate(r) for r in repo.recruiter_conversion(db)]


def get_conversion_trend(db: Client) -> list[ConversionTrendPoint]:
    return [ConversionTrendPoint.model_validate(r) for r in repo.conversion_trend(db)]
