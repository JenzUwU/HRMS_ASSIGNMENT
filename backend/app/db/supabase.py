"""
Supabase server-side access layer.

This is the ONLY module that imports the Supabase SDK. Routes and services
depend on app/db/repositories.py, which depends on this module. The frontend
never talks to Supabase directly and never sees these credentials.

The Supabase secret key (new API key system, ``sb_secret_...``) is used so the
backend can read every row regardless of Row Level Security. It replaces the
legacy ``service_role`` key. RLS and Supabase Auth are a later phase.
"""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings
from app.core.errors import DatabaseNotConfiguredError


@lru_cache
def get_supabase() -> Client:
    """Return a cached Supabase client, or raise if the server is not configured."""
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise DatabaseNotConfiguredError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SECRET_KEY in the backend environment."
        )
    return create_client(settings.supabase_url, settings.supabase_secret_key)


def reset_supabase_cache() -> None:
    """Clear the cached client (used by tests)."""
    get_supabase.cache_clear()
