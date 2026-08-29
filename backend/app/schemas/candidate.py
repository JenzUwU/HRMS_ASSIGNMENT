"""Response schemas for candidate resources (list, detail, notes, tasks, documents)."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# The database enums are surfaced as plain strings. The exact string values are
# defined in supabase/migrations/001_initial_schema.sql.


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


class RecruiterRef(_Model):
    recruiter_id: UUID
    recruiter_name: str
    recruiter_initials: str


class RiskSummary(_Model):
    level: str
    score: int
    factors: list[str] = []
    summary: str | None = None
    source: str
    model: str | None = None
    updated_at: datetime | None = None


class CandidateNote(_Model):
    id: UUID
    candidate_id: UUID
    author_recruiter_id: UUID | None = None
    author_name: str | None = None
    author_initials: str | None = None
    body: str
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime


class CandidateTask(_Model):
    id: UUID
    candidate_id: UUID
    assigned_recruiter_id: UUID | None = None
    title: str
    detail: str | None = None
    related_stage: str | None = None
    priority: str
    status: str
    source: str
    due_date: date | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CandidateDocument(_Model):
    id: UUID
    candidate_id: UUID
    doc_type: str
    status: str
    storage_path: str | None = None
    notes: str | None = None
    requested_at: datetime | None = None
    submitted_at: datetime | None = None
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CandidateListItem(_Model):
    """One row of v_candidate_list. Drives the candidates table and dashboard tables."""

    id: UUID
    slug: str
    full_name: str
    initials: str
    email: str
    phone: str | None = None
    role: str
    department: str | None = None
    location: str
    location_city: str | None = None
    source: str
    recruiter_id: UUID
    recruiter_name: str
    recruiter_initials: str
    offer_date: date
    joining_date: date
    joining_in_days: int
    status: str
    current_stage: str
    risk_level: str
    risk_score: int
    engagement_score: int | None = None
    last_interaction_at: datetime | None = None
    last_interaction_channel: str | None = None
    days_since_interaction: int | None = None
    next_action: str | None = None
    next_action_source: str | None = None
    steps_completed: int
    steps_total: int
    open_tasks: int
    unread_messages: int


class CandidateDetail(CandidateListItem):
    """Candidate list row plus the extra fields the detail page needs."""

    employment_type: str
    declined_at_stage: str | None = None
    risk: RiskSummary | None = None
    latest_note: CandidateNote | None = None
