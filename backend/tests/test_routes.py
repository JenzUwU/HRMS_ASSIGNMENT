"""Route-level tests via TestClient. DB + Groq are stubbed through dependency
overrides and monkeypatched repositories - no network."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.core.errors import AINotConfiguredError, AIUpstreamError
from app.db import repositories as repo
from app.main import app
from app.services import ai as ai_service

CAND = {
    "id": str(uuid.uuid4()),
    "slug": "route-cand",
    "full_name": "Route Cand",
    "current_stage": "documentation",
    "recruiter_id": str(uuid.uuid4()),
    "status": "active",
}


@pytest.fixture
def client(monkeypatch):
    app.dependency_overrides[deps.get_db] = lambda: object()
    monkeypatch.setattr(
        repo, "resolve_candidate",
        lambda db, ref: CAND if ref in (CAND["slug"], CAND["id"]) else None,
    )
    yield TestClient(app)
    app.dependency_overrides.pop(deps.get_db, None)


# --- candidate resolution --------------------------------------------

def test_note_unknown_candidate_404(client):
    r = client.post("/api/v1/candidates/ghost/notes", json={"body": "x"})
    assert r.status_code == 404
    assert r.json()["code"] == "not_found"


def test_note_invalid_body_422(client):
    r = client.post(
        f"/api/v1/candidates/{CAND['slug']}/notes", json={"body": ""}
    )
    assert r.status_code == 422


def test_note_extra_field_422(client):
    r = client.post(
        f"/api/v1/candidates/{CAND['slug']}/notes",
        json={"body": "ok", "surprise": 1},
    )
    assert r.status_code == 422


def test_candidate_patch_bad_status_422(client):
    r = client.patch(
        f"/api/v1/candidates/{CAND['slug']}", json={"status": "banana"}
    )
    assert r.status_code == 422


def test_note_created(client, monkeypatch):
    monkeypatch.setattr(
        repo, "insert_note",
        lambda db, **kw: {
            "id": str(uuid.uuid4()),
            "candidate_id": CAND["id"],
            "body": kw["body"],
            "is_pinned": False,
            "author_recruiter_id": None,
            "author_name": None,
            "author_initials": None,
            "created_at": "2026-08-29T00:00:00Z",
            "updated_at": "2026-08-29T00:00:00Z",
        },
    )
    monkeypatch.setattr(repo, "insert_engagement_event", lambda db, **kw: {"id": "1"})
    r = client.post(
        f"/api/v1/candidates/{CAND['slug']}/notes", json={"body": "real note"}
    )
    assert r.status_code == 201
    assert r.json()["body"] == "real note"


# --- AI routes -------------------------------------------------------

def test_ai_message_unknown_candidate_404(client):
    r = client.post("/api/v1/candidates/ghost/ai/message", json={"channel": "email"})
    assert r.status_code == 404


def test_ai_message_not_configured_503(client, monkeypatch):
    def boom(*a, **k):
        raise AINotConfiguredError()

    monkeypatch.setattr(ai_service, "draft_message", boom)
    r = client.post(
        f"/api/v1/candidates/{CAND['slug']}/ai/message", json={"channel": "email"}
    )
    assert r.status_code == 503
    assert r.json()["code"] == "ai_not_configured"


def test_ai_summary_upstream_502(client, monkeypatch):
    def boom(*a, **k):
        raise AIUpstreamError()

    monkeypatch.setattr(ai_service, "summarize_interactions", boom)
    r = client.post(f"/api/v1/candidates/{CAND['slug']}/ai/summary")
    assert r.status_code == 502
    assert r.json()["code"] == "ai_upstream_error"


def test_ai_recommendations_list(client, monkeypatch):
    monkeypatch.setattr(repo, "list_ai_recommendations", lambda db, cid, kind=None: [])
    r = client.get(f"/api/v1/candidates/{CAND['slug']}/ai/recommendations")
    assert r.status_code == 200
    assert r.json() == []
