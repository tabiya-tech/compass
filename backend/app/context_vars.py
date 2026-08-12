import contextvars
from app.i18n.locale_context import LocaleContext

# Define a context variable to store the session_id, which will be used to correlate log messages
# every conversation with a user will have a unique session_id
session_id_ctx_var = contextvars.ContextVar("session_id", default=":none:")

# Define a context variable to store the user_id, which will be used to correlate log messages
# every user will have a unique user_id
user_id_ctx_var = contextvars.ContextVar("user_id", default=":none:")

# Client ID is a unique identifier for the device or client (browser) using our application.
# Client ID is optional, so we set a default value of None
client_id_ctx_var = contextvars.ContextVar("client_id", default=None)

# The language context, used to determine which language used by the LLM to reply to the user.
user_language_ctx_var: contextvars.ContextVar["LocaleContext"] = contextvars.ContextVar("user_language")

# Correlation ID for request tracing. Read by the LLM tracing layer as trace metadata.
correlation_id_ctx_var = contextvars.ContextVar("correlation_id", default=":none:")

# Turn index within a conversation session. Read by the LLM tracing layer as trace metadata.
turn_index_ctx_var = contextvars.ContextVar("turn_index", default=-1)

# The agent type handling the current work. Set by common_libs.observability.decorators.traced_agent.
agent_type_ctx_var = contextvars.ContextVar("agent_type", default=":none:")

# The current conversation phase. Read by the LLM tracing layer as trace metadata.
phase_ctx_var = contextvars.ContextVar("phase", default=":none:")

# The Compass suite area (module) the current work belongs to.
# Holds the *value* of an app.observability.TraceModule, e.g. "Build your Profile".
# Set at the service entry points and used to group LLM traces by module.
module_ctx_var = contextvars.ContextVar("module", default=":none:")

# The area within the module the current work belongs to, e.g. "Preference Elicitation" for a
# Build Your Profile turn.
# Set at the service entry points and used to group LLM traces one level below the module.
sub_module_ctx_var = contextvars.ContextVar("sub_module", default=":none:")
