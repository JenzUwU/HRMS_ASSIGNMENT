"""Outbound email business logic.

    route -> send_candidate_email() -> smtp_client.send_email (Gmail SMTP)
                                    -> repositories (persist message + event)

Rules:
  * The recipient ALWAYS comes from the candidate record - never from the
    request body. HR cannot send to an arbitrary address.
  * A message is persisted only AFTER the SMTP server accepts the send. An SMTP
    failure raises (502/503) and nothing is written - no fake "sent" message.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from supabase import Client

from app.core.errors import AppError, ValidationError
from app.core.logging import logger
from app.db import repositories as repo
from app.schemas.email import SendCandidateEmailRequest, SendCandidateEmailResponse
from app.services import smtp_client

_PROVIDER = "gmail_smtp"

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def send_candidate_email(
    db: Client, candidate: dict, req: SendCandidateEmailRequest
) -> SendCandidateEmailResponse:
    to = (candidate.get("email") or "").strip()
    if not to:
        raise ValidationError("This candidate has no email address on record.")
    if not _EMAIL_RE.match(to):
        raise ValidationError("The candidate's email address is not valid.")

    conv = repo.get_or_create_conversation(
        db,
        candidate_id=candidate["id"],
        channel="email",
        subject=req.subject,
    )

    # 1. Send through Gmail SMTP. On failure this raises EmailUpstreamError (502)
    #    or EmailNotConfiguredError (503) and NOTHING below runs - no message is
    #    persisted.
    result = smtp_client.send_email(
        to=to,
        subject=req.subject,
        body=req.body,
        reply_to=str(req.reply_to) if req.reply_to else None,
        idempotency_key=f"cand-{candidate['id']}-{uuid.uuid4()}",
    )
    provider_message_id = result["message_id"]

    # 2. Persist the message (existing `messages` columns only).
    try:
        row = repo.insert_outbound_email(
            db,
            conversation_id=conv["id"],
            candidate_id=candidate["id"],
            sender_name=candidate.get("recruiter_name") or "HR",
            sender_recruiter_id=candidate.get("recruiter_id"),
            subject=req.subject,
            body=req.body,
            is_ai_generated=req.ai_recommendation_id is not None,
            sent_at=_now(),
        )
    except AppError:
        logger.error(
            "Email sent via Resend (id=%s) but persisting the message failed",
            provider_message_id,
        )
        raise

    # 3. Companion timeline event - carries the provider message id (the
    #    messages table has no column for it).
    try:
        repo.insert_engagement_event(
            db,
            candidate_id=candidate["id"],
            event_type="reminder_sent",
            stage=candidate.get("current_stage"),
            actor="hr",
            channel="email",
            title=f"Email sent: {req.subject}",
            description=req.body[:280],
            occurred_at=_now(),
            metadata={
                "provider": _PROVIDER,
                "provider_message_id": provider_message_id,
                "message_id": row["id"],
                "ai_recommendation_id": (
                    str(req.ai_recommendation_id) if req.ai_recommendation_id else None
                ),
            },
        )
    except AppError:
        logger.warning("Could not write the email timeline event")

    repo.touch_conversation(db, conv["id"], preview=req.body, at=_now())

    # 4. An outbound email counts as an interaction (same rule as
    #    services/mutations.create_message).
    try:
        repo.update_candidate(
            db,
            candidate["id"],
            {"last_interaction_at": _now(), "last_interaction_channel": "email"},
        )
    except AppError:
        logger.warning("Could not update last_interaction for %s", candidate["slug"])

    # 5. Sending an AI draft implies HR accepted it (best-effort).
    if req.ai_recommendation_id:
        try:
            repo.update_ai_recommendation(
                db,
                str(req.ai_recommendation_id),
                status="accepted",
                hr_override_text=None,
                resolved_at=_now(),
            )
        except AppError:
            pass

    return SendCandidateEmailResponse(
        sent=True,
        message_id=provider_message_id,
        provider=_PROVIDER,
        candidate_id=candidate["id"],
        conversation_id=conv["id"],
        stored_message_id=row["id"],
    )
