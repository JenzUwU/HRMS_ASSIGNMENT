"""Resend delivery-status webhook.

    POST /api/v1/webhooks/resend

Unauthenticated (Resend calls it directly), protected by Svix signature
verification against RESEND_WEBHOOK_SECRET. An unverified payload is rejected
(401) and never trusted.

Scope for this phase: delivery-status observability only
(email.sent / delivered / bounced / failed). Each verified event is appended to
the candidate timeline as an engagement_events row, correlated to the outbound
email by the provider message id stored in that email's own event metadata.
Inbound-email receiving (candidate replies) is deferred - see the README.
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Request

from app.api.deps import DB
from app.core.config import settings
from app.core.errors import (
    WebhookSignatureError,
    WhatsAppNotConfiguredError,
    WhatsAppNotEnabledError,
)
from app.core.logging import logger
from app.db import repositories as repo
from app.schemas.email import InboundPollResult, WebhookResult
from app.schemas.whatsapp import WhatsAppWebhookResult
from app.services import inbound_email, resend_client

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_STATUS_EVENTS = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.failed": "failed",
    "email.complained": "complained",
    "email.opened": "opened",
}


@router.post("/resend", response_model=WebhookResult)
async def resend_webhook(request: Request, db: DB) -> WebhookResult:
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    # Raises WebhookSignatureError (401) when the secret is unset or invalid.
    event = resend_client.verify_webhook(raw, headers)

    etype = event.get("type") if isinstance(event, dict) else None
    data = (event.get("data") if isinstance(event, dict) else {}) or {}
    status = _STATUS_EVENTS.get(etype or "")
    logger.info("Resend webhook: type=%s", etype)

    if not status:
        return WebhookResult(event_type=etype, recorded=False)

    provider_message_id = data.get("email_id") or data.get("id")
    recorded = _record_status(db, provider_message_id, etype, status, data)
    return WebhookResult(event_type=etype, recorded=recorded)


def _record_status(
    db: DB, provider_message_id, etype, status, data: dict
) -> bool:
    if not provider_message_id:
        return False
    origin = repo.find_email_event_by_provider_id(db, str(provider_message_id))
    if origin is None:
        logger.info("Delivery event for unknown provider id (ignored)")
        return False
    try:
        repo.insert_engagement_event(
            db,
            candidate_id=origin["candidate_id"],
            event_type="reminder_sent",
            stage=None,
            actor="system",
            channel="email",
            title=f"Email {status}",
            description=None,
            occurred_at=(data.get("created_at") or _now()),
            metadata={
                "provider": "resend",
                "provider_message_id": str(provider_message_id),
                "delivery_status": status,
                "resend_event": etype,
            },
        )
        return True
    except Exception:  # noqa: BLE001
        logger.warning("Could not record delivery status event")
        return False


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# inbound email poll (Gmail IMAP)
#
#   POST /api/v1/webhooks/inbound-email/poll
#
# Not a provider callback: this is triggered by our own scheduler / an operator,
# so it is gated by a shared secret header (INBOUND_POLL_TOKEN) rather than a
# provider signature. When a real inbound-email provider is added later, add a
# second signature-verified route that calls inbound_email.ingest_one().
# ---------------------------------------------------------------------------

@router.post("/inbound-email/poll", response_model=InboundPollResult)
async def inbound_email_poll(request: Request, db: DB) -> InboundPollResult:
    token = settings.inbound_poll_token
    supplied = request.headers.get("x-inbound-poll-token", "")
    if not token or not hmac.compare_digest(supplied, token):
        logger.warning("Rejected inbound-email poll: missing or invalid token")
        raise WebhookSignatureError("Invalid or missing inbound poll token.")
    result = inbound_email.poll_and_ingest(db)
    return InboundPollResult(**result)


# ---------------------------------------------------------------------------
# WhatsApp inbound webhook (provider-agnostic, DISABLED)
#
#   GET  /api/v1/webhooks/whatsapp   provider verification handshake (Meta)
#   POST /api/v1/webhooks/whatsapp   inbound message / status events
#
# WhatsApp has no connected provider. Both routes return 503 while
# WHATSAPP_ENABLED is false and never accept an inbound payload. When a provider
# is added, signature verification (Meta X-Hub-Signature-256 / Twilio
# X-Twilio-Signature) goes through whatsapp.get_provider().verify_webhook()
# BEFORE any payload is trusted or persisted.
# ---------------------------------------------------------------------------

def _whatsapp_gate() -> None:
    if not settings.whatsapp_enabled:
        raise WhatsAppNotEnabledError("The WhatsApp webhook is disabled.")
    raise WhatsAppNotConfiguredError(
        "WhatsApp is enabled but no provider adapter is configured; "
        "inbound webhook handling is not available yet."
    )


@router.get("/whatsapp", response_model=WhatsAppWebhookResult)
async def whatsapp_webhook_verify(request: Request) -> WhatsAppWebhookResult:
    _whatsapp_gate()
    return WhatsAppWebhookResult()  # unreachable while disabled


@router.post("/whatsapp", response_model=WhatsAppWebhookResult)
async def whatsapp_webhook(request: Request) -> WhatsAppWebhookResult:
    _whatsapp_gate()
    return WhatsAppWebhookResult()  # unreachable while disabled
