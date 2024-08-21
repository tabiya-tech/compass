from fastapi import Depends

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_dependecies.conversation_manager_dependencies import get_conversation_memory_manager
from app.vector_search.vector_search_dependencies import SearchServices, get_all_search_services


def get_agent_director(conversation_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       search_services: SearchServices = Depends(get_all_search_services)
                       ) -> LLMAgentDirector:
    """
    # Get the agent director instance.
    # """
    # we construct a new instance of the agent director every time
    #  this is not ideal, but we cant have a singleton instance since the AgentDirector has state,
    # and when multiple requests are using the same instance, they shouldn't share or mix state
    #  we should eventually refactor the agent director to be stateless, and then we can have a singleton instance
    return LLMAgentDirector(conversation_manager, search_services)
