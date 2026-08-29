"""In-process background loop that polls the inbound mailbox.

Mirrors app/services/scheduler.py (the engagement sweep loop) and stays fully
separate from it. It calls the existing inbound-email service directly - never
an HTTP request to itself - and reuses that service's threading match, sender
fallback, and Message-ID deduplication unchanged.

Trade-offs (documented, not hidden):
  * Runs inside the API process. It assumes a SINGLE backend worker. With
    multiple uvicorn workers each worker would start its own loop; the inbound
    service's Message-ID dedup keeps that safe but wasteful, so keep the Docker
    backend at one worker (see docker-compose.yml / Dockerfile).
  * The timer resets on process restart; it is not durable. The manual endpoint
    POST /api/v1/webhooks/inbound-email/poll always works regardless.
  * Disabled unless INBOUND_EMAIL_ENABLED=true AND IMAP is configured, so it
    never surprises a deployment.
"""
from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import logger

_task: asyncio.Task | None = None

# Never poll faster than this, whatever the configured interval says.
_MIN_INTERVAL_SECONDS = 30


def _interval() -> int:
    return max(
        _MIN_INTERVAL_SECONDS,
        int(settings.inbound_email_poll_interval_seconds or 120),
    )


def _should_run() -> bool:
    """True only when inbound email is enabled and IMAP is actually configured."""
    from app.services import imap_client

    return bool(settings.inbound_email_enabled and imap_client.is_configured())


def _run_once() -> None:
    """One poll. Swallows every error - the loop must survive a bad Gmail day."""
    from app.db.supabase import get_supabase
    from app.services import inbound_email

    try:
        db = get_supabase()
    except Exception:  # noqa: BLE001
        logger.warning("inbound poll: database not configured; skipping run")
        return
    try:
        result = inbound_email.poll_and_ingest(db)
        logger.info(
            "inbound poll: checked=%s ingested=%s skipped=%s",
            result.get("checked"),
            result.get("ingested"),
            result.get("skipped"),
        )
    except Exception as exc:  # noqa: BLE001
        # type name only - never the exception body (may echo credentials).
        logger.warning("inbound poll failed: %s", type(exc).__name__)


async def _loop() -> None:
    interval = _interval()
    logger.info(
        "inbound-email polling loop started (every %d s)", interval
    )
    while True:
        try:
            await asyncio.sleep(interval)
            await asyncio.to_thread(_run_once)
        except asyncio.CancelledError:
            logger.info("inbound-email polling loop stopped")
            raise
        except Exception:  # noqa: BLE001
            # Defensive: _run_once already swallows everything, but the loop
            # keeps going no matter what reaches here. Next poll still fires.
            logger.warning("inbound-email polling loop iteration error (continuing)")


def start() -> None:
    """Start the loop, or log why it is not starting. Idempotent."""
    global _task
    if not _should_run():
        if settings.inbound_email_enabled:
            logger.info(
                "inbound-email polling loop not started: IMAP is not configured. "
                "Use POST /api/v1/webhooks/inbound-email/poll or fix IMAP settings."
            )
        else:
            logger.info(
                "inbound-email polling loop disabled (INBOUND_EMAIL_ENABLED=false)"
            )
        return
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop() -> None:
    """Cancel the loop cleanly - no orphan tasks left behind."""
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
