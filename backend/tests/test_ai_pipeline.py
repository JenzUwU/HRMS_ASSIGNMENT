"""AI pipeline tests: structured-output validation, reprompt, business rules,
and provider configuration/upstream failures. No network — Groq is faked."""
from __future__ import annotations

import pytest

from app.core.errors import (
    AIInvalidOutputError,
    AINotConfiguredError,
    AIUpstreamError,
)
from app.schemas.ai import PersonalizedMessage, RiskClassification
from app.services import ai as ai_service
from app.services import groq_client


VALID_MSG = {
    "channel": "email",
    "subject": "Welcome aboard",
    "body": "Looking forward to having you join us next week.",
    "personalization_rationale": "References the upcoming start date.",
}


def _patch_completion(monkeypatch, *returns):
    calls = {"n": 0}

    def fake(system_prompt, context):
        i = min(calls["n"], len(returns) - 1)
        calls["n"] += 1
        out = returns[i]
        if isinstance(out, Exception):
            raise out
        return out

    monkeypatch.setattr(ai_service, "structured_completion", fake)
    return calls


# --- structured output validation ---------------------------------------

def test_valid_structured_output(monkeypatch):
    _patch_completion(monkeypatch, VALID_MSG)
    out = ai_service._generate("sys", {}, PersonalizedMessage)
    assert isinstance(out, PersonalizedMessage)
    assert out.channel.value == "email"


def test_extra_fields_rejected_then_invalid(monkeypatch):
    bad = {**VALID_MSG, "smuggled": "x"}
    calls = _patch_completion(monkeypatch, bad, bad)
    with pytest.raises(AIInvalidOutputError):
        ai_service._generate("sys", {}, PersonalizedMessage)
    assert calls["n"] == 2  # one reprompt


def test_reprompt_recovers(monkeypatch):
    calls = _patch_completion(monkeypatch, {"channel": "email"}, VALID_MSG)
    out = ai_service._generate("sys", {}, PersonalizedMessage)
    assert isinstance(out, PersonalizedMessage)
    assert calls["n"] == 2


def test_invalid_enum(monkeypatch):
    _patch_completion(
        monkeypatch,
        {**VALID_MSG, "channel": "carrier-pigeon"},
        {**VALID_MSG, "channel": "carrier-pigeon"},
    )
    with pytest.raises(AIInvalidOutputError):
        ai_service._generate("sys", {}, PersonalizedMessage)


def test_invalid_score_out_of_range(monkeypatch):
    bad_risk = {
        "level": "high",
        "score": 150,
        "factors": [],
        "summary": "x",
        "recommended_action": "y",
    }
    _patch_completion(monkeypatch, bad_risk, bad_risk)
    with pytest.raises(AIInvalidOutputError):
        ai_service._generate("sys", {}, RiskClassification)


# --- business validation (risk) ---------------------------------------

def _ctx(messages=5, events=5):
    return {
        "interaction_counts": {
            "messages_on_record": messages,
            "events_on_record": events,
        }
    }


def test_risk_level_snapped_to_score_band(monkeypatch):
    monkeypatch.setattr(
        ai_service.ai_context, "build_candidate_context", lambda db, c: _ctx()
    )
    _patch_completion(
        monkeypatch,
        {
            "level": "low",  # inconsistent with score 82
            "score": 82,
            "factors": ["no replies in 10 days"],
            "summary": "Candidate has gone quiet.",
            "recommended_action": "Call today.",
        },
    )
    result, _ctx_out, corrections = ai_service.classify_risk(None, {"id": "x"})
    assert result.level.value == "high"
    assert any("did not match score" in c for c in corrections)


def test_high_risk_downgraded_on_thin_evidence(monkeypatch):
    monkeypatch.setattr(
        ai_service.ai_context,
        "build_candidate_context",
        lambda db, c: _ctx(messages=0, events=1),
    )
    _patch_completion(
        monkeypatch,
        {
            "level": "high",
            "score": 88,
            "factors": ["gut feel"],
            "summary": "Seems risky.",
            "recommended_action": "Escalate.",
        },
    )
    result, _c, corrections = ai_service.classify_risk(None, {"id": "x"})
    assert result.level.value == "medium"
    assert result.score <= 60
    assert any("downgraded High" in c for c in corrections)


# --- provider configuration / upstream --------------------------------

def test_missing_api_key_raises_not_configured(monkeypatch):
    monkeypatch.setattr(groq_client.settings, "groq_api_key", None)
    groq_client.reset_groq_cache()
    with pytest.raises(AINotConfiguredError):
        groq_client.get_groq()
    groq_client.reset_groq_cache()


def test_structured_completion_retries_then_raises(monkeypatch):
    monkeypatch.setattr(groq_client.settings, "groq_max_retries", 1)

    def boom(system_prompt, payload):
        raise AIUpstreamError("down")

    monkeypatch.setattr(groq_client, "_one_call", boom)
    with pytest.raises(AIUpstreamError):
        groq_client.structured_completion("sys", {})


def test_structured_completion_retry_recovers(monkeypatch):
    monkeypatch.setattr(groq_client.settings, "groq_max_retries", 1)
    state = {"n": 0}

    def flaky(system_prompt, payload):
        state["n"] += 1
        if state["n"] == 1:
            raise AIUpstreamError("transient")
        return {"ok": True}

    monkeypatch.setattr(groq_client, "_one_call", flaky)
    assert groq_client.structured_completion("sys", {}) == {"ok": True}
