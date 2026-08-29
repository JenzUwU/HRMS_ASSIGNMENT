"""Reference data routes used by filters and the templates panel.

    GET /api/v1/recruiters
    GET /api/v1/message-templates
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DB
from app.db import repositories as repo
from app.schemas.reference import MessageTemplate, Recruiter

router = APIRouter(tags=["reference"])


@router.get("/recruiters", response_model=list[Recruiter])
def list_recruiters(db: DB) -> list[Recruiter]:
    return [Recruiter.model_validate(r) for r in repo.list_recruiters(db)]


@router.get("/message-templates", response_model=list[MessageTemplate])
def list_message_templates(db: DB) -> list[MessageTemplate]:
    return [MessageTemplate.model_validate(t) for t in repo.list_message_templates(db)]
