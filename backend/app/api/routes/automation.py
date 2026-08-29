"""Automated engagement sweep routes.

    POST /api/v1/automation/run-engagement-sweep   run the sweep now
    GET  /api/v1/automation/status                 rule config + last run

The POST endpoint is a manual / API trigger for the sweep. It is NOT the
scheduler - repeated execution is driven by the in-process background loop
(enabled with AUTOMATION_ENABLED) or an external cron hitting this endpoint.
Business logic lives entirely in app/services/engagement_rules.py.
"""
from __future__ import annotations

from fastapi import APIRouter, Body

from app.api.deps import DB
from app.core.config import settings
from app.schemas.automation import (
    AutomationStatus,
    EngagementSweepResult,
    SweepRequest,
)
from app.services import engagement_rules

router = APIRouter(prefix="/automation", tags=["automation"])


@router.post("/run-engagement-sweep", response_model=EngagementSweepResult)
def run_engagement_sweep(
    db: DB, body: SweepRequest | None = Body(default=None)
) -> EngagementSweepResult:
    req = body or SweepRequest()
    return engagement_rules.run_engagement_sweep(
        db, dry_run=req.dry_run, limit=req.limit
    )


@router.get("/status", response_model=AutomationStatus)
def automation_status() -> AutomationStatus:
    return AutomationStatus(
        background_loop_enabled=settings.automation_enabled,
        interval_minutes=settings.automation_interval_minutes,
        rule=engagement_rules.rule_description(),
        joining_window_days=settings.automation_joining_window_days,
        no_interaction_days=settings.automation_no_interaction_days,
        dedup_days=settings.automation_dedup_days,
        last_run=engagement_rules.get_last_run(),
    )
