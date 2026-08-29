"""Recruiter notification tests. SMTP and Supabase are faked - no email sent,
no network call. Exercises the shared recruiter_notify service and the two
trigger wrappers used by inbound_email and engagement_rules."""
from __future__ import annotations

import uuid

import pytest

from app.core.errors import EmailUpstreamError
from app.services import recruiter_notify

RID = str(uuid.uuid4())
CID = str(uuid.uuid4())
CAND = {
    "id": CID,
    "slug": "janani",
    "full_name": "Janani",
    "current_stage": "offer_accepted",
    "recruiter_id": RID,
}
RECRUITER = {"id": RID, "full_name": "Aman Singh", "email": "aman.singh@epitaxy.test"}


@pytest.fixture
def env(monkeypatch):
    s = {"events": [], "emails": [], "seen_keys": set(), "recruiter": RECRUITER}
    r = recruiter_notify.repo

    monkeypatch.setattr(
        r, "find_notification_event",
        lambda db, key: {"id": "x"} if key in s["seen_keys"] else None,
    )
    monkeypatch.setattr(
        r, "get_recruiter",
        lambda db, rid: s["recruiter"] if str(rid) == RID else None,
    )

    def insert_event(db, **kw):
        row = {"id": str(uuid.uuid4()), **kw}
        s["events"].append(kw)
        key = (kw.get("metadata") or {}).get("notification_key")
        if key:
            s["seen_keys"].add(key)
        return row

    monkeypatch.setattr(r, "insert_engagement_event", insert_event)

    def fake_send(to, subject, body, reply_to=None, *, idempotency_key=None):
        s["emails"].append({"to": to, "subject": subject, "body": body})
        return {"message_id": "smtp_notify_1"}

    monkeypatch.setattr(recruiter_notify.smtp_client, "send_email", fake_send)
    return s


# ---------------------------------------------------------------------------
# 1. happy path: email to the assigned recruiter + in-app event
# ---------------------------------------------------------------------------

def test_notifies_assigned_recruiter_by_email(env):
    status = recruiter_notify.notify_inbound_reply(
        None, CAND, message_key="<r1@x>", subject="Re: hello"
    )
    assert status == "notified: email"
    assert len(env["emails"]) == 1
    mail = env["emails"][0]
    assert mail["to"] == RECRUITER["email"]           # from recruiter record
    assert "Janani" in mail["subject"]
    assert "replied" in mail["body"].lower()
    ev = env["events"][0]
    assert ev["event_type"] == "note_added"
    assert ev["actor"] == "system"
    assert ev["metadata"]["notification"] is True
    assert ev["metadata"]["notification_key"] == "inbound:<r1@x>"
    assert ev["metadata"]["email_sent"] is True
    assert ev["metadata"]["recruiter_id"] == RID


# ---------------------------------------------------------------------------
# 2. duplicate event -> no second email, no second record
# ---------------------------------------------------------------------------

def test_duplicate_event_sends_nothing(env):
    first = recruiter_notify.notify_inbound_reply(
        None, CAND, message_key="<dup@x>", subject="s"
    )
    assert first == "notified: email"
    second = recruiter_notify.notify_inbound_reply(
        None, CAND, message_key="<dup@x>", subject="s"
    )
    assert second == "skipped: duplicate notification"
    assert len(env["emails"]) == 1
    assert len(env["events"]) == 1


# ---------------------------------------------------------------------------
# 3. recruiter has no valid email -> in-app only, workflow not broken
# ---------------------------------------------------------------------------

def test_missing_recruiter_email_is_safe(env):
    env["recruiter"] = {"id": RID, "full_name": "No Email", "email": ""}
    status = recruiter_notify.notify_inbound_reply(
        None, CAND, message_key="<n1@x>", subject="s"
    )
    assert status == "notified: in-app only (no recruiter email)"
    assert env["emails"] == []
    assert env["events"][0]["metadata"]["email_sent"] is False


def test_no_recruiter_assigned_is_safe(env):
    status = recruiter_notify.notify_high_risk(
        None, {**CAND, "recruiter_id": None}, assessment_id="a1", summary="risky"
    )
    assert status == "notified: in-app only (no recruiter email)"
    assert env["emails"] == []


# ---------------------------------------------------------------------------
# 4. SMTP failure -> records nothing, so the same key can retry
# ---------------------------------------------------------------------------

def test_smtp_failure_records_nothing(env, monkeypatch):
    def boom(*a, **k):
        raise EmailUpstreamError("smtp down")

    monkeypatch.setattr(recruiter_notify.smtp_client, "send_email", boom)
    status = recruiter_notify.notify_inbound_reply(
        None, CAND, message_key="<f1@x>", subject="s"
    )
    assert status.startswith("failed: email")
    assert env["events"] == []            # nothing recorded
    assert "<f1@x>" not in env["seen_keys"]  # key free to retry


# ---------------------------------------------------------------------------
# 5. notify_recruiter never raises (contract)
# ---------------------------------------------------------------------------

def test_notify_never_raises(monkeypatch):
    def explode(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(recruiter_notify.repo, "find_notification_event", explode)
    status = recruiter_notify.notify_recruiter(
        None, CAND, notification_key="k", headline="h", reason="r",
        recommended_action="a", kind="test",
    )
    assert status.startswith("failed:")


# ---------------------------------------------------------------------------
# 6. automation task wrapper
# ---------------------------------------------------------------------------

def test_automation_task_wrapper(env):
    status = recruiter_notify.notify_automation_task(
        None, CAND, task_id="task-9", detail="joining soon, no interaction"
    )
    assert status == "notified: email"
    assert env["events"][0]["metadata"]["notification_key"] == "automation:task-9"
    assert env["events"][0]["metadata"]["notification_kind"] == "automation_task"
    assert "task" in env["emails"][0]["body"].lower()


# ---------------------------------------------------------------------------
# 7. high-risk wrapper
# ---------------------------------------------------------------------------

def test_high_risk_wrapper(env):
    status = recruiter_notify.notify_high_risk(
        None, CAND, assessment_id="ra-3", summary="declining engagement"
    )
    assert status == "notified: email"
    assert "HIGH" in env["emails"][0]["body"]
    assert env["events"][0]["metadata"]["notification_key"] == "risk:ra-3"
