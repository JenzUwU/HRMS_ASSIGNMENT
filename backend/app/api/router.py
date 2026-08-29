from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.routes import (
    ai,
    analytics,
    auth,
    automation,
    candidates,
    communications,
    health,
    notifications,
    overrides,
    reference,
    webhooks,
)

api_router = APIRouter()

# Public: health check, auth (signup/login helpers), and provider webhooks
# (which carry their own Svix signature / poll-token verification).
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(webhooks.router)

# Protected: every HRMS data + action route. A verified Supabase session is
# required; since every account is HR, a valid token grants full HR access.
_hr = [Depends(get_current_user)]
api_router.include_router(candidates.router, dependencies=_hr)
api_router.include_router(communications.router, dependencies=_hr)
api_router.include_router(analytics.router, dependencies=_hr)
api_router.include_router(reference.router, dependencies=_hr)
api_router.include_router(notifications.router, dependencies=_hr)
api_router.include_router(ai.router, dependencies=_hr)
api_router.include_router(overrides.router, dependencies=_hr)
api_router.include_router(automation.router, dependencies=_hr)
