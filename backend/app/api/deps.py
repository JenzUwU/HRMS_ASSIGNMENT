"""Shared FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from supabase import Client

from app.db import repositories as repo
from app.db.supabase import get_supabase
from app.schemas.auth import AuthUser
from app.services import auth as auth_service


def get_db() -> Client:
    """Provide the Supabase client. Raises DatabaseNotConfiguredError (503) if unset."""
    return get_supabase()


DB = Annotated[Client, Depends(get_db)]


def get_current_user(
    db: DB,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    """Resolve the caller from the verified Supabase bearer token.

    The identity and the HR role come from Supabase (auth.get_user), never from
    a request body or a custom header. Raises NotAuthenticatedError (401) when
    no valid session is presented. Every authenticated account is HR, so a valid
    token is the only check protected routes need.
    """
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    return auth_service.verify_token(db, token)


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


def get_candidate_or_404(candidate_id: str, db: DB) -> dict:
    """Resolve the {candidate_id} path param (UUID or slug) to a candidate row, or 404.

    The param is named candidate_id to match the REST URL. It accepts either the
    UUID primary key or the human-readable candidates.slug.
    """
    from app.core.errors import NotFoundError

    row = repo.resolve_candidate(db, candidate_id)
    if row is None:
        raise NotFoundError("Candidate", candidate_id)
    return row


CandidateRow = Annotated[dict, Depends(get_candidate_or_404)]
