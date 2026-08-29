"""Gmail SMTP access layer (standard library only).

This is the ONLY module that opens an SMTP connection. Business code
(app/services/email.py) depends on ``send_email`` here, never on smtplib
directly. It mirrors the shape of ``resend_client.send_email`` so the email
service can sit on either transport unchanged.

Security:
  * SMTP_PASSWORD is a Google App Password supplied through the environment
    only (backend/.env, gitignored). It is never logged, never returned, and
    never included in an exception that leaves this module.
  * Message subject / body are not logged.
  * Only a generated RFC Message-ID is passed back to callers.
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from app.core.config import settings
from app.core.errors import EmailNotConfiguredError, EmailUpstreamError
from app.core.logging import logger

_MSGID_DOMAIN = "epitaxy-hrms"


def is_configured() -> bool:
    """True when host, username and password are all present."""
    return bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


def _sender_address() -> str:
    return (settings.email_from or settings.smtp_username or "").strip()


def _from_header() -> str:
    addr = _sender_address()
    name = (settings.email_from_name or "").strip()
    return formataddr((name, addr)) if name else addr


def reset_cache() -> None:
    """No cached state. Present for parity with resend_client (tests call it)."""
    return None


def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    *,
    idempotency_key: str | None = None,  # accepted for signature parity; unused
) -> dict[str, str]:
    """Send one plain-text email through Gmail SMTP over STARTTLS.

    Returns ``{"message_id": "<rfc-message-id>"}``.

    Raises:
      EmailNotConfiguredError (503) when SMTP settings are missing.
      EmailUpstreamError (502) on auth failure, connection failure, or a
      server-side rejection. Credentials never appear in the message.
    """
    if not is_configured():
        raise EmailNotConfiguredError(
            "SMTP email is not configured. Set SMTP_HOST, SMTP_USERNAME and "
            "SMTP_PASSWORD in the backend environment."
        )

    from_addr = _sender_address()
    message_id = make_msgid(domain=_MSGID_DOMAIN)

    msg = EmailMessage()
    msg["From"] = _from_header()
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = message_id
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    host = settings.smtp_host or "smtp.gmail.com"
    port = int(settings.smtp_port or 587)
    timeout = float(settings.smtp_timeout_seconds or 30.0)

    try:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg, from_addr=from_addr, to_addrs=[to])
    except smtplib.SMTPAuthenticationError:
        # Do not log the exception body: it can echo the AUTH command.
        logger.warning("SMTP authentication failed")
        raise EmailUpstreamError(
            "The email server rejected the SMTP credentials."
        ) from None
    except smtplib.SMTPRecipientsRefused:
        logger.warning("SMTP recipient refused")
        raise EmailUpstreamError(
            "The email server refused the recipient address."
        ) from None
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("SMTP send failed: %s", type(exc).__name__)
        raise EmailUpstreamError(
            "Could not reach the email server or the message was rejected."
        ) from None

    return {"message_id": message_id}
