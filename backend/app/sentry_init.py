import logging
from logging import getLevelNamesMapping
from typing import Optional, TypedDict, cast

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations import Integration
from sentry_sdk.types import Event, Hint

from app.app_config import get_application_config
from app.context_vars import session_id_ctx_var, user_id_ctx_var, client_id_ctx_var

logger = logging.getLogger(__name__)


class BackendSentryConfig(TypedDict, total=False):
    """
    Configuration for backend Sentry initialization.
    Mirrors the frontend structure where applicable.

    tracesSampleRate: float -> maps to traces_sample_rate
    enableLogs: bool -> when true, logging integration is enabled
    logLevel: str -> capture Python logs at/above this level into Sentry logging integration
    eventLevel: str -> send logs at/above this level to Sentry as events
    """

    tracesSampleRate: float
    enableLogs: bool
    logLevel: str
    eventLevel: str


SENTRY_CONFIG_DEFAULT: BackendSentryConfig = {
    "tracesSampleRate": 1.0,
    "enableLogs": False,
    "logLevel": "warning",
    "eventLevel": "error",
}


def _determine_event_level(level: str) -> int:
    level_mappings = getLevelNamesMapping()
    try:
        return level_mappings[level.upper()]
    except Exception:
        logging.error("Invalid Sentry log level '%s'. Falling back to ERROR.", level)
        return logging.ERROR


def init_sentry(dsn: str, environment: str | None = None, config: Optional[BackendSentryConfig] = None):
    logger.info("Initializing Sentry...")

    # Merge provided config with defaults
    cfg: BackendSentryConfig = {**SENTRY_CONFIG_DEFAULT, **(config or {})}

    # Configure logging integration according to configured levels
    integrations: list[Integration] = [cast(Integration, FastApiIntegration())]
    if cfg.get("enableLogs", False):
        capture_level = _determine_event_level(cfg.get("logLevel", "info"))
        event_level = _determine_event_level(cfg.get("eventLevel", "error"))
        sentry_logging = LoggingIntegration(
            event_level=event_level,
            sentry_logs_level=capture_level,
        )
        integrations.append(sentry_logging)

    sentry_sdk.init(
        dsn=dsn,
        integrations=integrations,
        traces_sample_rate=cfg.get("tracesSampleRate", SENTRY_CONFIG_DEFAULT["tracesSampleRate"]),
        environment=environment,
        send_default_pii=False,
        before_send=attach_ticket_info,
    )


def set_sentry_contexts():
    """
    Set sentry contexts
    """

    sentry_sdk.set_context("Backend Version", get_application_config().version_info.model_dump())


def attach_ticket_info(event: Event, hint: Hint) -> Event | None:
    # Set default user context with values from context vars
    event['tags'] = {
        **event.get('tags', {}),
        "session_id": session_id_ctx_var.get(),
        "user_id": user_id_ctx_var.get(),
        "client_id": client_id_ctx_var.get()
    }

    return event
