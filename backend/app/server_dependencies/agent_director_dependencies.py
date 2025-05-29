import logging

from fastapi import Depends

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from .conversation_manager_dependencies import get_conversation_memory_manager
from app.vector_search.vector_search_dependencies import SearchServices, get_all_search_services
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.app_config import ApplicationConfig, get_application_config

logger = logging.getLogger(__name__)


def get_agent_director(conversation_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       search_services: SearchServices = Depends(get_all_search_services),
                       application_config: ApplicationConfig = Depends(get_application_config)
                       ) -> LLMAgentDirector:
    """
    # Get the agent director instance.
    # """

    # We construct a new instance of the agent director every time
    # this is not ideal. However, we can't have a singleton instance since the AgentDirector has state,
    # and when multiple requests are using the same instance, they shouldn't share or mix state.
    # We should eventually refactor the agent director to be stateless, and then we can have a singleton instance.
    experience_pipeline_config = ExperiencePipelineConfig.from_application_config(application_config=application_config,
                                                                                  logger=logger)
    return LLMAgentDirector(
        conversation_manager=conversation_manager,
        search_services=search_services,
        experience_pipeline_config=experience_pipeline_config
    )
