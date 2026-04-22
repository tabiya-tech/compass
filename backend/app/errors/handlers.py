import logging
import os
from http import HTTPStatus

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.constants.errors import HTTPErrorResponse
from app.context_vars import correlation_id_ctx_var

logger = logging.getLogger(__name__)

_GENERIC_DETAIL = "Oops! Something went wrong."


def _sentry_enabled() -> bool:
    return os.getenv("BACKEND_ENABLE_SENTRY") == "True"


def _build_response(status_code: int, detail: str, sentry_event_id: str | None) -> JSONResponse:
    correlation_id = correlation_id_ctx_var.get()
    body = HTTPErrorResponse(
        detail=detail,
        correlation_id=correlation_id if correlation_id != ":none:" else None,
        sentry_event_id=sentry_event_id,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


def _maybe_capture(exc: BaseException, status_code: int) -> str | None:
    """Capture to Sentry only for server-side failures; returns the event id if captured."""
    if not _sentry_enabled():
        return None
    if status_code < HTTPStatus.INTERNAL_SERVER_ERROR:
        return None
    return sentry_sdk.capture_exception(exc)


async def _http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    sentry_event_id = _maybe_capture(exc, exc.status_code)
    return _build_response(exc.status_code, detail, sentry_event_id)


async def _unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception reached the global handler", exc_info=exc)
    sentry_event_id = _maybe_capture(exc, HTTPStatus.INTERNAL_SERVER_ERROR)
    return _build_response(HTTPStatus.INTERNAL_SERVER_ERROR, _GENERIC_DETAIL, sentry_event_id)


async def _validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Preserve FastAPI's default validation payload shape in `detail` so clients that parse it keep working,
    # while still attaching the correlation id for support lookups.
    correlation_id = correlation_id_ctx_var.get()
    body = {
        "detail": exc.errors(),
        "correlation_id": correlation_id if correlation_id != ":none:" else None,
    }
    return JSONResponse(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        content={k: v for k, v in body.items() if v is not None},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers that enrich error responses with correlation and Sentry ids."""
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)
