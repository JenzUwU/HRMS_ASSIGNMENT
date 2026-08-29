"""Authentication request/response schemas.

Login itself is done by the browser against Supabase Auth directly
(supabase-js signInWithPassword); the backend never sees the password on login.
Sign-up is routed through the backend so the HR role and the recruiter profile
are provisioned server-side with the Supabase secret key.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class AuthUser(BaseModel):
    """The verified identity attached to every protected request."""

    model_config = ConfigDict(extra="ignore")

    id: str                       # Supabase auth.users id
    email: EmailStr
    full_name: str | None = None
    role: str = "HR"              # from app_metadata, set server-side only
    recruiter_id: UUID | None = None  # matched to recruiters.email


class SignupResponse(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str | None = None
    role: str = "HR"
    recruiter_id: UUID | None = None
