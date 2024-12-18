import sentry_sdk
from sentry_sdk.types import Event, Hint
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from app.context_vars import session_id_ctx_var, user_id_ctx_var
import logging

logger = logging.getLogger(__name__)

def init_sentry(dsn: str, environment: str = None):
    logger.info("Initializing Sentry...")
    # Sentry integration for FastAPI is added here
    sentry_logging = LoggingIntegration(
        # level=logging.INFO,  # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Send errors as events
    )

    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            FastApiIntegration(),
            sentry_logging
        ],
        traces_sample_rate=1.0,
        environment=environment,
        send_default_pii=False,
        before_send=attach_user_info
    )


def attach_user_info(event: Event, hint: Hint) -> Event | None:
    # Set default user context with values from context vars
    sentry_sdk.set_user({
        "session_id": session_id_ctx_var.get(),
        "user_id": user_id_ctx_var.get()
    })
    return event