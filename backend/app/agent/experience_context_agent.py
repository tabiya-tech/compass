import logging
import time
from enum import Enum
from textwrap import dedent
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

from pydantic import BaseModel

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentInput, AgentOutput, LLMStats
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse
from app.agent.prompt_reponse_template import get_conversation_finish_instructions
from app.agent.prompt_reponse_template import get_json_response_instructions
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.tool.extract_experience_tool import ExtractExperienceTool, ExperienceEntity
from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.similarity_search_service import SimilaritySearchService

logger = logging.getLogger(__name__)

# Number of retries to get a JSON object from the model
_MAX_ATTEMPTS = 1


class ExperienceContextAgent(SimpleLLMAgent):
    """
    Agent that determines the context of a work experience.
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if self._state is None:
            logger.critical("ExperiencesExplorerAgent: execute() called before state was initialized")
        s = self._state

        # WIP (implement before merging)
        finished = True
        reply_raw = "Blah blah"

        # Send the prepared reply to the user
        # TODO: pass the LLM reasoning in case the answer was from an LLM
        return AgentOutput(message_for_user=reply_raw, finished=finished,
                           agent_type=self._agent_type,
                           reasoning="handwritten code",
                           agent_response_time_in_sec=0.1, llm_stats=[])

    def _create_llm_system_instructions(self) -> str:
        base_prompt = dedent("""" Based on the conversation above, what kind of experience is the user talking about. 
        Is it a formal work experience (waged job or entrepreneurship), is it an informal work experience (e.g. 
        micro-entrepreneurship) or is it an unseen economy experience (e.g. looking after a sick family member). 
        
        Please reply in the following format: X, Y, Z""")

        return base_prompt

    def __init__(self):
        system_instructions = self._create_llm_system_instructions()

        super().__init__(agent_type=AgentType.EXPERIENCE_CONTEXT_AGENT,
                         system_instructions=system_instructions)
