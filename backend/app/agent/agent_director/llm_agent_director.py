from app.agent.agent import Agent
from app.agent.agent_director._llm_router import LLMRouter
from app.agent.agent_director.abstract_agent_director import AbstractAgentDirector, ConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
from app.agent.farewell_agent import FarewellAgent
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.vector_search.vector_search_dependencies import SearchServices
from app.i18n.translation_service import t


class LLMAgentDirector(AbstractAgentDirector):
    """
    Receives user input, understands the conversation context and the user intent and routes
    the user input to the appropriate agent.
    """

    def __init__(self, *,
                 conversation_manager: ConversationMemoryManager,
                 search_services: SearchServices,
                 experience_pipeline_config: ExperiencePipelineConfig
                 ):
        super().__init__(conversation_manager)
        # initialize the agents
        self._agents: dict[AgentType, Agent] = {
            AgentType.WELCOME_AGENT: WelcomeAgent(),
            AgentType.EXPLORE_EXPERIENCES_AGENT: ExploreExperiencesAgentDirector(
                conversation_manager=conversation_manager,
                search_services=search_services,
                experience_pipeline_config=experience_pipeline_config
            ),
            AgentType.FAREWELL_AGENT: FarewellAgent()
        }
        self._llm_router = LLMRouter(self._logger)

    def get_welcome_agent(self) -> WelcomeAgent:
        # cast the agent to the WelcomeAgent
        agent = self._agents[AgentType.WELCOME_AGENT]
        if not isinstance(agent, WelcomeAgent):
            raise ValueError("The agent is not an instance of WelcomeAgent")
        return agent

    def get_explore_experiences_agent(self) -> ExploreExperiencesAgentDirector:
        #  cast the agent to the ExploreExperiencesAgentDirector
        agent = self._agents[AgentType.EXPLORE_EXPERIENCES_AGENT]
        if not isinstance(agent, ExploreExperiencesAgentDirector):
            raise ValueError("The agent is not an instance of ExploreExperiencesAgentDirector")
        return agent

    async def get_suitable_agent_type(self, *,
                                      user_input: AgentInput,
                                      phase: ConversationPhase,
                                      context: ConversationContext) -> AgentType:

        if phase == ConversationPhase.ENDED:
            raise ValueError("Conversation has ended, no more agents to run")

        # Currently, in the intro phase, only the welcome agent is active.
        if phase == ConversationPhase.INTRO:
            return AgentType.WELCOME_AGENT

        # In the consulting phase, the agent type is determined by the user's intent.
        if phase == ConversationPhase.COUNSELING:
            return await self._llm_router.execute(
                user_input=user_input,
                phase=phase,
                context=context
            )

        # Otherwise, send the Farewell agent to the LLM, no penalty and no error.
        return AgentType.FAREWELL_AGENT

    def _get_new_phase(self, agent_output: AgentOutput) -> ConversationPhase:
        """
        Get the new conversation phase based on the agent output and the current phase.
        """
        if self._state is None:
            raise RuntimeError("AgentDirectorState must be set before computing the new phase")
        current_phase = self._state.current_phase

        # ConversationPhase.ENDED is the final phase
        if current_phase == ConversationPhase.ENDED:
            return ConversationPhase.ENDED

            # In the intro phase, only the Welcome agent can end the phase
        if (current_phase == ConversationPhase.INTRO
                and agent_output.agent_type == AgentType.WELCOME_AGENT
                and agent_output.finished):
            return ConversationPhase.COUNSELING

        # In the consulting phase, only the Explore Experiences agent can end the phase
        if (current_phase == ConversationPhase.COUNSELING
                and agent_output.agent_type == AgentType.EXPLORE_EXPERIENCES_AGENT
                and agent_output.finished):
            return ConversationPhase.CHECKOUT

        # In the checkout phase, only the Farewell agent can end the phase
        if (current_phase == ConversationPhase.CHECKOUT
                and agent_output.agent_type == AgentType.FAREWELL_AGENT
                and agent_output.finished):
            return ConversationPhase.ENDED

        return current_phase

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input.
        Progress the conversation phase based on the agent output and the current phase.
        When all agents are done, return a message to the user that the conversation is finished.
        :param user_input: The user input.
        :return: The output from the agent
        """
        try:
            if self._state is None:
                raise RuntimeError("AgentDirectorState must be set before executing")
            first_call: bool = True
            transitioned_to_new_phase: bool = False
            agent_output: AgentOutput | None = None
            while first_call or transitioned_to_new_phase:
                if self._state.current_phase == ConversationPhase.ENDED:
                    try:
                        finished_msg = t("messages", "agent_director.final_message")
                    except Exception:
                        finished_msg = "The conversation has finished!"
                    agent_output = AgentOutput(
                        message_for_user=finished_msg,
                        finished=True,
                        agent_type=None,
                        agent_response_time_in_sec=0,  # artificial value as there is no LLM call
                        llm_stats=[]  # artificial value as there is no LLM call
                    )
                    return agent_output

                first_call = False
                # Get the context
                context = await self._conversation_manager.get_conversation_context()
                clean_input: AgentInput = user_input.model_copy()  # make a copy of the user input to avoid modifying the original
                clean_input.message = clean_input.message.strip()  # Remove leading and trailing whitespaces

                # Get the agent to run
                suitable_agent_type = await self.get_suitable_agent_type(
                    user_input=clean_input,
                    phase=self._state.current_phase,
                    context=context)
                self._logger.debug("Running agent: %s", {suitable_agent_type})
                agent_for_task = self._agents[suitable_agent_type]

                # Perform the task
                agent_output = await agent_for_task.execute(clean_input, context)
                if not agent_for_task.is_responsible_for_conversation_history():
                    await self._conversation_manager.update_history(clean_input, agent_output)

                # Update the conversation phase
                new_phase = self._get_new_phase(agent_output)
                self._logger.debug("Transitioned phase from %s --to-> %s", self._state.current_phase, new_phase)

                transitioned_to_new_phase = self._state.current_phase != new_phase
                if transitioned_to_new_phase:
                    user_input = AgentInput(
                        message="(silence)",
                        is_artificial=True
                    )
                    self._state.current_phase = new_phase

            # return the last agent output in case
            return agent_output

        # executing an agent can raise any number of unknown exceptions
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Error while executing the agent director: %s", e, exc_info=True)
            try:
                err_msg = t("messages", "agent_director.error_retry")
            except Exception:
                err_msg = "I am facing some difficulties right now, could you please repeat what you said?"
            agent_output = AgentOutput(
                message_for_user=err_msg,
                finished=True,
                agent_type=None,
                agent_response_time_in_sec=0,  # an artificial value, perhaps misleading, but could be improved later
                llm_stats=[]  # an artificial value as there shouldn't be any LLM call
            )
            await self._conversation_manager.update_history(user_input, agent_output)
            return agent_output
