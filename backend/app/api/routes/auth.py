"""Authentication routes.

    POST /api/v1/auth/signup   create an HR account (unauthenticated)
    GET  /api/v1/auth/me       the verified caller's identity + HR role

Login is performed by the browser directly against Supabase Auth
(supabase-js signInWithPassword). The backend never receives the password on
login and never issues its own tokens.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.schemas.auth import AuthUser, SignupRequest, SignupResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(db: DB, body: SignupRequest) -> SignupResponse:
    """Create the Supabase Auth user (role=HR, set server-side) and provision a
    recruiter profile. The client then signs in with Supabase directly."""
    return auth_service.signup(
        db,
        full_name=body.full_name,
        email=body.email,
        password=body.password,
    )


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUser) -> AuthUser:
    return user
