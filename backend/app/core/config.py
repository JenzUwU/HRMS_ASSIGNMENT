from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "HRMS Post Offer Engagement API"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # NoDecode: accept a comma-separated string (see validator below) instead of JSON.
    backend_cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Supabase. New API key system (sb_secret_... / sb_publishable_...).
    # SUPABASE_SECRET_KEY replaces the legacy service_role key and is used by the
    # backend. SUPABASE_PUBLISHABLE_KEY replaces the legacy anon key and is not
    # used by the backend yet (reserved for a future auth phase).
    supabase_url: str | None = None
    supabase_secret_key: str | None = None
    supabase_publishable_key: str | None = None

    # Groq (unused until integration)
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
