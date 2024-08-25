from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE


def get_conversation_memory_manager() -> ConversationMemoryManager:
    """ Get the conversation memory manager instance."""
    # we construct a new instance of the conversation memory manager every time
    #  this is not ideal, but we cant have a singleton instance since the ConversationMemoryManager has state,
    # and when multiple requests are using the same instance, they shouldn't share or mix state
    #  we should eventually refactor the ConversationMemoryManager to be stateless, and then we can have a singleton instance
    return ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
