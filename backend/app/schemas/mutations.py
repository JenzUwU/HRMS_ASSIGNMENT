"""Request/response schemas for the write endpoints.

Every mutation route body is one of these models (extra keys rejected). Response
models reuse the existing read schemas where possible.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ai import AIChannel


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- notes -----------------------------------------------------------------

class CreateNoteRequest(_Body):
    body: str = Field(min_length=1, max_length=4000)
    is_pinned: bool = False


# --- candidate status / preferences --------------------------------------

CandidateStatus = Literal["offer_accepted", "active", "joined", "declined"]


class UpdateCandidateRequest(_Body):
    status: CandidateStatus | None = None
    preferred_channel: AIChannel | None = Field(
        None,
        description=(
            "Persisted to candidates.last_interaction_channel - the only "
            "channel-preference field in the data model."
        ),
    )


# --- journey steps ------------------------------------------------------

StepStatus = Literal["pending", "in_progress", "completed", "skipped"]


class UpdateJourneyStepRequest(_Body):
    status: StepStatus


# --- messages ---------------------------------------------------------

class CreateMessageRequest(_Body):
    channel: AIChannel = AIChannel.email
    body: str = Field(min_length=1, max_length=8000)
    subject: str | None = Field(None, max_length=200)
    is_internal_note: bool = False
    is_ai_generated: bool = False


# --- tasks (quick actions) -------------------------------------------

class CreateTaskRequest(_Body):
    title: str = Field(min_length=1, max_length=200)
    detail: str | None = Field(None, max_length=2000)
    priority: Literal["low", "medium", "high"] = "medium"
    related_stage: str | None = None
    due_date: str | None = None


# --- AI recommendation HR override ---------------------------------

class AIRecommendationPatch(_Body):
    action: Literal["accept", "dismiss", "override"]
    override_text: str | None = Field(None, max_length=4000)


class AIRecommendationRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    candidate_id: UUID
    kind: str
    status: str
    model: str | None = None
    payload: dict
    prompt_context: dict | None = None
    hr_override_text: str | None = None
    is_current: bool
    resolved_at: datetime | None = None
    created_at: datetime


# --- risk HR override --------------------------------------------

class RiskAssessmentPatch(_Body):
    level: Literal["low", "medium", "high"]
    reason: str = Field(min_length=1, max_length=1500)
    score: int | None = Field(None, ge=0, le=100)


class RiskRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    candidate_id: UUID
    level: str
    score: int
    factors: list[str] = []
    summary: str | None = None
    source: str
    model: str | None = None
    is_current: bool
    created_at: datetime


class RiskOverrideResponse(BaseModel):
    result: RiskRecord
    previous_ai_assessment: RiskRecord | None = None
    note: str = (
        "The original AI assessment is preserved in history (is_current=false)."
    )
