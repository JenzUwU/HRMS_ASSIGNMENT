"""Recruiter email + in-app notifications.

    trigger (inbound reply / automation task / high risk)
        -> notify_recruiter()
        -> smtp_client.send_email (existing Gmail SMTP abstraction)
        -> engagement_events row (metadata.notification=True) = persistence for
           the in-app bell AND the dedup record

Design:
  * Reuses the existing smtp_client; no second SMTP implementation.
  * Recipient is ALWAYS the assigned recruiter's email read from the recruiters
    table. Never the candidate. Never hardcoded.
  * Dedup by notification_key: one engagement_events row per key
    (metadata.notification_key). The same event processed twice sends nothing.
  * Best-effort by contract: notify_recruiter never raises. A failure (no
    recruiter, bad email, SMTP down) is logged and returned as a status string
    so the calling candidate workflow is never broken.
  * A missing/invalid recruiter email still records the in-app notification
    (email_sent=false) so HR sees it in the bell.
  * An SMTP transport failure records NOTHING, so a later retrigger of the same
    key can retry the email.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from supabase import Client

from app.core.errors import AppError
from app.core.logging import logger
from app.db import repositories as repo
from app.services import smtp_client

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _email_body(
    candidate_name: str, headline: str, reason: str, recommended_action: str
) -> str:
    return (
        f"{headline}\n\n"
        f"Candidate: {candidate_name}\n\n"
        f"Reason:\n{reason}\n\n"
        f"Recommended action:\n{recommended_action}\n\n"
        "Open the HRMS Communication page to review and respond.\n\n"
        "Epitaxy HRMS"
    )


def notify_recruiter(
    db: Client,
    candidate: dict,
    *,
    notification_key: str,
    headline: str,
    reason: str,
    recommended_action: str,
    kind: str,
) -> str:
    """Notify the candidate's assigned recruiter about one event.

    Returns a short status string; NEVER raises. `notification_key` must be
    stable per underlying event (e.g. "inbound:<message-id>") - it is the
    dedup key.
    """
    try:
        return _notify(
            db,
            candidate,
            notification_key=notification_key,
            headline=headline,
            reason=reason,
            recommended_action=recommended_action,
            kind=kind,
        )
    except Exception as exc:  # noqa: BLE001 - notification must never break the flow
        logger.warning("recruiter notification failed: %s", type(exc).__name__)
        return "failed: unexpected error"


def _notify(
    db: Client,
    candidate: dict,
    *,
    notification_key: str,
    headline: str,
    reason: str,
    recommended_action: str,
    kind: str,
) -> str:
    # ---- dedup ---------------------------------------------------------
    if repo.find_notification_event(db, notification_key):
        return "skipped: duplicate notification"

    name = candidate.get("full_name") or "Candidate"

    # ---- resolve the assigned recruiter --------------------------------
    recruiter = None
    recruiter_id = candidate.get("recruiter_id")
    if recruiter_id:
        try:
            recruiter = repo.get_recruiter(db, recruiter_id)
        except AppError:
            recruiter = None
    recruiter_email = (recruiter or {}).get("email") or ""
    email_ok = bool(_EMAIL_RE.match(recruiter_email))

    # ---- email through the existing Gmail SMTP abstraction -------------
    email_sent = False
    if email_ok:
        try:
            smtp_client.send_email(
                to=recruiter_email,
                subject=f"Candidate needs attention: {name}",
                body=_email_body(name, headline, reason, recommended_action),
            )
            email_sent = True
        except AppError as exc:
            # Transport failure: log and record nothing, so the same key can
            # retry the email on the next trigger.
            logger.warning(
                "recruiter notification email failed for %s (%s)",
                candidate.get("slug"),
                exc.code,
            )
            return f"failed: email ({exc.code})"
    else:
        logger.warning(
            "recruiter for candidate %s has no valid email; recording "
            "in-app notification only",
            candidate.get("slug"),
        )

    # ---- persist: in-app bell record + dedup marker --------------------
    try:
        repo.insert_engagement_event(
            db,
            candidate_id=candidate["id"],
            event_type="note_added",
            stage=candidate.get("current_stage"),
            actor="system",
            channel="email" if email_sent else None,
            title=f"Recruiter notified: {headline}",
            description=f"{reason} Recommended action: {recommended_action}",
            occurred_at=_now(),
            metadata={
                "notification": True,
                "notification_key": notification_key,
                "notification_kind": kind,
                "recruiter_id": str(recruiter_id) if recruiter_id else None,
                "recruiter_name": (recruiter or {}).get("full_name"),
                "email_sent": email_sent,
                "reason": reason,
                "recommended_action": recommended_action,
            },
        )
    except AppError as exc:
        logger.warning("could not persist recruiter notification (%s)", exc.code)
        return "failed: persistence" if email_sent else f"failed: db ({exc.code})"

    return "notified: email" if email_sent else "notified: in-app only (no recruiter email)"


# ---------------------------------------------------------------------------
# trigger helpers (thin wrappers so call sites stay one-liners)
# ---------------------------------------------------------------------------

def notify_inbound_reply(db: Client, candidate: dict, *, message_key: str, subject: str) -> str:
    name = candidate.get("full_name") or "The candidate"
    return notify_recruiter(
        db,
        candidate,
        notification_key=f"inbound:{message_key}",
        headline=f"{name} has replied to your email.",
        reason="Candidate interaction requires recruiter attention."
        + (f' Reply subject: "{subject}".' if subject else ""),
        recommended_action="Review the candidate's latest response and follow up.",
        kind="inbound_reply",
    )


def notify_automation_task(db: Client, candidate: dict, *, task_id: str, detail: str) -> str:
    name = candidate.get("full_name") or "A candidate"
    return notify_recruiter(
        db,
        candidate,
        notification_key=f"automation:{task_id}",
        headline=f"A follow-up task was created for {name}.",
        reason=detail,
        recommended_action="Review the AI-drafted follow-up in Tasks, personalize it and send.",
        kind="automation_task",
    )


def notify_high_risk(db: Client, candidate: dict, *, assessment_id: str, summary: str | None) -> str:
    name = candidate.get("full_name") or "A candidate"
    return notify_recruiter(
        db,
        candidate,
        notification_key=f"risk:{assessment_id}",
        headline=f"{name} was classified as HIGH joining risk.",
        reason=summary or "The latest risk assessment classified this candidate as high risk.",
        recommended_action="Reach out to the candidate soon to prevent drop-off.",
        kind="high_risk",
    )
