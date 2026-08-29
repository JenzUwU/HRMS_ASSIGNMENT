"""Supabase Auth integration.

  * signup() -> creates the Supabase Auth user with app_metadata.role = "HR"
    (set with the secret key, never trusted from the client), then provisions a
    recruiter profile in the existing recruiters table.
  * verify_token() -> the ONLY way a protected route learns who the caller is.
    The bearer token is verified by Supabase (auth.get_user); the role and
    identity come from that verified user, not from any request field.

No password is ever logged. No access/refresh token is ever logged or returned.
"""
from __future__ import annotations

import re

from supabase import Client

from app.core.errors import AuthProviderError, ConflictError, NotAuthenticatedError
from app.core.logging import logger
from app.db import repositories as repo
from app.schemas.auth import AuthUser, SignupResponse

_HR_ROLE = "HR"
_DEPARTMENT = "Talent Acquisition"
_WS = re.compile(r"\s+")


def _initials(name: str) -> str:
    parts = [p for p in _WS.split(name.strip()) if p]
    if not parts:
        return "HR"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _ensure_recruiter(db: Client, email: str, full_name: str) -> str | None:
    existing = repo.get_recruiter_by_email(db, email)
    if existing:
        return existing["id"]
    try:
        row = repo.insert_recruiter(
            db,
            {
                "full_name": full_name,
                "initials": _initials(full_name),
                "email": email.lower().strip(),
                "department": _DEPARTMENT,
                "is_active": True,
            },
        )
        return row["id"]
    except Exception:  # noqa: BLE001 - profile row is best-effort, auth user still exists
        logger.warning("Could not provision a recruiter profile for the new HR user")
        return None


def signup(db: Client, *, full_name: str, email: str, password: str) -> SignupResponse:
    email = email.lower().strip()
    try:
        resp = db.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,  # assignment: no email-verification round trip
                "user_metadata": {"full_name": full_name},
                "app_metadata": {"role": _HR_ROLE},
            }
        )
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if "already" in msg and ("registered" in msg or "exist" in msg):
            raise ConflictError("An account with that email already exists.") from None
        logger.warning("Supabase signup failed: %s", type(exc).__name__)
        raise AuthProviderError("Could not create the account.") from None

    user = getattr(resp, "user", None)
    if user is None or not getattr(user, "id", None):
        raise AuthProviderError("The auth provider did not return a user.")

    recruiter_id = _ensure_recruiter(db, email, full_name)

    return SignupResponse(
        user_id=user.id,
        email=email,
        full_name=full_name,
        role=_HR_ROLE,
        recruiter_id=recruiter_id,
    )


def verify_token(db: Client, token: str) -> AuthUser:
    """Verify a Supabase access token and return the caller's identity.

    Raises NotAuthenticatedError (401) when the token is missing or invalid.
    """
    token = (token or "").strip()
    if not token:
        raise NotAuthenticatedError("Authentication required.")

    try:
        resp = db.auth.get_user(token)
    except Exception:  # noqa: BLE001 - any failure means "not a valid session"
        raise NotAuthenticatedError("Invalid or expired session.") from None

    user = getattr(resp, "user", None)
    if user is None or not getattr(user, "id", None) or not getattr(user, "email", None):
        raise NotAuthenticatedError("Invalid or expired session.")

    app_meta = getattr(user, "app_metadata", None) or {}
    user_meta = getattr(user, "user_metadata", None) or {}
    role = app_meta.get("role") or _HR_ROLE  # every account is HR

    recruiter = repo.get_recruiter_by_email(db, user.email)

    return AuthUser(
        id=user.id,
        email=user.email,
        full_name=user_meta.get("full_name"),
        role=role,
        recruiter_id=recruiter["id"] if recruiter else None,
    )
