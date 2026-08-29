"""Candidate creation (HR adds a real candidate from the UI).

Route -> here -> repositories -> Supabase. Generates the NOT-NULL derived
fields the form does not collect (slug, initials, location_city) and fills a
sensible recruiter default, then reuses the existing read-model to return a
CandidateDetail.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

from supabase import Client

from app.core.errors import ConflictError, ValidationError
from app.db import repositories as repo
from app.schemas.candidate import CandidateDetail
from app.schemas.email import CreateCandidateRequest
from app.services import candidates as read_service

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    base = _SLUG_RE.sub("-", name.lower()).strip("-")
    return base or "candidate"


def _unique_slug(db: Client, name: str) -> str:
    base = _slugify(name)
    slug = base
    n = 2
    while repo.slug_exists(db, slug):
        slug = f"{base}-{n}"
        n += 1
    return slug


def _initials(name: str) -> str:
    parts = [p for p in re.split(r"\s+", name.strip()) if p]
    if not parts:
        return "NA"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def create_candidate(
    db: Client,
    req: CreateCandidateRequest,
    *,
    owner_recruiter_id: str | None = None,
) -> CandidateDetail:
    if repo.email_in_use(db, req.email):
        raise ConflictError(f"A candidate with email {req.email} already exists.")

    # Owner precedence: explicit request field -> the authenticated HR user's
    # own recruiter profile -> the first recruiter on record. Existing
    # candidates' recruiter_id is never touched.
    recruiter_id = str(req.recruiter_id) if req.recruiter_id else None
    if recruiter_id:
        if repo.get_recruiter(db, recruiter_id) is None:
            raise ValidationError("recruiter_id does not match any recruiter.")
    elif owner_recruiter_id and repo.get_recruiter(db, owner_recruiter_id):
        recruiter_id = str(owner_recruiter_id)
    else:
        recruiters = repo.list_recruiters(db)
        if not recruiters:
            raise ValidationError(
                "No recruiter exists to assign this candidate to."
            )
        recruiter_id = recruiters[0]["id"]

    offer = req.offer_date or date.today()
    location_city = req.location.split(",")[0].strip() or req.location

    fields = {
        "slug": _unique_slug(db, req.full_name),
        "full_name": req.full_name,
        "initials": _initials(req.full_name),
        "email": req.email,
        "phone": req.phone,
        "role": req.role,
        "department": req.department,
        "employment_type": req.employment_type,
        "location": req.location,
        "location_city": location_city,
        "source": req.source,
        "recruiter_id": recruiter_id,
        "offer_date": offer.isoformat(),
        "joining_date": req.joining_date.isoformat(),
        "status": req.status,
        "current_stage": req.current_stage,
    }
    if req.preferred_channel is not None:
        fields["last_interaction_channel"] = req.preferred_channel.value

    row = repo.insert_candidate(db, fields)

    try:
        repo.insert_engagement_event(
            db,
            candidate_id=row["id"],
            event_type="offer_accepted",
            stage=req.current_stage,
            actor="hr",
            channel=None,
            title="Candidate added",
            description=f"{req.full_name} added by HR ({req.role}).",
            occurred_at=datetime.now(timezone.utc).isoformat(),
            metadata={"source": "hr_manual"},
        )
    except Exception:  # noqa: BLE001  - timeline entry is best-effort
        pass

    # Open an empty email conversation so the candidate is immediately
    # selectable in the Communication UI (before any message exists). This is
    # the same row get_or_create_conversation would create on first send, so
    # the first email stays idempotent and no fake message is written.
    try:
        repo.get_or_create_conversation(
            db,
            candidate_id=row["id"],
            channel="email",
            subject="Onboarding",
        )
    except Exception:  # noqa: BLE001  - conversation is best-effort
        pass

    return read_service.build_candidate_detail(db, row)
