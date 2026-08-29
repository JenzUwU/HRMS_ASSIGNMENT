"""AI Insights aggregation tests. Repository is faked: no Groq call, no Supabase,
no network. Verifies the read-only builder composes persisted rows correctly."""
from __future__ import annotations

import uuid

import pytest

from app.services import ai_insights

CID = str(uuid.uuid4())
CAND = {
    "id": CID,
    "slug": "janani",
    "full_name": "Janani",
    "next_action": "Send onboarding email",
    "next_action_source": "ai",
}

SUMMARY_PAYLOAD = {
    "summary": "Accepted the offer, replied to a test email.",
    "key_concerns": [],
    "positive_signals": ["Prompt reply"],
    "unanswered_issues": ["Joining date not confirmed"],
}
NEXT_ACTION_PAYLOAD = {
    "action": "Send a personalized onboarding email.",
    "rationale": "Engaged via email; 0/6 steps done.",
    "suggested_channel": "email",
    "confidence": 0.7,
}


def _rec(kind, *, current=True, status="suggested", override=None, payload=None):
    return {
        "id": str(uuid.uuid4()),
        "candidate_id": CID,
        "kind": kind,
        "status": status,
        "is_current": current,
        "hr_override_text": override,
        "model": "openai/gpt-oss-20b",
        "payload": payload or {},
        "prompt_context": {},
        "resolved_at": None,
        "created_at": "2026-08-29T16:00:00+00:00",
    }


@pytest.fixture
def repo(monkeypatch):
    state = {"risk": None, "recs": []}
    r = ai_insights.repo
    monkeypatch.setattr(r, "get_current_risk_assessment", lambda db, cid: state["risk"])
    monkeypatch.setattr(r, "list_ai_recommendations", lambda db, cid, **k: state["recs"])
    return state


# ---------------------------------------------------------------------------
# 1. empty: no AI output at all -> has_any False, all sections None
# ---------------------------------------------------------------------------

def test_empty_state(repo):
    ins = ai_insights.build_insights(None, CAND)
    assert ins.has_any is False
    assert ins.risk is None
    assert ins.interaction_summary is None
    assert ins.next_best_action is None
    assert ins.recent_recommendations == []
    # the grounded candidate field is still exposed
    assert ins.candidate_next_action == "Send onboarding email"


# ---------------------------------------------------------------------------
# 2. full aggregate from persisted rows
# ---------------------------------------------------------------------------

def test_full_aggregate(repo):
    repo["risk"] = {
        "level": "low", "score": 10, "factors": ["offer_accepted"],
        "summary": "Low risk.", "source": "ai", "is_current": True,
        "created_at": "2026-08-29T16:02:00+00:00",
    }
    repo["recs"] = [
        _rec("next_action", payload=NEXT_ACTION_PAYLOAD),
        _rec("interaction_summary", payload=SUMMARY_PAYLOAD),
        _rec("message_draft", payload={"channel": "email", "body": "hi", "subject": "s",
                                       "personalization_rationale": None}),
    ]
    ins = ai_insights.build_insights(None, CAND)

    assert ins.has_any is True
    assert ins.risk and ins.risk.level.value == "low" and ins.risk.score == 10
    assert ins.risk.overridden is False
    assert ins.interaction_summary and ins.interaction_summary.positive_signals == ["Prompt reply"]
    assert ins.interaction_summary.unanswered_issues == ["Joining date not confirmed"]
    assert ins.next_best_action and ins.next_best_action.confidence == 0.7
    assert ins.next_best_action.suggested_channel.value == "email"
    assert len(ins.recent_recommendations) == 3
    assert ins.generated_at == "2026-08-29T16:02:00+00:00"


# ---------------------------------------------------------------------------
# 3. HR override state is surfaced, original payload untouched
# ---------------------------------------------------------------------------

def test_override_flags(repo):
    repo["recs"] = [
        _rec("next_action", status="overridden",
             override="HR: call her instead", payload=NEXT_ACTION_PAYLOAD),
        _rec("interaction_summary", status="dismissed", payload=SUMMARY_PAYLOAD),
    ]
    ins = ai_insights.build_insights(None, CAND)
    assert ins.next_best_action_overridden is True
    assert ins.next_best_action_override_text == "HR: call her instead"
    # payload still the original AI text
    assert ins.next_best_action.action == NEXT_ACTION_PAYLOAD["action"]
    assert ins.interaction_summary_overridden is True
    hist = {h.kind: h for h in ins.recent_recommendations}
    assert hist["next_action"].overridden is True
    assert hist["interaction_summary"].overridden is True


def test_manual_risk_marked_overridden(repo):
    repo["risk"] = {
        "level": "medium", "score": 40, "factors": [], "summary": "HR call.",
        "source": "manual", "is_current": True,
        "created_at": "2026-08-29T17:00:00+00:00",
    }
    ins = ai_insights.build_insights(None, CAND)
    assert ins.risk.source == "manual"
    assert ins.risk.overridden is True


# ---------------------------------------------------------------------------
# 4. malformed legacy payload does not crash the page
# ---------------------------------------------------------------------------

def test_malformed_payload_is_skipped(repo):
    repo["recs"] = [_rec("interaction_summary", payload={"totally": "wrong"})]
    ins = ai_insights.build_insights(None, CAND)
    assert ins.interaction_summary is None
    assert ins.has_any is True  # the row still exists
    assert len(ins.recent_recommendations) == 1


# ---------------------------------------------------------------------------
# 5. only non-current recommendations -> not shown as active, still in history
# ---------------------------------------------------------------------------

def test_stale_recommendation_not_active(repo):
    repo["recs"] = [_rec("next_action", current=False, payload=NEXT_ACTION_PAYLOAD)]
    ins = ai_insights.build_insights(None, CAND)
    assert ins.next_best_action is None
    assert len(ins.recent_recommendations) == 1
    assert ins.recent_recommendations[0].is_current is False
