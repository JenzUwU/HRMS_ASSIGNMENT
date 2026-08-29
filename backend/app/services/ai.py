"""AI engagement service (Groq-backed).

Pipeline for every function:

    build candidate context   (app/services/ai_context.py, no secrets/PII-lite)
      -> system prompt         (app/services/ai_prompts.py, guardrailed)
      -> Groq JSON completion  (app/services/groq_client.py, retry on transport)
      -> Pydantic validation   (app/schemas/ai.py, retry once on invalid shape)
      -> business validation   (score/level consistency etc.)
      -> return (model, prompt_context)

Routes persist the result to ai_recommendations / risk_assessments. Raw Groq
responses never leave this module.
"""
from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError
from supabase import Client

from app.core.errors import AIInvalidOutputError
from app.core.logging import logger
from app.schemas.ai import (
    AIChannel,
    InteractionSummary,
    NextBestAction,
    PersonalizedMessage,
    RiskClassification,
    RiskLevel,
)
from app.services import ai_context, ai_prompts
from app.services.groq_client import structured_completion

TModel = TypeVar("TModel", bound=BaseModel)

# Re-exported so callers can `except AINotConfiguredError` without importing the
# client module.
from app.core.errors import AINotConfiguredError  # noqa: E402,F401


def _generate(
    system_prompt: str,
    context: dict[str, Any],
    model_cls: type[TModel],
) -> TModel:
    """Groq -> parse -> Pydantic. One reprompt if the first reply is invalid."""
    raw = structured_completion(system_prompt, context)
    try:
        return model_cls.model_validate(raw)
    except ValidationError as first:
        logger.info(
            "AI output failed validation for %s, reprompting once", model_cls.__name__
        )
        corrective = (
            system_prompt
            + "\n\nYour previous reply did not match the schema. Errors:\n"
            + first.errors().__repr__()[:800]
            + "\nReturn ONLY a corrected JSON object."
        )
        raw2 = structured_completion(corrective, context)
        try:
            return model_cls.model_validate(raw2)
        except ValidationError as second:
            logger.warning(
                "AI output invalid after retry for %s: %s",
                model_cls.__name__,
                second.error_count(),
            )
            raise AIInvalidOutputError(
                f"AI produced output that did not match {model_cls.__name__}."
            ) from second


# ---------------------------------------------------------------------------
# public service functions
# ---------------------------------------------------------------------------

def draft_message(
    db: Client, candidate: dict, *, channel: AIChannel, purpose: str | None = None
) -> tuple[PersonalizedMessage, dict[str, Any]]:
    ctx = ai_context.build_candidate_context(db, candidate)
    ctx["request"] = {"channel": channel.value, "purpose": purpose}
    schema = PersonalizedMessage.model_json_schema()
    result = _generate(ai_prompts.message_prompt(schema), ctx, PersonalizedMessage)

    # Business rule: keep the returned channel aligned with what HR asked for,
    # and only email carries a subject.
    result.channel = channel
    if channel != AIChannel.email:
        result.subject = None
    return result, ctx


def summarize_interactions(
    db: Client, candidate: dict
) -> tuple[InteractionSummary, dict[str, Any]]:
    ctx = ai_context.build_candidate_context(db, candidate)
    schema = InteractionSummary.model_json_schema()
    result = _generate(ai_prompts.summary_prompt(schema), ctx, InteractionSummary)
    return result, ctx


def recommend_next_action(
    db: Client, candidate: dict
) -> tuple[NextBestAction, dict[str, Any]]:
    ctx = ai_context.build_candidate_context(db, candidate)
    schema = NextBestAction.model_json_schema()
    result = _generate(ai_prompts.next_action_prompt(schema), ctx, NextBestAction)
    return result, ctx


def _level_for_score(score: int) -> RiskLevel:
    if score >= 70:
        return RiskLevel.high
    if score >= 40:
        return RiskLevel.medium
    return RiskLevel.low


def classify_risk(
    db: Client, candidate: dict
) -> tuple[RiskClassification, dict[str, Any], list[str]]:
    """Returns (result, prompt_context, corrections)."""
    ctx = ai_context.build_candidate_context(db, candidate)
    schema = RiskClassification.model_json_schema()
    result = _generate(ai_prompts.risk_prompt(schema), ctx, RiskClassification)

    corrections: list[str] = []
    # Business rule: score is authoritative; snap level to its band if the model
    # disagreed with itself. Never let an inconsistent classification persist.
    expected = _level_for_score(result.score)
    if result.level != expected:
        corrections.append(
            f"level '{result.level.value}' did not match score {result.score};"
            f" set to '{expected.value}'"
        )
        result.level = expected

    # Guard against an over-confident High on thin evidence.
    counts = ctx.get("interaction_counts", {})
    thin = (counts.get("messages_on_record", 0) == 0) and (
        counts.get("events_on_record", 0) <= 1
    )
    if result.level == RiskLevel.high and thin:
        corrections.append(
            "downgraded High to Medium: not enough interaction history to support High"
        )
        result.level = RiskLevel.medium
        result.score = min(result.score, 60)

    return result, ctx, corrections
