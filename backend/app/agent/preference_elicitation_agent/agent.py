"""
Preference Elicitation Agent.

This agent conducts a conversational preference elicitation process
using vignettes and experience-based questions to build a structured
preference vector for job/career recommendations.
"""

import time
import logging
from typing import Optional
from datetime import datetime, timezone
import asyncio

from pydantic import BaseModel, Field

from app.agent.agent import Agent
from app.agent.agent_types import (
    AgentType,
    AgentInput,
    AgentOutput,
    AgentOutputWithReasoning,
    LLMStats
)
from app.agent.llm_caller import LLMCaller
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.types import (
    Vignette,
    VignetteResponse,
    PreferenceVector,
    UserContext
)
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.preference_extractor import (
    PreferenceExtractor,
    PreferenceExtractionResult,
    ExperiencePreferenceExtractor,
    ExperiencePreferenceExtractionResult
)
from app.agent.preference_elicitation_agent.user_context_extractor import UserContextExtractor
from app.agent.prompt_template.agent_prompt_template import (
    STD_AGENT_CHARACTER,
    STD_LANGUAGE_STYLE
)
from app.agent.simple_llm_agent.prompt_response_template import get_json_response_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationContext
from app.agent.experience.experience_entity import ExperienceEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import (
    LLMConfig,
    LOW_TEMPERATURE_GENERATION_CONFIG,
    JSON_GENERATION_CONFIG
)

# DB6 imports (Epic 1 dependency - optional)
try:
    from app.epic1.db6_youth_database.db6_client import DB6Client, YouthProfile
except ImportError:
    # Epic 1 not available yet, 
    DB6Client = None
    YouthProfile = None


class ConversationResponse(BaseModel):
    """
    Response model for the conversation LLM.

    Handles presenting vignettes and responding to user input
    in a natural, conversational way.
    """
    reasoning: str
    """Chain of thought reasoning about the response"""

    message: str
    """Message to present to the user"""

    finished: bool
    """Whether the preference elicitation is complete"""

    class Config:
        extra = "forbid"


class PreferenceSummaryGenerator(BaseModel):
    """
    LLM response model for generating preference summary.

    Generates natural, conversational bullet points summarizing
    the user's key job preferences from their preference vector.
    """
    reasoning: str = Field(
        description="Brief reasoning about what stands out in their preferences"
    )

    finished: bool = Field(
        description="Always set to True when summary is generated"
    )

    message: str = Field(
        description="Summary of user's preferences as formatted bullet points (use • for bullets)"
    )

    class Config:
        extra = "forbid"


class PreferenceElicitationAgent(Agent):
    """
    Agent that elicits user preferences through vignettes and conversation.

    Conducts a multi-phase conversation:
    1. INTRO: Explain the process and set expectations
    2. EXPERIENCE_QUESTIONS: Ask about past work experiences
    3. VIGNETTES: Present vignette scenarios for preference discovery
    4. FOLLOW_UP: Ask clarifying questions
    5. WRAPUP: Summarize preferences and confirm
    6. COMPLETE: Finish the session

    Builds a comprehensive PreferenceVector that can be used
    for job/career recommendations.
    """

    def __init__(
        self,
        vignettes_config_path: Optional[str] = None,
        db6_client: Optional['DB6Client'] = None,
        use_personalized_vignettes: bool = True
    ):
        """
        Initialize the Preference Elicitation Agent.

        Args:
            vignettes_config_path: Optional path to vignettes config file (for static vignettes)
            db6_client: Optional DB6 client for Epic 1 Youth Database integration.
                       If None, agent works without DB6 (uses snapshot only).
                       If provided, agent can fetch fresh experiences and save preferences.
            use_personalized_vignettes: Whether to use personalized vignette generation (default: True)
        """
        super().__init__(
            agent_type=AgentType.PREFERENCE_ELICITATION_AGENT,
            is_responsible_for_conversation_history=False
        )

        self._state: Optional[PreferenceElicitationAgentState] = None
        self._db6_client = db6_client  # Optional Epic 1 dependency
        self._user_context: Optional[UserContext] = None

        # Initialize LLMs
        llm_config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
        )

        # Conversation LLM for natural dialogue
        conversation_system_instructions = self._build_conversation_system_instructions()
        self._conversation_llm = GeminiGenerativeLLM(
            system_instructions=conversation_system_instructions,
            config=llm_config
        )
        self._conversation_caller: LLMCaller[ConversationResponse] = LLMCaller[ConversationResponse](
            model_response_type=ConversationResponse
        )

        # Shared LLM for vignette personalization and context extraction
        self._shared_llm = GeminiGenerativeLLM(config=llm_config)

        # Initialize vignette engine with personalization support
        self._vignette_engine = VignetteEngine(
            llm=self._shared_llm if use_personalized_vignettes else None,
            vignettes_config_path=vignettes_config_path,
            use_personalization=use_personalized_vignettes
        )

        # User context extractor
        self._context_extractor = UserContextExtractor(llm=self._shared_llm)

        # Preference extractors (create their own LLMs with system instructions)
        self._preference_extractor = PreferenceExtractor()
        self._experience_preference_extractor = ExperiencePreferenceExtractor()

    def set_state(self, state: PreferenceElicitationAgentState) -> None:
        """
        Set the agent state.

        Args:
            state: PreferenceElicitationAgentState to use
        """
        self._state = state

    async def _prewarm_next_vignette(self) -> None:
        """
        Pre-generate the next vignette in the background to reduce perceived latency.

        This is called as a background task during INTRO/EXPERIENCE_QUESTIONS phases
        so the vignette is ready when the user transitions to VIGNETTES phase.

        The generated vignette is added to the engine's queue and will be retrieved
        automatically when select_next_vignette() is called during the VIGNETTES phase.
        """
        if self._state is None or self._user_context is None:
            return

        # Only pre-warm for personalized vignettes
        if not self._vignette_engine._use_personalization:
            return

        try:
            # Only pre-warm if queue is empty
            if self._vignette_engine._vignette_queue:
                self.logger.debug("Vignette queue not empty, skipping pre-warm")
                return

            next_category = self._state.get_next_category_to_explore()
            if next_category:
                # Double-check category not already covered (race condition protection)
                if next_category in self._state.categories_covered:
                    self.logger.debug(f"Category '{next_category}' already covered, skipping pre-warm")
                    return

                self.logger.info(f"Pre-warming vignette for category: {next_category}")

                # Get templates for next category
                templates = self._vignette_engine._personalizer.get_templates_by_category(next_category)
                if not templates:
                    return

                # Generate vignette directly using personalizer (bypass select_next_vignette to avoid state changes)
                from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer

                # Select template: avoid recently used templates (same logic as vignette_engine)
                used_template_ids = [
                    resp.vignette_id.rsplit('_', 1)[0]  # Extract template_id from vignette_id
                    for resp in self._state.vignette_responses[-3:]  # Last 3 responses
                ]

                # Find first unused template, or use first if all used
                template = templates[0]
                for t in templates:
                    if t.template_id not in used_template_ids:
                        template = t
                        break
                previous_scenarios = []
                for resp in self._state.vignette_responses:
                    prev_vignette = self._vignette_engine.get_vignette_by_id(resp.vignette_id)
                    if prev_vignette:
                        scenario_summary = f"{prev_vignette.scenario_text} Options: {', '.join(opt.title for opt in prev_vignette.options)}"
                        previous_scenarios.append(scenario_summary)

                personalized = await self._vignette_engine._personalizer.personalize_vignette(
                    template=template,
                    user_context=self._user_context,
                    previous_vignettes=previous_scenarios
                )

                # Cache and queue the vignette
                self._vignette_engine._vignettes_by_id[personalized.vignette.vignette_id] = personalized.vignette
                self._vignette_engine._vignette_queue.append(personalized.vignette)

                self.logger.info(f"Pre-warmed vignette {personalized.vignette.vignette_id}")
        except Exception as e:
            # Don't fail the conversation if pre-warming fails
            self.logger.warning(f"Failed to pre-warm vignette: {e}")

    async def _extract_user_context(self) -> None:
        """
        Extract user context from experiences.

        Called at the start of the conversation to personalize vignettes.
        """
        if self._state is None:
            return

        experiences = self._state.initial_experiences_snapshot
        self._user_context = await self._context_extractor.extract_context(experiences)
        self.logger.info(
            f"Extracted user context: role={self._user_context.current_role}, "
            f"industry={self._user_context.industry}, level={self._user_context.experience_level}"
        )

    async def execute(
        self,
        user_input: AgentInput,
        context: ConversationContext
    ) -> AgentOutput:
        """
        Execute the preference elicitation conversation.

        Args:
            user_input: Input from the user
            context: Conversation context

        Returns:
            Agent output with response message
        """
        agent_start_time = time.time()

        if self._state is None:
            self.logger.error("State not set for PreferenceElicitationAgent")
            return self._create_error_response(agent_start_time)

        # Increment turn count
        self._state.increment_turn_count()

        # Handle empty input
        if user_input.message == "":
            user_input.message = "(silence)"
            user_input.is_artificial = True

        msg = user_input.message.strip()

        # Execute based on current phase
        try:
            if self._state.conversation_phase == "INTRO":
                response, llm_stats = await self._handle_intro_phase(msg, context)
            elif self._state.conversation_phase == "EXPERIENCE_QUESTIONS":
                response, llm_stats = await self._handle_experience_questions_phase(msg, context)
            elif self._state.conversation_phase == "VIGNETTES":
                response, llm_stats = await self._handle_vignettes_phase(msg, context)
            elif self._state.conversation_phase == "FOLLOW_UP":
                response, llm_stats = await self._handle_follow_up_phase(msg, context)
            elif self._state.conversation_phase == "WRAPUP":
                response, llm_stats = await self._handle_wrapup_phase(msg, context)
            elif self._state.conversation_phase == "COMPLETE":
                response, llm_stats = await self._handle_complete_phase(msg, context)
            else:
                self.logger.error(f"Unknown phase: {self._state.conversation_phase}")
                return self._create_error_response(agent_start_time)

        except Exception as e:
            self.logger.exception("Error in preference elicitation agent: %s", str(e))
            return self._create_error_response(agent_start_time)

        # Create output
        agent_end_time = time.time()
        output = AgentOutputWithReasoning(
            message_for_user=response.message.strip('"'),
            finished=response.finished,
            reasoning=response.reasoning,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats
        )

        return output

    async def _get_experiences_for_questions(self) -> Optional[list[ExperienceEntity]]:
        """
        Get experiences for experience-based questions with graceful fallback logic.

        Priority:
        1. Try DB6 if enabled and available (fresh data)
        2. Fall back to snapshot (consistent data)
        3. Return None if no data available

        Returns:
            List of ExperienceEntity or None if no experiences available
        """
        # Try DB6 if enabled
        if self._state.use_db6_for_fresh_data and self._db6_client:
            try:
                youth_id = str(self._state.session_id)
                profile = await self._db6_client.get_youth_profile(youth_id)

                if profile and profile.past_experiences:
                    self.logger.debug(
                        f"Fetched {len(profile.past_experiences)} experiences from DB6 for youth {youth_id}"
                    )
                    return profile.past_experiences
                else:
                    self.logger.debug(f"No experiences in DB6 for youth {youth_id}, using snapshot")

            except Exception as e:
                # DB6 unavailable or error - graceful degradation
                self.logger.warning(f"DB6 fetch failed, using snapshot: {e}")

        # Fallback to snapshot
        return self._state.initial_experiences_snapshot

    async def _save_preference_vector_to_db6(self) -> None:
        """
        Save completed preference vector to DB6 (Epic 1 Youth Database).

        Called at the end of preference elicitation (WRAPUP phase).
        If DB6 is not available, logs a warning but does not fail the conversation.
        """
        if not self._db6_client:
            self.logger.info("DB6 client not available, skipping preference vector save")
            return

        if not YouthProfile:
            self.logger.warning("YouthProfile not available (Epic 1 not integrated), skipping save")
            return

        try:
            youth_id = str(self._state.session_id)

            # Fetch existing profile or create new
            profile = await self._db6_client.get_youth_profile(youth_id)
            if not profile:
                self.logger.info(f"Creating new youth profile for {youth_id}")
                profile = YouthProfile(youth_id=youth_id)

            # Update preference vector
            profile.preference_vector = self._state.preference_vector
            profile.updated_at = datetime.now(timezone.utc)

            # Add interaction history entry
            profile.interaction_history.append({
                "agent": "PreferenceElicitationAgent",
                "action": "preference_elicitation_completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "vignettes_completed": len(self._state.completed_vignettes),
                "confidence_score": self._state.preference_vector.confidence_score,
                "categories_covered": self._state.categories_covered
            })

            # Save to DB6
            await self._db6_client.save_youth_profile(profile)
            self.logger.info(
                f"Saved preference vector to DB6 for youth {youth_id} "
                f"(confidence: {self._state.preference_vector.confidence_score:.2f})"
            )

        except Exception as e:
            # Don't fail the conversation - just log the error
            self.logger.error(f"Failed to save preference vector to DB6: {e}", exc_info=True)

    async def _handle_intro_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle the introduction phase.

        Explains the preference elicitation process and transitions
        to experience questions.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        # Check if this is the first turn
        if self._state.conversation_turn_count <= 1:
            # Provide introduction
            intro_message = """Let me help you understand what kind of work would be a good fit for you!

            I'm going to ask you about different job scenarios - there are no right or wrong answers. I just want to understand what matters most to YOU in a job.

            We'll look at things like salary, work environment, job security, career growth, and work-life balance. This will help me suggest opportunities that match what you're really looking for.

            Ready to start? I'll begin by asking about any work experience you've had."""

            response = ConversationResponse(
                reasoning="Introducing the preference elicitation process",
                message=intro_message,
                finished=False
            )

            # Extract user context for personalization
            await self._extract_user_context()

            # Pre-warm: Generate first vignette in background
            # This reduces perceived latency when transitioning to VIGNETTES phase
            asyncio.create_task(self._prewarm_next_vignette())

            # Move to experience questions phase
            self._state.conversation_phase = "EXPERIENCE_QUESTIONS"

            return response, []

        # If user has responded, move to experience questions
        self._state.conversation_phase = "EXPERIENCE_QUESTIONS"
        return await self._handle_experience_questions_phase(user_input, context)

    async def _handle_experience_questions_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle the experience-based questions phase.

        Asks reflective questions about past work experiences to extract preference signals.
        This is DIFFERENT from skills exploration - we're asking what they ENJOYED/VALUED,
        not what they DID.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        all_llm_stats: list[LLMStats] = []
        previous_experience_question = self._state.last_experience_question_asked

        # If there was a previous experience question, extract preferences from the response
        if previous_experience_question and user_input.strip():
            await self._extract_and_store_experience_preferences(
                question_asked=previous_experience_question,
                user_response=user_input,
                all_llm_stats=all_llm_stats
            )

        # After 2-3 turns of experience questions, move to vignettes
        if self._state.conversation_turn_count >= 4:
            self._state.conversation_phase = "VIGNETTES"
            return await self._handle_vignettes_phase(user_input, context)

        # Get experiences (from DB6 or snapshot)
        experiences = await self._get_experiences_for_questions()

        # Build prompt based on whether we have prior experience data
        if experiences and len(experiences) > 0:
            # Reference specific experiences they've shared
            exp_summaries = []
            for exp in experiences[:3]:  # Use first 3 experiences
                summary = ExperienceEntity.get_structured_summary(
                    experience_title=exp.experience_title,
                    work_type=exp.work_type,
                    company=exp.company,
                    location=exp.location,
                    start_date=exp.timeline.start if exp.timeline else None,
                    end_date=exp.timeline.end if exp.timeline else None
                )
                exp_summaries.append(summary)

            previous_question_context = f"""
                When constructing the question, keep in mind the previous question asked and DO NOT repeat it.
                <previous_experience_question>
                {previous_experience_question}
                </previous_experience_question>
                """ if previous_experience_question else ""

            prompt = f"""The user previously shared these work experiences:
                {chr(10).join(f'- {s}' for s in exp_summaries)}

                # GUIDELINES
                - Ask them a REFLECTIVE question about what they ENJOYED or DISLIKED about these specific experiences.
                - Focus on understanding their PREFERENCES, not their responsibilities.
                {previous_question_context}
                Examples:
                - "You mentioned working as {experiences[0].experience_title}. What aspects of that work did you find most satisfying?"
                - "What frustrated you most about the {experiences[0].experience_title} role?"
                - "Comparing your work at {experiences[0].company} and {experiences[1].company if len(experiences) > 1 else 'your other experiences'}, which did you prefer and why?"

                Keep it conversational and natural. One question at a time."""
        else:
            # Generic experience questions (no prior data)
            prompt = """Ask a reflective question about past work or school tasks they enjoyed.
                Focus on understanding what made those experiences satisfying or frustrating.

                Examples:
                - "Tell me about a work task you really enjoyed - what made it satisfying?"
                - "Have you ever chosen a lower-paying job for another reason? What was it?"
                - "Was there a job where the hours felt just right? What were they like?"

                Keep it conversational and natural. One question at a time."""

        # Combine the experience-based prompt with JSON instructions
        combined_instructions = f"""{prompt}
            {get_json_response_instructions()}
        """

        response, llm_stats = await self._conversation_caller.call_llm(
            llm=self._conversation_llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=combined_instructions,
                context=context,
                user_input=user_input
            ),
            logger=self.logger
        )
        all_llm_stats.extend(llm_stats)

        # Pre-warm next vignette after 2nd experience question
        # User will answer ~2-3 more questions before seeing vignettes
        if self._state.conversation_turn_count == 2:
            asyncio.create_task(self._prewarm_next_vignette())

        if response is None:
            # Fallback question
            fallback_msg = (
                "Tell me about a work task you really enjoyed - what made it satisfying?"
                if not experiences
                else f"You mentioned working as {experiences[0].experience_title}. What did you enjoy most about that work?"
            )
            response = ConversationResponse(
                reasoning="Failed to get LLM response, using fallback",
                message=fallback_msg,
                finished=False
            )

        # Store the question being asked for next turn's extraction
        self._state.last_experience_question_asked = response.message

        return response, all_llm_stats

    async def _handle_vignettes_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle the vignettes phase.

        Presents vignette scenarios and extracts preferences from responses.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        all_llm_stats: list[LLMStats] = []

        # If there's a current vignette, extract preferences from response
        if self._state.current_vignette_id:
            vignette = self._vignette_engine.get_vignette_by_id(
                self._state.current_vignette_id
            )

            if vignette:
                # Build conversation history context for extraction
                conversation_history = self._build_conversation_history_for_extraction(context)

                # Extract preferences from user's response
                extraction_result, extraction_stats = await self._preference_extractor.extract_preferences(
                    vignette=vignette,
                    user_response=user_input,
                    current_preference_vector=self._state.preference_vector,
                    conversation_history=conversation_history
                )
                all_llm_stats.extend(extraction_stats)

                # Create vignette response record
                vignette_response = VignetteResponse(
                    vignette_id=vignette.vignette_id,
                    chosen_option_id=extraction_result.chosen_option_id,
                    user_reasoning=user_input,
                    extracted_preferences=extraction_result.inferred_preferences,
                    confidence=extraction_result.confidence
                )

                # Update state
                self._state.add_vignette_response(vignette_response)

                # Update preference vector
                self._state.preference_vector = self._preference_extractor.update_preference_vector(
                    self._state.preference_vector,
                    extraction_result
                )

                # Mark category as covered if confidence is high
                if extraction_result.confidence > 0.6:
                    self.logger.info(
                        f"✅ Marking category '{vignette.category}' as covered "
                        f"(confidence: {extraction_result.confidence:.2f}, vignette: {vignette.vignette_id})"
                    )
                    self._state.mark_category_covered(vignette.category)
                else:
                    self.logger.warning(
                        f"⚠️  NOT marking category '{vignette.category}' as covered - confidence too low "
                        f"(confidence: {extraction_result.confidence:.2f}, threshold: 0.6, vignette: {vignette.vignette_id})"
                    )

                # Check if we should ask follow-up BEFORE moving to next vignette
                if self._should_ask_follow_up(vignette_response):
                    # Generate follow-up question
                    self.logger.info(f"Generating follow-up for vignette {vignette_response.vignette_id}")

                    # Generate follow-up (no parallel pre-warming to avoid rate limits)
                    follow_up_message = await self._generate_contextual_follow_up(
                        vignette_response=vignette_response,
                        extraction_result=extraction_result,
                        context=context
                    )

                    # Transition to follow-up phase
                    self._state.conversation_phase = "FOLLOW_UP"

                    response = ConversationResponse(
                        reasoning=f"Asking follow-up for low-confidence extraction (confidence: {extraction_result.confidence:.2f})",
                        message=follow_up_message,
                        finished=False
                    )

                    return response, all_llm_stats

        # Pre-warm next vignette while user is thinking (background task)
        asyncio.create_task(self._prewarm_next_vignette())

        # Check if we can complete
        if self._state.can_complete() and len(self._state.completed_vignettes) >= 6:
            self._state.conversation_phase = "WRAPUP"
            return await self._handle_wrapup_phase(user_input, context)

        # Log current state before selecting next vignette
        self.logger.info(
            f"\nVignette Selection State:\n"
            f"  - Completed vignettes: {len(self._state.completed_vignettes)}\n"
            f"  - Categories covered: {self._state.categories_covered}\n"
            f"  - Categories to explore: {self._state.categories_to_explore}\n"
            f"  - Current preference vector confidence: {self._state.preference_vector.confidence_score:.2f}"
        )
        
        # Select next vignette (with user context for personalization)
        next_vignette = await self._vignette_engine.select_next_vignette(
            self._state,
            user_context=self._user_context
        )

        if next_vignette is None:
            # No more vignettes, move to wrapup
            self._state.conversation_phase = "WRAPUP"
            return await self._handle_wrapup_phase(user_input, context)

        # Update state with new vignette
        self._state.current_vignette_id = next_vignette.vignette_id

        # Log selected vignette details
        self.logger.info(
            f"🎯 Selected vignette:\n"
            f"  - ID: {next_vignette.vignette_id}\n"
            f"  - Category: {next_vignette.category}\n"
            f"  - Scenario: {next_vignette.scenario_text[:100]}..."
        )

        # Present the vignette
        vignette_message = self._format_vignette_message(next_vignette)

        response = ConversationResponse(
            reasoning=f"Presenting vignette {next_vignette.vignette_id} for category {next_vignette.category}",
            message=vignette_message,
            finished=False
        )

        return response, all_llm_stats

    def _should_ask_follow_up(self, vignette_response: VignetteResponse) -> bool:
        """
        Decide if we should ask a follow-up question.

        Triggers:
        - Low extraction confidence (<0.7)
        - Haven't asked follow-up for this vignette yet
        - User gave very short response (<15 words)

        Args:
            vignette_response: The vignette response to evaluate

        Returns:
            True if follow-up should be asked
        """
        # Already asked follow-up for this vignette?
        if vignette_response.vignette_id in self._state.follow_ups_asked:
            return False

        # Low confidence extraction?
        if vignette_response.confidence < 0.7:
            self.logger.info(
                f"Follow-up needed for vignette {vignette_response.vignette_id} "
                f"(confidence: {vignette_response.confidence:.2f})"
            )
            return True

        # Very short response (likely needs clarification)
        word_count = len(vignette_response.user_reasoning.split())
        if word_count < 15:
            self.logger.info(
                f"Follow-up needed for vignette {vignette_response.vignette_id} "
                f"(word count: {word_count})"
            )
            return True

        return False

    async def _generate_contextual_follow_up(
        self,
        vignette_response: VignetteResponse,
        extraction_result: PreferenceExtractionResult,
        context: ConversationContext
    ) -> str:
        """
        Generate a contextual follow-up based on the vignette and user's response.

        Uses the suggested_follow_up from extraction result if available,
        otherwise generates one using the conversation LLM.

        Args:
            vignette_response: The vignette response
            extraction_result: The preference extraction result
            context: Conversation context

        Returns:
            Follow-up question string
        """
        # Use suggested follow-up from extraction if available
        if extraction_result.suggested_follow_up:
            return extraction_result.suggested_follow_up

        # Fallback: Generate using conversation LLM
        vignette = self._vignette_engine.get_vignette_by_id(vignette_response.vignette_id)

        if not vignette:
            return "Could you tell me a bit more about why you chose that option?"

        # Build prompt for LLM to generate natural follow-up
        prompt = f"""The user just responded to a job choice scenario.

Scenario: {vignette.scenario_text}

Their response: {vignette_response.user_reasoning}

Confidence in extraction: {extraction_result.confidence:.2f} (low confidence)

Generate ONE short follow-up question (max 15 words) to clarify their preference.

Examples:
- "What was the main factor in your choice?"
- "Would you feel the same if the salary difference was smaller?"
- "Tell me more about why that matters to you"

Keep it conversational, not interrogative.

{get_json_response_instructions()}"""

        try:
            response, _ = await self._conversation_caller.call_llm(
                llm=self._conversation_llm,
                llm_input=prompt,
                logger=self.logger
            )

            if response:
                return response.message.strip('"')
        except Exception as e:
            self.logger.warning(f"Failed to generate follow-up: {e}")

        return "Could you tell me more about your choice?"

    async def _handle_follow_up_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle follow-up questions phase.

        Extracts additional preferences from follow-up response,
        then returns to vignettes phase.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        all_llm_stats: list[LLMStats] = []

        # Get the last vignette response
        if not self._state.vignette_responses:
            self._state.conversation_phase = "VIGNETTES"
            return await self._handle_vignettes_phase(user_input, context)

        last_response = self._state.vignette_responses[-1]
        vignette = self._vignette_engine.get_vignette_by_id(last_response.vignette_id)

        if vignette:
            # Extract additional preferences from follow-up response
            extraction_result, extraction_stats = await self._preference_extractor.extract_preferences(
                vignette=vignette,
                user_response=f"{last_response.user_reasoning}\n\nFollow-up response: {user_input}",
                current_preference_vector=self._state.preference_vector
            )
            all_llm_stats.extend(extraction_stats)

            # Update preference vector with refined preferences
            self._state.preference_vector = self._preference_extractor.update_preference_vector(
                self._state.preference_vector,
                extraction_result
            )

            self.logger.info(
                f"Updated preferences from follow-up (new confidence: {extraction_result.confidence:.2f})"
            )

            # Check if we should now mark the category as covered (after follow-up improved confidence)
            if extraction_result.confidence > 0.6:
                self.logger.info(
                    f"✅ Marking category '{vignette.category}' as covered after follow-up "
                    f"(confidence: {extraction_result.confidence:.2f}, vignette: {vignette.vignette_id})"
                )
                self._state.mark_category_covered(vignette.category)
            else:
                self.logger.warning(
                    f"⚠️  NOT marking category '{vignette.category}' as covered after follow-up - confidence still too low "
                    f"(confidence: {extraction_result.confidence:.2f}, threshold: 0.6, vignette: {vignette.vignette_id})"
                )

        # Mark that we've asked follow-up for this vignette
        self._state.mark_follow_up_asked(last_response.vignette_id)

        # Pre-warm next vignette now (after follow-up response, before presenting next vignette)
        # This spreads out LLM calls to avoid rate limiting
        asyncio.create_task(self._prewarm_next_vignette())

        # Return to vignettes phase
        self._state.conversation_phase = "VIGNETTES"
        return await self._handle_vignettes_phase(user_input, context)

    async def _handle_wrapup_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle wrap-up phase.

        Summarizes preferences and confirms with user.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        all_llm_stats: list[LLMStats] = []

        # Summarize preferences using LLM
        summary, summary_stats = await self._generate_preference_summary()
        all_llm_stats.extend(summary_stats)

        wrapup_message = f"""Great! I've learned a lot about your preferences.

        Here's what I understand about what matters to you in a job:

        {summary}

        This will help me suggest opportunities that are a good fit for you. Does this sound about right?"""

        response = ConversationResponse(
        reasoning="Wrapping up preference elicitation with summary",
        message=wrapup_message,
        finished=True
        )

        # Save preference vector to DB6 (Epic 1)
        await self._save_preference_vector_to_db6()

        self._state.conversation_phase = "COMPLETE"

        return response, all_llm_stats

    async def _handle_complete_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle complete phase.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        response = ConversationResponse(
            reasoning="Preference elicitation already complete",
            message="I've already recorded your preferences. Let's move on to finding opportunities for you!",
            finished=True
        )

        return response, []

    async def _extract_and_store_experience_preferences(
        self,
        question_asked: str,
        user_response: str,
        all_llm_stats: list[LLMStats]
    ) -> None:
        """
        Extract preference signals from experience question response and update state.

        Args:
            question_asked: The question that was asked
            user_response: User's response
            all_llm_stats: List to append LLM stats to
        """
        # Get experience context if available
        experiences = await self._get_experiences_for_questions()
        experience_context = None
        if experiences and len(experiences) > 0:
            exp_summaries = []
            for exp in experiences[:2]:  # Use first 2 for context
                summary = ExperienceEntity.get_structured_summary(
                    experience_title=exp.experience_title,
                    work_type=exp.work_type,
                    company=exp.company,
                    location=exp.location,
                    start_date=exp.timeline.start if exp.timeline else None,
                    end_date=exp.timeline.end if exp.timeline else None
                )
                exp_summaries.append(summary)
            experience_context = "\n".join(exp_summaries)

        try:
            # Extract preferences
            extraction_result, extraction_stats = await self._experience_preference_extractor.extract_preferences_from_experience(
                question_asked=question_asked,
                user_response=user_response,
                experience_context=experience_context
            )
            all_llm_stats.extend(extraction_stats)

            if extraction_result.confidence > 0.2:  # Only use if minimally confident
                # Store in experience_based_preferences
                for dimension, value in extraction_result.inferred_preferences.items():
                    self._state.experience_based_preferences[dimension] = {
                        "value": value,
                        "confidence": extraction_result.confidence,
                        "source": "experience_question"
                    }

                # Update preference vector with low-confidence seeding
                for dimension, value in extraction_result.inferred_preferences.items():
                    self._preference_extractor._update_preference_field(
                        preference_vector=self._state.preference_vector,
                        field_path=dimension,
                        value=value,
                        weight=extraction_result.confidence * 0.7  # Scale down weight for experience-based
                    )

                self.logger.info(
                    f"Extracted {len(extraction_result.inferred_preferences)} preference signals from experience "
                    f"(confidence: {extraction_result.confidence:.2f})"
                )
            else:
                self.logger.debug(
                    f"Skipped experience extraction due to low confidence: {extraction_result.confidence:.2f}"
                )

        except Exception as e:
            # Don't fail the conversation if extraction fails
            self.logger.warning(f"Failed to extract preferences from experience response: {e}")

    def _format_vignette_message(self, vignette: Vignette) -> str:
        """
        Format a vignette into a conversational message.

        Args:
            vignette: Vignette to format

        Returns:
            Formatted message string
        """
        # Build message
        message_parts = [vignette.scenario_text, ""]

        # Add each option
        for option in vignette.options:
            message_parts.append(f"**{option.title}**")
            message_parts.append(option.description)
            message_parts.append("")

        message_parts.append("Which would you prefer, and why?")

        return "\n".join(message_parts)

    def _build_conversation_history_for_extraction(
        self,
        context: ConversationContext
    ) -> str:
        """
        Build a concise conversation history for preference extraction.

        Only includes the last few relevant turns to provide context
        without overwhelming the extraction LLM.

        Args:
            context: Current conversation context

        Returns:
            Formatted conversation history string
        """
        # Get the last 3-5 turns for context
        recent_turns = context.history.turns[-5:] if len(context.history.turns) > 0 else []

        if not recent_turns:
            return ""

        history_parts = []
        for turn in recent_turns:
            # Only include turns during vignette/follow-up phases for relevance
            history_parts.append(f"Assistant: {turn.output.message_for_user}")
            history_parts.append(f"User: {turn.input.message}")

        return "\n".join(history_parts)

    async def _generate_preference_summary(self) -> tuple[str, list[LLMStats]]:
        """
        Generate a natural summary of extracted preferences using LLM.

        Uses LLM to create personalized, conversational bullet points that
        highlight the strongest and most distinctive preferences.

        Returns:
            Tuple of (summary string, LLM stats)
        """
        pv = self._state.preference_vector

        # Format the preference vector for the LLM
        pv_formatted = self._format_preference_vector_for_summary(pv)

        prompt = f"""
The user has completed a preference elicitation conversation. Below is their preference vector with scores and values.

Your task: Generate 3-5 natural, conversational bullet points summarizing what matters most to them in a job.

**Guidelines:**
1. Focus on the STRONGEST signals (high scores >0.7 or low scores <0.3)
2. Combine related preferences naturally (e.g., "flexibility and autonomy" not separate bullets)
3. Include task preferences - they're critical for recommendations
4. Mention negative signals if meaningful (e.g., low work-life balance = career-driven)
5. Use conversational language, not technical jargon
6. Prioritize the top 3-5 most distinctive preferences
7. Be specific - reference actual values when they tell a story

**Preference Vector:**
{pv_formatted}

**Examples of good summaries:**
- "Job security and stable income are very important to you - you strongly prefer permanent roles"
- "You thrive on analytical and problem-solving work, especially tasks that require deep thinking"
- "You prefer working independently rather than in social or team-based roles"
- "Career growth and learning opportunities matter more to you than work-life balance"
- "Flexible hours and autonomy are important, though remote work isn't a must-have"

Generate a summary that captures what's UNIQUE about this user's preferences.
"""

        # Create LLM caller
        caller = LLMCaller[PreferenceSummaryGenerator](
            model_response_type=PreferenceSummaryGenerator
        )

        try:
            response, llm_stats = await caller.call_llm(
                llm=self._conversation_llm,  # Reuse existing conversation LLM
                llm_input=prompt,
                logger=self.logger
            )

            if response and response.message:
                self.logger.info(
                    f"Generated LLM preference summary. "
                    f"Reasoning: {response.reasoning}"
                )
                # Message already contains formatted bullets, return as-is
                return response.message, llm_stats
            else:
                self.logger.warning("LLM returned empty summary, using fallback")
                fallback = self._generate_basic_preference_summary()
                return fallback, llm_stats  # Still return stats even if using fallback

        except Exception as e:
            self.logger.warning(f"Failed to generate LLM summary: {e}, using fallback")
            fallback = self._generate_basic_preference_summary()
            return fallback, []  # No stats on exception

    def _format_preference_vector_for_summary(self, pv: PreferenceVector) -> str:
        """
        Format preference vector in a readable way for LLM.

        Args:
            pv: Preference vector to format

        Returns:
            Formatted string representation
        """
        return f"""
Financial:
- Importance: {pv.financial.importance:.2f}
- Benefits importance: {pv.financial.benefits_importance:.2f}
- Bonus/commission tolerance: {pv.financial.bonus_commission_tolerance:.2f}

Work Environment:
- Remote preference: {pv.work_environment.remote_work_preference}
- Flexibility importance: {pv.work_environment.work_hours_flexibility_importance:.2f}
- Autonomy importance: {pv.work_environment.autonomy_importance:.2f}
- Supervision preference: {pv.work_environment.supervision_preference}

Job Security:
- Importance: {pv.job_security.importance:.2f}
- Stability required: {pv.job_security.income_stability_required}
- Risk tolerance: {pv.job_security.risk_tolerance}
- Contract preference: {pv.job_security.contract_type_preference}

Career Advancement:
- Importance: {pv.career_advancement.importance:.2f}
- Learning value: {pv.career_advancement.learning_opportunities_value}
- Skill development: {pv.career_advancement.skill_development_importance:.2f}

Work-Life Balance:
- Importance: {pv.work_life_balance.importance:.2f}
- Max hours/week: {pv.work_life_balance.max_acceptable_hours_per_week or 'Not set'}
- Weekend work: {pv.work_life_balance.weekend_work_tolerance}
- Evening work: {pv.work_life_balance.evening_work_tolerance}

Task Preferences:
- Social tasks: {pv.task_preferences.social_tasks_preference:.2f}
- Cognitive tasks: {pv.task_preferences.cognitive_tasks_preference:.2f}
- Routine tolerance: {pv.task_preferences.routine_tasks_tolerance:.2f}
- Creative tasks: {pv.task_preferences.creative_tasks_preference:.2f}
- Manual tasks: {pv.task_preferences.manual_tasks_preference:.2f}

Overall Confidence: {pv.confidence_score:.2f}
"""

    def _generate_basic_preference_summary(self) -> str:
        """
        Fallback basic summary if LLM fails.

        Returns:
            Simple fallback summary
        """
        pv = self._state.preference_vector
        summary_parts = []

        # Only include strongest signals as fallback
        if pv.financial.importance > 0.7:
            summary_parts.append("• Financial compensation is important to you")

        if pv.job_security.importance > 0.7:
            summary_parts.append("• Job security and stability matter to you")

        if pv.career_advancement.importance > 0.7:
            summary_parts.append("• Career growth is important to you")

        if not summary_parts:
            summary_parts.append("• I've learned about your job preferences")

        return "\n".join(summary_parts)

    def _build_conversation_system_instructions(self) -> str:
        """
        Build system instructions for the conversation LLM.

        Returns:
            System instructions string
        """
        return f"""{STD_AGENT_CHARACTER}

            {STD_LANGUAGE_STYLE}

            You are conducting a preference elicitation conversation to understand what the user values in a job.

            Your goals:
            1. Present job scenarios (vignettes) in a natural, conversational way
            2. Acknowledge the user's responses with empathy
            3. Guide the conversation through different preference dimensions
            4. Keep the tone friendly and supportive

            Guidelines:
            - Don't rush through vignettes - give space for the user to think
            - Validate their choices without judgment
            - Use simple language, avoid jargon
            - Keep responses concise (2-3 sentences usually)
            - Transition smoothly between vignettes

            {get_json_response_instructions()}"""

    def _create_error_response(self, start_time: float) -> AgentOutput:
        """
        Create an error response.

        Args:
            start_time: When agent execution started

        Returns:
            AgentOutput with error message
        """
        end_time = time.time()
        return AgentOutput(
            message_for_user="I'm having some trouble right now. Could you please try again?",
            finished=False,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(end_time - start_time, 2),
            llm_stats=[]
        )
