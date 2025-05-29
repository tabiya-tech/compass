from app.agent.agent import Agent
from app.agent.agent_director.abstract_agent_director import AbstractAgentDirector, ConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
from app.agent.farewell_agent import FarewellAgent
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import \
    ConversationMemoryManager
from app.vector_search.vector_search_dependencies import SearchServices


class SimpleAgentDirector(AbstractAgentDirector):
    """
    A simple implementation of an agent director. It transitions sequentially through the conversation phases and
    delegates the conversation to the appropriate agent for each phase.
    There is always one agent responsible for each phase.
    """

    def __init__(self, conversation_manager: ConversationMemoryManager,
                 search_services: SearchServices):
        super().__init__(conversation_manager)

        # initialize the agents
        self._agents: dict[ConversationPhase, Agent] = {
            ConversationPhase.INTRO: WelcomeAgent(),
            ConversationPhase.COUNSELING: ExploreExperiencesAgentDirector(conversation_manager=conversation_manager,
                                                                          search_services=search_services),
            ConversationPhase.CHECKOUT: FarewellAgent()
        }

    def get_explore_experiences_agent(self) -> ExploreExperiencesAgentDirector:
        #  cast the agent to the ExploreExperiencesAgentDirector
        agent = self._agents[ConversationPhase.COUNSELING]
        if not isinstance(agent, ExploreExperiencesAgentDirector):
            raise ValueError("The agent is not an instance of ExploreExperiencesAgentDirector")
        return agent

    def get_welcome_agent(self) -> WelcomeAgent:
        """
        Get the welcome agent.
        :return: The welcome agent
        """
        agent = self._agents[ConversationPhase.INTRO]
        if not isinstance(agent, WelcomeAgent):
            raise ValueError("The agent is not an instance of WelcomeAgent")
        return agent

    def _get_current_agent(self) -> Agent | None:
        """
        Get the current agent for a specific state.
        :return: The current agent for the state, or None if conversation has ended
        """
        return self._agents.get(self._state.current_phase, None)

    def _transition_to_next_phase(self):
        """
        Transition to the next phase of the conversation.
        """
        if self._state.current_phase != ConversationPhase.ENDED:
            self._state.current_phase = ConversationPhase(self._state.current_phase.value + 1)

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input and specific state.
        When all agents are done, return a message to the user that the conversation is finished.
        :param user_input: The user input
        :return: The output from the agent
        """

        try:
            current_agent = self._get_current_agent()
            if current_agent:
                context = await self._conversation_manager.get_conversation_context()
                agent_output = await current_agent.execute(user_input, context)
                if agent_output.finished:  # If the agent is finished, move to the next agent
                    self._transition_to_next_phase()
                    # Update the conversation history
                await self._conversation_manager.update_history(user_input, agent_output)
            else:
                # No more agents to run
                agent_output = AgentOutput(
                    message_for_user="Conversation finished, all agents are done!",
                    finished=True, agent_type=None)
            return agent_output
        # executing an agent can raise any number of unknown exceptions
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Error while executing the agent director: %s", e, exc_info=True)
            return AgentOutput(message_for_user="Conversation forcefully ended",
                               finished=True, agent_type=None)
