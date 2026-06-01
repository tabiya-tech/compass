from pathlib import Path

from app.agent.agent import Agent
from app.agent.agent_director._llm_router import LLMRouter
from app.agent.agent_director.abstract_agent_director import AbstractAgentDirector, ConversationPhase, CounselingSubPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
from app.agent.farewell_agent import FarewellAgent
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.countries import Country
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
                 experience_pipeline_config: ExperiencePipelineConfig,
                 enable_preference_elicitation: bool = False,
                 default_country_of_user: Country = Country.UNSPECIFIED,
                 ):
        super().__init__(conversation_manager)
        self._enable_preference_elicitation = enable_preference_elicitation
        # initialize the agents
        self._agents: dict[AgentType, Agent] = {
            AgentType.WELCOME_AGENT: WelcomeAgent(),
            AgentType.EXPLORE_EXPERIENCES_AGENT: ExploreExperiencesAgentDirector(
                conversation_manager=conversation_manager,
                search_services=search_services,
                experience_pipeline_config=experience_pipeline_config,
                enable_preference_elicitation=enable_preference_elicitation,
            ),
            AgentType.FAREWELL_AGENT: FarewellAgent()
        }
        if enable_preference_elicitation:
            offline_output_dir = str(Path(__file__).parent.parent.parent.parent / "offline_output")
            self._agents[AgentType.PREFERENCE_ELICITATION_AGENT] = PreferenceElicitationAgent(
                use_personalized_vignettes=False,
                use_offline_with_personalization=True,
                offline_output_dir=offline_output_dir,
                country_of_user=default_country_of_user,
            )
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

    def get_preference_elicitation_agent(self) -> PreferenceElicitationAgent:
        # cast the agent to the PreferenceElicitationAgent
        agent = self._agents.get(AgentType.PREFERENCE_ELICITATION_AGENT)
        if not isinstance(agent, PreferenceElicitationAgent):
            raise ValueError("Preference elicitation agent is not enabled")
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

        # In the counseling phase, when preference elicitation is enabled the sub-phase
        # determines the agent deterministically. When it is disabled, fall back to the
        # existing LLM router which routes within (WELCOME, EXPLORE_EXPERIENCES, FAREWELL).
        if phase == ConversationPhase.COUNSELING:
            if self._enable_preference_elicitation and self._state is not None:
                sub_phase = self._state.counseling_sub_phase
                if sub_phase == CounselingSubPhase.PREFERENCE_ELICITATION:
                    return AgentType.PREFERENCE_ELICITATION_AGENT
                # CounselingSubPhase.EXPLORE_EXPERIENCES → route deterministically too.
                return AgentType.EXPLORE_EXPERIENCES_AGENT
            return await self._llm_router.execute(
                user_input=user_input,
                phase=phase,
                context=context
            )

        # Otherwise, send the Farewell agent to the LLM, no penalty and no error.
        return AgentType.FAREWELL_AGENT

    def _compute_next_state(self, agent_output: AgentOutput) -> tuple[ConversationPhase, CounselingSubPhase]:
        """
        Compute the next (conversation_phase, counseling_sub_phase) for the given agent output.
        Pure function — does not mutate self._state. The caller (execute) applies the result.
        """
        if self._state is None:
            raise RuntimeError("AgentDirectorState must be set before computing the new phase")
        current_phase = self._state.current_phase
        current_sub_phase = self._state.counseling_sub_phase

        # ConversationPhase.ENDED is the final phase
        if current_phase == ConversationPhase.ENDED:
            return ConversationPhase.ENDED, current_sub_phase

            # In the intro phase, only the Welcome agent can end the phase
        if (current_phase == ConversationPhase.INTRO
                and agent_output.agent_type == AgentType.WELCOME_AGENT
                and agent_output.finished):
            return ConversationPhase.COUNSELING, current_sub_phase

        # In the consulting phase, only the Explore Experiences agent can end the phase
        # (when preference elicitation is enabled it advances the sub-phase first instead of ending)
        if (current_phase == ConversationPhase.COUNSELING
                and agent_output.agent_type == AgentType.EXPLORE_EXPERIENCES_AGENT
                and agent_output.finished):
            if self._enable_preference_elicitation:
                return ConversationPhase.COUNSELING, CounselingSubPhase.PREFERENCE_ELICITATION
            return ConversationPhase.CHECKOUT, current_sub_phase

        # In the consulting phase, the Preference Elicitation agent ends the phase
        if (current_phase == ConversationPhase.COUNSELING
                and agent_output.agent_type == AgentType.PREFERENCE_ELICITATION_AGENT
                and agent_output.finished):
            return ConversationPhase.CHECKOUT, current_sub_phase

        # In the checkout phase, only the Farewell agent can end the phase
        if (current_phase == ConversationPhase.CHECKOUT
                and agent_output.agent_type == AgentType.FAREWELL_AGENT
                and agent_output.finished):
            return ConversationPhase.ENDED, current_sub_phase

        return current_phase, current_sub_phase

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
                    finished_msg = t("messages", "agentDirector.finalMessage","The conversation has finished!")
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

                # Determine if a phase transition is about to happen so we can decide
                # whether to save this agent's response to history.
                new_phase, new_sub_phase = self._compute_next_state(agent_output)
                _will_transition = self._state.current_phase != new_phase

                if not agent_for_task.is_responsible_for_conversation_history():
                    # Skip saving only the WelcomeAgent's final transition message — the next
                    # agent produces its own opener that supersedes it. Other transitions
                    # (PreferenceElicitationAgent WRAPUP summary, FarewellAgent closing) emit
                    # user-facing content that must be preserved.
                    skip_on_transition = (
                            _will_transition
                            and agent_output.agent_type == AgentType.WELCOME_AGENT
                    )
                    if not skip_on_transition:
                        await self._conversation_manager.update_history(clean_input, agent_output)
                    context = await self._conversation_manager.get_conversation_context()

                # Advance the counseling sub-phase if it changed (no director loop re-entry —
                # the next user turn picks up the new sub-agent via deterministic routing).
                if self._state.counseling_sub_phase != new_sub_phase:
                    self._logger.info(
                        "Advancing counseling sub-phase: %s --to-> %s",
                        self._state.counseling_sub_phase, new_sub_phase,
                    )
                    self._state.counseling_sub_phase = new_sub_phase

                # Update the conversation phase
                self._logger.debug("Transitioned phase from %s --to-> %s", self._state.current_phase, new_phase)

                transitioned_to_new_phase = _will_transition
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
            err_msg = t("messages", "agentDirector.errorRetry")
            agent_output = AgentOutput(
                message_for_user=err_msg,
                finished=True,
                agent_type=None,
                agent_response_time_in_sec=0,  # an artificial value, perhaps misleading, but could be improved later
                llm_stats=[]  # an artificial value as there shouldn't be any LLM call
            )
            await self._conversation_manager.update_history(user_input, agent_output)
            return agent_output
