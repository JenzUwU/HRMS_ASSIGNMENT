"""Response schemas for communication resources (conversations and messages)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Message(_Model):
    id: UUID
    conversation_id: UUID
    candidate_id: UUID
    direction: str          # inbound | outbound
    channel: str            # email | whatsapp | sms
    actor: str              # candidate | recruiter | system
    sender_name: str
    sender_recruiter_id: UUID | None = None
    subject: str | None = None
    body: str
    status: str
    is_ai_generated: bool = False
    is_internal_note: bool = False
    template_id: UUID | None = None
    sent_at: datetime | None = None
    scheduled_for: datetime | None = None
    created_at: datetime


class Conversation(_Model):
    id: UUID
    candidate_id: UUID
    channel: str
    subject: str
    last_message_at: datetime | None = None
    last_message_preview: str | None = None
    unread_count: int = 0
    is_online: bool = False
    created_at: datetime
    updated_at: datetime


class ConversationThread(Conversation):
    messages: list[Message] = []


class CandidateCommunications(_Model):
    candidate_id: UUID
    candidate_slug: str
    conversations: list[ConversationThread] = []
