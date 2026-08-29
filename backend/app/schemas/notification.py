"""Response schema for the in-app recruiter notification feed."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RecruiterNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    candidate_id: str
    candidate_name: str | None = None
    candidate_slug: str | None = None
    candidate_initials: str | None = None
    kind: str
    title: str
    reason: str | None = None
    recommended_action: str | None = None
    email_sent: bool = False
    occurred_at: datetime
