"""Request/response schemas for candidate creation and outbound email."""
from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.ai import AIChannel

CandidateStatus = Literal["offer_accepted", "active", "joined", "declined"]
EngagementStage = Literal[
    "offer_accepted", "welcome_sent", "documentation",
    "manager_intro", "pre_joining", "joined",
]
CandidateSource = Literal[
    "linkedin", "referral", "naukri", "indeed",
    "company_site", "agency", "other",
]
EmploymentType = Literal["full_time", "part_time", "contract", "intern"]


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateCandidateRequest(_Body):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(None, max_length=40)
    role: str = Field(min_length=2, max_length=120)
    department: str | None = Field(None, max_length=80)
    location: str = Field(min_length=2, max_length=120)
    recruiter_id: UUID | None = None
    offer_date: date | None = None
    joining_date: date
    status: CandidateStatus = "offer_accepted"
    current_stage: EngagementStage = "offer_accepted"
    source: CandidateSource = "other"
    employment_type: EmploymentType = "full_time"
    preferred_channel: AIChannel | None = None

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("full_name", "role", "location")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def _dates_consistent(self) -> "CreateCandidateRequest":
        offer = self.offer_date or date.today()
        if self.joining_date < offer:
            raise ValueError("joining_date must be on or after the offer date")
        return self


class SendCandidateEmailRequest(_Body):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000, description="Plain-text body")
    reply_to: EmailStr | None = None
    # optional - populate the message row's is_ai_generated flag / provenance
    ai_recommendation_id: UUID | None = None

    @field_validator("subject", "body")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class SendCandidateEmailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sent: bool
    message_id: str
    provider: str = "gmail_smtp"
    channel: str = "email"
    candidate_id: UUID
    conversation_id: UUID
    stored_message_id: UUID


class WebhookResult(BaseModel):
    received: bool = True
    event_type: str | None = None
    recorded: bool = False


class InboundPollResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    checked: int
    ingested: int
    skipped: int
    details: list[str] = []
