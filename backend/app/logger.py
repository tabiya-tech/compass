import json
import logging

from app.context_vars import (
    session_id_ctx_var,
    user_id_ctx_var,
    correlation_id_ctx_var,
    turn_index_ctx_var,
    agent_type_ctx_var,
    phase_ctx_var,
    llm_call_duration_ms_ctx_var
)


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
        
        # Add new observability fields for Epic 4 tracking
        record.correlation_id = correlation_id_ctx_var.get()
        record.turn_index = turn_index_ctx_var.get()
        record.agent_type = agent_type_ctx_var.get()
        record.phase = phase_ctx_var.get()
        record.llm_call_duration_ms = llm_call_duration_ms_ctx_var.get()

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
            "timestamp": record.asctime,
            # New observability fields for Epic 4
            "correlation_id": getattr(record, 'correlation_id', ':none:'),
            "turn_index": getattr(record, 'turn_index', -1),
            "agent_type": getattr(record, 'agent_type', ':none:'),
            "phase": getattr(record, 'phase', ':none:'),
            "llm_call_duration_ms": getattr(record, 'llm_call_duration_ms', -1)
        })
