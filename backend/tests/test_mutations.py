"""Write-side service tests. Repository + read-service are faked (offline)."""
from __future__ import annotations

import uuid

import pytest

from app.core.errors import NotFoundError, UpstreamError
from app.schemas.mutations import (
    AIRecommendationPatch,
    CreateMessageRequest,
    CreateNoteRequest,
    CreateTaskRequest,
    RiskAssessmentPatch,
    UpdateCandidateRequest,
    UpdateJourneyStepRequest,
)
from app.services import mutations as m


CAND = {
    "id": str(uuid.uuid4()),
    "slug": "test-cand",
    "full_name": "Test Cand",
    "current_stage": "documentation",
    "recruiter_id": str(uuid.uuid4()),
}


@pytest.fixture
def fake(monkeypatch):
    store = {
        "notes": [],
        "events": [],
        "tasks": [],
        "messages": [],
        "steps": {},
        "candidate_updates": [],
        "ai_recs": {},
        "risk": {},
        "risk_inserts": [],
        "current_risk": None,
    }

    def insert_note(db, *, candidate_id, body, is_pinned=False, author_recruiter_id=None):
        row = {
            "id": str(uuid.uuid4()),
            "candidate_id": candidate_id,
            "body": body,
            "is_pinned": is_pinned,
            "author_recruiter_id": None,
            "author_name": None,
            "author_initials": None,
            "created_at": "2026-08-29T00:00:00Z",
            "updated_at": "2026-08-29T00:00:00Z",
        }
        store["notes"].append(row)
        return row

    def insert_engagement_event(db, **kw):
        store["events"].append(kw)
        return {"id": str(uuid.uuid4()), **kw}

    def insert_task(db, **kw):
        row = {
            "id": str(uuid.uuid4()),
            "status": "open",
            "completed_at": None,
            "created_at": "2026-08-29T00:00:00Z",
            "updated_at": "2026-08-29T00:00:00Z",
            "assigned_recruiter_id": kw.get("assigned_recruiter_id"),
            **kw,
        }
        store["tasks"].append(row)
        return row

    def update_candidate(db, candidate_id, fields):
        store["candidate_updates"].append(fields)
        return {**CAND, **fields}

    def get_journey_step(db, candidate_id, stage):
        return store["steps"].get(stage)

    def upsert_journey_step(db, *, candidate_id, stage, position, status, started_at, completed_at):
        row = {
            "id": str(uuid.uuid4()),
            "stage": stage,
            "position": position,
            "status": status,
            "started_at": started_at,
            "completed_at": completed_at,
        }
        store["steps"][stage] = row
        return row

    def get_or_create_conversation(db, *, candidate_id, channel, subject):
        return {"id": str(uuid.uuid4()), "channel": channel}

    def insert_message(db, **kw):
        row = {
            "id": str(uuid.uuid4()),
            "conversation_id": kw["conversation_id"],
            "candidate_id": kw["candidate_id"],
            "direction": "outbound",
            "channel": kw["channel"],
            "actor": "recruiter",
            "sender_name": kw.get("sender_name", "HR"),
            "subject": kw.get("subject"),
            "body": kw["body"],
            "status": "sent",
            "is_ai_generated": kw["is_ai_generated"],
            "is_internal_note": kw["is_internal_note"],
            "sent_at": kw["sent_at"],
            "created_at": kw["sent_at"],
        }
        store["messages"].append(row)
        return row

    def touch_conversation(db, cid, *, preview, at):
        pass

    def get_ai_recommendation(db, rid):
        return store["ai_recs"].get(str(rid))

    def update_ai_recommendation(db, rid, *, status, hr_override_text, resolved_at):
        row = store["ai_recs"][str(rid)]
        row = {**row, "status": status, "resolved_at": resolved_at}
        if hr_override_text is not None:
            row["hr_override_text"] = hr_override_text
        store["ai_recs"][str(rid)] = row
        return row

    def get_risk_assessment(db, aid):
        return store["risk"].get(str(aid))

    def get_current_risk_assessment(db, candidate_id):
        return store["current_risk"]

    def insert_risk_assessment(db, *, candidate_id, level, score, factors, summary, model, source="ai"):
        row = {
            "id": str(uuid.uuid4()),
            "candidate_id": candidate_id,
            "level": level,
            "score": score,
            "factors": factors,
            "summary": summary,
            "source": source,
            "model": model,
            "is_current": True,
            "created_at": "2026-08-29T00:00:00Z",
        }
        store["risk_inserts"].append(row)
        return row

    for name, fn in {
        "insert_note": insert_note,
        "insert_engagement_event": insert_engagement_event,
        "insert_task": insert_task,
        "update_candidate": update_candidate,
        "get_journey_step": get_journey_step,
        "upsert_journey_step": upsert_journey_step,
        "get_or_create_conversation": get_or_create_conversation,
        "insert_message": insert_message,
        "touch_conversation": touch_conversation,
        "get_ai_recommendation": get_ai_recommendation,
        "update_ai_recommendation": update_ai_recommendation,
        "get_risk_assessment": get_risk_assessment,
        "get_current_risk_assessment": get_current_risk_assessment,
        "insert_risk_assessment": insert_risk_assessment,
        "resolve_candidate": lambda db, ref: CAND,
    }.items():
        monkeypatch.setattr(m.repo, name, fn)

    monkeypatch.setattr(
        m.read_service, "build_candidate_detail", lambda db, row: row
    )
    monkeypatch.setattr(
        m.read_service,
        "build_engagement_journey",
        lambda db, row: {"steps": list(store["steps"].values())},
    )
    return store


# --- notes / tasks -----------------------------------------------------

def test_create_note_persists_and_logs_event(fake):
    out = m.create_note(None, CAND, CreateNoteRequest(body="watch relocation"))
    assert out.body == "watch relocation"
    assert len(fake["notes"]) == 1
    assert fake["events"][0]["event_type"] == "note_added"


def test_create_task(fake):
    out = m.create_task(
        None, CAND, CreateTaskRequest(title="Send reminder", priority="high")
    )
    assert out.title == "Send reminder"
    assert fake["tasks"][0]["source"] == "manual"


# --- candidate status ------------------------------------------------

def test_update_candidate_joined_sets_stage_and_event(fake):
    m.update_candidate(None, CAND, UpdateCandidateRequest(status="joined"))
    assert {"status": "joined", "current_stage": "joined"} in fake["candidate_updates"]
    assert fake["events"][0]["event_type"] == "joined"


def test_update_candidate_preferred_channel(fake):
    m.update_candidate(
        None, CAND, UpdateCandidateRequest(preferred_channel="whatsapp")
    )
    assert {"last_interaction_channel": "whatsapp"} in fake["candidate_updates"]


# --- journey ---------------------------------------------------------

def test_journey_step_invalid_stage(fake):
    with pytest.raises(NotFoundError):
        m.update_journey_step(
            None, CAND, "not_a_stage", UpdateJourneyStepRequest(status="completed")
        )


def test_journey_step_completed_sets_timestamp(fake):
    m.update_journey_step(
        None, CAND, "documentation", UpdateJourneyStepRequest(status="completed")
    )
    step = fake["steps"]["documentation"]
    assert step["status"] == "completed"
    assert step["completed_at"] is not None


# --- messages ------------------------------------------------------

def test_create_message_marks_interaction(fake):
    m.create_message(
        None, CAND, CreateMessageRequest(channel="email", body="hi there")
    )
    assert any("last_interaction_at" in u for u in fake["candidate_updates"])


def test_internal_note_message_does_not_mark_interaction(fake):
    m.create_message(
        None,
        CAND,
        CreateMessageRequest(channel="email", body="internal", is_internal_note=True),
    )
    assert not any("last_interaction_at" in u for u in fake["candidate_updates"])
    assert fake["events"][0]["event_type"] == "note_added"


# --- AI recommendation override ----------------------------------

def _seed_rec(store, status="suggested"):
    rid = str(uuid.uuid4())
    store["ai_recs"][rid] = {
        "id": rid,
        "candidate_id": CAND["id"],
        "kind": "message_draft",
        "status": status,
        "model": "openai/gpt-oss-20b",
        "payload": {"body": "original AI text"},
        "prompt_context": None,
        "hr_override_text": None,
        "is_current": True,
        "resolved_at": None,
        "created_at": "2026-08-29T00:00:00Z",
    }
    return rid


def test_override_recommendation_not_found(fake):
    with pytest.raises(NotFoundError):
        m.override_ai_recommendation(
            None, str(uuid.uuid4()), AIRecommendationPatch(action="accept")
        )


def test_override_recommendation_requires_text(fake):
    rid = _seed_rec(fake)
    with pytest.raises(UpstreamError):
        m.override_ai_recommendation(
            None, rid, AIRecommendationPatch(action="override", override_text="  ")
        )


def test_override_recommendation_preserves_payload(fake):
    rid = _seed_rec(fake)
    out = m.override_ai_recommendation(
        None, rid, AIRecommendationPatch(action="override", override_text="use warmer tone")
    )
    assert out.status == "overridden"
    assert out.hr_override_text == "use warmer tone"
    # original AI payload untouched
    assert fake["ai_recs"][rid]["payload"] == {"body": "original AI text"}


def test_accept_recommendation(fake):
    rid = _seed_rec(fake)
    out = m.override_ai_recommendation(
        None, rid, AIRecommendationPatch(action="accept")
    )
    assert out.status == "accepted"


# --- risk override ---------------------------------------------

def test_risk_override_not_found(fake):
    with pytest.raises(NotFoundError):
        m.override_risk(
            None, str(uuid.uuid4()), RiskAssessmentPatch(level="low", reason="ok")
        )


def test_risk_override_preserves_original_ai(fake):
    aid = str(uuid.uuid4())
    ai_row = {
        "id": aid,
        "candidate_id": CAND["id"],
        "level": "high",
        "score": 80,
        "factors": ["quiet"],
        "summary": "AI summary",
        "source": "ai",
        "model": "openai/gpt-oss-20b",
        "is_current": True,
        "created_at": "2026-08-29T00:00:00Z",
    }
    fake["risk"][aid] = ai_row
    fake["current_risk"] = ai_row

    res = m.override_risk(
        None, aid, RiskAssessmentPatch(level="medium", reason="spoke to candidate, on track")
    )
    assert res.result.source == "manual"
    assert res.result.level == "medium"
    assert res.previous_ai_assessment is not None
    assert res.previous_ai_assessment.source == "ai"
    assert len(fake["risk_inserts"]) == 1
