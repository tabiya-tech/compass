import contextvars
import logging

# Define a context variable to store the session_id, which will be used to correlate log messages
# every conversation with a user will have a unique session_id
session_id_ctx_var = contextvars.ContextVar("session_id", default=":none:")


class SessionIdLogFilter(logging.Filter):
    """
    A custom log filter that adds the session_id to the log record
    """
    def filter(self, record: logging.LogRecord) -> bool:
        # Get the session_id from the context variable
        # and add it to the log record
        # This will allow us to correlate log messages
        record.session_id = session_id_ctx_var.get()

        return True
