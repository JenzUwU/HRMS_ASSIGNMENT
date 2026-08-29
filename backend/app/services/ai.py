"""
AI service (Groq). NOT wired up yet.

When integrating:
  1. add `groq` to requirements.txt
  2. implement GroqClient using settings.groq_api_key and settings.groq_model
  3. expose narrow use case functions here (draft_message, summarize_risk, ...)
     so routes depend on this module, never on the Groq SDK directly.
"""
from app.core.config import settings


class AINotConfiguredError(RuntimeError):
    pass


def get_ai_client():  # noqa: ANN201
    if not settings.groq_api_key:
        raise AINotConfiguredError(
            "Groq is not configured. Set GROQ_API_KEY, then implement get_ai_client()."
        )
    raise NotImplementedError("Groq client not implemented yet.")
