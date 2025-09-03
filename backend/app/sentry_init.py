import sentry_sdk
from sentry_sdk.types import Event, Hint
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from app.app_config import get_application_config
from app.context_vars import session_id_ctx_var, user_id_ctx_var, client_id_ctx_var
import logging
from typing import Dict, List, Optional, TypedDict

logger = logging.getLogger(__name__)


class BackendSentryConfig(TypedDict, total=False):
    """
    Configuration for backend Sentry initialization.
    Mirrors the frontend structure where applicable.

    tracesSampleRate: float -> maps to traces_sample_rate
    enableLogs: bool -> controls which log levels are sent as events
    levels: List[str] -> ['debug'|'info'|'warning'|'error'] determines event level threshold
    """

    tracesSampleRate: float
    enableLogs: bool
    levels: List[str]


SENTRY_CONFIG_DEFAULT: BackendSentryConfig = {
    "tracesSampleRate": 1.0,
    "enableLogs": False,
    "levels": ["error"],
}


def _determine_event_level(levels: List[str], enable_logs: bool) -> int:
    """Map configured levels to a python logging threshold for Sentry event_level.

    Lower thresholds mean more logs are captured as Sentry events.
    Order of precedence (most verbose first): debug < info < warning < error
    """
    if not enable_logs:
        return logging.ERROR
    normalized = {lvl.strip().lower() for lvl in levels if isinstance(lvl, str)}
    if "debug" in normalized:
        return logging.DEBUG
    if "info" in normalized:
        return logging.INFO
    if "warning" in normalized or "warn" in normalized:
        return logging.WARNING
    # default to error
    return logging.ERROR


def init_sentry(dsn: str, environment: str | None = None, config: Optional[BackendSentryConfig] = None):
    logger.info("Initializing Sentry...")

    # Merge provided config with defaults
    cfg: BackendSentryConfig = {**SENTRY_CONFIG_DEFAULT, **(config or {})}

    # Configure logging integration according to configured levels
    event_level = _determine_event_level(cfg.get("levels", ["error"]), bool(cfg.get("enableLogs", False)))
    sentry_logging = LoggingIntegration(
        # Breadcrumb capture level is omitted to reduce noise in production
        event_level=event_level
    )

    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            FastApiIntegration(),
            sentry_logging,
        ],
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
