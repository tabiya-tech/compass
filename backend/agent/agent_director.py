import logging

from agent.agent_types import Agent, AgentInput, AgentOutput, ConversationHistory
from agent.farewell_agent import FarewellAgent
from agent.skill_explore_agent import SkillExplorerAgent
from agent.welcome_agent import WelcomeAgent

logger = logging.getLogger(__name__)


class AgentDirector:

    # current agent index

    def __init__(self):
        self._current_agent_index = 0
        self._agents: list[Agent] = [
            WelcomeAgent(),
            SkillExplorerAgent(),
            FarewellAgent()
        ]
        self._conversation_history: ConversationHistory = []

    async def reset(self):
        # Reset agent index
        self._current_agent_index = 0
        # Reset conversation history
        self._conversation_history = []

    async def get_conversation_history(self) -> ConversationHistory:
        return self._conversation_history

    # Is there a reason this is an async function?
    def get_current_agent(self) -> Agent | None:
        if 0 <= self._current_agent_index < len(self._agents):
            return self._agents[self._current_agent_index]
        else:
            return None

    def set_current_agent(self, agent_index):
        self._current_agent_index = agent_index

    async def run_task(self, user_input: AgentInput) -> AgentOutput:
        try:
            current_agent = self.get_current_agent()
            history = await self.get_conversation_history()
            if current_agent:
                agent_output = await current_agent.execute(user_input, history)
                if agent_output.finished:
                    self._current_agent_index += 1
            else:
                # No more agents to run
                agent_output = AgentOutput(message_for_user="Conversation finished, all agents are done! ", finished=True, agent_type=None)
            self._conversation_history.append((user_input, agent_output))
            return agent_output
        except Exception as e:
            logger.exception(e)
            return AgentOutput(message_for_user="Conversation forcefully ended", finished=True, agent_type=None)
