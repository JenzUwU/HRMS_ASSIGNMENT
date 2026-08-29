"""Domain constants shared across the backend."""
from __future__ import annotations

# The engagement journey, in order. Stage keys match the engagement_stage enum
# in supabase/migrations/001_initial_schema.sql.
JOURNEY_STAGES: list[tuple[str, str]] = [
    ("offer_accepted", "Offer Accepted"),
    ("welcome_sent", "Welcome Sent"),
    ("documentation", "Documentation"),
    ("manager_intro", "Manager Introduction"),
    ("pre_joining", "Pre-Joining Check-in"),
    ("joined", "Joined"),
]

STAGE_LABEL: dict[str, str] = dict(JOURNEY_STAGES)
