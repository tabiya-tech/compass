import json
import logging

from app.context_vars import session_id_ctx_var, user_id_ctx_var, module_ctx_var, sub_module_ctx_var
from common_libs.observability.tracing import current_trace_id


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

        # The suite area, the area within it and the Langfuse trace, so a log line
        # can be pivoted straight to the trace it belongs to. Named trace_module rather than module
        # because LogRecord already defines `module` as the name of the module that emitted the record.
        record.trace_module = module_ctx_var.get()
        record.trace_sub_module = sub_module_ctx_var.get()
        record.trace_id = current_trace_id()

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
            # LLM tracing correlation
            "trace_module": getattr(record, 'trace_module', ':none:'),
            "trace_sub_module": getattr(record, 'trace_sub_module', ':none:'),
            "trace_id": getattr(record, 'trace_id', None)
        })
