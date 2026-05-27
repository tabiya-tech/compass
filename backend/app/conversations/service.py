"""
This module contains the service layer for handling conversations.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.conversations.phase_state_machine import JourneyPhase, PhaseDataStatus, determine_start_phase
from app.agent.agent_types import AgentInput
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_manager import IConversationMemoryManager
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.types import ConversationResponse
from app.conversations.utils import get_messages_from_conversation_manager, filter_conversation_history, \
    get_total_explored_experiences, get_current_conversation_phase_response
from app.sensitive_filter import sensitive_filter
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder
from app.job_preferences.service import IJobPreferencesService
from app.conversations.phase_data import (
    apply_entry_phase,
    build_phase_data_status_from_state,
)
from app.user_recommendations.services.service import IUserRecommendationsService
from app.job_preferences.types import JobPreferences

from app.app_config import get_application_config
from app.users.cv.service import ICVUploadService
from app.users.cv.cv_to_agent_mapper import map_cv_to_collected_data
from app.context_vars import turn_index_ctx_var, detected_language_ctx_var, user_language_ctx_var
from app.agent.persona_detector import detect_persona
from app.agent.language_detector import detect_language, get_locale_for_detected_language, DetectedLanguage
from app.i18n.types import Locale

class ConversationAlreadyConcludedError(Exception):
    """
    Exception raised when there is an attempt to send a message on a conversation that has already concluded
    """

    def __init__(self, session_id: int):
        super().__init__(f"The conversation for session {session_id} is already concluded")


class IConversationService(ABC):
    """
   Interface for the conversation service

   Allows us to mock the service in tests.
   """

    @abstractmethod
    async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool,
                   filter_pii: bool,
                   city: str | None = None,
                   province: str | None = None,
                   discuss_recommendations: bool = True) -> ConversationResponse:
        # TODO: discuss filter pii and clear_memory
        """
        Get a message from the user and return a response from Compass, save the message and response into the application state
        :param user_id: str - the id of the user sending the message
        :param session_id: int - id for the conversation session
        :param user_input: str - the message sent by the user
        :param clear_memory: bool - [ Deprecated ] - pass true to clear memory for session
        :param filter_pii: bool - pass true to enable personal identifying information filtering
        :param city: str | None - the city of the user (used only when initialising a new state)
        :param province: str | None - the province/state of the user (used only when initialising a new state)
        :return: ConversationResponse - an object containing a list of messages and some metadata about the current conversation
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_history_by_session_id(self, user_id: str, session_id: int) -> ConversationResponse:
        """
        Get all the messages for this session so far
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :return: ConversationResponse - an object containing a list of messages and some metadata about the current conversation
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()


class ConversationService(IConversationService):
    def __init__(self, *,
                 application_state_metrics_recorder: IApplicationStateMetricsRecorder,
                 agent_director: LLMAgentDirector,
                 conversation_memory_manager: IConversationMemoryManager,
                 reaction_repository: IReactionRepository,
                 job_preferences_service: IJobPreferencesService,
                 user_recommendations_service: IUserRecommendationsService,
                 cv_upload_service: ICVUploadService | None = None):
        self._logger = logging.getLogger(ConversationService.__name__)
        self._agent_director = agent_director
        self._application_state_metrics_recorder = application_state_metrics_recorder
        self._conversation_memory_manager = conversation_memory_manager
        self._reaction_repository = reaction_repository
        self._job_preferences_service = job_preferences_service
        self._user_recommendations_service = user_recommendations_service
        self._cv_upload_service = cv_upload_service

    async def _inject_cv_experiences_if_available(self, state, user_id: str) -> None:
        """Pre-populate collect_experience_state with CV-extracted experiences if available."""
        if self._cv_upload_service is None:
            return
        collect_state = state.collect_experience_state
        if not collect_state.first_time_visit or collect_state.collected_data:
            return
        try:
            uploads = await self._cv_upload_service.get_user_cvs(user_id=user_id)
            if not uploads:
                return
            # Use the most recent completed upload
            latest = uploads[0]
            extraction = latest.structured_extraction
            if not extraction:
                return
            cv_experiences = extraction.experiences
            if not cv_experiences:
                return
            new_items = map_cv_to_collected_data(cv_experiences, collect_state.collected_data)
            collect_state.collected_data.extend(new_items)
            self._logger.info(
                "Injected %d CV experiences into collect_experience_state for user=%s",
                len(new_items), user_id,
            )
        except Exception as e:
            self._logger.warning(
                "Failed to inject CV experiences for user=%s: %s", user_id, str(e), exc_info=True,
            )

    async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool,
                   filter_pii: bool,
                   city: str | None = None,
                   province: str | None = None,
                   discuss_recommendations: bool = True) -> ConversationResponse:
        if clear_memory:
            await self._application_state_metrics_recorder.delete_state(session_id)
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the sent_at for the user input
        user_input = AgentInput(message=user_input, sent_at=datetime.now(timezone.utc))

        state = await self._application_state_metrics_recorder.get_state(session_id, city=city, province=province)

        if state.agent_director_state.current_phase == ConversationPhase.INTRO:
            data = await build_phase_data_status_from_state(
                state, user_id, self._user_recommendations_service
            )
            entry_phase = determine_start_phase(data)
            self._logger.info(
                "Step-skip check: session=%s user=%s entry_phase=%s",
                session_id, user_id, entry_phase.value,
            )
            if apply_entry_phase(state, entry_phase):
                self._logger.info(
                    "Step-skip: skipping to %s phase",
                    entry_phase.value,
                )
            else:
                self._logger.info(
                    "Step-skip: starting at SKILLS_ELICITATION (no skip, proceeding with intro)",
                )

        if state.agent_director_state.current_phase == ConversationPhase.ENDED:
            raise ConversationAlreadyConcludedError(session_id)

        self._agent_director.set_state(state.agent_director_state)
        self._agent_director.get_welcome_agent().set_state(state.welcome_agent_state)
        self._agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
        self._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            state.collect_experience_state)
        # Inject CV-extracted experiences into collect_experience_state if available
        await self._inject_cv_experiences_if_available(state, user_id)
        self._agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(
            state.skills_explorer_agent_state)
        self._agent_director.get_preference_elicitation_agent().set_state(state.preference_elicitation_agent_state)

        # Prepare recommender state with skills and preferences if not already set
        await self._prepare_recommender_state_if_needed(state, user_id)

        # Apply discuss_recommendations flag from user profile
        state.recommender_advisor_agent_state.discuss_recommendations = discuss_recommendations

        self._agent_director.get_recommender_advisor_agent().set_state(state.recommender_advisor_agent_state)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        context = await self._conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)

        # Set turn_index in context for observability logging
        turn_index_ctx_var.set(current_index)

        # Detect persona using prior user messages + current input
        history_messages = [
            turn.input.message for turn in context.all_history.turns
            if not turn.input.is_artificial and turn.input.message
        ]
        persona_type = detect_persona(user_input.message, history_messages)
        state.agent_director_state.persona_type = persona_type
        state.collect_experience_state.persona_type = persona_type
        state.skills_explorer_agent_state.persona_type = persona_type

        previous_detections = [
            detect_language(msg) for msg in history_messages[-3:]
        ] if history_messages else []
        detected = detect_language(
            user_input.message,
            conversation_history=history_messages,
            previous_detections=previous_detections or None,
        )
        detected_language_ctx_var.set(detected.value)
        app_config = get_application_config()
        default_locale = app_config.language_config.default_locale
        locale_str = get_locale_for_detected_language(detected, default_locale.value)
        try:
            user_language_ctx_var.set(Locale.from_locale_str(locale_str))
        except ValueError:
            self._logger.warning(
                "Detected locale '%s' not registered, falling back to default '%s'",
                locale_str, default_locale.value,
            )
            user_language_ctx_var.set(default_locale)

        await self._agent_director.execute(user_input=user_input)
        # get the context again after updating the history
        context = await self._conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)

        # Save preference vector to JobPreferences if preference elicitation just completed
        if self._should_save_preference_vector(state):
            await self._save_preference_vector_to_job_preferences(state)

        # get the date when the conversation was conducted
        state.agent_director_state.conversation_conducted_at = datetime.now(timezone.utc)

        # save the state, before responding to the user
        await self._application_state_metrics_recorder.save_state(state, user_id)

        return ConversationResponse(
            messages=response,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=get_total_explored_experiences(state),
            current_phase=get_current_conversation_phase_response(state, self._logger)
        )

    async def get_history_by_session_id(self, user_id: str, session_id: int) -> ConversationResponse:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context = await self._conversation_memory_manager.get_conversation_context()
        reactions_for_session = await self._reaction_repository.get_reactions(session_id)
        messages = await filter_conversation_history(context.all_history, reactions_for_session)

        # Count the number of experiences explored in the conversation
        experiences_explored = 0

        for exp in state.explore_experiences_director_state.experiences_state.values():
            # Check if the experience has been processed and has top skills
            if exp.dive_in_phase == DiveInPhase.PROCESSED and len(exp.experience.top_skills) > 0:
                experiences_explored += 1

        return ConversationResponse(
            messages=messages,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=experiences_explored,
            current_phase=get_current_conversation_phase_response(state, self._logger)
        )

    def _should_save_preference_vector(self, state: ApplicationState) -> bool:
        """
        Check if preference elicitation just completed and needs saving to JobPreferences.

        The preference vector is saved when the agent transitions to COMPLETE phase,
        which happens after the WRAPUP phase shows the summary to the user.

        Args:
            state: Current application state after agent execution

        Returns:
            True if preferences should be saved, False otherwise
        """
        pref_state = state.preference_elicitation_agent_state

        # Save when in COMPLETE phase and has a valid preference vector
        return (pref_state.conversation_phase == "COMPLETE"
                and pref_state.preference_vector.confidence_score > 0.0)

    async def _save_preference_vector_to_job_preferences(self, state: ApplicationState) -> None:
        """
        Save completed preference vector to JobPreferences collection.

        This creates a denormalized copy of the preference vector for quick access
        by the Epic 3 recommender system. The preference vector is already saved in
        the youth database (DB6) by the agent; this is an additional copy for performance.

        Args:
            state: Application state containing the completed preference vector
        """
        try:
            pref_state = state.preference_elicitation_agent_state
            pv = pref_state.preference_vector

            # Convert PreferenceVector to JobPreferences format
            job_prefs = JobPreferences(
                session_id=pref_state.session_id,
                # Core preference dimensions
                financial_importance=pv.financial_importance,
                work_environment_importance=pv.work_environment_importance,
                career_advancement_importance=pv.career_advancement_importance,
                work_life_balance_importance=pv.work_life_balance_importance,
                job_security_importance=pv.job_security_importance,
                task_preference_importance=pv.task_preference_importance,
                social_impact_importance=pv.social_impact_importance,
                # Quality metadata
                confidence_score=pv.confidence_score,
                n_vignettes_completed=pv.n_vignettes_completed,
                per_dimension_uncertainty=pv.per_dimension_uncertainty,
                # Bayesian metadata
                posterior_mean=pv.posterior_mean,
                posterior_covariance_diagonal=pv.posterior_covariance_diagonal,
                fim_determinant=pv.fim_determinant,
                # Qualitative insights
                decision_patterns=pv.decision_patterns,
                tradeoff_willingness=pv.tradeoff_willingness,
                values_signals=pv.values_signals,
                consistency_indicators=pv.consistency_indicators,
                extracted_constraints=pv.extracted_constraints,
                # Hard constraints (if extracted)
                concrete_salary_min=pv.extracted_constraints.get("minimum_salary") if pv.extracted_constraints else None,
                # Timestamp
                last_updated=datetime.now(timezone.utc)
            )

            # Save to job_preferences collection (proper dependency injection via FastAPI)
            await self._job_preferences_service.create_or_update(
                session_id=pref_state.session_id,
                preferences=job_prefs
            )

            self._logger.info(
                f"Saved preference vector to JobPreferences for session {pref_state.session_id} "
                f"(confidence: {pv.confidence_score:.2f})"
            )

        except Exception as e:
            # Don't fail the conversation - just log the error
            # This is a denormalized copy; the primary data is already in DB6
            self._logger.error(f"Failed to save preference vector to JobPreferences: {e}", exc_info=True)

    async def _prepare_recommender_state_if_needed(self, state: ApplicationState, user_id: str) -> None:
        """
        Prepare RecommenderAdvisorAgent state with skills and preferences if not already initialized.

        When skip_to_phase is RECOMMENDATION, loads pre-computed recommendations from
        user_recommendations collection and passes them to the agent.

        Otherwise populates:
        - Skills vector from explored experiences
        - Preference vector from preference elicitation agent
        - BWS occupation scores from preference elicitation
        - Location data (city/province) - optional for v1

        Args:
            state: Application state containing all agent states
            user_id: User ID for loading pre-computed recommendations when skipping
        """
        rec_state = state.recommender_advisor_agent_state

        if (state.agent_director_state.skip_to_phase == JourneyPhase.RECOMMENDATION
                and rec_state.recommendations is None):
            self._logger.info(
                "Step-skip: loading pre-computed recommendations for user=%s", user_id
            )
            try:
                db_recs = await self._user_recommendations_service.get_by_user_id(user_id)
                if db_recs:
                    from app.agent.recommender_advisor_agent.user_recommendations_converter import (
                        user_recommendations_to_node2vec,
                    )
                    rec_state.recommendations = user_recommendations_to_node2vec(user_id, db_recs)
                    rec_state.youth_id = user_id
                    self._logger.info(
                        "Loaded pre-computed recommendations for recommender: "
                        "%d occupations, %d opportunities, %d skill gaps",
                        len(db_recs.occupation_recommendations),
                        len(db_recs.opportunity_recommendations),
                        len(db_recs.skill_gap_recommendations),
                    )
            except Exception as e:
                self._logger.warning(
                    "Failed to load pre-computed recommendations for skip: %s", e, exc_info=True
                )

        if rec_state.skills_vector is not None and rec_state.preference_vector is not None:
            return

        try:
            # Extract skills from explored experiences
            if rec_state.skills_vector is None:
                from app.agent.recommender_advisor_agent.skills_extractor import SkillsExtractor

                explored_experiences = state.explore_experiences_director_state.explored_experiences
                extractor = SkillsExtractor()
                skills_vector = extractor.extract_skills_vector(explored_experiences)

                rec_state.skills_vector = skills_vector
                self._logger.info(
                    f"Extracted skills vector for recommender: "
                    f"{len(skills_vector.get('skills', []))} skills from "
                    f"{skills_vector.get('total_experiences', 0)} experiences"
                )

            # Extract preference vector from preference elicitation agent
            if rec_state.preference_vector is None:
                pref_state = state.preference_elicitation_agent_state
                if pref_state.preference_vector is not None:
                    rec_state.preference_vector = pref_state.preference_vector
                    self._logger.info(
                        f"Loaded preference vector for recommender "
                        f"(confidence: {pref_state.preference_vector.confidence_score:.2f})"
                    )

            # Extract BWS occupation scores from preference elicitation
            if rec_state.bws_scores is None:
                pref_state = state.preference_elicitation_agent_state
                if pref_state.bws_scores:
                    rec_state.bws_scores = pref_state.bws_scores
                    self._logger.info(
                        f"Loaded BWS scores for recommender: "
                        f"{len(pref_state.bws_scores)} items"
                    )

            # Extract education experiences for matching service signals
            rec_state.education_experiences = [
                e for e in state.collect_experience_state.collected_data
                if e.source == "education"
            ]

            # Set youth_id (use session_id as fallback)
            if rec_state.youth_id is None:
                rec_state.youth_id = f"youth_{state.session_id}"

            # Location data (city/province) - optional for v1
            # TODO: Extract from user profile or welcome agent when implemented
            # For now, matching service will use defaults

        except Exception as e:
            # Don't fail - just log the error
            # Recommender agent will work with whatever data is available
            self._logger.warning(f"Error preparing recommender state: {e}", exc_info=True)
