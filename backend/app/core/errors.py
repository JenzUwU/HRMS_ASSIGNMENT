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


class DatabaseNotConfiguredError(AppError):
    """Supabase is not configured on the server."""

    status_code = 503
    code = "database_not_configured"


class UpstreamError(AppError):
    """The database request failed."""

    status_code = 502
    code = "upstream_error"


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
