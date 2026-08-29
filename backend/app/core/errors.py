"""
Application error types and FastAPI exception handlers.

Routes and repositories raise these; main.py registers the handlers so every
error path returns a consistent JSON body:

    {"detail": "<message>", "code": "<machine_code>"}
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.logging import logger


class AppError(Exception):
    """Base class for expected application errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.__doc__ or "Internal error"
        super().__init__(self.detail)


class NotFoundError(AppError):
    """Requested resource was not found."""

    status_code = 404
    code = "not_found"

    def __init__(self, resource: str, identifier: object):
        super().__init__(f"{resource} '{identifier}' was not found")


class ConflictError(AppError):
    """The request conflicts with the current state of a resource."""

    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    """The request was well-formed but semantically invalid."""

    status_code = 422
    code = "validation_error"


class DatabaseNotConfiguredError(AppError):
    """Supabase is not configured on the server."""

    status_code = 503
    code = "database_not_configured"


class UpstreamError(AppError):
    """The database request failed."""

    status_code = 502
    code = "upstream_error"


class AINotConfiguredError(AppError):
    """The AI provider (Groq) is not configured on the server."""

    status_code = 503
    code = "ai_not_configured"


class AIUpstreamError(AppError):
    """The AI provider request failed or timed out."""

    status_code = 502
    code = "ai_upstream_error"


class AIInvalidOutputError(AppError):
    """The AI provider returned output that failed parsing or validation."""

    status_code = 502
    code = "ai_invalid_output"


class EmailNotConfiguredError(AppError):
    """The email transport (Gmail SMTP) is not configured on the server."""

    status_code = 503
    code = "email_not_configured"


class EmailUpstreamError(AppError):
    """The email server rejected the request or was unreachable."""

    status_code = 502
    code = "email_upstream_error"


class WebhookSignatureError(AppError):
    """The webhook signature could not be verified."""

    status_code = 401
    code = "webhook_signature_invalid"


class WhatsAppNotEnabledError(AppError):
    """WhatsApp messaging is disabled on this server (WHATSAPP_ENABLED=false)."""

    status_code = 503
    code = "whatsapp_not_enabled"


class WhatsAppNotConfiguredError(AppError):
    """WhatsApp is enabled but no provider adapter / credentials are configured."""

    status_code = 503
    code = "whatsapp_not_configured"


class WhatsAppUpstreamError(AppError):
    """The WhatsApp provider rejected the request or was unreachable."""

    status_code = 502
    code = "whatsapp_upstream_error"


class NotAuthenticatedError(AppError):
    """No valid Supabase session was presented on a protected route."""

    status_code = 401
    code = "not_authenticated"


class AuthProviderError(AppError):
    """Supabase Auth rejected the request or was unreachable."""

    status_code = 502
    code = "auth_provider_error"


def _payload(detail: str, code: str) -> dict[str, str]:
    return {"detail": detail, "code": code}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("AppError %s: %s", exc.code, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.detail, exc.code),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_payload("An unexpected error occurred", "internal_error"),
        )
