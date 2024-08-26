import contextvars

# Define a context variable to store the session_id, which will be used to correlate log messages
# every conversation with a user will have a unique session_id
session_id_ctx_var = contextvars.ContextVar("session_id", default=":none:")

# Define a context variable to store the user_id, which will be used to correlate log messages
# every user will have a unique user_id
user_id_ctx_var = contextvars.ContextVar("user_id", default=":none:")

