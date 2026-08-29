"""WhatsApp scaffolding tests.

WhatsApp is disabled and has no provider. These tests assert it stays that way:
every path returns a clear 503 / 422, nothing is sent, nothing is persisted, and
no credential leaks into an error. Existing email behaviour is untouched.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.core.errors import (
    ValidationError,
    WhatsAppNotConfiguredError,
    WhatsAppNotEnabledError,
)
from app.db import repositories as repo
from app.main import app
from app.schemas.whatsapp import SendWhatsAppRequest
from app.services import whatsapp as wa

CAND = {
    "id": str(uuid.uuid4()),
    "slug": "riya-nair",
    "full_name": "Riya Nair",
    "email": "riya.nair@example.com",
    "phone": "+91 90000 12345",
    "role": "AI Engineer",
    "recruiter_name": "Aman Singh",
    "current_stage": "offer_accepted",
}
CAND_NO_PHONE = {**CAND, "phone": None}

_SECRET = "wa-secret-shouldnotleak-12345"


@pytest.fixture
def no_persist(monkeypatch):
    """Fail loudly if the disabled WhatsApp path ever touches the DB."""
    def _boom(*a, **k):  # noqa: ANN001
        raise AssertionError("WhatsApp must not persist anything while disabled")

    for name in (
        "get_or_create_conversation", "insert_message", "touch_conversation",
        "update_candidate", "insert_engagement_event",
    ):
        monkeypatch.setattr(wa.repo, name, _boom)


@pytest.fixture
def creds_set(monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_api_key", _SECRET)
    monkeypatch.setattr(wa.settings, "whatsapp_webhook_secret", _SECRET)


@pytest.fixture
def client(monkeypatch):
    app.dependency_overrides[deps.get_db] = lambda: object()
    monkeypatch.setattr(
        repo, "resolve_candidate",
        lambda db, ref: (
            CAND if ref in (CAND["slug"], CAND["id"])
            else CAND_NO_PHONE if ref == "no-phone"
            else None
        ),
    )
    yield TestClient(app)
    app.dependency_overrides.pop(deps.get_db, None)


def _send_url(ref: str) -> str:
    return f"/api/v1/candidates/{ref}/communications/whatsapp"


# ---------------------------------------------------------------------------
# send endpoint
# ---------------------------------------------------------------------------

def test_send_disabled_returns_503(client, monkeypatch, no_persist, creds_set):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    r = client.post(_send_url(CAND["slug"]), json={"body": "Hi Riya"})
    assert r.status_code == 503
    assert r.json()["code"] == "whatsapp_not_enabled"
    assert _SECRET not in r.text


def test_send_enabled_but_no_provider_returns_503(client, monkeypatch, no_persist, creds_set):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", True)
    monkeypatch.setattr(wa.settings, "whatsapp_provider", "meta")
    r = client.post(_send_url(CAND["slug"]), json={"body": "Hi Riya"})
    assert r.status_code == 503
    assert r.json()["code"] == "whatsapp_not_configured"
    assert _SECRET not in r.text


def test_send_candidate_without_phone_422(client, monkeypatch, no_persist):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    r = client.post(_send_url("no-phone"), json={"body": "Hi"})
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"


def test_send_unknown_candidate_404(client, monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    r = client.post(_send_url("ghost"), json={"body": "Hi"})
    assert r.status_code == 404


def test_send_invalid_body_422(client, monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    assert client.post(_send_url(CAND["slug"]), json={"body": ""}).status_code == 422
    assert client.post(
        _send_url(CAND["slug"]), json={"body": "x", "surprise": 1}
    ).status_code == 422


def test_send_never_persists_while_disabled(monkeypatch, no_persist):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    with pytest.raises(WhatsAppNotEnabledError):
        wa.send_candidate_whatsapp(None, CAND, SendWhatsAppRequest(body="Hi"))


def test_service_dispatch_raises_while_disabled(monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    with pytest.raises(WhatsAppNotEnabledError):
        wa.send_whatsapp_message(to="+919000012345", body="Hi")


def test_get_provider_unconfigured(monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", True)
    monkeypatch.setattr(wa.settings, "whatsapp_provider", "twilio")
    with pytest.raises(WhatsAppNotConfiguredError):
        wa.get_provider()


def test_phone_validation_message_has_no_secret(monkeypatch, creds_set):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    with pytest.raises(ValidationError) as ei:
        wa.send_candidate_whatsapp(None, CAND_NO_PHONE, SendWhatsAppRequest(body="Hi"))
    assert _SECRET not in str(ei.value.detail)


# ---------------------------------------------------------------------------
# inbound webhook
# ---------------------------------------------------------------------------

def test_webhook_post_disabled_rejected(client, monkeypatch, creds_set):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    r = client.post("/api/v1/webhooks/whatsapp", json={"messages": [{"text": "hi"}]})
    assert r.status_code == 503
    assert r.json()["code"] == "whatsapp_not_enabled"
    assert _SECRET not in r.text


def test_webhook_get_disabled_rejected(client, monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    r = client.get("/api/v1/webhooks/whatsapp?hub.challenge=123")
    assert r.status_code == 503


def test_webhook_enabled_no_provider_rejected(client, monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", True)
    r = client.post("/api/v1/webhooks/whatsapp", json={"messages": []})
    assert r.status_code == 503
    assert r.json()["code"] == "whatsapp_not_configured"


# ---------------------------------------------------------------------------
# existing email path is untouched
# ---------------------------------------------------------------------------

def test_email_route_still_present_and_independent(client, monkeypatch):
    monkeypatch.setattr(wa.settings, "whatsapp_enabled", False)
    # email route still validates its own body (subject required) regardless of
    # the WhatsApp feature flag
    r = client.post(
        f"/api/v1/candidates/{CAND['slug']}/communications/email",
        json={"body": "no subject"},
    )
    assert r.status_code == 422

    from app.main import app as _app
    paths = _app.openapi()["paths"]
    assert "/api/v1/candidates/{candidate_id}/communications/email" in paths
    assert "/api/v1/webhooks/resend" in paths
