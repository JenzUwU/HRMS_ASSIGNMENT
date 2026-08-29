"""Inbound email (candidate reply) ingestion tests. IMAP and Supabase are faked:
no IMAP connection is opened, no real mailbox is read."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.core.errors import EmailNotConfiguredError
from app.main import app
from app.services import inbound_email
from app.services.imap_client import InboundEmail

CID = str(uuid.uuid4())
CAND = {
    "id": CID,
    "slug": "janani",
    "full_name": "Janani",
    "email": "janani22td0680@svcet.ac.in",
    "current_stage": "offer_accepted",
}
OUR_MSGID = "<178801837489.22028.1@epitaxy-hrms>"


def mk(**kw) -> InboundEmail:
    base = dict(
        message_id="<reply-1@svcet.ac.in>",
        in_reply_to=OUR_MSGID,
        references=[OUR_MSGID],
        from_addr="janani22td0680@svcet.ac.in",
        from_name="Janani",
        subject="Re: Epitaxy HRMS - Email Delivery Test",
        body="Hi, yes I received it. Looking forward to joining.",
        received_at="2026-08-29T18:40:00+00:00",
    )
    base.update(kw)
    return InboundEmail(**base)


@pytest.fixture
def store(monkeypatch):
    s = {
        "messages": [],
        "events": [],
        "conv": [{"id": str(uuid.uuid4()), "channel": "email", "candidate_id": CID}],
        "candidate_updates": [],
        "ingested_ids": set(),
        "outbound_events": {OUR_MSGID: {"candidate_id": CID}},
    }
    r = inbound_email.repo

    monkeypatch.setattr(r, "find_email_event_by_provider_id",
                        lambda db, mid: s["outbound_events"].get(mid))
    monkeypatch.setattr(r, "get_candidate_record", lambda db, cid: CAND if str(cid) == CID else None)
    monkeypatch.setattr(r, "get_candidate_by_email",
                        lambda db, e: CAND if e.lower() == CAND["email"] else None)
    monkeypatch.setattr(r, "find_inbound_event_by_message_id",
                        lambda db, mid: {"id": "x"} if mid in s["ingested_ids"] else None)
    monkeypatch.setattr(r, "list_conversations_for_candidate",
                        lambda db, cid: [c for c in s["conv"] if c["candidate_id"] == str(cid)])
    monkeypatch.setattr(r, "get_or_create_conversation",
                        lambda db, *, candidate_id, channel, subject: (
                            {"id": str(uuid.uuid4()), "channel": channel,
                             "candidate_id": str(candidate_id)}))

    def insert_inbound_email(db, **kw):
        row = {"id": str(uuid.uuid4()), "direction": "inbound",
               "channel": "email", "actor": "candidate", "status": "delivered", **kw}
        s["messages"].append(row)
        return row

    monkeypatch.setattr(r, "insert_inbound_email", insert_inbound_email)

    def insert_event(db, **kw):
        s["events"].append(kw)
        if kw.get("metadata", {}).get("inbound_message_id"):
            s["ingested_ids"].add(kw["metadata"]["inbound_message_id"])

    monkeypatch.setattr(r, "insert_engagement_event", insert_event)
    monkeypatch.setattr(r, "touch_conversation", lambda *a, **k: None)
    monkeypatch.setattr(r, "update_candidate",
                        lambda db, cid, fields: s["candidate_updates"].append(fields))

    s["notify_calls"] = []
    monkeypatch.setattr(
        inbound_email.recruiter_notify, "notify_inbound_reply",
        lambda db, cand, *, message_key, subject: (
            s["notify_calls"].append({"slug": cand.get("slug"), "key": message_key})
            or "notified: email"
        ),
    )
    return s


# ---------------------------------------------------------------------------
# 1. threading match (In-Reply-To -> our outbound Message-ID)
# ---------------------------------------------------------------------------

def test_inbound_reply_triggers_recruiter_notification(store):
    inbound_email.ingest_one(None, mk())
    assert len(store["notify_calls"]) == 1
    assert store["notify_calls"][0]["slug"] == "janani"


def test_ingest_matches_by_threading(store):
    status = inbound_email.ingest_one(None, mk())
    assert status.startswith("ingested: janani (via threading)")
    m = store["messages"][0]
    assert m["direction"] == "inbound"
    assert m["channel"] == "email"
    assert m["status"] == "delivered"
    assert m["sender_name"] == "Janani"
    assert m["body"].startswith("Hi, yes I received it")
    assert m["conversation_id"] == store["conv"][0]["id"]  # existing conv reused
    ev = store["events"][0]
    assert ev["event_type"] == "candidate_replied"
    assert ev["actor"] == "candidate"
    assert ev["metadata"]["matched_by"] == "threading"
    assert any("last_interaction_at" in u for u in store["candidate_updates"])


# ---------------------------------------------------------------------------
# 2. fallback: sender email -> candidate
# ---------------------------------------------------------------------------

def test_ingest_matches_by_sender_email(store):
    status = inbound_email.ingest_one(None, mk(in_reply_to=None, references=[]))
    assert "via sender_email" in status
    assert store["messages"][0]["candidate_id"] == CID


# ---------------------------------------------------------------------------
# 3. unknown sender / no thread -> skipped, nothing persisted
# ---------------------------------------------------------------------------

def test_ingest_unknown_sender_skipped(store):
    status = inbound_email.ingest_one(
        None, mk(in_reply_to=None, references=[], from_addr="stranger@nowhere.com")
    )
    assert status.startswith("skipped: no candidate")
    assert store["messages"] == []
    assert store["events"] == []


def test_ingest_no_sender_skipped(store):
    status = inbound_email.ingest_one(None, mk(from_addr=""))
    assert status == "skipped: no sender address"
    assert store["messages"] == []


# ---------------------------------------------------------------------------
# 4. idempotent: same Message-ID not ingested twice
# ---------------------------------------------------------------------------

def test_ingest_is_idempotent(store):
    first = inbound_email.ingest_one(None, mk())
    assert first.startswith("ingested")
    second = inbound_email.ingest_one(None, mk())
    assert second == "skipped: already ingested"
    assert len(store["messages"]) == 1  # no duplicate


# ---------------------------------------------------------------------------
# 5. wrong-candidate safety: a matching thread id wins over a mismatched sender
# ---------------------------------------------------------------------------

def test_threading_does_not_cross_candidates(store):
    other = str(uuid.uuid4())
    store["outbound_events"]["<other@epitaxy-hrms>"] = {"candidate_id": other}
    store_cand = dict(CAND, id=other, slug="someone-else",
                      email="janani22td0680@svcet.ac.in")
    # get_candidate_record must return the *threaded* candidate, not the sender's
    inbound_email.repo.get_candidate_record = (  # type: ignore
        lambda db, cid: store_cand if str(cid) == other else CAND
    )
    status = inbound_email.ingest_one(
        None, mk(in_reply_to="<other@epitaxy-hrms>", references=["<other@epitaxy-hrms>"])
    )
    assert "someone-else" in status
    assert store["messages"][0]["candidate_id"] == other


# ---------------------------------------------------------------------------
# 6. poll gate: disabled -> 503
# ---------------------------------------------------------------------------

def test_poll_disabled_raises(monkeypatch):
    monkeypatch.setattr(inbound_email.settings, "inbound_email_enabled", False)
    with pytest.raises(EmailNotConfiguredError):
        inbound_email.poll_and_ingest(None)


def test_poll_counts(monkeypatch, store):
    monkeypatch.setattr(inbound_email.settings, "inbound_email_enabled", True)
    monkeypatch.setattr(
        inbound_email.imap_client, "fetch_recent",
        lambda limit=None: [mk(), mk(message_id="<r2@x>", from_addr="stranger@nowhere.com",
                                   in_reply_to=None, references=[])],
    )
    res = inbound_email.poll_and_ingest(None)
    assert res["checked"] == 2
    assert res["ingested"] == 1
    assert res["skipped"] == 1


# ---------------------------------------------------------------------------
# 7. route requires the shared token
# ---------------------------------------------------------------------------

def test_route_rejects_without_token(monkeypatch):
    from app.api.routes import webhooks

    monkeypatch.setattr(webhooks.settings, "inbound_poll_token", "s3cret")
    app.dependency_overrides[deps.get_db] = lambda: object()
    try:
        c = TestClient(app)
        r = c.post("/api/v1/webhooks/inbound-email/poll")
        assert r.status_code == 401
        r2 = c.post("/api/v1/webhooks/inbound-email/poll",
                    headers={"X-Inbound-Poll-Token": "wrong"})
        assert r2.status_code == 401
    finally:
        app.dependency_overrides.pop(deps.get_db, None)
