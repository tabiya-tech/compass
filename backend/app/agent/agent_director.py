import logging
from typing import TypeAlias, Dict
from collections import defaultdict

from app.agent.agent_types import Agent, AgentInput, AgentOutput, \
    ConversationHistory
from app.agent.farewell_agent import FarewellAgent
from app.agent.skill_explore_agent import SkillExplorerAgent
from app.agent.welcome_agent import WelcomeAgent
from app.agent.conversation_manager import ConversationManager

logger = logging.getLogger(__name__)

CurrentIndexDict: TypeAlias = Dict[int, int]


class AgentDirector:
    """
    Receives user input, understands the conversation context and the user intent and routes
    the user input to the appropriate agent.
    """

    def __init__(self):
        # set the default agent index to 0
        self._current_agent_index: CurrentIndexDict = defaultdict(int)
        # initialize the agents
        self._agents: list[Agent] = [
            WelcomeAgent(),
            SkillExplorerAgent(),
            FarewellAgent()
        ]
        # initialize the conversation manager
        self._conversation_manager = ConversationManager()

    async def reset(self, session_id: int) -> None:
        """
        Reset the state of the conversation
        """
        # Reset agent index for a specific session
        await self.set_current_agent(session_id, 0)
        # Reset conversation history for a specific session
        await self._conversation_manager.reset(session_id)

    async def get_conversation_history(self,
                                       session_id: int) -> ConversationHistory:
        """
        Get the conversation history for a specific session.

        :param session_id: The session id of the conversation

        :return: The conversation history for the specific session
        """
        return await self._conversation_manager.get_conversation_history(
            session_id)

    def get_current_agent(self, session_id: int) -> tuple[int, Agent | None]:
        """
        Get the current agent index and the current agent for a specific session.

        :param session_id: The session id of the conversation
        :return: A tuple of the index of current agent and the current agent.
                 None if the index is out of range
        """
        current_agent_index = self._current_agent_index[session_id]
        if 0 <= current_agent_index < len(self._agents):
            return current_agent_index, self._agents[current_agent_index]
        # If the index is out of range, return None
        return current_agent_index, None

    async def set_current_agent(self, session_id: int, agent_index: int) -> None:
        """
        Set the current agent index for a specific session.

        :param session_id: The session id of the conversation
        :param agent_index: The index of the agent to set as current
        """
        self._current_agent_index[session_id] = agent_index

    async def run_task(self, session_id: int,
                       user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input and specific session.

        If the agent has finished, set the next agent as the current agent.

        When all agents are done, return a message to the user that the conversation is finished.

        :param session_id: The session id of the conversation
        :param user_input: The user input
        :return: The output from the agent
        """
        try:
            current_agent_index, current_agent = self.get_current_agent(session_id)
            if current_agent:
                history = await self.get_conversation_history(session_id)
                agent_output = await current_agent.execute(user_input, history)
                if agent_output.finished:  # If the agent is finished, move to the next agent
                    await self.set_current_agent(session_id, current_agent_index + 1)
                await self._conversation_manager.update_history(session_id, user_input,
                                                                agent_output)
            else:
                # No more agents to run
                agent_output = AgentOutput(
                    message_for_user="Conversation finished, all agents are done!",
                    finished=True, agent_type=None)
            return agent_output
        except Exception as e:  # pylint: disable=broad-except # executing an agent can raise any number of unknown exceptions
            logger.exception(e)
            return AgentOutput(message_for_user="Conversation forcefully ended",
                               finished=True, agent_type=None)
