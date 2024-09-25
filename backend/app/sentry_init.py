import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

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
        send_default_pii=False
    )