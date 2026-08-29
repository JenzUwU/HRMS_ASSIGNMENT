"""In-process background scheduler for the engagement sweep.

This is the simplest mechanism that fits a single-process FastAPI deployment:
an asyncio task started from the app lifespan that runs the sweep on a fixed
interval. It only calls services/engagement_rules.run_engagement_sweep - no
business logic lives here.

Trade-offs (documented, not hidden):
  * It runs inside the API process. With multiple uvicorn workers each worker
    starts its own loop; the sweep's deduplication makes concurrent runs safe
    but wasteful. For >1 worker, disable this loop and drive the sweep from an
    external scheduler (cron / Cloud Scheduler / a worker) hitting
    POST /api/v1/automation/run-engagement-sweep.
  * The timer resets on process restart; it is not durable.
  * Disabled by default (AUTOMATION_ENABLED=false) so it never surprises a
    deployment. The manual endpoint always works regardless.
"""
from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import logger

_task: asyncio.Task | None = None


def _run_once() -> None:
    # Imported lazily so a misconfigured DB/AI does not break app import.
    from app.db.supabase import get_supabase
    from app.services.engagement_rules import run_engagement_sweep

    try:
        db = get_supabase()
    except Exception:  # noqa: BLE001
        logger.warning("automation loop: database not configured; skipping run")
        return
    try:
        run_engagement_sweep(db)
    except Exception:  # noqa: BLE001
        logger.exception("automation loop: sweep raised")


async def _loop() -> None:
    interval = max(60, settings.automation_interval_minutes * 60)
    logger.info(
        "automation background loop started (every %d min)",
        settings.automation_interval_minutes,
    )
    while True:
        try:
            await asyncio.sleep(interval)
            await asyncio.to_thread(_run_once)
        except asyncio.CancelledError:
            logger.info("automation background loop stopped")
            raise
        except Exception:  # noqa: BLE001
            logger.exception("automation background loop iteration failed")


def start() -> None:
    global _task
    if not settings.automation_enabled:
        logger.info(
            "automation background loop disabled (AUTOMATION_ENABLED=false); "
            "use POST /api/v1/automation/run-engagement-sweep or an external cron"
        )
        return
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
