from pathlib import Path

from app.agent.agent import Agent
from app.agent.agent_director._llm_router import LLMRouter
from app.agent.agent_director.abstract_agent_director import AbstractAgentDirector, ConversationPhase, CounselingSubPhase
from app.conversations.phase_state_machine import JourneyPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
from app.agent.farewell_agent import FarewellAgent
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.recommender_advisor_agent.agent import RecommenderAdvisorAgent
from app.agent.recommender_advisor_agent.matching_service_client import MatchingServiceClient
from app.agent.welcome_agent import WelcomeAgent
from app.app_config import get_application_config
from app.countries import Country
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.vector_search.vector_search_dependencies import SearchServices
from app.user_recommendations.services.service import IUserRecommendationsService
from app.i18n.translation_service import t
from app.context_vars import phase_ctx_var, agent_type_ctx_var # for observability logging

class LLMAgentDirector(AbstractAgentDirector):
    """
    Receives user input, understands the conversation context and the user intent and routes
    the user input to the appropriate agent.
    """

    def __init__(self, *,
                 conversation_manager: ConversationMemoryManager,
                 search_services: SearchServices,
                 experience_pipeline_config: ExperiencePipelineConfig,
                 user_recommendations_service: IUserRecommendationsService,
                 ):
        super().__init__(conversation_manager)
        self._user_recommendations_service = user_recommendations_service

        # Initialize matching service client from config
        matching_service_client = None
        try:
            app_config = get_application_config()
            if app_config.matching_service_url and app_config.matching_service_api_key:
                matching_service_client = MatchingServiceClient(
                    base_url=app_config.matching_service_url,
                    api_key=app_config.matching_service_api_key
                )
                self._logger.info(
                    f"Matching service client initialized: {app_config.matching_service_url}"
                )
            else:
                self._logger.warning(
                    "Matching service not configured (URL or API key missing). "
                    "Recommender agent will use fallback recommendations."
                )
        except Exception as e:
            self._logger.warning(
                f"Failed to initialize matching service client: {e}. "
                "Recommender agent will use fallback recommendations."
            )

        # initialize the agents
        self._agents: dict[AgentType, Agent] = {
            AgentType.WELCOME_AGENT: WelcomeAgent(),
            AgentType.EXPLORE_EXPERIENCES_AGENT: ExploreExperiencesAgentDirector(
                conversation_manager=conversation_manager,
                search_services=search_services,
                experience_pipeline_config=experience_pipeline_config
            ),
            AgentType.PREFERENCE_ELICITATION_AGENT: PreferenceElicitationAgent(
                use_personalized_vignettes=False,  # Disable default personalization
                use_offline_with_personalization=True,  # Enable hybrid mode (offline D-optimal vignettes + LLM personalization)
                offline_output_dir=str(Path(__file__).parent.parent.parent.parent / "offline_output"),
                country_of_user=get_application_config().default_country_of_user,
            ),
            AgentType.RECOMMENDER_ADVISOR_AGENT: RecommenderAdvisorAgent(
                db6_client=None,  # Optional: Youth database integration
                node2vec_client=None,  # Optional: Node2Vec recommendation service
                occupation_search_service=search_services.occupation_search_service,
                matching_service_client=matching_service_client  # NEW: Deployed matching service
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

    def get_preference_elicitation_agent(self) -> PreferenceElicitationAgent:
        # cast the agent to the PreferenceElicitationAgent
        agent = self._agents[AgentType.PREFERENCE_ELICITATION_AGENT]
        if not isinstance(agent, PreferenceElicitationAgent):
            raise ValueError("The agent is not an instance of PreferenceElicitationAgent")
        return agent

    def get_recommender_advisor_agent(self) -> RecommenderAdvisorAgent:
        # cast the agent to the RecommenderAdvisorAgent
        agent = self._agents[AgentType.RECOMMENDER_ADVISOR_AGENT]
        if not isinstance(agent, RecommenderAdvisorAgent):
            raise ValueError("The agent is not an instance of RecommenderAdvisorAgent")
        return agent

    async def get_suitable_agent_type(self, *,
                                      user_input: AgentInput,
                                      phase: ConversationPhase,
                                      context: ConversationContext) -> AgentType:

        if phase == ConversationPhase.ENDED:
            raise ValueError("Conversation has ended, no more agents to run")

        if phase == ConversationPhase.INTRO:
            return AgentType.WELCOME_AGENT

        # In the consulting phase, the agent type is determined by the user's intent.
        # Matching and recommendation are detached from the conversation flow (Phase 1 simplification).
        if phase == ConversationPhase.COUNSELING:
            # Priority 1: Explicit phase skip overrides everything
            skip_phase = self._state.skip_to_phase
            if skip_phase == JourneyPhase.PREFERENCE_ELICITATION:
                self._logger.info(
                    "Step-skip: routing to PREFERENCE_ELICITATION_AGENT (skip_to_phase=PREFERENCE_ELICITATION)"
                )
                return AgentType.PREFERENCE_ELICITATION_AGENT

            # Priority 2: Deterministic sub-phase routing
            sub_phase = self._state.counseling_sub_phase
            if sub_phase == CounselingSubPhase.EXPLORE_EXPERIENCES:
                return AgentType.EXPLORE_EXPERIENCES_AGENT
            if sub_phase == CounselingSubPhase.PREFERENCE_ELICITATION:
                return AgentType.PREFERENCE_ELICITATION_AGENT

            # Fallback: use the LLM router (should not normally reach here)
            self._logger.warning("Unexpected counseling sub-phase state, falling back to LLM router")
            return await self._llm_router.execute(
                user_input=user_input,
                phase=phase,
                context=context
            )

        # Otherwise, send the Farewell agent
        return AgentType.FAREWELL_AGENT

    def _get_new_phase(self, agent_output: AgentOutput) -> ConversationPhase:
        """
        Get the new conversation phase based on the agent output and the current phase.
        Also advances counseling_sub_phase when agents within COUNSELING complete.
        """
        if self._state is None:
            raise RuntimeError("AgentDirectorState must be set before computing the new phase")
        current_phase = self._state.current_phase

        if current_phase == ConversationPhase.ENDED:
            return ConversationPhase.ENDED

        if (current_phase == ConversationPhase.INTRO
                and agent_output.agent_type == AgentType.WELCOME_AGENT
                and agent_output.finished):
            return ConversationPhase.COUNSELING

        if (current_phase == ConversationPhase.COUNSELING
                and agent_output.finished
                and agent_output.agent_type == AgentType.EXPLORE_EXPERIENCES_AGENT):
            self._state.counseling_sub_phase = CounselingSubPhase.PREFERENCE_ELICITATION
            self._logger.info(
                "ExploreExperiencesAgent finished, advancing to PREFERENCE_ELICITATION sub-phase"
            )
            return ConversationPhase.COUNSELING

        if (current_phase == ConversationPhase.COUNSELING
                and agent_output.finished
                and agent_output.agent_type == AgentType.PREFERENCE_ELICITATION_AGENT):
            return ConversationPhase.CHECKOUT

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
            
            # Set initial phase in context for observability logging
            phase_ctx_var.set(self._state.current_phase.value)
            
            first_call: bool = True
            transitioned_to_new_phase: bool = False
            agent_output: AgentOutput | None = None
            context = await self._conversation_manager.get_conversation_context()
            while first_call or transitioned_to_new_phase:
                if self._state.current_phase == ConversationPhase.ENDED:                    
                    finished_msg = t("messages", "agentDirector.finalMessage","The conversation has finished!")
                    agent_output = AgentOutput(
                        message_for_user=finished_msg,
                        finished=True,
                        agent_type=None,
                        agent_response_time_in_sec=0,
                        llm_stats=[]
                    )
                    return agent_output

                first_call = False
                clean_input: AgentInput = user_input.model_copy()  # make a copy of the user input to avoid modifying the original
                clean_input.message = clean_input.message.strip()  # Remove leading and trailing whitespaces

                # Get the agent to run
                suitable_agent_type = await self.get_suitable_agent_type(
                    user_input=clean_input,
                    phase=self._state.current_phase,
                    context=context)
                self._logger.debug("Running agent: %s", {suitable_agent_type})

                # Track routed agent for sticky routing and observability
                if suitable_agent_type != self._state.last_routed_agent:
                    self._state.last_routed_agent = suitable_agent_type
                    self._state.sticky_turn_counter = 1
                else:
                    self._state.sticky_turn_counter += 1

                # Set agent_type in context for observability logging
                agent_type_ctx_var.set(suitable_agent_type.value if suitable_agent_type else ":none:")
                
                agent_for_task = self._agents[suitable_agent_type]

                # Perform the task
                agent_output = await agent_for_task.execute(clean_input, context)
                
                if not agent_for_task.is_responsible_for_conversation_history():
                    await self._conversation_manager.update_history(clean_input, agent_output)
                    context = await self._conversation_manager.get_conversation_context()

                # Reset sticky state when agent finishes
                if agent_output.finished:
                    self._state.last_routed_agent = None
                    self._state.sticky_turn_counter = 0

                # clear skip_to_phase if the target agent finished
                if agent_output.finished and self._state.skip_to_phase is not None:
                    self._state.skip_to_phase = None
                    self._logger.info("Step-skip: target agent finished, clearing skip_to_phase")

                # Update the conversation phase (and counseling sub-phase when applicable)
                new_phase = self._get_new_phase(agent_output)
                self._logger.debug("Transitioned phase from %s --to-> %s", self._state.current_phase, new_phase)

                transitioned_to_new_phase = self._state.current_phase != new_phase
                if transitioned_to_new_phase:
                    self._state.current_phase = new_phase
                    phase_ctx_var.set(new_phase.value if new_phase else ":none:")

                if (agent_output.finished
                        and agent_output.agent_type == AgentType.EXPLORE_EXPERIENCES_AGENT
                        and self._state.counseling_sub_phase == CounselingSubPhase.PREFERENCE_ELICITATION):
                    transitioned_to_new_phase = True
                    user_input = AgentInput(message="", is_artificial=True)
                elif transitioned_to_new_phase:
                    if get_application_config().inline_phase_transition:
                        transitioned_to_new_phase = False
                    else:
                        user_input = AgentInput(
                            message="(silence)",
                            is_artificial=True
                        )
                
                # Clear agent_type after all operations and logging for this iteration
                # This ensures observability logs capture the agent type throughout execution
                agent_type_ctx_var.set(":none:")

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
