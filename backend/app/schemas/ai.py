"""Structured AI output models and AI endpoint request/response schemas.

These models are the contract between the Groq response and the rest of the
application. Every field is constrained so that a malformed model response
fails Pydantic validation instead of reaching the database or the UI.
"""
from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _Model(BaseModel):
    # Reject unknown keys so the model cannot smuggle unexpected fields through.
    model_config = ConfigDict(extra="forbid")


class AIChannel(str, Enum):
    email = "email"
    whatsapp = "whatsapp"
    sms = "sms"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


# ---------------------------------------------------------------------------
# A. Personalized message
# ---------------------------------------------------------------------------

class PersonalizedMessage(_Model):
    channel: AIChannel
    subject: str | None = Field(
        None,
        max_length=160,
        description="Present for email, omitted/null for whatsapp and sms.",
    )
    body: str = Field(min_length=1, max_length=4000)
    personalization_rationale: str | None = Field(None, max_length=600)

    @field_validator("subject")
    @classmethod
    def _blank_subject_is_none(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


# ---------------------------------------------------------------------------
# B. Interaction summary
# ---------------------------------------------------------------------------

class InteractionSummary(_Model):
    summary: str = Field(min_length=1, max_length=2000)
    key_concerns: list[str] = Field(default_factory=list, max_length=12)
    positive_signals: list[str] = Field(default_factory=list, max_length=12)
    unanswered_issues: list[str] = Field(default_factory=list, max_length=12)


# ---------------------------------------------------------------------------
# C. Next best action
# ---------------------------------------------------------------------------

class NextBestAction(_Model):
    action: str = Field(min_length=1, max_length=300)
    rationale: str = Field(min_length=1, max_length=1000)
    suggested_channel: AIChannel
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# D. Risk classification
# ---------------------------------------------------------------------------

class RiskClassification(_Model):
    level: RiskLevel
    score: int = Field(ge=0, le=100)
    factors: list[str] = Field(default_factory=list, max_length=12)
    summary: str = Field(min_length=1, max_length=1500)
    recommended_action: str = Field(min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class DraftMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: AIChannel = AIChannel.email
    purpose: str | None = Field(
        None,
        max_length=400,
        description="Optional HR intent, e.g. 'nudge on pending documents'.",
    )


# ---------------------------------------------------------------------------
# Responses (validated model + persistence metadata; never the raw Groq body)
# ---------------------------------------------------------------------------

class AIMeta(BaseModel):
    model: str
    persisted: bool
    record_id: UUID | None = None
    corrections: list[str] = Field(default_factory=list)


class DraftMessageResponse(BaseModel):
    result: PersonalizedMessage
    meta: AIMeta


class InteractionSummaryResponse(BaseModel):
    result: InteractionSummary
    meta: AIMeta


class NextBestActionResponse(BaseModel):
    result: NextBestAction
    meta: AIMeta


class RiskClassificationResponse(BaseModel):
    result: RiskClassification
    meta: AIMeta
