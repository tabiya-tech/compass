# This package is still a stub. The agent is not yet implemented.
import logging
from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import \
    ConversationContext

logger = logging.getLogger(__name__)


def _create_llm_system_instructions() -> str:
    # TODO: Replace the prompt with a real one (this is just a stub)
    return dedent(""""You work for an employment agency helping the user outline their previous 
        experiences and reframe them for the job market. You should be explicit in saying that past experience can 
        also reflect work in the unseen economy, such as care work for family and this should be included in your 
        investigation. Keep asking the user if they have more experience they would 
        like to talk about until they explicitly state that they don't.""")


class CollectExperiencesAgent(SimpleLLMAgent):
    """
    This agent drives the conversation to build up the initial picture of the previous work experiences of the user.
    This agent is stateless, and it does not link to ESCO.
    """

    def __init__(self):
        # The system instructions are passed to the llm, together with the common instructions wrt CoT
        system_instructions = _create_llm_system_instructions()

        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         system_instructions=system_instructions)


