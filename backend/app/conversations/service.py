"""
This module contains the service layer for handling conversations.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.agent.agent_types import AgentInput
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_manager import IConversationMemoryManager
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.types import ConversationResponse
from app.conversations.utils import get_messages_from_conversation_manager, filter_conversation_history, \
    get_total_explored_experiences, get_current_conversation_phase_response
from app.job_preferences.service import IJobPreferencesService
from app.job_preferences.types import JobPreferences
from app.sensitive_filter import sensitive_filter
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder


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
                   filter_pii: bool) -> ConversationResponse:
        # TODO: discuss filter pii and clear_memory
        """
        Get a message from the user and return a response from Compass, save the message and response into the application state
        :param user_id: str - the id of the user sending the message
        :param session_id: int - id for the conversation session
        :param user_input: str - the message sent by the user
        :param clear_memory: bool - [ Deprecated ] - pass true to clear memory for session
        :param filter_pii: bool - pass true to enable personal identifying information filtering
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
                 enable_preference_elicitation: bool = False,
                 job_preferences_service: Optional[IJobPreferencesService] = None):
        self._logger = logging.getLogger(ConversationService.__name__)
        self._agent_director = agent_director
        self._application_state_metrics_recorder = application_state_metrics_recorder
        self._conversation_memory_manager = conversation_memory_manager
        self._reaction_repository = reaction_repository
        self._enable_preference_elicitation = enable_preference_elicitation
        self._job_preferences_service = job_preferences_service
        if enable_preference_elicitation and job_preferences_service is None:
            raise ValueError(
                "job_preferences_service must be provided when preference elicitation is enabled"
            )

    async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool,
                   filter_pii: bool) -> ConversationResponse:
        if clear_memory:
            await self._application_state_metrics_recorder.delete_state(session_id)
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the sent_at for the user input
        agent_input = AgentInput(message=user_input, sent_at=datetime.now(timezone.utc))

        # set the state of the agent director, the conversation memory manager and all the agents
        state = await self._application_state_metrics_recorder.get_state(session_id)

        # Check if the conversation has ended
        if state.agent_director_state.current_phase == ConversationPhase.ENDED:
            raise ConversationAlreadyConcludedError(session_id)

        self._agent_director.set_state(state.agent_director_state)
        self._agent_director.get_welcome_agent().set_state(state.welcome_agent_state)
        self._agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
        self._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            state.collect_experience_state)
        self._agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(
            state.skills_explorer_agent_state)
        if self._enable_preference_elicitation:
            self._agent_director.get_preference_elicitation_agent().set_state(
                state.preference_elicitation_agent_state
            )
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        context = await self._conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)
        previous_pref_phase = (
            state.preference_elicitation_agent_state.conversation_phase
            if self._enable_preference_elicitation
            else None
        )
        await self._agent_director.execute(user_input=agent_input)
        # get the context again after updating the history
        context = await self._conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)
        # get the date when the conversation was conducted
        state.agent_director_state.conversation_conducted_at = datetime.now(timezone.utc)

        if self._enable_preference_elicitation:
            await self._maybe_save_preference_vector(state, previous_pref_phase)

        # save the state, before responding to the user
        await self._application_state_metrics_recorder.save_state(state, user_id)

        return ConversationResponse(
            messages=response,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=get_total_explored_experiences(state),
            current_phase=get_current_conversation_phase_response(state, self._logger)
        )

    async def _maybe_save_preference_vector(self, state: ApplicationState, previous_pref_phase: Optional[str]) -> None:
        """
        If the preference elicitation agent just transitioned to COMPLETE, mirror the
        learned PreferenceVector into the `job_preferences` collection so downstream
        consumers (matching, analytics, partner exports) can read it via REST.
        """
        if self._job_preferences_service is None:
            return
        pref_state = state.preference_elicitation_agent_state
        if pref_state.conversation_phase != "COMPLETE":
            return
        if previous_pref_phase == "COMPLETE":
            return  # Already saved on the turn it transitioned; idempotent re-saves are unnecessary.

        pv = pref_state.preference_vector
        job_preferences = JobPreferences(
            session_id=state.session_id,
            financial_importance=pv.financial_importance,
            work_environment_importance=pv.work_environment_importance,
            career_advancement_importance=pv.career_advancement_importance,
            work_life_balance_importance=pv.work_life_balance_importance,
            job_security_importance=pv.job_security_importance,
            task_preference_importance=pv.task_preference_importance,
            social_impact_importance=pv.social_impact_importance,
            confidence_score=pv.confidence_score,
            n_vignettes_completed=pv.n_vignettes_completed,
            per_dimension_uncertainty=pv.per_dimension_uncertainty,
            posterior_mean=pv.posterior_mean,
            posterior_covariance_diagonal=pv.posterior_covariance_diagonal,
            fim_determinant=pv.fim_determinant,
            decision_patterns=pv.decision_patterns,
        )
        await self._job_preferences_service.create_or_update(
            session_id=state.session_id,
            preferences=job_preferences,
        )
        self._logger.info(
            "Persisted PreferenceVector to job_preferences for session %s", state.session_id,
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