# This package is still a stub. The agent is not yet implemented.
import logging
from textwrap import dedent

from app.agent.agent import SimpleLLMAgent, P
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import \
    ConversationContext

logger = logging.getLogger(__name__)


def _create_llm_system_instructions() -> str:
    # TODO: Implement the prompt (this is just a stub)
    return dedent(
        """...""")


class InferOccupationsAgent(SimpleLLMAgent):
    """
    This agent takes the conversation history related to a single experience and links it to ESCO entities
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput[P]:
        # Stub code (will be replaced)
        agent_reply_txt = f"Inferring occupations for: <experience_id> (not implemented)"

        return AgentOutput(message_for_user=agent_reply_txt, finished=True,
                                   agent_type=self._agent_type,
                                   reasoning="handwritten code",
                                   agent_response_time_in_sec=0.1, llm_stats=[])

    def __init__(self):
        system_instructions = _create_llm_system_instructions()

        super().__init__(agent_type=AgentType.INFER_OCCUPATIONS_AGENT,
                         system_instructions=system_instructions)