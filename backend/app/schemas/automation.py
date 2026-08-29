"""Schemas for the automated engagement sweep."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SweepOutcome = Literal["processed", "skipped", "failed"]


class SweepRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dry_run: bool = Field(
        False,
        description="Evaluate eligibility and dedup only; no AI call, no writes.",
    )
    limit: int | None = Field(
        None, ge=1, le=200, description="Cap candidates processed this run."
    )


class SweepCandidateResult(BaseModel):
    candidate_id: UUID
    slug: str
    full_name: str
    joining_in_days: int | None = None
    days_since_interaction: int | None = None
    outcome: SweepOutcome
    reason: str | None = None
    task_id: UUID | None = None
    recommendation_id: UUID | None = None
    event_id: UUID | None = None
    message_channel: str | None = None


class EngagementSweepResult(BaseModel):
    rule: str
    dry_run: bool
    ran_at: datetime
    scanned: int
    eligible: int
    processed: int
    skipped: int
    failed: int
    results: list[SweepCandidateResult] = Field(default_factory=list)


class AutomationStatus(BaseModel):
    background_loop_enabled: bool
    interval_minutes: int
    rule: str
    joining_window_days: int
    no_interaction_days: int
    dedup_days: int
    last_run: EngagementSweepResult | None = None
