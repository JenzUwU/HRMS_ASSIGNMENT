from fastapi import APIRouter

from app.api.routes import (
    ai,
    analytics,
    automation,
    candidates,
    communications,
    health,
    overrides,
    reference,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(candidates.router)
api_router.include_router(communications.router)
api_router.include_router(analytics.router)
api_router.include_router(reference.router)
api_router.include_router(ai.router)
api_router.include_router(overrides.router)
api_router.include_router(automation.router)
