"""Response schemas for analytics endpoints.

Summary metrics are computed from the candidates and engagement_events tables;
the funnel, recruiter and trend series are read straight from the Phase 1 SQL
views (v_stage_funnel, v_recruiter_conversion, v_conversion_trend_weekly).
"""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


class AnalyticsSummary(_Model):
    total_offered: int
    joined: int
    declined: int
    offer_to_join_conversion: float
    high_risk_candidates: int
    joining_next_7_days: int
    joining_next_15_days: int
    joining_next_30_days: int
    average_engagement_frequency: float


class StageFunnelRow(_Model):
    stage: str
    position: int
    candidates_reached: int
    declined_at_stage: int


class RecruiterConversionRow(_Model):
    recruiter_id: str
    recruiter_name: str
    initials: str
    offered: int
    joined: int
    declined: int
    offer_to_join_rate: float | None = None


class ConversionTrendPoint(_Model):
    week_start: date
    week_end: date
    offered_in_week: int
    cumulative_offered: int
    cumulative_joined: int
    cumulative_conversion_rate: float | None = None
