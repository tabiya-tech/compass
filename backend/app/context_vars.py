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

# Correlation ID for request tracing (generated per HTTP request)
correlation_id_ctx_var = contextvars.ContextVar("correlation_id", default=":none:")

# Turn index within a conversation session (increments with each user message)
turn_index_ctx_var = contextvars.ContextVar("turn_index", default=-1)

# Current agent type handling the request
agent_type_ctx_var = contextvars.ContextVar("agent_type", default=":none:")

# Current conversation phase
phase_ctx_var = contextvars.ContextVar("phase", default=":none:")

# LLM call duration in milliseconds (for current operation)
llm_call_duration_ms_ctx_var = contextvars.ContextVar("llm_call_duration_ms", default=-1)
