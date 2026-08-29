"""Resend SDK access layer.

This is the ONLY module that imports the Resend SDK. Business code depends on
``send_email`` / ``verify_webhook`` here, never on the SDK directly.

Security:
  * RESEND_API_KEY comes from settings (env only). It is never logged, never
    returned, and never included in an error message or exception that leaves
    this module.
  * Only the provider message id is passed back to callers.
"""
from __future__ import annotations

import html as _html
from functools import lru_cache
from typing import Any

from app.core.config import settings
from app.core.errors import EmailNotConfiguredError, EmailUpstreamError, WebhookSignatureError
from app.core.logging import logger


@lru_cache
def _configure() -> Any:
    """Configure the Resend SDK once, or raise if the key is missing."""
    if not settings.resend_api_key or not settings.resend_from_email:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL "
            "in the backend environment."
        )
    import resend

    resend.api_key = settings.resend_api_key
    try:
        # synchronous client with the configured timeout
        resend.default_http_client = resend.RequestsClient(
            timeout=int(settings.resend_timeout_seconds)
        )
    except Exception:  # noqa: BLE001 - fall back to the SDK default client
        pass
    return resend


def reset_cache() -> None:
    """Clear the cached SDK config (used by tests)."""
    _configure.cache_clear()


def is_configured() -> bool:
    return bool(settings.resend_api_key and settings.resend_from_email)


def _from_header() -> str:
    name = (settings.resend_from_name or "").strip()
    return f"{name} <{settings.resend_from_email}>" if name else str(settings.resend_from_email)


def _text_to_html(text: str) -> str:
    """Minimal, safe HTML from plain text - escaped, newlines -> <br>."""
    return "<div>" + _html.escape(text).replace("\n", "<br>") + "</div>"


def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    *,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Send one plain-text email (with a generated HTML part) through Resend.

    Returns ``{"message_id": "<id>"}``.
    Raises EmailNotConfiguredError (503) or EmailUpstreamError (502). The API key
    is never part of any raised message.
    """
    resend = _configure()

    params: dict[str, Any] = {
        "from": _from_header(),
        "to": [to],
        "subject": subject,
        "text": body,
        "html": _text_to_html(body),
    }
    if reply_to:
        params["reply_to"] = reply_to

    options = {"idempotency_key": idempotency_key} if idempotency_key else None

    try:
        result = resend.Emails.send(params, options) if options else resend.Emails.send(params)
    except Exception as exc:  # noqa: BLE001
        # Never surface the SDK exception text verbatim - it can echo request
        # headers, including Authorization. Log the type only.
        logger.warning("Resend send failed: %s", type(exc).__name__)
        detail = _safe_detail(exc)
        raise EmailUpstreamError(
            f"The email provider rejected the request or was unreachable{detail}."
        ) from None

    message_id = (
        result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
    )
    if not message_id:
        raise EmailUpstreamError("The email provider did not return a message id.")
    return {"message_id": message_id}


_SAFE_HINTS = (
    "not verified",
    "domain",
    "invalid `to`",
    "invalid to",
    "rate limit",
    "testing emails",
)


def _safe_detail(exc: Exception) -> str:
    """A short, credential-free hint from a provider error, if one is obviously safe."""
    msg = str(exc).lower()
    for hint in _SAFE_HINTS:
        if hint in msg:
            # Return the provider's own sentence but strip anything that looks
            # like a key/token.
            clean = " ".join(
                w for w in str(exc).split() if not w.startswith(("re_", "Bearer", "sk_"))
            )
            return f" ({clean.strip().rstrip('.')})"
    return ""


# ---------------------------------------------------------------------------
# webhook signature verification (delivery-status events)
# ---------------------------------------------------------------------------

def verify_webhook(payload: bytes, headers: dict[str, str]) -> dict[str, Any]:
    """Verify a Resend (Svix) webhook and return the parsed JSON body.

    Raises WebhookSignatureError (401) when the secret is unset or the signature
    is invalid - an unverified delivery webhook is never trusted.
    """
    secret = settings.resend_webhook_secret
    if not secret:
        raise WebhookSignatureError(
            "Webhook rejected: RESEND_WEBHOOK_SECRET is not configured."
        )

    from svix.webhooks import Webhook, WebhookVerificationError

    hdr = {k.lower(): v for k, v in headers.items()}
    try:
        return Webhook(secret).verify(payload, hdr)
    except WebhookVerificationError as exc:
        logger.warning("Rejected webhook: signature verification failed")
        raise WebhookSignatureError("Invalid webhook signature.") from exc
