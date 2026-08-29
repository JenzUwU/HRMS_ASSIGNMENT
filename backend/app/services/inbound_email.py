"""Inbound email (candidate reply) ingestion.

    poll route -> poll_and_ingest() -> imap_client.fetch_recent()  (Gmail IMAP)
                                    -> ingest_one() per message
                                    -> repositories (persist inbound message + event)

Candidate resolution, in order:
  1. Threading: any RFC Message-ID in In-Reply-To / References that matches an
     outbound email we sent (engagement_events.metadata.provider_message_id).
  2. Fallback: the sender address matches exactly one candidate's email.
A reply that resolves to no candidate is skipped, never guessed.

Idempotent: an inbound Message-ID already recorded is skipped, so re-polling the
mailbox never duplicates a reply. No conversation is created when an email
conversation already exists. No AI response is generated here.
"""
from __future__ import annotations

from supabase import Client

from app.core.config import settings
from app.core.errors import EmailNotConfiguredError
from app.core.logging import logger
from app.db import repositories as repo
from app.services import imap_client, recruiter_notify
from app.services.imap_client import InboundEmail

_MAX_BODY_STORE = 20000
_PREVIEW = 180


def _resolve_candidate(db: Client, mail: InboundEmail) -> tuple[dict | None, str]:
    # 1. threading
    for mid in mail.thread_ids:
        origin = repo.find_email_event_by_provider_id(db, mid)
        if origin and origin.get("candidate_id"):
            cand = repo.get_candidate_record(db, origin["candidate_id"])
            if cand:
                return cand, "threading"
    # 2. sender email
    if mail.from_addr:
        cand = repo.get_candidate_by_email(db, mail.from_addr)
        if cand:
            return cand, "sender_email"
    return None, "unresolved"


def _email_conversation(db: Client, candidate_id: str, subject: str) -> dict:
    existing = [
        c
        for c in repo.list_conversations_for_candidate(db, candidate_id)
        if c.get("channel") == "email"
    ]
    if existing:
        return existing[0]
    # No prior email thread (e.g. candidate emailed first). Open one.
    return repo.get_or_create_conversation(
        db, candidate_id=candidate_id, channel="email", subject=subject or "Email"
    )


def ingest_one(db: Client, mail: InboundEmail) -> str:
    """Persist one inbound reply. Returns a short status string."""
    if not mail.from_addr:
        return "skipped: no sender address"
    if not mail.body:
        return "skipped: empty body"

    if mail.message_id and repo.find_inbound_event_by_message_id(db, mail.message_id):
        return "skipped: already ingested"

    candidate, matched_by = _resolve_candidate(db, mail)
    if candidate is None:
        logger.info("Inbound reply from an address with no candidate match (skipped)")
        return f"skipped: no candidate for {mail.from_addr}"

    cid = candidate["id"]
    conv = _email_conversation(db, cid, mail.subject)

    row = repo.insert_inbound_email(
        db,
        conversation_id=conv["id"],
        candidate_id=cid,
        sender_name=candidate.get("full_name") or mail.from_name or "Candidate",
        subject=mail.subject or None,
        body=mail.body[:_MAX_BODY_STORE],
        received_at=mail.received_at,
    )

    try:
        repo.insert_engagement_event(
            db,
            candidate_id=cid,
            event_type="candidate_replied",
            stage=candidate.get("current_stage"),
            actor="candidate",
            channel="email",
            title=f"Candidate replied: {mail.subject}" if mail.subject else "Candidate replied by email",
            description=mail.body[:280],
            occurred_at=mail.received_at,
            metadata={
                "provider": "gmail_imap",
                "inbound_message_id": mail.message_id,
                "in_reply_to": mail.in_reply_to,
                "matched_by": matched_by,
                "message_id": row["id"],
            },
        )
    except Exception:  # noqa: BLE001
        logger.warning("Could not write the inbound reply timeline event")

    repo.touch_conversation(db, conv["id"], preview=mail.body[:_PREVIEW], at=mail.received_at)

    try:
        repo.update_candidate(
            db,
            cid,
            {
                "last_interaction_at": mail.received_at,
                "last_interaction_channel": "email",
            },
        )
    except Exception:  # noqa: BLE001
        logger.warning("Could not update last_interaction for the candidate")

    # Notify the assigned recruiter (email + in-app). Best-effort: never raises,
    # deduped by the inbound Message-ID so re-polling sends nothing.
    notify_key = mail.message_id or f"{mail.from_addr}:{mail.received_at}"
    recruiter_notify.notify_inbound_reply(
        db, candidate, message_key=notify_key, subject=mail.subject
    )

    return f"ingested: {candidate.get('slug')} (via {matched_by})"


def poll_and_ingest(db: Client) -> dict:
    """Poll the mailbox once and ingest every candidate reply found."""
    if not settings.inbound_email_enabled:
        raise EmailNotConfiguredError(
            "Inbound email polling is disabled. Set INBOUND_EMAIL_ENABLED=true."
        )

    mails = imap_client.fetch_recent(limit=settings.inbound_poll_max)
    details: list[str] = []
    ingested = 0
    for mail in mails:
        status = ingest_one(db, mail)
        details.append(status)
        if status.startswith("ingested"):
            ingested += 1

    return {
        "checked": len(mails),
        "ingested": ingested,
        "skipped": len(mails) - ingested,
        "details": details,
    }
