"""Auth tests. Supabase Auth is faked - no network, no real users created."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.core.errors import (
    AuthProviderError,
    ConflictError,
    NotAuthenticatedError,
)
from app.main import app
from app.schemas.auth import SignupRequest
from app.services import auth as auth_service


class _User:
    def __init__(self, uid, email, app_meta=None, user_meta=None):
        self.id = uid
        self.email = email
        self.app_metadata = app_meta or {}
        self.user_metadata = user_meta or {}


class _Resp:
    def __init__(self, user):
        self.user = user


class _FakeAuth:
    """Stand-in for db.auth (SyncSupabaseAuthClient)."""

    def __init__(self):
        self.created = []
        self.valid_token = "good-token"

    class _Admin:
        def __init__(self, outer):
            self.outer = outer

        def create_user(self, attrs):
            if attrs["email"] in {c["email"] for c in self.outer.created}:
                raise Exception("A user with this email address has already been registered")
            u = _User(
                str(uuid.uuid4()),
                attrs["email"],
                app_meta=attrs.get("app_metadata"),
                user_meta=attrs.get("user_metadata"),
            )
            self.outer.created.append(attrs)
            return _Resp(u)

    @property
    def admin(self):
        return _FakeAuth._Admin(self)

    def get_user(self, jwt):
        if jwt != self.valid_token:
            raise Exception("invalid JWT")
        return _Resp(
            _User("auth-uid-1", "hr.person@epitaxy-hrms.com", app_meta={"role": "HR"},
                  user_meta={"full_name": "HR Person"})
        )


class _FakeDB:
    def __init__(self):
        self.auth = _FakeAuth()


@pytest.fixture
def fake_db(monkeypatch):
    db = _FakeDB()
    recruiters: dict[str, dict] = {}

    monkeypatch.setattr(
        auth_service.repo, "get_recruiter_by_email",
        lambda _db, e: recruiters.get(e.lower()),
    )

    def insert_recruiter(_db, fields):
        row = {"id": str(uuid.uuid4()), **fields}
        recruiters[fields["email"]] = row
        return row

    monkeypatch.setattr(auth_service.repo, "insert_recruiter", insert_recruiter)
    return db


# ---------------------------------------------------------------------------
# signup
# ---------------------------------------------------------------------------

def test_signup_sets_hr_role_and_provisions_recruiter(fake_db):
    res = auth_service.signup(
        fake_db, full_name="Jane HR", email="Jane.HR@Epitaxy-HRMS.com",
        password="hunter2hunter2",
    )
    assert res.role == "HR"
    assert res.email == "jane.hr@epitaxy-hrms.com"
    assert res.recruiter_id is not None
    # role was set server-side in app_metadata, not taken from any input
    created = fake_db.auth.created[0]
    assert created["app_metadata"] == {"role": "HR"}
    assert created["email_confirm"] is True
    assert created["user_metadata"]["full_name"] == "Jane HR"


def test_signup_duplicate_email_conflict(fake_db):
    kw = dict(full_name="Jane HR", email="dupe@epitaxy-hrms.com", password="hunter2hunter2")
    auth_service.signup(fake_db, **kw)
    with pytest.raises(ConflictError):
        auth_service.signup(fake_db, **kw)


def test_signup_request_rejects_short_password():
    with pytest.raises(Exception):
        SignupRequest(full_name="A B", email="a@b.com", password="short")


def test_signup_provider_failure_maps_to_502(fake_db, monkeypatch):
    def boom(_attrs):
        raise Exception("service unavailable")

    monkeypatch.setattr(_FakeAuth._Admin, "create_user", lambda self, a: boom(a))
    with pytest.raises(AuthProviderError):
        auth_service.signup(
            fake_db, full_name="X Y", email="x@epitaxy-hrms.com", password="hunter2hunter2"
        )


# ---------------------------------------------------------------------------
# token verification
# ---------------------------------------------------------------------------

def test_verify_token_returns_hr_identity(fake_db, monkeypatch):
    rec_id = str(uuid.uuid4())
    monkeypatch.setattr(
        auth_service.repo, "get_recruiter_by_email",
        lambda _db, e: {"id": rec_id} if e == "hr.person@epitaxy-hrms.com" else None,
    )
    user = auth_service.verify_token(fake_db, "good-token")
    assert user.role == "HR"
    assert user.email == "hr.person@epitaxy-hrms.com"
    assert str(user.recruiter_id) == rec_id
    assert user.full_name == "HR Person"


def test_verify_token_missing_raises_401(fake_db):
    with pytest.raises(NotAuthenticatedError) as ei:
        auth_service.verify_token(fake_db, "")
    assert ei.value.status_code == 401


def test_verify_token_invalid_raises_401(fake_db):
    with pytest.raises(NotAuthenticatedError):
        auth_service.verify_token(fake_db, "forged-token")


# ---------------------------------------------------------------------------
# route protection
# ---------------------------------------------------------------------------

def test_protected_route_rejects_without_token():
    # drop the autouse bypass for this test
    app.dependency_overrides.pop(deps.get_current_user, None)
    app.dependency_overrides[deps.get_db] = lambda: _FakeDB()
    try:
        c = TestClient(app)
        r = c.get("/api/v1/candidates")
        assert r.status_code == 401
        assert r.json()["code"] == "not_authenticated"

        r2 = c.get("/api/v1/candidates", headers={"Authorization": "Bearer nope"})
        assert r2.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_public_routes_stay_open():
    app.dependency_overrides.pop(deps.get_current_user, None)
    try:
        c = TestClient(app)
        assert c.get("/api/v1/health").status_code == 200
        # signup validation still runs (422) without a token -> route is public
        r = c.post("/api/v1/auth/signup", json={"full_name": "A", "email": "bad", "password": "x"})
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()
