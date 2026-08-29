"""AI Insights aggregation (read-only).

    GET route -> build_insights() -> repositories (already-persisted rows)

Composes the current risk assessment, the current interaction-summary and
next-action recommendations, override state, and a short recommendation history
into one payload for the AI Insights UI. It never calls Groq and never writes:
every value here was produced and persisted by the existing AI endpoints.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from app.core.logging import logger
from app.db import repositories as repo
from app.schemas.ai import (
    AiInsightItem,
    CandidateAiInsights,
    InteractionSummary,
    NextBestAction,
    RiskInsight,
)

_OVERRIDE_STATUSES = {"overridden", "dismissed"}


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value if isinstance(value, str) else str(value)


def _risk_insight(row: dict | None) -> RiskInsight | None:
    if not row:
        return None
    try:
        return RiskInsight(
            level=row["level"],
            score=int(row.get("score") or 0),
            factors=list(row.get("factors") or []),
            summary=row.get("summary"),
            source=row.get("source") or "ai",
            is_current=bool(row.get("is_current", True)),
            overridden=(row.get("source") in ("manual", "rule")),
            created_at=_iso(row.get("created_at")),
        )
    except Exception:  # noqa: BLE001 - a malformed legacy row must not 500 the page
        logger.warning("Skipped a malformed risk_assessments row in insights")
        return None


def _current(recs: list[dict], kind: str) -> dict | None:
    for r in recs:
        if r.get("kind") == kind and r.get("is_current"):
            return r
    return None


def _summary_model(row: dict | None) -> InteractionSummary | None:
    if not row:
        return None
    try:
        return InteractionSummary.model_validate(row.get("payload") or {})
    except Exception:  # noqa: BLE001
        return None


def _next_action_model(row: dict | None) -> NextBestAction | None:
    if not row:
        return None
    try:
        return NextBestAction.model_validate(row.get("payload") or {})
    except Exception:  # noqa: BLE001
        return None


def build_insights(db: Client, candidate: dict) -> CandidateAiInsights:
    cid = candidate["id"]

    risk_row = repo.get_current_risk_assessment(db, cid)
    recs = repo.list_ai_recommendations(db, cid)  # newest first

    summary_row = _current(recs, "interaction_summary")
    action_row = _current(recs, "next_action")

    def _overridden(row: dict | None) -> bool:
        return bool(
            row
            and (
                row.get("status") in _OVERRIDE_STATUSES
                or (row.get("hr_override_text") or "").strip()
            )
        )

    risk = _risk_insight(risk_row)
    summary = _summary_model(summary_row)
    next_action = _next_action_model(action_row)

    history = [
        AiInsightItem(
            id=r["id"],
            kind=r["kind"],
            status=r["status"],
            is_current=bool(r.get("is_current")),
            overridden=_overridden(r),
            hr_override_text=r.get("hr_override_text"),
            model=r.get("model"),
            created_at=_iso(r["created_at"]) or "",
            resolved_at=_iso(r.get("resolved_at")),
        )
        for r in recs[:8]
    ]

    timestamps = [
        t
        for t in (
            _iso(risk_row.get("created_at")) if risk_row else None,
            _iso(recs[0]["created_at"]) if recs else None,
        )
        if t
    ]
    generated_at = max(timestamps) if timestamps else None

    return CandidateAiInsights(
        candidate_id=cid,
        candidate_slug=candidate["slug"],
        has_any=bool(risk or summary or next_action or recs),
        generated_at=generated_at,
        risk=risk,
        interaction_summary=summary,
        interaction_summary_overridden=_overridden(summary_row),
        interaction_summary_override_text=(
            (summary_row or {}).get("hr_override_text")
        ),
        next_best_action=next_action,
        next_best_action_overridden=_overridden(action_row),
        next_best_action_override_text=(action_row or {}).get("hr_override_text"),
        candidate_next_action=candidate.get("next_action"),
        candidate_next_action_source=candidate.get("next_action_source"),
        recent_recommendations=history,
    )
