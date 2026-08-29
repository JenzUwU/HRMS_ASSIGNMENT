"""Shared FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from supabase import Client

from app.db import repositories as repo
from app.db.supabase import get_supabase


def get_db() -> Client:
    """Provide the Supabase client. Raises DatabaseNotConfiguredError (503) if unset."""
    return get_supabase()


DB = Annotated[Client, Depends(get_db)]


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
