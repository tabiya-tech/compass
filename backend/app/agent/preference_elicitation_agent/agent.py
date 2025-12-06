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
    PreferenceExtractionResult
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

        # Preference extractor (creates its own LLM with system instructions)
        self._preference_extractor = PreferenceExtractor()

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
                self.logger.info(f"Pre-warming vignette for category: {next_category}")

                # Get templates for next category
                templates = self._vignette_engine._personalizer.get_templates_by_category(next_category)
                if not templates:
                    return

                # Generate vignette directly using personalizer (bypass select_next_vignette to avoid state changes)
                from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer

                template = templates[0]
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
            self.logger.exception("Error in preference elicitation agent", e)
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

            # Pre-warm: Generate first vignette in background (optional optimization)
            # This reduces perceived latency when transitioning to VIGNETTES phase
            # Uncomment to enable:
            # asyncio.create_task(self._prewarm_next_vignette())

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
        # After 2-3 turns of experience questions, move to vignettes
        if self._state.conversation_turn_count >= 3:
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

            prompt = f"""The user previously shared these work experiences:
                {chr(10).join(f'- {s}' for s in exp_summaries)}

                Ask them a REFLECTIVE question about what they ENJOYED or DISLIKED about these specific experiences.
                Focus on understanding their PREFERENCES, not their responsibilities.

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

{get_json_response_instructions()}"""

        response, llm_stats = await self._conversation_caller.call_llm(
            llm=self._conversation_llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=combined_instructions,
                context=context,
                user_input=user_input
            ),
            logger=self.logger
        )

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

        return response, llm_stats

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
                # Extract preferences from user's response
                extraction_result, extraction_stats = await self._preference_extractor.extract_preferences(
                    vignette=vignette,
                    user_response=user_input,
                    current_preference_vector=self._state.preference_vector
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
                    self._state.mark_category_covered(vignette.category)

        # Check if we can complete
        if self._state.can_complete() and len(self._state.completed_vignettes) >= 5:
            self._state.conversation_phase = "WRAPUP"
            return await self._handle_wrapup_phase(user_input, context)

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

        # Present the vignette
        vignette_message = self._format_vignette_message(next_vignette)

        response = ConversationResponse(
            reasoning=f"Presenting vignette {next_vignette.vignette_id} for category {next_vignette.category}",
            message=vignette_message,
            finished=False
        )

        return response, all_llm_stats

    async def _handle_follow_up_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle follow-up questions phase.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (response, LLM stats)
        """
        # TODO: Implement follow-up logic
        # For now, return to vignettes
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
        # Summarize preferences
        summary = self._generate_preference_summary()

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

        return response, []

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

    def _generate_preference_summary(self) -> str:
        """
        Generate a summary of extracted preferences.

        Returns:
            Human-readable summary string
        """
        pv = self._state.preference_vector
        summary_parts = []

        # Financial preferences
        if pv.financial.importance > 0.6:
            summary_parts.append("• Salary and financial compensation are important to you")

        # Work environment
        if pv.work_environment.remote_work_preference in ["strongly_prefer", "prefer"]:
            summary_parts.append("• You prefer remote or flexible work arrangements")

        # Job security
        if pv.job_security.importance > 0.6:
            summary_parts.append("• Job security and stability matter to you")

        # Career advancement
        if pv.career_advancement.importance > 0.6:
            summary_parts.append("• You value opportunities for growth and learning")

        # Work-life balance
        if pv.work_life_balance.importance > 0.6:
            summary_parts.append("• Work-life balance is important to you")

        if not summary_parts:
            summary_parts.append("• I'm still learning about your preferences")

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
