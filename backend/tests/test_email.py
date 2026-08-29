"""Email integration tests. Gmail SMTP and Supabase are faked - smtplib is
monkeypatched, no real connection is opened and no email is ever sent."""
from __future__ import annotations

import smtplib
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.core.errors import EmailNotConfiguredError, EmailUpstreamError, ValidationError
from app.db import repositories as repo
from app.main import app
from app.schemas.email import CreateCandidateRequest, SendCandidateEmailRequest
from app.services import candidate_admin, email as email_service, smtp_client

RID = str(uuid.uuid4())
CAND = {
    "id": str(uuid.uuid4()),
    "slug": "janani-t",
    "full_name": "Janani T",
    "email": "janani@example.com",
    "role": "AI Engineer",
    "current_stage": "offer_accepted",
    "recruiter_id": RID,
    "recruiter_name": "Aman Singh",
    "status": "offer_accepted",
}


# ---------------------------------------------------------------------------
# fakes
# ---------------------------------------------------------------------------

@pytest.fixture
def db_store(monkeypatch):
    store = {"messages": [], "events": [], "conv": {}, "candidate_updates": [], "ai": []}

    monkeypatch.setattr(
        email_service.repo, "get_or_create_conversation",
        lambda db, *, candidate_id, channel, subject: store["conv"].setdefault(
            (str(candidate_id), channel), {"id": str(uuid.uuid4()), "channel": channel}
        ),
    )

    def insert_outbound_email(db, **kw):
        row = {
            "id": str(uuid.uuid4()),
            "direction": "outbound",
            "channel": "email",
            "actor": "recruiter",
            "status": "sent",
            **kw,
        }
        store["messages"].append(row)
        return row

    monkeypatch.setattr(email_service.repo, "insert_outbound_email", insert_outbound_email)
    monkeypatch.setattr(
        email_service.repo, "insert_engagement_event",
        lambda db, **kw: store["events"].append(kw),
    )
    monkeypatch.setattr(email_service.repo, "touch_conversation", lambda *a, **k: None)
    monkeypatch.setattr(
        email_service.repo, "update_candidate",
        lambda db, cid, fields: store["candidate_updates"].append(fields),
    )
    monkeypatch.setattr(
        email_service.repo, "update_ai_recommendation",
        lambda *a, **k: store["ai"].append(k),
    )
    return store


@pytest.fixture
def smtp_ok(monkeypatch):
    """email_service.smtp_client.send_email replaced with an in-memory capture."""
    sent = []

    def fake_send(to, subject, body, reply_to=None, *, idempotency_key=None):
        sent.append({"to": to, "subject": subject, "body": body, "reply_to": reply_to})
        return {"message_id": "smtp_msg_123"}

    monkeypatch.setattr(email_service.smtp_client, "send_email", fake_send)
    return sent


@pytest.fixture
def smtp_fails(monkeypatch):
    def boom(*a, **k):
        raise EmailUpstreamError("the email server rejected the request")

    monkeypatch.setattr(email_service.smtp_client, "send_email", boom)


@pytest.fixture
def smtp_configured(monkeypatch):
    monkeypatch.setattr(smtp_client.settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(smtp_client.settings, "smtp_port", 587)
    monkeypatch.setattr(smtp_client.settings, "smtp_username", "hr@gmail.test")
    monkeypatch.setattr(smtp_client.settings, "smtp_password", "app-password")
    monkeypatch.setattr(smtp_client.settings, "email_from", "hr@gmail.test")


class _FakeSMTP:
    """Context-manager stand-in for smtplib.SMTP. Records calls; sends nothing."""

    instances: list["_FakeSMTP"] = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.logged_in_as = None
        self.sent = []
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self, *a):
        return (250, b"ok")

    def starttls(self, *a, **k):
        self.tls = True

    def login(self, user, password):
        self.logged_in_as = user

    def send_message(self, msg, from_addr=None, to_addrs=None):
        self.sent.append({"from": from_addr, "to": to_addrs, "subject": msg["Subject"]})


# ---------------------------------------------------------------------------
# 1. SMTP client: configuration
# ---------------------------------------------------------------------------

def test_smtp_missing_credentials_raises_503(monkeypatch):
    monkeypatch.setattr(smtp_client.settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(smtp_client.settings, "smtp_username", "hr@gmail.test")
    monkeypatch.setattr(smtp_client.settings, "smtp_password", None)
    with pytest.raises(EmailNotConfiguredError) as ei:
        smtp_client.send_email("a@b.com", "s", "b")
    assert ei.value.status_code == 503


def test_smtp_valid_config_reported(smtp_configured):
    assert smtp_client.is_configured() is True


# ---------------------------------------------------------------------------
# 2. SMTP client: success / failure paths (smtplib mocked)
# ---------------------------------------------------------------------------

def test_smtp_success_returns_message_id(smtp_configured, monkeypatch):
    _FakeSMTP.instances.clear()
    monkeypatch.setattr(smtp_client.smtplib, "SMTP", _FakeSMTP)
    out = smtp_client.send_email(
        "candidate@example.com", "Epitaxy HRMS Email Test", "Hi, this is a test."
    )
    assert out["message_id"].startswith("<") and "epitaxy-hrms" in out["message_id"]
    conn = _FakeSMTP.instances[-1]
    assert conn.logged_in_as == "hr@gmail.test"
    assert conn.sent[0]["to"] == ["candidate@example.com"]
    assert conn.sent[0]["subject"] == "Epitaxy HRMS Email Test"


def test_smtp_auth_failure_maps_to_502(smtp_configured, monkeypatch):
    class Boom(_FakeSMTP):
        def login(self, user, password):
            raise smtplib.SMTPAuthenticationError(535, b"Bad credentials")

    monkeypatch.setattr(smtp_client.smtplib, "SMTP", Boom)
    with pytest.raises(EmailUpstreamError) as ei:
        smtp_client.send_email("a@b.com", "s", "b")
    assert ei.value.status_code == 502
    # the raised message must never contain the password
    assert "app-password" not in str(ei.value)


def test_smtp_connection_failure_maps_to_502(smtp_configured, monkeypatch):
    def refuse(*a, **k):
        raise OSError("connection refused")

    monkeypatch.setattr(smtp_client.smtplib, "SMTP", refuse)
    with pytest.raises(EmailUpstreamError) as ei:
        smtp_client.send_email("a@b.com", "s", "b")
    assert ei.value.status_code == 502


# ---------------------------------------------------------------------------
# 3. candidate has no / invalid email -> validation error (422)
# ---------------------------------------------------------------------------

def test_candidate_without_email_rejected(db_store, smtp_ok):
    with pytest.raises(ValidationError):
        email_service.send_candidate_email(
            None, {**CAND, "email": ""},
            SendCandidateEmailRequest(subject="Hi", body="hello"),
        )
    assert smtp_ok == []  # SMTP never attempted


def test_candidate_invalid_email_rejected(db_store, smtp_ok):
    with pytest.raises(ValidationError):
        email_service.send_candidate_email(
            None, {**CAND, "email": "not-an-email"},
            SendCandidateEmailRequest(subject="Hi", body="hello"),
        )
    assert smtp_ok == []


# ---------------------------------------------------------------------------
# 4. route-level: unknown candidate -> 404, bad body -> 422
# ---------------------------------------------------------------------------

def test_route_unknown_candidate_404(monkeypatch):
    app.dependency_overrides[deps.get_db] = lambda: object()
    monkeypatch.setattr(repo, "resolve_candidate", lambda db, ref: None)
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/candidates/ghost/communications/email",
            json={"subject": "s", "body": "b"},
        )
        assert r.status_code == 404
        assert r.json()["code"] == "not_found"
    finally:
        app.dependency_overrides.pop(deps.get_db, None)


def test_route_invalid_body_422(monkeypatch):
    app.dependency_overrides[deps.get_db] = lambda: object()
    monkeypatch.setattr(repo, "resolve_candidate", lambda db, ref: CAND)
    try:
        c = TestClient(app)
        r = c.post(
            f"/api/v1/candidates/{CAND['slug']}/communications/email",
            json={"subject": "", "body": "b"},
        )
        assert r.status_code == 422
        r2 = c.post(
            f"/api/v1/candidates/{CAND['slug']}/communications/email",
            json={"subject": "s", "body": "b", "surprise": 1},
        )
        assert r2.status_code == 422
    finally:
        app.dependency_overrides.pop(deps.get_db, None)


# ---------------------------------------------------------------------------
# 5. SMTP success -> message + event persisted
# ---------------------------------------------------------------------------

def test_send_success_persists_message(db_store, smtp_ok):
    res = email_service.send_candidate_email(
        None, CAND,
        SendCandidateEmailRequest(subject="Welcome", body="Hi Janani"),
    )
    assert res.sent is True
    assert res.message_id == "smtp_msg_123"
    assert res.provider == "gmail_smtp"
    assert res.channel == "email"

    assert len(db_store["messages"]) == 1
    m = db_store["messages"][0]
    assert m["direction"] == "outbound"
    assert m["channel"] == "email"
    assert m["subject"] == "Welcome"
    assert m["status"] == "sent"

    ev = db_store["events"][0]
    assert ev["channel"] == "email"
    assert ev["metadata"]["provider"] == "gmail_smtp"
    assert ev["metadata"]["provider_message_id"] == "smtp_msg_123"

    # recipient comes from the candidate record, not the request body
    assert smtp_ok[0]["to"] == CAND["email"]
    assert any("last_interaction_at" in u for u in db_store["candidate_updates"])


# ---------------------------------------------------------------------------
# 6. SMTP failure -> 502, nothing persisted (no fake "sent" message)
# ---------------------------------------------------------------------------

def test_send_failure_not_persisted(db_store, smtp_fails):
    with pytest.raises(EmailUpstreamError) as ei:
        email_service.send_candidate_email(
            None, CAND, SendCandidateEmailRequest(subject="x", body="y")
        )
    assert ei.value.status_code == 502
    assert db_store["messages"] == []
    assert db_store["events"] == []
    assert db_store["candidate_updates"] == []


# ---------------------------------------------------------------------------
# 7. newly created candidate can send their FIRST email (no prior thread)
# ---------------------------------------------------------------------------

def test_first_email_for_new_candidate(db_store, smtp_ok):
    fresh = {
        "id": str(uuid.uuid4()),
        "slug": "test-candidate",
        "full_name": "Test Candidate",
        "email": "test.candidate@example.com",
        "role": "Software Engineer",
        "current_stage": "offer_accepted",
        "recruiter_id": RID,
        "recruiter_name": "Aman Singh",
        "status": "offer_accepted",
    }
    assert db_store["conv"] == {}  # no conversation exists yet
    res = email_service.send_candidate_email(
        None, fresh,
        SendCandidateEmailRequest(
            subject="Epitaxy HRMS Email Test",
            body="Hi, this is a test email sent from the Epitaxy HRMS application.",
        ),
    )
    assert res.sent is True
    assert res.conversation_id is not None  # conversation was created on send
    assert len(db_store["messages"]) == 1
    assert smtp_ok[0]["to"] == "test.candidate@example.com"


# ---------------------------------------------------------------------------
# 8. payload validation
# ---------------------------------------------------------------------------

def test_request_model_rejects_bad_reply_to():
    with pytest.raises(Exception):
        SendCandidateEmailRequest(subject="s", body="b", reply_to="nonsense")


def test_request_model_strips_and_bounds():
    req = SendCandidateEmailRequest(subject="  Hi  ", body="  hello  ")
    assert req.subject == "Hi" and req.body == "hello"
    with pytest.raises(Exception):
        SendCandidateEmailRequest(subject="x" * 201, body="b")


# ---------------------------------------------------------------------------
# 9. AI draft flows into the email send (Groq stays separate)
# ---------------------------------------------------------------------------

def test_ai_draft_id_marks_message_ai_generated(db_store, smtp_ok):
    rec_id = uuid.uuid4()
    res = email_service.send_candidate_email(
        None, CAND,
        SendCandidateEmailRequest(
            subject="Personalized", body="AI text", ai_recommendation_id=rec_id
        ),
    )
    assert res.sent is True
    assert db_store["messages"][0]["is_ai_generated"] is True
    assert db_store["ai"] and db_store["ai"][0]["status"] == "accepted"


# ---------------------------------------------------------------------------
# 10. candidate-specific recipient resolution (the "Ajay" bug)
#     Every send resolves the recipient from the candidate in the URL path,
#     never from the request body and never from a previously-selected
#     candidate.
# ---------------------------------------------------------------------------

_AJAY = {
    "id": str(uuid.uuid4()),
    "slug": "ajay-krishna",
    "full_name": "Ajay Krishna",
    "email": "ajay.krishna@example.com",
    "role": "Backend Engineer",
    "current_stage": "offer_accepted",
    "recruiter_id": RID,
    "recruiter_name": "Aman Singh",
    "status": "offer_accepted",
}
_JANANI = {**CAND, "slug": "janani", "full_name": "Janani", "email": "janani@svcet.example"}


def test_send_resolves_recipient_per_candidate(db_store, smtp_ok):
    # send for Janani
    email_service.send_candidate_email(
        None, _JANANI, SendCandidateEmailRequest(subject="Hi J", body="body")
    )
    # then send for Ajay - a different candidate object
    email_service.send_candidate_email(
        None, _AJAY, SendCandidateEmailRequest(subject="Hi A", body="body")
    )
    assert [m["to"] for m in smtp_ok] == [_JANANI["email"], _AJAY["email"]]
    # Ajay's email was never used for Janani and vice versa
    assert _JANANI["email"] != _AJAY["email"]


def test_route_recipient_comes_from_path_candidate(db_store, smtp_ok, monkeypatch):
    """POST /candidates/<ref>/communications/email resolves <ref> to a candidate
    and emails THAT candidate - not whoever was sent last."""
    app.dependency_overrides[deps.get_db] = lambda: object()
    resolved = {"ajay-krishna": _AJAY, "janani": _JANANI}
    monkeypatch.setattr(repo, "resolve_candidate", lambda db, ref: resolved.get(ref))
    try:
        c = TestClient(app)
        r1 = c.post(
            "/api/v1/candidates/janani/communications/email",
            json={"subject": "s", "body": "b"},
        )
        r2 = c.post(
            "/api/v1/candidates/ajay-krishna/communications/email",
            json={"subject": "s", "body": "b"},
        )
        assert r1.status_code == 201 and r2.status_code == 201
        assert smtp_ok[0]["to"] == _JANANI["email"]
        assert smtp_ok[1]["to"] == _AJAY["email"]
    finally:
        app.dependency_overrides.pop(deps.get_db, None)


def test_request_cannot_supply_a_recipient():
    """The client must not be able to steer the recipient. `to` / `recipient`
    are rejected by the strict request model."""
    for bad in ({"to": "attacker@evil.test"}, {"recipient": "x@y.test"}):
        with pytest.raises(Exception):
            SendCandidateEmailRequest(subject="s", body="b", **bad)


def test_candidate_missing_email_is_a_clean_422(db_store, smtp_ok):
    with pytest.raises(ValidationError):
        email_service.send_candidate_email(
            None, {**_AJAY, "email": None},
            SendCandidateEmailRequest(subject="s", body="b"),
        )
    assert smtp_ok == []  # nothing sent


def test_list_conversations_for_candidate_flattens_candidate_fields(monkeypatch):
    """The candidate-scoped conversations feed carries candidate_name / _slug so
    the Communication deep-link can render the right person."""
    from app.db import repositories as r

    captured = {}

    class _Res:
        data = [{
            "id": "conv-1", "candidate_id": "cand-1", "channel": "email",
            "subject": "Onboarding", "last_message_at": None,
            "last_message_preview": None, "unread_count": 0, "is_online": False,
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            "candidate": {
                "full_name": "Ajay Krishna", "initials": "AK", "slug": "ajay-krishna",
                "role": "Backend Engineer", "location_city": "Kochi",
                "status": "offer_accepted", "current_stage": "offer_accepted",
            },
        }]

    def fake_run(q):
        return _Res()

    def fake_table(name):
        captured["table"] = name

        class Q:
            def select(self, *a, **k):
                captured["select"] = a[0] if a else None
                return self

            def eq(self, *a, **k):
                return self

            def order(self, *a, **k):
                return self

        return Q()

    monkeypatch.setattr(r, "_run", fake_run)
    db = type("D", (), {"table": staticmethod(fake_table)})()
    rows = r.list_conversations_for_candidate(db, "cand-1")
    assert "candidate:candidates(" in (captured["select"] or "")  # embed requested
    assert rows[0]["candidate_name"] == "Ajay Krishna"
    assert rows[0]["candidate_slug"] == "ajay-krishna"
    assert "candidate" not in rows[0]  # embed was flattened away


# ---------------------------------------------------------------------------
# candidate creation (supports the workflow: "HR adds Test Candidate")
# ---------------------------------------------------------------------------

def test_create_candidate_request_rejects_bad_email():
    with pytest.raises(Exception):
        CreateCandidateRequest(full_name="A B", email="nope", role="Eng",
                               location="Pune", joining_date="2099-01-01")


def test_create_candidate_generates_slug_initials_recruiter(monkeypatch):
    monkeypatch.setattr(candidate_admin.repo, "email_in_use", lambda db, e: False)
    monkeypatch.setattr(candidate_admin.repo, "slug_exists", lambda db, s: False)
    monkeypatch.setattr(candidate_admin.repo, "list_recruiters", lambda db: [{"id": RID}])
    monkeypatch.setattr(candidate_admin.repo, "get_recruiter", lambda db, r: {"id": RID})
    monkeypatch.setattr(candidate_admin.repo, "insert_engagement_event", lambda db, **k: None)
    captured = {}
    monkeypatch.setattr(
        candidate_admin.repo, "insert_candidate",
        lambda db, fields: (captured.update(fields) or {**fields, "id": str(uuid.uuid4())}),
    )
    monkeypatch.setattr(
        candidate_admin.read_service, "build_candidate_detail", lambda db, row: row
    )
    candidate_admin.create_candidate(
        None,
        CreateCandidateRequest(
            full_name="Test  Candidate", email="Test.Candidate@Example.com",
            role="Software Engineer",
            location="Chennai, Tamil Nadu", joining_date="2099-01-05",
        ),
    )
    assert captured["slug"] == "test-candidate"
    assert captured["initials"] == "TC"
    assert captured["email"] == "test.candidate@example.com"
    assert captured["recruiter_id"] == RID


def test_new_candidate_journey_has_no_step_ids(monkeypatch):
    from app.services import candidates as read_service

    cand = {
        "id": str(uuid.uuid4()), "slug": "brand-new", "full_name": "Brand New",
        "current_stage": "offer_accepted", "status": "offer_accepted",
        "steps_completed": 0, "steps_total": 6,
    }
    for name in ("list_journey_steps", "list_engagement_events", "list_tasks", "list_documents"):
        monkeypatch.setattr(read_service.repo, name, lambda *a, **k: [])
    monkeypatch.setattr(read_service.repo, "get_current_risk_assessment", lambda *a, **k: None)
    journey = read_service.build_engagement_journey(None, cand)
    assert len(journey.steps) == 6
    assert all(s.id is None for s in journey.steps)
