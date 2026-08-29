"""Response schema for GET /api/v1/candidates/{id}/engagement.

Represents the engagement journey: the 6 ordered stages, the timeline of events,
a progress rollup, the current risk snapshot, and the near-term work
(upcoming tasks, pending documents).
"""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.candidate import CandidateDocument, CandidateTask, RiskSummary


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


class JourneyStep(_Model):
    # None when the candidate has no candidate_journey_steps row yet for this
    # stage - the read model synthesizes the 6 ordered stages regardless.
    id: UUID | None = None
    stage: str
    label: str
    status: str            # pending | in_progress | completed | skipped
    position: int          # 1..6
    due_date: date | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class EngagementEvent(_Model):
    id: UUID
    event_type: str
    stage: str | None = None
    actor: str
    channel: str | None = None
    title: str
    description: str | None = None
    occurred_at: datetime


class JourneyProgress(_Model):
    total_steps: int
    completed: int
    in_progress: int
    pending: int
    percent_complete: int


class EngagementJourney(_Model):
    candidate_id: UUID
    candidate_slug: str
    current_stage: str
    status: str
    steps: list[JourneyStep]
    progress: JourneyProgress
    timeline: list[EngagementEvent]
    risk: RiskSummary | None = None
    upcoming_tasks: list[CandidateTask] = []
    pending_documents: list[CandidateDocument] = []
