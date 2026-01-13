import json
import logging

from app.context_vars import session_id_ctx_var, user_id_ctx_var


class SessionIdLogFilter(logging.Filter):
    """
    A custom log filter that adds the session_id to the log record
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Get the session_id and user_id from the context variable
        # and add them to the log record
        # This will allow us to correlate log messages
        record.session_id = session_id_ctx_var.get()
        record.user_id = user_id_ctx_var.get()

        return True


class JsonLogFormatter(logging.Formatter):
    """
    JsonLogFormatter is a custom log formatter that adds the session_id to the log message.
    """

    def __init__(self, fmt=None):
        """
        Initialize the formatter with custom format and date format.
        """
        super().__init__(fmt)

    def format(self, record: logging.LogRecord):
        """
        Override the format method to customize the log output.
        """
        # Get the formatted message from the parent class
        formatted_message = super().format(record)

        # Get the session_id and the user_id from the context variable
        session_id = session_id_ctx_var.get()
        user_id = user_id_ctx_var.get()

        # We are using JSON format for the log message
        # Because google cloud logging expects JSON format
        # https://cloud.google.com/python/docs/reference/logging/latest/std-lib-integration#logging-json-payloads
        return json.dumps({
            "message": formatted_message,
            "logger_level": record.levelname,
            "logger_message": record.getMessage(),
            "user_id": user_id,
            "logger_name": record.name,
            "session_id": str(session_id),
            "timestamp": record.asctime
        })


_logger = logging.getLogger(__name__)


def _sanitize_context(context: dict | None) -> dict | None:
    if not context:
        return None

    sanitized = {}
    for key, value in context.items():
        sanitized[key] = f"[redacted:{type(value).__name__}]"
    return sanitized


def _format_context(context: dict | None) -> str | None:
    sanitized_context = _sanitize_context(context)
    if sanitized_context is None:
        return None

    try:
        return json.dumps(sanitized_context, ensure_ascii=True)
    except Exception as exc:  # pylint: disable=broad-except
        _logger.debug("Failed to JSON encode sanitized context", exc_info=exc)
        return str(sanitized_context)


def log_non_pii_warning(message: str, context: dict | None = None) -> None:
    formatted_context = _format_context(context)
    if formatted_context:
        _logger.warning("%s | context=%s", message, formatted_context)
    else:
        _logger.warning(message)


def log_non_pii_error(message: str, context: dict | None = None) -> None:
    formatted_context = _format_context(context)
    if formatted_context:
        _logger.error("%s | context=%s", message, formatted_context)
    else:
        _logger.error(message)
