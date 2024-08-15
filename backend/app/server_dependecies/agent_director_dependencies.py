from threading import Lock

from fastapi import Depends

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_dependecies.conversation_manager_dependencies import get_conversation_memory_manager
from app.vector_search.vector_search_dependencies import SearchServices, get_all_search_services

# Lock to ensure that the singleton instances are thread-safe

_lock = Lock()

_llm_agent_director_singleton: LLMAgentDirector | None = None


def get_agent_director(conversation_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       search_services: SearchServices = Depends(get_all_search_services)
                       ) -> LLMAgentDirector:
    """
    Get the agent director instance.
    """
    global _llm_agent_director_singleton
    if _llm_agent_director_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        with _lock:  # before modifying the singleton instance, acquire the lock
            if _llm_agent_director_singleton is None:  # double check after acquiring the lock
                _llm_agent_director_singleton = LLMAgentDirector(conversation_manager, search_services)

    return _llm_agent_director_singleton
