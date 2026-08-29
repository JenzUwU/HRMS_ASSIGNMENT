"""Response schemas for reference data (recruiters, message templates)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Recruiter(_Model):
    id: UUID
    full_name: str
    initials: str
    email: str
    department: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class MessageTemplate(_Model):
    id: UUID
    name: str
    category: str
    channel: str
    subject: str | None = None
    body: str
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
