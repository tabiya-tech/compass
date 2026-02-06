"""
Preference Elicitation Agent.

This agent conducts a conversational preference elicitation process
using vignettes and experience-based questions to build a structured
preference vector for job/career recommendations.
"""

import time
import logging
import json
from pathlib import Path
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
    UserContext,
    PersonalizationLog
)
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.preference_extractor import (
    PreferenceExtractor,
    PreferenceExtractionResult,
    ExperiencePreferenceExtractor,
    ExperiencePreferenceExtractionResult
)
from app.agent.preference_elicitation_agent.metadata_extractor import MetadataExtractor
from app.agent.preference_elicitation_agent.user_context_extractor import UserContextExtractor
from app.agent.preference_elicitation_agent import bws_utils
from app.agent.prompt_template.agent_prompt_template import (
    STD_AGENT_CHARACTER,
    STD_LANGUAGE_STYLE
)

# Adaptive D-efficiency imports
try:
    import numpy as np
    from app.agent.preference_elicitation_agent.bayesian.posterior_manager import (
        PosteriorManager,
        PosteriorDistribution
    )
    from app.agent.preference_elicitation_agent.information_theory.stopping_criterion import StoppingCriterion
    from app.agent.preference_elicitation_agent.config.adaptive_config import AdaptiveConfig
    ADAPTIVE_AVAILABLE = True
except ImportError:
    ADAPTIVE_AVAILABLE = False
    PosteriorManager = None
    PosteriorDistribution = None
    StoppingCriterion = None
    AdaptiveConfig = None
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

# Youth database imports (optional dependency)
try:
    from app.database_contracts.db6_youth_database.db6_client import DB6Client, YouthProfile
except ImportError:
    # Youth database not available yet
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

    metadata: Optional[dict] = None
    """Optional structured metadata for UI rendering (e.g., BWS tasks, vignettes)"""

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
        use_personalized_vignettes: bool = True,
        use_offline_with_personalization: bool = False,
        offline_output_dir: Optional[str] = None
    ):
        """
        Initialize the Preference Elicitation Agent.

        Args:
            vignettes_config_path: Optional path to vignettes config file (for static vignettes)
            db6_client: Optional youth database client for accessing youth profiles.
                       If None, agent works without database integration (uses snapshot only).
                       If provided, agent can fetch fresh experiences and save preferences.
            use_personalized_vignettes: Whether to use personalized vignette generation (default: True)
            use_offline_with_personalization: Whether to use hybrid mode (offline D-optimal + LLM personalization)
            offline_output_dir: Directory containing offline-optimized vignettes (required if use_offline_with_personalization=True)
        """
        super().__init__(
            agent_type=AgentType.PREFERENCE_ELICITATION_AGENT,
            is_responsible_for_conversation_history=False
        )

        self._state: Optional[PreferenceElicitationAgentState] = None
        self._db6_client = db6_client  # Optional youth database client
        self._user_context: Optional[UserContext] = None

        # Personalization logging
        self._use_offline_with_personalization = use_offline_with_personalization
        self._personalization_logs: list[PersonalizationLog] = []
        self._session_logs_dir = Path(__file__).parent.parent.parent.parent / "session_logs"
        self._session_logs_dir.mkdir(parents=True, exist_ok=True)

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
        # Note: use_offline_with_personalization overrides use_personalized_vignettes
        self._vignette_engine = VignetteEngine(
            llm=self._shared_llm if (use_personalized_vignettes or use_offline_with_personalization) else None,
            vignettes_config_path=vignettes_config_path,
            use_personalization=use_personalized_vignettes and not use_offline_with_personalization,
            use_offline_with_personalization=use_offline_with_personalization,
            offline_output_dir=offline_output_dir
        )

        # User context extractor
        self._context_extractor = UserContextExtractor(llm=self._shared_llm)

        # Preference extractors (create their own LLMs with system instructions)
        self._preference_extractor = PreferenceExtractor()
        self._experience_preference_extractor = ExperiencePreferenceExtractor()
        self._metadata_extractor = MetadataExtractor()

        # Adaptive D-efficiency components (lazy init)
        self._adaptive_config: Optional[AdaptiveConfig] = None
        self._posterior_manager: Optional[PosteriorManager] = None
        self._stopping_criterion: Optional[StoppingCriterion] = None

    def set_state(self, state: PreferenceElicitationAgentState) -> None:
        """
        Set the agent state.

        Args:
            state: PreferenceElicitationAgentState to use
        """
        self._state = state

        # Sync Bayesian posterior to PreferenceVector when loading state
        # (important for resuming sessions)
        self._sync_bayesian_posterior_to_preference_vector()

    def _log_personalization(self, personalization_log: PersonalizationLog) -> None:
        """
        Callback for logging vignette personalization.

        Args:
            personalization_log: PersonalizationLog entry from VignettePersonalizer
        """
        self._personalization_logs.append(personalization_log)

        # Save to file immediately for debugging
        if self._state is not None:
            log_file = self._session_logs_dir / f"personalization_log_{self._state.session_id}.jsonl"
            with open(log_file, 'a', encoding='utf-8') as f:
                # Write as JSONL (one JSON object per line)
                json.dump(personalization_log.model_dump(), f, default=str, ensure_ascii=False)
                f.write('\n')

    def _init_adaptive_components(self) -> None:
        """
        Initialize adaptive D-efficiency components (lazy initialization).

        Called when use_adaptive_selection is enabled in state.
        """
        if not ADAPTIVE_AVAILABLE:
            self.logger.warning("Adaptive D-efficiency not available (import failed)")
            return

        if self._adaptive_config is None:
            self._adaptive_config = AdaptiveConfig.from_env()

        if self._posterior_manager is None:
            # Initialize with prior from config
            prior_mean = self._adaptive_config.prior_mean
            prior_variance = self._adaptive_config.prior_variance

            # Create prior mean and covariance as numpy arrays
            prior_mean_array = np.array(prior_mean)
            prior_cov_array = np.diag([prior_variance] * 7)  # Diagonal covariance matrix

            self._posterior_manager = PosteriorManager(
                prior_mean=prior_mean_array,
                prior_cov=prior_cov_array
            )

        if self._stopping_criterion is None:
            self._stopping_criterion = StoppingCriterion(
                min_vignettes=self._adaptive_config.min_vignettes,
                max_vignettes=self._adaptive_config.max_vignettes,
                det_threshold=self._adaptive_config.fim_det_threshold,
                max_variance_threshold=self._adaptive_config.max_variance_threshold
            )

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

        # Only pre-warm for personalized vignettes (not hybrid or adaptive mode)
        if not self._vignette_engine._use_personalization:
            return

        # Don't pre-warm for hybrid mode (offline + personalization)
        # Hybrid mode uses deterministic D-optimal selection
        if self._use_offline_with_personalization:
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
            elif self._state.conversation_phase == "BWS":
                response, llm_stats = await self._handle_bws_phase(msg, context)
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
            llm_stats=llm_stats,
            metadata=response.metadata  # Pass through metadata for structured UI rendering (BWS tasks, etc.)
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
        Save completed preference vector to youth database.

        Called at the end of preference elicitation (WRAPUP phase).
        If youth database is not available, logs a warning but does not fail the conversation.
        """
        if not self._db6_client:
            self.logger.info("DB6 client not available, skipping preference vector save")
            return

        if not YouthProfile:
            self.logger.warning("YouthProfile not available (database not integrated), skipping save")
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


    async def _handle_bws_phase(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle the Best-Worst Scaling (BWS) occupation ranking phase.

        This phase shows 12 tasks where users pick best and worst occupations
        from sets of 5, building a ranking over all 40 occupation groups.

        Args:
            user_input: User's message
            context: Conversation context

        Returns:
            Tuple of (ConversationResponse, LLMStats)
        """
        # Load BWS tasks
        tasks = bws_utils.load_bws_tasks()
        total_tasks = len(tasks)

        # Parse previous response if this isn't the first task
        if self._state.bws_tasks_completed > 0 and user_input.strip():
            try:
                # Get the previous task's occupations
                prev_task = tasks[self._state.bws_tasks_completed - 1]
                prev_occupations = prev_task["occupations"]

                # Parse user's choice
                best_occ, worst_occ = bws_utils.parse_bws_response(user_input, prev_occupations)

                # Save response
                self._state.bws_responses.append({
                    "task_id": self._state.bws_tasks_completed - 1,
                    "alts": prev_occupations,
                    "best": best_occ,
                    "worst": worst_occ,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                self.logger.info(
                    f"BWS Task {self._state.bws_tasks_completed}/{total_tasks} completed: "
                    f"best={best_occ}, worst={worst_occ}"
                )

            except ValueError as e:
                # Parsing failed - ask for clarification
                return ConversationResponse(
                    reasoning=f"Failed to parse BWS response: {str(e)}",
                    message=str(e),
                    finished=False
                ), []

        # Check if BWS phase is complete
        if self._state.bws_tasks_completed >= total_tasks:
            # Compute occupation scores
            scores = bws_utils.compute_occupation_scores(self._state.bws_responses)
            self._state.occupation_scores = scores

            # Get top 10
            top_10 = bws_utils.get_top_k_occupations(scores, k=10)
            self._state.top_10_occupations = top_10

            # Mark BWS complete and transition to vignettes
            self._state.bws_phase_complete = True
            self._state.conversation_phase = "VIGNETTES"

            # Log completion
            occupation_labels = bws_utils.load_occupation_labels()
            top_labels = [occupation_labels.get(code, code) for code in top_10[:5]]
            self.logger.info(f"BWS phase complete. Top 5 occupations: {top_labels}")

            # Transition message
            message = (
                "Perfect! I now have a good sense of the types of work that interest you.\n\n"
                "Next, I'd like to understand what matters to you **within** these job types. "
                "I'll show you some job scenarios, and you can tell me which you'd prefer."
            )

            return ConversationResponse(
                reasoning="BWS phase complete, transitioning to vignettes",
                message=message,
                finished=False
            ), []

        # Show next BWS task
        current_task = tasks[self._state.bws_tasks_completed]
        task_number = self._state.bws_tasks_completed + 1

        message = bws_utils.format_bws_question(current_task, task_number, total_tasks)

        # Build metadata for structured UI rendering
        occupation_groups = bws_utils.load_occupation_groups()
        occupation_map = {occ["code"]: occ for occ in occupation_groups}

        occupations_metadata = []
        for occ_code in current_task["occupations"]:
            occ_data = occupation_map.get(occ_code, {})
            occupations_metadata.append({
                "code": occ_code,
                "label": occ_data.get("label", f"Occupation {occ_code}"),
                "description": occ_data.get("description", "")
            })

        metadata = {
            "interaction_type": "bws_task",
            "task_number": task_number,
            "total_tasks": total_tasks,
            "occupations": occupations_metadata
        }

        self._state.bws_tasks_completed += 1

        return ConversationResponse(
            reasoning=f"Showing BWS task {task_number}/{total_tasks}",
            message=message,
            finished=False,
            metadata=metadata
        ), []

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

            # Transition to experience questions phase
            self._state.conversation_phase = "EXPERIENCE_QUESTIONS"

            return response, []

        # Continue with experience questions
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

        # After 2-3 turns of experience questions, move to BWS (occupation ranking)
        if self._state.conversation_turn_count >= 4:
            self._state.conversation_phase = "BWS"
            return await self._handle_bws_phase("", context)  # Start BWS with empty input

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
                self.logger.info(
                    f"✅ MARKED VIGNETTE AS COMPLETED: {vignette_response.vignette_id}\n"
                    f"   Total completed: {len(self._state.completed_vignettes)}\n"
                    f"   List: {self._state.completed_vignettes}"
                )

                # DISABLED: LLM-based preference vector update (replaced by Bayesian)
                # NOTE: This is commented out because:
                # 1. New simplified PreferenceVector has flat structure (no nested fields)
                # 2. LLM extraction has constraint bias (values anchored to vignette ranges)
                # 3. Bayesian posterior handles all preference learning more reliably
                # To re-enable: Need to update PreferenceExtractor to work with flat fields
                # self._state.preference_vector = self._preference_extractor.update_preference_vector(
                #     self._state.preference_vector,
                #     extraction_result
                # )

                # Adaptive D-efficiency: Update Bayesian posterior
                # This is needed for BOTH adaptive mode and hybrid mode (offline + personalization)
                # Bayesian update is the PRIMARY method for learning preferences
                if self._state.use_adaptive_selection or self._use_offline_with_personalization:
                    await self._update_bayesian_posterior(vignette, extraction_result.chosen_option_id, user_input)

                # Update qualitative metadata (every 3 vignettes)
                # Extracts unbiased patterns from cumulative responses
                await self._update_qualitative_metadata()

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
        # Skip for adaptive/hybrid modes (selection is deterministic based on posterior)
        if not self._state.use_adaptive_selection and not self._use_offline_with_personalization:
            asyncio.create_task(self._prewarm_next_vignette())

        # Check if we can complete (adaptive/hybrid modes use different stopping criterion)
        if self._state.use_adaptive_selection or self._use_offline_with_personalization:
            # Adaptive/hybrid stopping criterion
            # ONLY check during adaptive phase, not after we've started static_end
            if not self._state.adaptive_phase_complete:
                should_continue, stopping_reason = await self._check_adaptive_stopping_criterion()

                if not should_continue:
                    self.logger.info(f"Adaptive stopping criterion met: {stopping_reason}")
                    self._state.stopped_early = True
                    self._state.stopping_reason = stopping_reason
                    self._state.adaptive_phase_complete = True
                    self.logger.info("Setting adaptive_phase_complete=True, will show 2 static_end vignettes")
                    # Continue to select next vignette (will be from static_end)

            # After static_end vignettes complete, move to WRAPUP
            # Check: have we shown both static_end vignettes?
            elif self._state.adaptive_phase_complete:
                static_end_count = sum(1 for v_id in self._state.completed_vignettes if v_id.startswith("static_end"))
                if static_end_count >= 2:
                    self.logger.info(f"Static_end vignettes complete ({static_end_count} shown), moving to WRAPUP")
                    self._state.conversation_phase = "WRAPUP"
                    return await self._handle_wrapup_phase(user_input, context)
        else:
            # Traditional stopping criterion
            if self._state.can_complete() and len(self._state.completed_vignettes) >= 6:
                self._state.conversation_phase = "WRAPUP"
                return await self._handle_wrapup_phase(user_input, context)

        # Log current state before selecting next vignette
        self.logger.info(
            f"\n🔍 AGENT Vignette Selection State:\n"
            f"  - Completed vignettes COUNT: {len(self._state.completed_vignettes)}\n"
            f"  - Completed vignettes IDs: {self._state.completed_vignettes}\n"
            f"  - Current vignette ID: {self._state.current_vignette_id}\n"
            f"  - Categories covered: {self._state.categories_covered}\n"
            f"  - Categories to explore: {self._state.categories_to_explore}\n"
            f"  - Current preference vector confidence: {self._state.preference_vector.confidence_score:.2f}\n"
            f"  - Adaptive mode: {self._state.use_adaptive_selection}\n"
            f"  - Hybrid mode: {self._use_offline_with_personalization}"
        )

        # Select next vignette
        # The engine internally routes based on mode (adaptive, hybrid, personalization, or static)
        # Pass personalization callback if using hybrid mode
        personalization_callback = self._log_personalization if self._use_offline_with_personalization else None

        next_vignette = await self._vignette_engine.select_next_vignette(
            self._state,
            user_context=self._user_context,
            personalization_log_callback=personalization_callback
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
        if word_count < 5:
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

        # Save preference vector to youth database (DB6)
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
        # Use simplified 7-dimensional structure
        return f"""
Core Preference Dimensions (0.0 = Low, 1.0 = High):

1. Financial Compensation: {pv.financial_importance:.2f}
   - Salary, benefits, and total compensation

2. Work Environment: {pv.work_environment_importance:.2f}
   - Remote work, commute, autonomy, work pace

3. Career Advancement: {pv.career_advancement_importance:.2f}
   - Learning opportunities, skill development, promotions

4. Work-Life Balance: {pv.work_life_balance_importance:.2f}
   - Flexible hours, family time, personal commitments

5. Job Security: {pv.job_security_importance:.2f}
   - Stable employment, contract type, income reliability

6. Task Preferences: {pv.task_preference_importance:.2f}
   - Type of work (social, cognitive, manual, routine)

7. Social Impact: {pv.social_impact_importance:.2f}
   - Purpose, values alignment, helping others

Overall Confidence: {pv.confidence_score:.2f}
Vignettes Completed: {pv.n_vignettes_completed}
"""

    def _generate_basic_preference_summary(self) -> str:
        """
        Fallback basic summary if LLM fails.

        Returns:
            Simple fallback summary
        """
        pv = self._state.preference_vector
        summary_parts = []

        # Only include strongest signals as fallback (using simplified structure)
        if pv.financial_importance > 0.7:
            summary_parts.append("• Financial compensation is important to you")

        if pv.job_security_importance > 0.7:
            summary_parts.append("• Job security and stability matter to you")

        if pv.career_advancement_importance > 0.7:
            summary_parts.append("• Career growth is important to you")

        if pv.work_life_balance_importance > 0.7:
            summary_parts.append("• Work-life balance is important to you")

        if pv.social_impact_importance > 0.7:
            summary_parts.append("• Making a positive social impact matters to you")

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

    async def _update_bayesian_posterior(
        self,
        vignette: Vignette,
        chosen_option_id: str,
        user_response: str
    ) -> None:
        """
        Update Bayesian posterior distribution based on vignette response.

        Used by both adaptive mode and hybrid mode (offline + personalization).

        Args:
            vignette: The vignette that was presented
            chosen_option_id: ID of the option chosen by the user
            user_response: User's explanation
        """
        # Check if Bayesian updates are needed (adaptive mode OR hybrid mode)
        if not ADAPTIVE_AVAILABLE:
            return

        if not self._state.use_adaptive_selection and not self._use_offline_with_personalization:
            return

        try:
            # Initialize components if not already done
            self._init_adaptive_components()

            # Extract likelihood function
            likelihood_fn = await self._preference_extractor.extract_likelihood(
                vignette=vignette,
                user_response=user_response,
                chosen_option=chosen_option_id
            )

            # Sync state posterior to manager (if state has updated values)
            if self._state.posterior_mean and self._state.posterior_covariance:
                self._posterior_manager.posterior = PosteriorDistribution(
                    mean=self._state.posterior_mean,
                    covariance=self._state.posterior_covariance
                )

            # Update posterior (uses manager's internal posterior)
            updated_posterior = self._posterior_manager.update(
                likelihood_fn=likelihood_fn,
                observation={"vignette": vignette, "chosen_option": chosen_option_id, "user_response": user_response}
            )

            # Update state
            self._state.posterior_mean = updated_posterior.mean
            self._state.posterior_covariance = updated_posterior.covariance

            # Compute updated FIM
            from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
            from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator

            likelihood_calc = LikelihoodCalculator()
            fisher_calculator = FisherInformationCalculator(likelihood_calc)

            current_fim = np.array(self._state.fisher_information_matrix) if self._state.fisher_information_matrix else np.eye(7) / self._adaptive_config.prior_variance

            # Compute FIM contribution from this vignette
            vignette_fim = fisher_calculator.compute_fim(vignette, np.array(updated_posterior.mean))
            updated_fim = current_fim + vignette_fim

            # Update state
            self._state.fisher_information_matrix = updated_fim.tolist()
            self._state.fim_determinant = float(np.linalg.det(updated_fim))

            # Update uncertainty per dimension
            uncertainty_dict = {}
            for i, dim in enumerate(updated_posterior.dimensions):
                uncertainty_dict[dim] = updated_posterior.get_variance(dim)
            self._state.uncertainty_per_dimension = uncertainty_dict

            self.logger.info(
                f"Updated Bayesian posterior: FIM det = {self._state.fim_determinant:.2e}, "
                f"max variance = {max(uncertainty_dict.values()):.3f}"
            )

            # Sync Bayesian posterior to PreferenceVector
            self._sync_bayesian_posterior_to_preference_vector()

        except Exception as e:
            self.logger.error(f"Failed to update Bayesian posterior: {e}", exc_info=True)

    def _sync_bayesian_posterior_to_preference_vector(self) -> None:
        """
        Sync Bayesian posterior to simplified PreferenceVector.

        Maps the 7-dimensional Bayesian posterior (learned from vignettes using
        Laplace approximation) to the streamlined PreferenceVector structure.

        Uses sigmoid transformation to map unconstrained posterior_mean values
        to [0.0, 1.0] importance scores, and hybrid confidence calculation.
        """
        # Only sync if using adaptive/hybrid mode
        if not (self._state.use_adaptive_selection or self._use_offline_with_personalization):
            return

        # Only sync if posterior exists
        if not self._state.posterior_mean or not self._state.posterior_covariance:
            return

        try:
            posterior_mean = np.array(self._state.posterior_mean)
            posterior_cov = np.array(self._state.posterior_covariance)

            # Sigmoid transformation: maps (-∞, +∞) → [0, 1]
            def sigmoid(x: float) -> float:
                return float(1.0 / (1.0 + np.exp(-x)))

            # Map posterior_mean to importance scores
            # Dimension mapping (from PosteriorDistribution.dimensions):
            # 0: financial_importance
            # 1: work_environment_importance
            # 2: career_growth_importance → career_advancement_importance
            # 3: work_life_balance_importance
            # 4: job_security_importance
            # 5: task_preference_importance
            # 6: values_culture_importance → social_impact_importance

            self._state.preference_vector.financial_importance = sigmoid(posterior_mean[0])
            self._state.preference_vector.work_environment_importance = sigmoid(posterior_mean[1])
            self._state.preference_vector.career_advancement_importance = sigmoid(posterior_mean[2])
            self._state.preference_vector.work_life_balance_importance = sigmoid(posterior_mean[3])
            self._state.preference_vector.job_security_importance = sigmoid(posterior_mean[4])
            self._state.preference_vector.task_preference_importance = sigmoid(posterior_mean[5])
            self._state.preference_vector.social_impact_importance = sigmoid(posterior_mean[6])

            # Update metadata
            n_vignettes = len(self._state.completed_vignettes)
            self._state.preference_vector.n_vignettes_completed = n_vignettes

            # Store raw Bayesian metadata
            self._state.preference_vector.posterior_mean = posterior_mean.tolist()
            self._state.preference_vector.posterior_covariance_diagonal = np.diag(posterior_cov).tolist()
            self._state.preference_vector.fim_determinant = self._state.fim_determinant

            # Per-dimension uncertainty
            variances = np.diag(posterior_cov)
            self._state.preference_vector.per_dimension_uncertainty = {
                "financial_importance": float(variances[0]),
                "work_environment_importance": float(variances[1]),
                "career_advancement_importance": float(variances[2]),
                "work_life_balance_importance": float(variances[3]),
                "job_security_importance": float(variances[4]),
                "task_preference_importance": float(variances[5]),
                "social_impact_importance": float(variances[6])
            }

            # Calculate hybrid confidence score
            # Component 1: Variance-based (statistical uncertainty)
            avg_variance = float(np.mean(variances))
            confidence_variance = 1.0 / (1.0 + avg_variance)

            # Component 2: Vignette-count based (heuristic)
            confidence_count = 1.0 - np.exp(-n_vignettes / 10.0)

            # Weighted combination (70% variance, 30% count)
            alpha = 0.7
            confidence = alpha * confidence_variance + (1.0 - alpha) * confidence_count
            self._state.preference_vector.confidence_score = float(np.clip(confidence, 0.0, 1.0))

            self.logger.debug(
                f"Synced Bayesian posterior to PreferenceVector:\n"
                f"  Financial: {self._state.preference_vector.financial_importance:.3f} (var: {variances[0]:.3f})\n"
                f"  Work Env: {self._state.preference_vector.work_environment_importance:.3f} (var: {variances[1]:.3f})\n"
                f"  Career: {self._state.preference_vector.career_advancement_importance:.3f} (var: {variances[2]:.3f})\n"
                f"  Work-Life: {self._state.preference_vector.work_life_balance_importance:.3f} (var: {variances[3]:.3f})\n"
                f"  Security: {self._state.preference_vector.job_security_importance:.3f} (var: {variances[4]:.3f})\n"
                f"  Tasks: {self._state.preference_vector.task_preference_importance:.3f} (var: {variances[5]:.3f})\n"
                f"  Social: {self._state.preference_vector.social_impact_importance:.3f} (var: {variances[6]:.3f})\n"
                f"  Confidence: {self._state.preference_vector.confidence_score:.3f} "
                f"(variance_component={confidence_variance:.3f}, count_component={confidence_count:.3f}, n={n_vignettes})"
            )

        except Exception as e:
            self.logger.error(f"Failed to sync Bayesian posterior to PreferenceVector: {e}", exc_info=True)

    async def _update_qualitative_metadata(self) -> None:
        """
        Update qualitative metadata from cumulative user responses.

        Called periodically (every 3 vignettes) to extract patterns from
        accumulated responses. More responses = better pattern detection.
        """
        # Only update if we have enough responses (minimum 3)
        if len(self._state.vignette_responses) < 3:
            return

        # Only update every 3 vignettes to reduce LLM calls
        if len(self._state.vignette_responses) % 3 != 0:
            return

        try:
            # Collect all user responses
            all_responses = [
                vr.user_reasoning
                for vr in self._state.vignette_responses
                if vr.user_reasoning
            ]

            if not all_responses:
                return

            self.logger.info(
                f"Extracting qualitative metadata from {len(all_responses)} responses..."
            )

            # Extract metadata
            metadata = await self._metadata_extractor.extract_metadata(all_responses)

            # Update preference vector metadata fields
            if metadata.decision_patterns:
                self._state.preference_vector.decision_patterns.update(metadata.decision_patterns)

            if metadata.tradeoff_willingness:
                self._state.preference_vector.tradeoff_willingness.update(metadata.tradeoff_willingness)

            if metadata.values_signals:
                self._state.preference_vector.values_signals.update(metadata.values_signals)

            if metadata.consistency_indicators:
                self._state.preference_vector.consistency_indicators.update(metadata.consistency_indicators)

            if metadata.extracted_constraints:
                self._state.preference_vector.extracted_constraints.update(metadata.extracted_constraints)

            self.logger.info(
                f"Updated qualitative metadata:\n"
                f"  Decision patterns: {list(metadata.decision_patterns.keys())}\n"
                f"  Tradeoffs: {list(metadata.tradeoff_willingness.keys())}\n"
                f"  Values: {list(metadata.values_signals.keys())}\n"
                f"  Constraints: {list(metadata.extracted_constraints.keys())}"
            )

        except Exception as e:
            self.logger.error(f"Failed to update qualitative metadata: {e}", exc_info=True)

    async def _check_adaptive_stopping_criterion(self) -> tuple[bool, str]:
        """
        Check if adaptive stopping criterion is met.

        Returns:
            Tuple of (should_continue, reason)
        """
        # Check if adaptive stopping is enabled (adaptive mode OR hybrid mode)
        if not ADAPTIVE_AVAILABLE:
            return True, "Adaptive libraries not available"

        if not self._state.use_adaptive_selection and not self._use_offline_with_personalization:
            return True, "Adaptive mode not enabled"

        try:
            self._init_adaptive_components()

            # Get current posterior and FIM
            if not self._state.posterior_mean or not self._state.fisher_information_matrix:
                return True, "Posterior not yet initialized"

            posterior = PosteriorDistribution(
                mean=self._state.posterior_mean,
                covariance=self._state.posterior_covariance
            )

            fim = np.array(self._state.fisher_information_matrix)

            n_vignettes_shown = len(self._state.completed_vignettes)

            # Check stopping criterion
            should_continue, reason = self._stopping_criterion.should_continue(
                posterior=posterior,
                fim=fim,
                n_vignettes_shown=n_vignettes_shown
            )

            return should_continue, reason

        except Exception as e:
            self.logger.error(f"Failed to check adaptive stopping criterion: {e}", exc_info=True)
            # Fallback to traditional stopping
            return True, f"Error in adaptive stopping: {e}"

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
