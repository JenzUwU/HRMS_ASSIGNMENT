"""Tests for the automated engagement rule (pre_joining_no_interaction).

Covers the 8 required cases. Offline: repo + Groq are faked (see conftest).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.services import engagement_rules as er

NOW = datetime.now(timezone.utc)
TODAY = date.today()


def make_candidate(
    *,
    slug: str = "test-cand",
    status: str = "active",
    joining_in_days: int | None = 5,
    interaction_days_ago: int | None = None,
    current_stage: str = "pre_joining",
):
    joining_date = (
        (TODAY + timedelta(days=joining_in_days)).isoformat()
        if joining_in_days is not None
        else None
    )
    last_interaction_at = (
        (NOW - timedelta(days=interaction_days_ago)).isoformat()
        if interaction_days_ago is not None
        else None
    )
    return {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "full_name": slug.replace("-", " ").title(),
        "status": status,
        "joining_date": joining_date,
        "joining_in_days": joining_in_days,
        "last_interaction_at": last_interaction_at,
        "days_since_interaction": interaction_days_ago,
        "last_interaction_channel": "email",
        "current_stage": current_stage,
        "recruiter_id": str(uuid.uuid4()),
    }


# --- eligibility predicate (CASES 1-6) ---------------------------------------

def test_case1_joining_5d_interaction_6d_ago_is_eligible():
    ok, why = er.evaluate_candidate(make_candidate(joining_in_days=5, interaction_days_ago=6))
    assert ok, why


def test_case2_joining_5d_interaction_2d_ago_not_eligible():
    ok, why = er.evaluate_candidate(make_candidate(joining_in_days=5, interaction_days_ago=2))
    assert not ok
    assert "2 day" in why


def test_case3_joining_10d_interaction_10d_ago_not_eligible():
    ok, why = er.evaluate_candidate(make_candidate(joining_in_days=10, interaction_days_ago=10))
    assert not ok
    assert "out" in why  # joining_date too far


def test_case4_already_joined_not_eligible():
    ok, why = er.evaluate_candidate(
        make_candidate(status="joined", joining_in_days=-1, interaction_days_ago=9)
    )
    assert not ok
    assert "joined" in why


def test_case5_declined_not_eligible():
    ok, why = er.evaluate_candidate(
        make_candidate(status="declined", joining_in_days=4, interaction_days_ago=20)
    )
    assert not ok
    assert "declined" in why


def test_case6_no_interaction_history_qualifies():
    # Documented decision: NULL last_interaction_at => never interacted =>
    # satisfies "no interaction in the last 5 days".
    ok, why = er.evaluate_candidate(
        make_candidate(joining_in_days=5, interaction_days_ago=None)
    )
    assert ok
    assert "no interaction on record" in why


def test_missing_joining_date_not_eligible():
    ok, why = er.evaluate_candidate(make_candidate(joining_in_days=None))
    assert not ok
    assert "no joining_date" in why


def test_past_joining_date_not_eligible():
    ok, why = er.evaluate_candidate(make_candidate(joining_in_days=-3, interaction_days_ago=9))
    assert not ok
    assert "past" in why


# --- sweep: persistence + dedup + failure isolation (CASES 7-8) -------------

def test_sweep_processes_eligible_and_persists(fake_db, repo_stub):
    repo_stub["eligible"] = [make_candidate(slug="cand-a", interaction_days_ago=6)]
    repo_stub["scanned"] = 50

    res = er.run_engagement_sweep(fake_db)

    assert res.scanned == 50
    assert res.eligible == 1
    assert res.processed == 1
    assert res.skipped == 0 and res.failed == 0
    assert len(repo_stub["tasks"]) == 1
    assert repo_stub["tasks"][0]["source"] == "automation"
    assert len(repo_stub["recommendations"]) == 1
    assert repo_stub["recommendations"][0]["kind"] == "message_draft"
    assert len(repo_stub["events"]) == 1
    ev = repo_stub["events"][0]
    assert ev["event_type"] == "reminder_sent"
    assert ev["actor"] == "system"
    assert ev["metadata"]["automation"] is True
    assert ev["metadata"]["rule"] == er.RULE_ID
    r = res.results[0]
    assert r.outcome == "processed"
    assert r.task_id and r.recommendation_id and r.event_id
    # the assigned recruiter is notified about the new follow-up task
    assert len(repo_stub["recruiter_notifications"]) == 1
    assert repo_stub["recruiter_notifications"][0]["slug"] == "cand-a"
    assert repo_stub["recruiter_notifications"][0]["task_id"] == str(r.task_id)


@pytest.mark.parametrize(
    "days,expected", [(0, "high"), (3, "high"), (4, "medium"), (None, "medium")]
)
def test_task_priority_by_joining_proximity(days, expected):
    assert er._task_priority(days) == expected


def test_case7_double_run_does_not_duplicate(fake_db, repo_stub):
    repo_stub["eligible"] = [make_candidate(slug="cand-b", interaction_days_ago=8)]

    first = er.run_engagement_sweep(fake_db)
    second = er.run_engagement_sweep(fake_db)

    assert first.processed == 1
    assert second.processed == 0
    assert second.skipped == 1
    assert len(repo_stub["tasks"]) == 1
    assert len(repo_stub["events"]) == 1
    assert len(repo_stub["recommendations"]) == 1
    assert repo_stub["ai_calls"] == ["cand-b"]  # AI not called again


def test_dry_run_writes_nothing(fake_db, repo_stub):
    repo_stub["eligible"] = [make_candidate(slug="cand-dry", interaction_days_ago=9)]

    res = er.run_engagement_sweep(fake_db, dry_run=True)

    assert res.dry_run is True
    assert res.processed == 1
    assert repo_stub["tasks"] == []
    assert repo_stub["events"] == []
    assert repo_stub["recommendations"] == []
    assert repo_stub["ai_calls"] == []


def test_case8_ai_failure_isolated_per_candidate(fake_db, repo_stub):
    repo_stub["eligible"] = [
        make_candidate(slug="cand-ok", interaction_days_ago=6),
        make_candidate(slug="cand-bad", interaction_days_ago=7),
        make_candidate(slug="cand-ok2", interaction_days_ago=8),
    ]
    repo_stub["ai_fail_slugs"] = {"cand-bad"}

    res = er.run_engagement_sweep(fake_db)

    assert res.eligible == 3
    assert res.processed == 2
    assert res.failed == 1
    by_slug = {r.slug: r for r in res.results}
    assert by_slug["cand-bad"].outcome == "failed"
    assert by_slug["cand-bad"].reason.startswith("ai:")
    assert by_slug["cand-ok"].outcome == "processed"
    assert by_slug["cand-ok2"].outcome == "processed"
    # failed candidate wrote no task / event / recommendation
    assert len(repo_stub["tasks"]) == 2
    assert len(repo_stub["events"]) == 2
    assert len(repo_stub["recommendations"]) == 2


def test_stale_view_row_rejected_by_defensive_recheck(fake_db, repo_stub):
    # View says eligible, but the row itself shows a recent interaction.
    repo_stub["eligible"] = [make_candidate(slug="cand-stale", interaction_days_ago=1)]

    res = er.run_engagement_sweep(fake_db)

    assert res.processed == 0
    assert res.skipped == 1
    assert "no longer eligible" in res.results[0].reason
    assert repo_stub["tasks"] == []
