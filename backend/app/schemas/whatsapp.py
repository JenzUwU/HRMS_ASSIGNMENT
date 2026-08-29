"""Request/response schemas for outbound WhatsApp and the WhatsApp webhook.

WhatsApp is provider-agnostic and DISABLED by default - no provider is
connected. These models describe the contract so the endpoint shape is stable
when a real provider (Meta Cloud API / Twilio) is added later.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SendWhatsAppRequest(_Body):
    body: str = Field(min_length=1, max_length=4096, description="Plain-text message")
    # Optional provenance when HR sends an AI-generated draft (same field the
    # email flow uses). No behaviour depends on it yet.
    ai_recommendation_id: UUID | None = None

    @field_validator("body")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class SendWhatsAppResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sent: bool
    channel: Literal["whatsapp"] = "whatsapp"
    candidate_id: UUID
    provider: str | None = None
    provider_message_id: str | None = None
    conversation_id: UUID | None = None
    stored_message_id: UUID | None = None


class WhatsAppWebhookResult(BaseModel):
    received: bool = True
    enabled: bool = False
    handled: bool = False
