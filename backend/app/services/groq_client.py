"""Groq access layer.

This is the ONLY module that imports the Groq SDK. Services depend on
`structured_completion`, never on the SDK directly. The API key comes from
settings (env only) and is never logged or returned to callers.
"""
from __future__ import annotations

import json
import time
from functools import lru_cache
from typing import Any

from groq import APIStatusError, Groq, GroqError, RateLimitError

from app.core.config import settings
from app.core.errors import (
    AIInvalidOutputError,
    AINotConfiguredError,
    AIUpstreamError,
)
from app.core.logging import logger


@lru_cache
def get_groq() -> Groq:
    """Return a cached Groq client, or raise the app's configuration error."""
    if not settings.groq_api_key:
        raise AINotConfiguredError(
            "Groq is not configured. Set GROQ_API_KEY in the backend environment."
        )
    return Groq(
        api_key=settings.groq_api_key,
        timeout=settings.groq_timeout_seconds,
        max_retries=0,  # we do our own controlled retry below
    )


def reset_groq_cache() -> None:
    """Clear the cached client (used by tests)."""
    get_groq.cache_clear()


_MAX_RATE_LIMIT_WAIT = 12.0


def _retry_after_seconds(exc: RateLimitError) -> float:
    header = None
    try:
        header = exc.response.headers.get("retry-after")
    except Exception:  # noqa: BLE001
        pass
    try:
        return min(float(header), _MAX_RATE_LIMIT_WAIT) if header else 3.0
    except (TypeError, ValueError):
        return 3.0


def _one_call(system_prompt: str, user_payload: dict[str, Any]) -> dict[str, Any]:
    client = get_groq()
    content_msg = {
        "role": "user",
        "content": json.dumps(user_payload, ensure_ascii=False),
    }

    def _create():
        return client.chat.completions.create(
            model=settings.groq_model,
            temperature=0.2,
            max_tokens=1200,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                content_msg,
            ],
        )

    try:
        try:
            completion = _create()
        except RateLimitError as rl:
            wait = _retry_after_seconds(rl)
            logger.info("Groq rate limited; waiting %.1fs then retrying once", wait)
            time.sleep(wait)
            completion = _create()
    except RateLimitError as exc:
        logger.warning("Groq rate limit persisted")
        raise AIUpstreamError(
            "AI provider is rate limited. Try again shortly."
        ) from exc
    except APIStatusError as exc:
        # Provider returned an HTTP error (bad request, 5xx, model access).
        logger.warning("Groq API error: status=%s", exc.status_code)
        raise AIUpstreamError(
            f"AI provider returned an error (status {exc.status_code})."
        ) from exc
    except GroqError as exc:
        # Timeout / connection / SDK error. Never log the exception body -
        # it can echo request headers.
        logger.warning("Groq call failed: %s", type(exc).__name__)
        raise AIUpstreamError("AI provider request failed or timed out.") from exc

    content = (completion.choices[0].message.content or "").strip()
    if not content:
        raise AIInvalidOutputError("AI provider returned an empty response.")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AIInvalidOutputError("AI response was not valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise AIInvalidOutputError("AI response was not a JSON object.")
    return parsed


def structured_completion(
    system_prompt: str, user_payload: dict[str, Any]
) -> dict[str, Any]:
    """Call Groq in JSON mode and return the parsed object.

    Retries once on a transient upstream failure or an unparseable body. The
    caller is still responsible for Pydantic + business validation.
    """
    attempts = 1 + max(0, settings.groq_max_retries)
    last: Exception | None = None
    for i in range(1, attempts + 1):
        try:
            return _one_call(system_prompt, user_payload)
        except (AIUpstreamError, AIInvalidOutputError) as exc:
            last = exc
            if i < attempts:
                logger.info("Retrying Groq call (attempt %d/%d)", i + 1, attempts)
                continue
            raise
    assert last is not None  # unreachable
    raise last
