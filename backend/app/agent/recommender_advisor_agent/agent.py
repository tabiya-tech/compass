"""
Recommender/Advisor Agent.

This agent presents occupation, opportunity, and training recommendations
to users, handles their concerns, and motivates them to take concrete action.

Epic 3 implementation - slim orchestrator that delegates to phase handlers.
"""

import time
from typing import Any, Optional
from uuid import uuid4

from app.agent.agent import Agent
from app.agent.agent_types import (
    AgentType,
    AgentInput,
    AgentOutput,
    AgentOutputWithReasoning,
    LLMStats
)
from app.agent.llm_caller import LLMCaller
from app.agent.recommender_advisor_agent.state import RecommenderAdvisorAgentState
from app.agent.recommender_advisor_agent.types import (
    ConversationPhase,
    Node2VecRecommendations,
)
from app.agent.recommender_advisor_agent.llm_response_models import (
    ConversationResponse,
    ResistanceClassification,
    ActionExtractionResult,
    UserIntentClassification,
)
from app.agent.recommender_advisor_agent.recommendation_interface import RecommendationInterface
from app.agent.recommender_advisor_agent.phase_handlers import (
    IntroPhaseHandler,
    PresentPhaseHandler,
    ExplorationPhaseHandler,
    ConcernsPhaseHandler,
    TradeoffsPhaseHandler,
    FollowupPhaseHandler,
    SkillsPivotPhaseHandler,
    ActionPhaseHandler,
    WrapupPhaseHandler,
)
from app.agent.prompt_template.agent_prompt_template import (
    STD_AGENT_CHARACTER,
    STD_LANGUAGE_STYLE
)
from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import (
    LLMConfig,
    LOW_TEMPERATURE_GENERATION_CONFIG,
    MEDIUM_TEMPERATURE_GENERATION_CONFIG,
    JSON_GENERATION_CONFIG
)

# Import PreferenceVector from Epic 2
from app.agent.preference_elicitation_agent.types import PreferenceVector

# Vector search imports for occupation search
from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.similarity_search_service import SimilaritySearchService

# DB6 imports (Epic 1 dependency - optional)
try:
    from app.database_contracts.db6_youth_database.db6_client import DB6Client
    DB6_AVAILABLE = True
except ImportError:
    DB6Client = None
    DB6_AVAILABLE = False


class RecommenderAdvisorAgent(Agent):
    """
    Agent that presents recommendations and motivates users to take action.
    
    Uses a phase-based conversation flow with dedicated handlers:
    - INTRO → PRESENT → EXPLORATION → CONCERNS → ACTION → WRAPUP → COMPLETE
    
    The agent orchestrates between phases, delegating actual handling
    to specialized phase handlers for maintainability.
    """
    
    def __init__(
        self,
        db6_client: Optional['DB6Client'] = None,
        node2vec_client: Optional[Any] = None,
        occupation_search_service: Optional[SimilaritySearchService[OccupationEntity]] = None,
        matching_service: Optional[Any] = None,
    ):
        """
        Initialize the Recommender/Advisor Agent.

        Args:
            db6_client: Optional DB6 client for Epic 1 Youth Database integration.
            node2vec_client: Optional Node2Vec client for generating recommendations (legacy).
            occupation_search_service: Optional occupation search service for finding occupations not in recommendations.
            matching_service: Optional MatchingService (v1 or v2) for deployed matching service.
        """
        super().__init__(
            agent_type=AgentType.RECOMMENDER_ADVISOR_AGENT,
            is_responsible_for_conversation_history=False
        )

        self._state: Optional[RecommenderAdvisorAgentState] = None
        self._db6_client = db6_client
        self._occupation_search_service = occupation_search_service

        # Initialize LLM
        llm_config = LLMConfig(
            # generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
            generation_config=MEDIUM_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
        )

        conversation_system_instructions = self._build_conversation_system_instructions()
        self._conversation_llm = GeminiGenerativeLLM(
            system_instructions=conversation_system_instructions,
            config=llm_config
        )

        # Initialize LLM callers
        self._conversation_caller: LLMCaller[ConversationResponse] = LLMCaller[ConversationResponse](
            model_response_type=ConversationResponse
        )
        self._resistance_caller: LLMCaller[ResistanceClassification] = LLMCaller[ResistanceClassification](
            model_response_type=ResistanceClassification
        )
        self._action_caller: LLMCaller[ActionExtractionResult] = LLMCaller[ActionExtractionResult](
            model_response_type=ActionExtractionResult
        )
        self._intent_caller: LLMCaller[UserIntentClassification] = LLMCaller[UserIntentClassification](
            model_response_type=UserIntentClassification
        )

        # Initialize IntentClassifier (centralized intent classification)
        from app.agent.recommender_advisor_agent.intent_classifier import IntentClassifier
        self._intent_classifier = IntentClassifier(intent_caller=self._intent_caller)

        # Initialize recommendation interface with matching service
        self._recommendation_interface = RecommendationInterface(
            matching_service=matching_service,
            node2vec_client=node2vec_client  # Keep for backwards compatibility
        )

        # Initialize phase handlers
        self._init_phase_handlers()
    
    def _init_phase_handlers(self) -> None:
        """Initialize all phase handlers."""
        self._intro_handler = IntroPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            recommendation_interface=self._recommendation_interface,
            occupation_search_service=self._occupation_search_service,
            logger=self.logger
        )

        # Initialize action handler first (needed by concerns handler)
        self._action_handler = ActionPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            action_caller=self._action_caller,
            intent_classifier=self._intent_classifier,
            logger=self.logger
        )

        # Initialize concerns handler (depends on action_handler)
        self._concerns_handler = ConcernsPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            resistance_caller=self._resistance_caller,
            intent_classifier=self._intent_classifier,
            action_handler=self._action_handler,
            recommendation_interface=self._recommendation_interface,
            occupation_search_service=self._occupation_search_service,
            logger=self.logger
        )

        self._tradeoffs_handler = TradeoffsPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            logger=self.logger
        )

        # Initialize exploration handler with delegation targets (constructor injection)
        self._exploration_handler = ExplorationPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            intent_classifier=self._intent_classifier,
            concerns_handler=self._concerns_handler,
            action_handler=self._action_handler,
            tradeoffs_handler=self._tradeoffs_handler,
            occupation_search_service=self._occupation_search_service,
            logger=self.logger
        )

        # Initialize present handler with delegation targets (constructor injection)
        self._present_handler = PresentPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            intent_classifier=self._intent_classifier,
            exploration_handler=self._exploration_handler,
            concerns_handler=self._concerns_handler,
            tradeoffs_handler=self._tradeoffs_handler,
            occupation_search_service=self._occupation_search_service,
            logger=self.logger
        )

        self._followup_handler = FollowupPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            intent_classifier=self._intent_classifier,
            logger=self.logger
        )
        
        self._skills_pivot_handler = SkillsPivotPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            intent_classifier=self._intent_classifier,
            exploration_handler=self._exploration_handler,
            concerns_handler=self._concerns_handler,
            action_planning_handler=self._action_handler,
            present_handler=self._present_handler,
            logger=self.logger
        )

        self._wrapup_handler = WrapupPhaseHandler(
            conversation_llm=self._conversation_llm,
            conversation_caller=self._conversation_caller,
            db6_client=self._db6_client,
            logger=self.logger
        )

        # Remaining delegation
        self._present_handler._skills_pivot_handler = self._skills_pivot_handler
        self._exploration_handler._skills_pivot_handler = self._skills_pivot_handler
        self._action_handler._present_handler = self._present_handler
        self._action_handler._concerns_handler = self._concerns_handler
        self._action_handler._wrapup_handler = self._wrapup_handler

    
    def _build_conversation_system_instructions(self) -> str:
        """Build system instructions for the conversation LLM."""
        return f"""
            {STD_AGENT_CHARACTER}

            You are a career advisor helping young people explore occupation recommendations.
            Your goal is to motivate users to take concrete action - applying for jobs, enrolling
            in training, or actively exploring career paths.

            {STD_LANGUAGE_STYLE}

            ## HARD RULES (NON-NEGOTIABLE):

            ### What NOT to say:
            - "You will enjoy this" (manipulative - you can't predict enjoyment)
            - "This fits who you are" (identity claim without basis)
            - "You're perfect for this" (overpromising)
            - "Trust me" (appeals to authority)

            ### Better alternatives:
            - "Many people discover they enjoy X after trying it"
            - "This path keeps future options open"
            - "Your skills align well - you'd have a strong foundation"
            - "Based on what you shared, this matches your priorities"

            ### Response Format:
            Always respond with valid JSON matching the ConversationResponse schema.
        """
    
    def set_state(self, state: RecommenderAdvisorAgentState) -> None:
        """Set the agent state."""
        self._state = state
    
    def create_initial_state(
        self,
        youth_id: str,
        country_of_user: 'Country',
        city: Optional[str] = None,
        province: Optional[str] = None,
        preference_vector: Optional[PreferenceVector] = None,
        skills_vector: Optional[dict] = None,
        bws_scores: Optional[dict[str, float]] = None,
        top_10_bws: Optional[list[str]] = None,
        recommendations: Optional[Node2VecRecommendations] = None,
    ) -> RecommenderAdvisorAgentState:
        """
        Create initial state for a new recommender session.

        Args:
            youth_id: User/youth identifier
            country_of_user: Country of the user for localization
            city: User's city (required by matching service)
            province: User's province/state (required by matching service)
            preference_vector: Preference vector from Epic 2
            skills_vector: Skills vector from Epic 4
            bws_scores: BWS ranking from Epic 2
            top_10_bws: HB-ranked WA_Element_IDs forwarded to matching service
            recommendations: Pre-generated Node2Vec recommendations (optional)

        Returns:
            Initialized RecommenderAdvisorAgentState
        """
        session_id = uuid4().int & ((1 << 48) - 1)
        return RecommenderAdvisorAgentState(
            session_id=session_id,
            youth_id=youth_id,
            country_of_user=country_of_user,
            city=city,
            province=province,
            preference_vector=preference_vector,
            skills_vector=skills_vector,
            bws_scores=bws_scores,
            top_10_bws=top_10_bws,
            recommendations=recommendations,
        )
    
    async def execute(
        self,
        user_input: AgentInput,
        context: ConversationContext
    ) -> AgentOutput:
        """
        Execute the recommender/advisor conversation.
        
        Routes to the appropriate phase handler based on current state.
        """
        agent_start_time = time.time()
        
        if self._state is None:
            self.logger.error("State not set for RecommenderAdvisorAgent")
            return self._create_error_response(agent_start_time)
        
        # Increment turn count
        self._state.increment_turn_count()

        # Simple flow: when discuss_recommendations=False, skip the multi-phase
        # conversation and return a single structured message with careers and jobs.
        if not self._state.discuss_recommendations:
            try:
                return await self._execute_simple_flow(agent_start_time)
            except Exception as e:
                self.logger.exception("Error in recommender simple flow: %s", str(e))
                return self._create_error_response(agent_start_time)

        # Handle empty input
        msg = user_input.message.strip() if user_input.message else "(silence)"

        # Route to appropriate phase handler
        try:
            response, llm_stats = await self._route_to_handler(msg, context)
        except Exception as e:
            self.logger.exception("Error in recommender advisor agent: %s", str(e))
            return self._create_error_response(agent_start_time)

        # Only trust finished=True from the COMPLETE phase — all other phases must not terminate
        if response.finished and self._state.conversation_phase != ConversationPhase.COMPLETE:
            response.finished = False

        # Create output
        return AgentOutputWithReasoning(
            message_for_user=response.message.strip('"'),
            finished=response.finished,
            reasoning=response.reasoning,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
            llm_stats=llm_stats
        )
    
    async def _route_to_handler(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """Route to the appropriate phase handler."""
        phase = self._state.conversation_phase
        
        if phase == ConversationPhase.INTRO:
            return await self._intro_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.PRESENT_RECOMMENDATIONS:
            return await self._present_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.CAREER_EXPLORATION:
            return await self._exploration_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.ADDRESS_CONCERNS:
            return await self._concerns_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.DISCUSS_TRADEOFFS:
            return await self._tradeoffs_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.FOLLOW_UP:
            return await self._followup_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.SKILLS_UPGRADE_PIVOT:
            return await self._skills_pivot_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.ACTION_PLANNING:
            return await self._action_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.WRAPUP:
            return await self._wrapup_handler.handle(user_input, self._state, context)
        
        elif phase == ConversationPhase.COMPLETE:
            return await self._wrapup_handler.handle_complete(user_input, self._state, context)
        
        else:
            self.logger.error(f"Unknown phase: {phase}")
            return ConversationResponse(
                reasoning=f"Unknown phase: {phase}",
                message="I seem to have lost track. Let me show you the recommendations again.",
                finished=False
            ), []
    
    async def _execute_simple_flow(self, agent_start_time: float) -> AgentOutput:
        """
        Simple flow for users with discuss_recommendations=False.

        Fetches recommendations (or reuses already-loaded ones), then uses the LLM to
        present career opportunities (title + description) and job opportunities
        (title + description + application URL) in a clear, friendly format.
        Marks the session as finished after a single message.
        """
        # On re-engagement (already presented once): refresh with unseen recommendations
        if self._state.presented_occupations:
            seen_uuids: set[str] = set(self._state.presented_occupations)
            fresh = await self._recommendation_interface.generate_recommendations(
                youth_id=self._state.youth_id,
                city=self._state.city,
                province=self._state.province,
                preference_vector=self._state.preference_vector,
                skills_vector=self._state.skills_vector,
                bws_scores=self._state.bws_scores,
                top_10_bws=self._state.top_10_bws,
                education_experiences=self._state.education_experiences,
            )
            new_occs = [o for o in fresh.occupation_recommendations if o.uuid not in seen_uuids]
            new_jobs = [j for j in fresh.opportunity_recommendations if j.uuid not in seen_uuids]
            if not new_occs and not new_jobs:
                return AgentOutputWithReasoning(
                    message_for_user=(
                        "I've searched again but don't have new matches for you right now. "
                        "The job database refreshes daily — check back tomorrow."
                    ),
                    finished=False,
                    reasoning="Simple flow refresh: no new recommendations after filtering seen items.",
                    agent_type=self.agent_type,
                    agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
                    llm_stats=[],
                )
            fresh.occupation_recommendations = new_occs
            fresh.opportunity_recommendations = new_jobs
            self._state.recommendations = fresh

        # First call: fetch recommendations if not yet loaded
        elif self._state.recommendations is None:
            self._state.recommendations = await self._recommendation_interface.generate_recommendations(
                youth_id=self._state.youth_id,
                city=self._state.city,
                province=self._state.province,
                preference_vector=self._state.preference_vector,
                skills_vector=self._state.skills_vector,
                bws_scores=self._state.bws_scores,
                education_experiences=self._state.education_experiences,
                top_10_bws=self._state.top_10_bws,
            )
            self.logger.info(
                "Simple flow: generated recommendations for %s: %d occupations, %d opportunities",
                self._state.youth_id,
                len(self._state.recommendations.occupation_recommendations),
                len(self._state.recommendations.opportunity_recommendations),
            )

        recs = self._state.recommendations

        # Build structured data block for the LLM to present
        career_lines: list[str] = []
        for i, occ in enumerate(recs.occupation_recommendations, start=1):
            career_lines.append(f"{i}. {occ.occupation}")
            if occ.description:
                career_lines.append(f"   Description: {occ.description}")

        job_lines: list[str] = []
        for i, job in enumerate(recs.opportunity_recommendations, start=1):
            job_lines.append(f"{i}. {job.opportunity_title}")
            if job.employer:
                job_lines.append(f"   Employer: {job.employer}")
            if job.location:
                job_lines.append(f"   Location: {job.location}")
            if job.salary_range:
                job_lines.append(f"   Salary: {job.salary_range}")
            if job.justification:
                job_lines.append(f"   Why it matches you: {job.justification}")
            if job.application_deadline:
                job_lines.append(f"   Closing date: {job.application_deadline}")
            if job.posting_url:
                job_lines.append(f"   Apply here: {job.posting_url}")

        # Record presented occupation UUIDs so re-engagement can filter them out
        for occ in recs.occupation_recommendations:
            if occ.uuid not in self._state.presented_occupations:
                self._state.presented_occupations.append(occ.uuid)

        careers_block = "\n".join(career_lines) if career_lines else "No career recommendations available."
        jobs_block = "\n".join(job_lines) if job_lines else "No job opportunities available."

        prompt = f"""You are a career advisor presenting personalised recommendations to a job seeker.
Present the following career and job recommendations clearly and encouragingly.
Do NOT add any extra recommendations, scores, or information beyond what is provided.

CAREER OPPORTUNITIES (show title and description only):
{careers_block}

JOB OPPORTUNITIES (show each field that is available: title, employer, location, salary, why it matches, closing date, and application link):
{jobs_block}

Write a warm, clear message that:
1. Opens with a brief one-sentence introduction
2. Lists each career opportunity with its title and description
3. Lists each job opportunity showing all available fields (employer, location, salary, why it matches you, closing date, and the application link labelled "Apply here:")
4. Closes with two sentences: one encouraging sentence, then a second sentence letting the user know they can come back any day to ask for new job opportunities as the listings refresh regularly

Respond in JSON with this exact shape:
{{
  "reasoning": "<brief note on how you presented the data>",
  "message": "<the full formatted message for the user>",
  "finished": false
}}"""

        response, llm_stats = await self._conversation_caller.call_llm(
            llm=self._conversation_llm,
            llm_input=prompt,
            logger=self.logger,
        )

        if response is None:
            # LLM failed after retries — fall back to plain text
            self.logger.error("Simple flow: LLM failed to respond, falling back to plain text.")
            plain = f"Here are your personalised recommendations:\n\n**Career Opportunities**\n{careers_block}\n\n**Job Opportunities**\n{jobs_block}"
            return AgentOutputWithReasoning(
                message_for_user=plain,
                finished=False,
                reasoning="Simple flow: LLM unavailable, returned plain text fallback.",
                agent_type=self.agent_type,
                agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
                llm_stats=llm_stats,
            )

        return AgentOutputWithReasoning(
            message_for_user=response.message.strip('"'),
            finished=False,
            reasoning="Simple flow: LLM presented career and job recommendations without multi-phase discussion.",
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
            llm_stats=llm_stats,
        )

    def _create_error_response(self, start_time: float) -> AgentOutput:
        """Create an error response."""
        return AgentOutput(
            message_for_user="I apologize, but I encountered an issue. Let's try again.",
            finished=False,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(time.time() - start_time, 2),
            llm_stats=[]
        )
