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

# Correlation ID for request tracing (generated per HTTP request)
correlation_id_ctx_var = contextvars.ContextVar("correlation_id", default=":none:")

# Turn index within a conversation session (increments with each user message)
turn_index_ctx_var = contextvars.ContextVar("turn_index", default=-1)

# Current agent type handling the request
agent_type_ctx_var = contextvars.ContextVar("agent_type", default=":none:")

# Current conversation phase
phase_ctx_var = contextvars.ContextVar("phase", default=":none:")

# The suite area (module) the current work belongs to.
# Holds the *value* of an app.observability.TraceModule, e.g. "Build your Profile".
# Set at the service entry points and used to group LLM traces by module.
module_ctx_var = contextvars.ContextVar("module", default=":none:")

# The area within the module the current work belongs to, e.g. "Preference Elicitation" for a
# Build Your Profile turn.
# Set at the service entry points and used to group LLM traces one level below the module.
sub_module_ctx_var = contextvars.ContextVar("sub_module", default=":none:")
