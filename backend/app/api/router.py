from fastapi import APIRouter

from app.api.routes import analytics, candidates, communications, health, reference

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(candidates.router)
api_router.include_router(communications.router)
api_router.include_router(analytics.router)
api_router.include_router(reference.router)

# AI routes (Groq) are a later phase and will be registered here.
