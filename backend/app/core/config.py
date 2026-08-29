from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
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

    # Groq. groq_api_key is server-side only and never sent to the browser.
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    groq_timeout_seconds: float = 30.0
    groq_max_retries: int = 1

    # Resend (transactional email). All four are server-side only; the API key
    # is never logged and never sent to the browser. Without RESEND_API_KEY the
    # email endpoints return HTTP 503 (email_not_configured).
    resend_api_key: str | None = None
    resend_from_email: str | None = None
    resend_from_name: str = "HR"
    # Svix signing secret for POST /api/v1/webhooks/resend (starts "whsec_").
    # When unset, delivery-status webhooks are rejected (401).
    resend_webhook_secret: str | None = None
    resend_timeout_seconds: float = 30.0

    # Gmail SMTP (app/services/smtp_client.py + email.py). Outbound candidate
    # email is delivered through this. All values are server-side only and are
    # never sent to the browser. SMTP_PASSWORD is a Google App Password, never a
    # real account password; it is never logged. Without SMTP_HOST /
    # SMTP_USERNAME / SMTP_PASSWORD the email endpoint returns HTTP 503
    # (email_not_configured).
    smtp_host: str | None = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    # repr=False keeps the App Password out of repr(settings) / any accidental log.
    smtp_password: str | None = Field(default=None, repr=False)
    email_from: str | None = None
    email_from_name: str = "HR"
    smtp_timeout_seconds: float = 30.0

    # Inbound email via IMAP (app/services/imap_client.py + inbound_email.py).
    # Reads candidate replies from the same Gmail mailbox outbound email is sent
    # from. IMAP must be enabled on the account; the Google App Password
    # (SMTP_PASSWORD) also authenticates IMAP, so IMAP_USERNAME / IMAP_PASSWORD
    # default to the SMTP ones when unset. Server-side only; never logged.
    # POST /api/v1/webhooks/inbound-email/poll is gated by INBOUND_POLL_TOKEN.
    # When INBOUND_EMAIL_ENABLED is true AND IMAP is configured, an in-process
    # background loop (app/services/inbound_scheduler.py) also polls every
    # INBOUND_EMAIL_POLL_INTERVAL_SECONDS. Assumes a single backend worker.
    imap_host: str | None = "imap.gmail.com"
    imap_port: int = 993
    imap_username: str | None = None
    imap_password: str | None = Field(default=None, repr=False)
    imap_mailbox: str = "INBOX"
    imap_timeout_seconds: float = 30.0
    inbound_email_enabled: bool = False
    inbound_poll_max: int = 25
    inbound_poll_token: str | None = Field(default=None, repr=False)
    inbound_email_poll_interval_seconds: int = 120

    @property
    def imap_user(self) -> str | None:
        return self.imap_username or self.smtp_username

    @property
    def imap_pass(self) -> str | None:
        return self.imap_password or self.smtp_password

    # WhatsApp (provider-agnostic; DISABLED by default - no provider is
    # connected). WHATSAPP_ENABLED gates both the send endpoint and the inbound
    # webhook; while it is false they return HTTP 503 and nothing is ever
    # persisted. A real provider (Meta Cloud API / Twilio) is plugged in later
    # by setting WHATSAPP_PROVIDER + its credentials. All values are server-side
    # only, never logged, never sent to the browser.
    whatsapp_enabled: bool = False
    whatsapp_provider: str | None = None            # "meta" | "twilio" | ...
    whatsapp_api_url: str | None = None
    whatsapp_api_key: str | None = Field(default=None, repr=False)
    whatsapp_phone_number_id: str | None = None
    whatsapp_webhook_secret: str | None = Field(default=None, repr=False)
    whatsapp_timeout_seconds: float = 30.0

    # Automated engagement sweep (services/engagement_rules.py).
    # automation_enabled turns on the in-process background loop; the sweep is
    # always available via POST /api/v1/automation/run-engagement-sweep.
    automation_enabled: bool = False
    automation_interval_minutes: int = 360
    automation_joining_window_days: int = 7
    automation_no_interaction_days: int = 5
    automation_dedup_days: int = 3
    automation_max_candidates_per_run: int = 25

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
