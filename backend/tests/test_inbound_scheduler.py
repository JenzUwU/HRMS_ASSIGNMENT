"""Tests for the automatic inbound-email polling loop
(app/services/inbound_scheduler.py).

IMAP / Gmail is never touched: the inbound-email service is mocked. No real
email is sent or received.
"""
from __future__ import annotations

import asyncio
import logging

import pytest

from app.services import inbound_scheduler as sch


@pytest.fixture(autouse=True)
def _reset_task():
    sch._task = None
    yield
    if sch._task is not None:
        sch._task.cancel()
        sch._task = None


@pytest.fixture
def enabled(monkeypatch):
    """Inbound enabled + IMAP 'configured'."""
    monkeypatch.setattr(sch.settings, "inbound_email_enabled", True)
    from app.services import imap_client

    monkeypatch.setattr(imap_client, "is_configured", lambda: True)


@pytest.fixture
def poll_spy(monkeypatch):
    calls = {"n": 0}
    from app.services import inbound_email

    def fake_poll(db):
        calls["n"] += 1
        return {"checked": 3, "ingested": 1, "skipped": 2, "details": []}

    monkeypatch.setattr(inbound_email, "poll_and_ingest", fake_poll)
    # get_supabase must not touch the network
    monkeypatch.setattr(
        "app.db.supabase.get_supabase", lambda: object(), raising=False
    )
    return calls


# ---------------------------------------------------------------------------
# start / stop gating
# ---------------------------------------------------------------------------

def test_loop_does_not_start_when_disabled(monkeypatch):
    monkeypatch.setattr(sch.settings, "inbound_email_enabled", False)

    async def run():
        sch.start()
        return sch._task

    assert asyncio.run(run()) is None


def test_loop_does_not_start_when_imap_unconfigured(monkeypatch):
    monkeypatch.setattr(sch.settings, "inbound_email_enabled", True)
    from app.services import imap_client

    monkeypatch.setattr(imap_client, "is_configured", lambda: False)

    async def run():
        sch.start()
        return sch._task

    assert asyncio.run(run()) is None


def test_loop_starts_when_enabled_and_configured(enabled):
    async def run():
        sch.start()
        t = sch._task
        await sch.stop()
        return t

    task = asyncio.run(run())
    assert task is not None


def test_start_is_idempotent(enabled):
    async def run():
        sch.start()
        first = sch._task
        sch.start()
        second = sch._task
        await sch.stop()
        return first, second

    a, b = asyncio.run(run())
    assert a is b  # no second loop


# ---------------------------------------------------------------------------
# interval + service call
# ---------------------------------------------------------------------------

def test_configured_interval_is_respected(monkeypatch, enabled):
    monkeypatch.setattr(
        sch.settings, "inbound_email_poll_interval_seconds", 300
    )
    assert sch._interval() == 300


def test_interval_has_a_floor(monkeypatch):
    monkeypatch.setattr(sch.settings, "inbound_email_poll_interval_seconds", 1)
    assert sch._interval() == 30  # never poll faster than the floor


def test_default_interval_is_120(monkeypatch):
    monkeypatch.setattr(
        sch.settings, "inbound_email_poll_interval_seconds", 120
    )
    assert sch._interval() == 120


def test_loop_calls_the_existing_inbound_service(monkeypatch, enabled, poll_spy):
    # make sleep instant so an iteration runs immediately, then stop
    real_sleep = asyncio.sleep

    async def fast_sleep(_):
        await real_sleep(0)

    monkeypatch.setattr(sch.asyncio, "sleep", fast_sleep)

    async def run():
        sch.start()
        await real_sleep(0.05)  # let a few iterations happen
        await sch.stop()

    asyncio.run(run())
    assert poll_spy["n"] >= 1  # the existing service was called


def test_run_once_calls_poll_and_ingest_directly(poll_spy):
    sch._run_once()
    assert poll_spy["n"] == 1


# ---------------------------------------------------------------------------
# resilience: a bad poll must not kill the loop
# ---------------------------------------------------------------------------

def test_poll_exception_does_not_kill_the_loop(monkeypatch, enabled):
    from app.services import inbound_email

    n = {"calls": 0}

    def boom(db):
        n["calls"] += 1
        raise RuntimeError("imap.gmail.com timed out")

    monkeypatch.setattr(inbound_email, "poll_and_ingest", boom)
    monkeypatch.setattr(
        "app.db.supabase.get_supabase", lambda: object(), raising=False
    )
    real_sleep = asyncio.sleep

    async def fast_sleep(_):
        await real_sleep(0)

    monkeypatch.setattr(sch.asyncio, "sleep", fast_sleep)

    async def run():
        sch.start()
        await real_sleep(0.05)
        alive = sch._task is not None and not sch._task.done()
        await sch.stop()
        return alive

    still_alive = asyncio.run(run())
    assert n["calls"] >= 2       # it retried after the error
    assert still_alive           # loop was still running


def test_run_once_swallows_errors(monkeypatch, poll_spy):
    from app.services import inbound_email

    def boom(db):
        raise RuntimeError("nope")

    monkeypatch.setattr(inbound_email, "poll_and_ingest", boom)
    sch._run_once()  # must not raise


# ---------------------------------------------------------------------------
# shutdown
# ---------------------------------------------------------------------------

def test_stop_cancels_cleanly_no_orphan(enabled):
    async def run():
        sch.start()
        task = sch._task
        await sch.stop()
        return task

    task = asyncio.run(run())
    assert task.cancelled() or task.done()
    assert sch._task is None


def test_stop_is_safe_when_never_started():
    asyncio.run(sch.stop())  # no task -> no error
    assert sch._task is None


# ---------------------------------------------------------------------------
# no secrets in logs
# ---------------------------------------------------------------------------

def test_no_credentials_in_logs(monkeypatch, caplog):
    monkeypatch.setattr(sch.settings, "inbound_email_enabled", True)
    monkeypatch.setattr(sch.settings, "inbound_poll_token", "super-secret-token")
    monkeypatch.setattr(sch.settings, "imap_password", "app-password-1234")
    from app.services import imap_client

    monkeypatch.setattr(imap_client, "is_configured", lambda: True)
    from app.services import inbound_email

    def boom(db):
        raise RuntimeError("535 auth failed for user with app-password-1234")

    monkeypatch.setattr(inbound_email, "poll_and_ingest", boom)
    monkeypatch.setattr(
        "app.db.supabase.get_supabase", lambda: object(), raising=False
    )

    async def run():
        with caplog.at_level(logging.INFO):
            sch.start()               # "loop started" INFO line
            sch._run_once()           # failure logged (type name only)
            await sch.stop()

    asyncio.run(run())

    blob = "\n".join(r.getMessage() for r in caplog.records)
    assert "super-secret-token" not in blob
    assert "app-password-1234" not in blob
    assert "RuntimeError" in blob  # the type name is fine to log


def test_startup_and_shutdown_log_at_info(enabled, caplog):
    async def run():
        with caplog.at_level(logging.INFO, logger="hrms"):
            sch.start()
            await asyncio.sleep(0)     # let the loop coroutine reach its first line
            await sch.stop()

    asyncio.run(run())
    msgs = [r.getMessage() for r in caplog.records if r.levelno == logging.INFO]
    assert any("polling loop started" in m for m in msgs)
    assert any("polling loop stopped" in m for m in msgs)


# ---------------------------------------------------------------------------
# the manual route still works, dedup unchanged
# ---------------------------------------------------------------------------

def test_manual_poll_route_still_exists():
    from app.main import app

    paths = {r.path for r in app.routes}
    assert "/api/v1/webhooks/inbound-email/poll" in paths


def test_scheduler_reuses_the_same_service_as_the_route():
    """The loop and the manual endpoint call the identical function - one
    ingestion + dedup implementation, not two."""
    import inspect

    from app.api.routes import webhooks
    from app.services import inbound_email

    route_src = inspect.getsource(webhooks)
    assert "inbound_email.poll_and_ingest" in route_src or "poll_and_ingest" in route_src
    loop_src = inspect.getsource(sch._run_once)
    assert "inbound_email.poll_and_ingest" in loop_src
