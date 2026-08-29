"""Provider-agnostic WhatsApp communication.

STATUS: DISABLED. No provider (Meta, Twilio, ...) is connected. Every send and
every inbound webhook currently raises a clear 503 - nothing is sent, nothing
is faked, nothing is persisted.

Shape for the future
--------------------
    route  ->  send_candidate_whatsapp(db, candidate, req)   (business logic)
                 |
                 v
           send_whatsapp_message(to=..., body=...)           (dispatch)
                 |
                 v
           get_provider() -> WhatsAppProvider                (adapter boundary)
                 |
        +--------+---------+
        |                  |
  MetaWhatsAppProvider  TwilioWhatsAppProvider   (NOT implemented here)

Provider-specific code (HTTP calls, auth headers, signature verification, phone
number id, payload shapes) lives ONLY behind a WhatsAppProvider subclass. It
never leaks into candidate routes, the communication UI, repositories or the AI
services - those all talk to the abstraction.

Reuses the existing schema unchanged: `conversations.channel = 'whatsapp'` and
`messages.channel = 'whatsapp'` already exist (comm_channel enum, migration
001). No migration is required.
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.core.config import settings
from app.db import repositories as repo
from app.core.errors import (
    ValidationError,
    WhatsAppNotConfiguredError,
    WhatsAppNotEnabledError,
)
from app.core.logging import logger
from app.schemas.whatsapp import SendWhatsAppRequest, SendWhatsAppResponse

# E.164-ish: optional +, 8-15 digits. Deliberately permissive - the provider
# does the authoritative validation when one is connected.
_PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# provider adapter boundary
# ---------------------------------------------------------------------------

class WhatsAppProvider(ABC):
    """A concrete provider (Meta Cloud API, Twilio, ...) implements this.

    Nothing outside this module should import a subclass or know which provider
    is active.
    """

    name: str = "abstract"

    @abstractmethod
    def send_text(self, *, to: str, body: str) -> dict[str, Any]:
        """Send a plain-text WhatsApp message. Returns at least
        {"provider_message_id": "..."}. Raises WhatsAppUpstreamError on failure.
        Must never log or echo credentials."""
        raise NotImplementedError

    def verify_webhook(
        self, payload: bytes, headers: dict[str, str]
    ) -> dict[str, Any]:
        """Verify an inbound webhook signature and return the parsed body.
        Meta uses X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app
        secret); Twilio uses X-Twilio-Signature. Raises WebhookSignatureError."""
        raise NotImplementedError


# Future adapters register here. Left empty on purpose - connecting a provider
# is: implement the subclass, add it to this map, set WHATSAPP_PROVIDER + creds.
#
#   _PROVIDERS = {
#       "meta": MetaWhatsAppProvider,
#       "twilio": TwilioWhatsAppProvider,
#   }
_PROVIDERS: dict[str, type[WhatsAppProvider]] = {}


def get_provider() -> WhatsAppProvider:
    """Return the configured provider adapter, or raise a clear 503.

    Raises:
        WhatsAppNotEnabledError   - WHATSAPP_ENABLED is false
        WhatsAppNotConfiguredError - enabled but no adapter for WHATSAPP_PROVIDER
    """
    if not settings.whatsapp_enabled:
        raise WhatsAppNotEnabledError()

    key = (settings.whatsapp_provider or "").strip().lower()
    adapter = _PROVIDERS.get(key)
    if adapter is None:
        raise WhatsAppNotConfiguredError(
            "WhatsApp is enabled but no provider adapter is configured "
            f"(WHATSAPP_PROVIDER={key or 'unset'!r})."
        )
    return adapter()


def send_whatsapp_message(*, to: str, body: str) -> dict[str, Any]:
    """Provider-agnostic send entry point.

    While WhatsApp is disabled/unconfigured this raises (503) - it never returns
    a fake success.
    """
    provider = get_provider()  # raises 503 until a provider is connected
    logger.info("Dispatching WhatsApp message via provider=%s", provider.name)
    return provider.send_text(to=to, body=body)


# ---------------------------------------------------------------------------
# business logic (called by the route)
# ---------------------------------------------------------------------------

def _candidate_whatsapp_number(candidate: dict) -> str:
    raw = (candidate.get("phone") or "").strip()
    if not raw:
        raise ValidationError(
            "This candidate has no phone number on record for WhatsApp."
        )
    normalized = re.sub(r"[\s\-()]", "", raw)
    if not _PHONE_RE.match(normalized):
        raise ValidationError(
            "The candidate's phone number is not a valid WhatsApp number."
        )
    return normalized


def send_candidate_whatsapp(
    db: Client, candidate: dict, req: SendWhatsAppRequest
) -> SendWhatsAppResponse:
    """Send a WhatsApp message to the candidate.

    The recipient ALWAYS comes from the candidate record - never the request
    body. A message is persisted only AFTER the provider accepts the send.

    Today this always raises:
      * ValidationError (422)          - candidate has no valid phone number
      * WhatsAppNotEnabledError (503)  - WHATSAPP_ENABLED is false
      * WhatsAppNotConfiguredError (503) - enabled but no provider adapter
    """
    # 1. Validate a WhatsApp-capable number exists (independent of the feature
    #    flag, so "candidate without phone" is always a 422).
    to = _candidate_whatsapp_number(candidate)

    # 2. Feature gate. Return 503 without touching the provider.
    if not settings.whatsapp_enabled:
        raise WhatsAppNotEnabledError()

    # 3. Send. Raises until a provider adapter is connected - no fake success.
    result = send_whatsapp_message(to=to, body=req.body)
    provider_message_id = result.get("provider_message_id")

    # ---- everything below is unreachable until a provider exists ----------
    # It is the persistence path for when one does: reuse the existing
    # conversations / messages tables (channel='whatsapp'), same as email.
    conv = repo.get_or_create_conversation(
        db, candidate_id=candidate["id"], channel="whatsapp",
        subject=f"WhatsApp with {candidate['full_name']}",
    )
    row = repo.insert_message(
        db,
        conversation_id=conv["id"],
        candidate_id=candidate["id"],
        channel="whatsapp",
        body=req.body,
        subject=None,
        is_internal_note=False,
        is_ai_generated=req.ai_recommendation_id is not None,
        sent_at=_now(),
        sender_name=candidate.get("recruiter_name") or "HR",
    )
    repo.touch_conversation(db, conv["id"], preview=req.body, at=_now())
    try:
        repo.update_candidate(
            db, candidate["id"],
            {"last_interaction_at": _now(), "last_interaction_channel": "whatsapp"},
        )
    except Exception:  # noqa: BLE001
        logger.warning("Could not update last_interaction after WhatsApp send")

    return SendWhatsAppResponse(
        sent=True,
        candidate_id=candidate["id"],
        provider=(settings.whatsapp_provider or None),
        provider_message_id=provider_message_id,
        conversation_id=conv["id"],
        stored_message_id=row["id"],
    )
