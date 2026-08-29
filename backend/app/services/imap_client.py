"""Gmail IMAP access layer (standard library only).

The ONLY module that opens an IMAP connection. Business code
(app/services/inbound_email.py) depends on ``fetch_recent`` here.

Outbound uses smtp.gmail.com (send-only); this reads replies back from the same
mailbox over imap.gmail.com. The Google App Password (SMTP_PASSWORD /
IMAP_PASSWORD) authenticates both. It is never logged, never returned, and
never part of any raised exception.

The mailbox is opened READ-ONLY: nothing is marked, moved or deleted. De-dup is
done in the database (by inbound Message-ID), so re-polling is safe.
"""
from __future__ import annotations

import email
import email.header
import email.utils
import imaplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import Message as EmailMessageT

from app.core.config import settings
from app.core.errors import EmailNotConfiguredError, EmailUpstreamError
from app.core.logging import logger


@dataclass
class InboundEmail:
    message_id: str | None
    in_reply_to: str | None
    references: list[str]
    from_addr: str
    from_name: str
    subject: str
    body: str
    received_at: str  # ISO 8601 UTC

    @property
    def thread_ids(self) -> list[str]:
        """Every RFC Message-ID this reply threads onto (In-Reply-To first)."""
        ids: list[str] = []
        if self.in_reply_to:
            ids.append(self.in_reply_to)
        for ref in reversed(self.references):
            if ref not in ids:
                ids.append(ref)
        return ids


def is_configured() -> bool:
    return bool(settings.imap_host and settings.imap_user and settings.imap_pass)


def _plain_body(msg: EmailMessageT) -> str:
    """Best-effort plain-text body. Prefers text/plain; strips attachments."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() != "text/plain":
                continue
            if "attachment" in str(part.get("Content-Disposition", "")).lower():
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
        return ""
    payload = msg.get_payload(decode=True)
    if payload is None:
        return str(msg.get_payload())
    charset = msg.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def _parse_refs(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [tok for tok in raw.replace(",", " ").split() if tok.startswith("<")]


def _to_iso(date_hdr: str | None) -> str:
    if date_hdr:
        try:
            dt = email.utils.parsedate_to_datetime(date_hdr)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            pass
    return datetime.now(timezone.utc).isoformat()


def _parse(raw_bytes: bytes) -> InboundEmail:
    msg = email.message_from_bytes(raw_bytes)
    name, addr = email.utils.parseaddr(msg.get("From", ""))
    subject = str(email.header.make_header(email.header.decode_header(
        msg.get("Subject", "") or ""
    )))
    return InboundEmail(
        message_id=(msg.get("Message-ID") or "").strip() or None,
        in_reply_to=(msg.get("In-Reply-To") or "").strip() or None,
        references=_parse_refs(msg.get("References")),
        from_addr=addr.lower().strip(),
        from_name=name.strip() or addr.split("@")[0],
        subject=subject.strip(),
        body=_plain_body(msg).strip(),
        received_at=_to_iso(msg.get("Date")),
    )


def fetch_recent(limit: int | None = None) -> list[InboundEmail]:
    """Return the most recent inbound messages, newest last.

    Raises EmailNotConfiguredError (503) when IMAP settings are missing, or
    EmailUpstreamError (502) on any IMAP transport / auth failure. Credentials
    are never included in the raised message.
    """
    if not is_configured():
        raise EmailNotConfiguredError(
            "Inbound email (IMAP) is not configured. Set IMAP_HOST and either "
            "IMAP_USERNAME/IMAP_PASSWORD or SMTP_USERNAME/SMTP_PASSWORD."
        )

    cap = int(limit or settings.inbound_poll_max or 25)
    host = settings.imap_host or "imap.gmail.com"
    port = int(settings.imap_port or 993)
    timeout = float(settings.imap_timeout_seconds or 30.0)

    conn: imaplib.IMAP4_SSL | None = None
    try:
        conn = imaplib.IMAP4_SSL(host, port, timeout=timeout)
        conn.login(settings.imap_user, settings.imap_pass)
        conn.select(settings.imap_mailbox or "INBOX", readonly=True)
        typ, data = conn.search(None, "ALL")
        if typ != "OK":
            raise EmailUpstreamError("IMAP search failed.")
        ids = (data[0] or b"").split()
        pick = ids[-cap:]
        out: list[InboundEmail] = []
        for mid in pick:
            typ, msg_data = conn.fetch(mid, "(RFC822)")
            if typ != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                continue
            out.append(_parse(msg_data[0][1]))
        return out
    except imaplib.IMAP4.error:
        logger.warning("IMAP authentication or protocol error")
        raise EmailUpstreamError(
            "The IMAP server rejected the credentials or the request."
        ) from None
    except (OSError, TimeoutError) as exc:
        logger.warning("IMAP connection failed: %s", type(exc).__name__)
        raise EmailUpstreamError("Could not reach the IMAP server.") from None
    finally:
        if conn is not None:
            try:
                conn.logout()
            except Exception:  # noqa: BLE001
                pass


def reset_cache() -> None:
    """No cached state. Present for parity with smtp_client / resend_client."""
    return None
