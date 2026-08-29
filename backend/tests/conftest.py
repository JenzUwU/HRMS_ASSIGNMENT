"""Shared test fixtures.

No network, no Supabase, no Groq. The engagement-rule tests drive
run_engagement_sweep with the repository layer and the AI service replaced by
in-memory fakes, so they are deterministic and offline.
"""
from __future__ import annotations

import uuid

import pytest

from app.schemas.ai import AIChannel, PersonalizedMessage


class FakeDB:
    """Stand-in for the Supabase Client. The repo functions are monkeypatched,
    so this only needs to be a distinct object the sweep can pass around."""


@pytest.fixture
def fake_db() -> FakeDB:
    return FakeDB()


@pytest.fixture
def fake_message() -> PersonalizedMessage:
    return PersonalizedMessage(
        channel=AIChannel.email,
        subject="Checking in before your start date",
        body="Hi there, just making sure you have everything you need to join us.",
        personalization_rationale="References the imminent joining date and the "
        "quiet period since the last contact.",
    )


@pytest.fixture
def repo_stub(monkeypatch, fake_message):
    """Replace the repository + AI calls used by engagement_rules with fakes
    backed by an in-memory store. Returns the store so tests can inspect it."""
    from app.services import engagement_rules as er

    store: dict = {
        "tasks": [],
        "events": [],
        "recommendations": [],
        "ai_calls": [],
        "ai_fail_slugs": set(),
    }

    def _list_eligible(db, **kw):
        return store.get("eligible", [])

    def _count_candidates(db):
        return store.get("scanned", len(store.get("eligible", [])))

    def _has_open_task(db, candidate_id):
        return any(
            t["candidate_id"] == candidate_id and t["status"] in ("open", "in_progress")
            for t in store["tasks"]
        )

    def _recent_event(db, candidate_id, *, rule, since_iso):
        return any(
            e["candidate_id"] == candidate_id
            and e["metadata"].get("rule") == rule
            and e["metadata"].get("automation")
            for e in store["events"]
        )

    def _insert_task(db, **kw):
        row = {"id": str(uuid.uuid4()), "status": "open", **kw}
        store["tasks"].append(row)
        return row

    def _insert_reco(db, **kw):
        row = {"id": str(uuid.uuid4()), **kw}
        store["recommendations"].append(row)
        return row

    def _insert_event(db, **kw):
        row = {"id": str(uuid.uuid4()), **kw}
        store["events"].append(row)
        return row

    def _draft_message(db, candidate, *, channel, purpose=None):
        store["ai_calls"].append(candidate.get("slug"))
        if candidate.get("slug") in store["ai_fail_slugs"]:
            from app.core.errors import AIUpstreamError

            raise AIUpstreamError("simulated Groq failure")
        return fake_message, {"purpose": purpose, "channel": channel.value}

    monkeypatch.setattr(er.repo, "list_automation_eligible_candidates", _list_eligible)
    monkeypatch.setattr(er.repo, "count_candidates", _count_candidates)
    monkeypatch.setattr(er.repo, "has_open_automation_task", _has_open_task)
    monkeypatch.setattr(er.repo, "recent_automation_event_exists", _recent_event)
    monkeypatch.setattr(er.repo, "insert_task", _insert_task)
    monkeypatch.setattr(er.repo, "insert_ai_recommendation", _insert_reco)
    monkeypatch.setattr(er.repo, "insert_engagement_event", _insert_event)
    monkeypatch.setattr(er.ai_service, "draft_message", _draft_message)
    return store
