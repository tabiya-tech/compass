import contextvars

# Define a context variable to store the session_id, which will be used to correlate log messages
# every conversation with a user will have a unique session_id
session_id_ctx_var = contextvars.ContextVar("session_id", default=":none:")

# Define a context variable to store the user_id, which will be used to correlate log messages
# every user will have a unique user_id
user_id_ctx_var = contextvars.ContextVar("user_id", default=":none:")

# Client ID is a unique identifier for the device or client (browser) using our application.
# Client ID is optional, so we set a default value of None
client_id_ctx_var = contextvars.ContextVar("client_id", default=None)

# The language the user is speaking.
user_language_ctx_var = contextvars.ContextVar("user_language")
