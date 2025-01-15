"""
This module contains the service layer for the conversation module.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.agent.agent_types import AgentInput
from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationStateManager
from app.conversations.types import ConversationResponse
from app.conversations.utils import get_messages_from_conversation_manager, filter_conversation_history
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.sensitive_filter import sensitive_filter
from app.types import Experience, Skill
from app.users.repositories import UserPreferenceRepository


class UnauthorizedSessionAccessError(Exception):
    """
    Exception raised when there is an attempt to read or write to a session that is not owned by the requesting user
    """
    def __init__(self, user_id: str, session_id: int):
        message = f"User {user_id} is not authorized to access session {session_id}"
        super().__init__(message)

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
    async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool, filter_pii: bool) -> ConversationResponse:
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

    @abstractmethod
    async def get_experiences_by_session_id(self, user_id: str, session_id: int) -> list[Experience]:
        """
        Get all the experiences that have been discovered for this session so far
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :return: list[Experience] - an array containing a list of experience objects
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

class ConversationService(IConversationService):
    def __init__(self, *, application_state_manager: ApplicationStateManager, agent_director: LLMAgentDirector, conversation_memory_manager: ConversationMemoryManager, user_preference_repository: UserPreferenceRepository):
        self._logger = logging.getLogger(ConversationService.__name__)
        self._agent_director = agent_director
        self._application_state_manager = application_state_manager
        self._conversation_memory_manager = conversation_memory_manager
        self._user_preference_repository = user_preference_repository

    async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool, filter_pii: bool) -> ConversationResponse:
        # check that the user making the request has the session_id in their user preferences
        current_user_preferences = await self._user_preference_repository.get_user_preference_by_user_id(user_id)
        if current_user_preferences is None or session_id not in current_user_preferences.sessions:
            raise UnauthorizedSessionAccessError(user_id, session_id)

        if clear_memory:
            await self._application_state_manager.delete_state(session_id)
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

            # set the sent_at for the user input
        user_input = AgentInput(message=user_input, sent_at=datetime.now(timezone.utc))

        # set the state of the agent director, the conversation memory manager and all the agents
        state = await self._application_state_manager.get_state(session_id)

        # Check if the conversation has ended
        if state.agent_director_state.current_phase == ConversationPhase.ENDED:
            raise ConversationAlreadyConcludedError(session_id)

        self._agent_director.set_state(state.agent_director_state)
        self._agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
        self._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            state.collect_experience_state)
        self._agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(state.skills_explorer_agent_state)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        context = await self._conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)
        await self._agent_director.execute(user_input=user_input)
        # get the context again after updating the history
        context = await self._conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)
        # get the date when the conversation was conducted
        state.agent_director_state.conversation_conducted_at = datetime.now(timezone.utc)
        # Count for number of experiences explored in the conversation
        experiences_explored = 0

        for exp in state.explore_experiences_director_state.experiences_state.values():
            # Check if the experience has been processed and has top skills
            if exp.dive_in_phase == DiveInPhase.PROCESSED and len(exp.experience.top_skills) > 0:
                experiences_explored += 1

        # save the state, before responding to the user
        await self._application_state_manager.save_state(state)
        return ConversationResponse(
            messages=response,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=experiences_explored
        )

    async def get_history_by_session_id(self, user_id: str, session_id: int) -> ConversationResponse:
        # check that the user making the request has the session_id in their user preferences
        current_user_preferences = await self._user_preference_repository.get_user_preference_by_user_id(user_id)
        if current_user_preferences is None or session_id not in current_user_preferences.sessions:
            raise UnauthorizedSessionAccessError(user_id, session_id)

        state = await self._application_state_manager.get_state(session_id)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context = await self._conversation_memory_manager.get_conversation_context()
        messages = filter_conversation_history(context.all_history)

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
            experiences_explored=experiences_explored
        )

    async def get_experiences_by_session_id(self, user_id: str, session_id: int) -> list[Experience]:
        # check that the user making the request has the session_id in their user preferences
        current_user_preferences = await self._user_preference_repository.get_user_preference_by_user_id(user_id)
        if current_user_preferences is None or session_id not in current_user_preferences.sessions:
            raise UnauthorizedSessionAccessError(user_id, session_id)
        # Get the experiences from the application state
        state = await self._application_state_manager.get_state(session_id)

        experiences: list[Experience] = []

        for uuid in state.explore_experiences_director_state.experiences_state:
            """
            UUID is the key for the experiences_state dictionary in the explore_experiences_director_state.
            """
            experience_details: ExperienceEntity = state.explore_experiences_director_state.experiences_state[uuid].experience
            """
            experience_details is the value for the UUID key in the experiences_state dictionary.
            """
            top_skills = []
            """
            Top skills for the experience.
            """

            for skill in experience_details.top_skills:
                """
                Construct the Skill object for each skill in the top_skills list.
                """
                top_skills.append(Skill(
                    UUID=skill.UUID,
                    preferredLabel=skill.preferredLabel,
                    description=skill.description,
                    altLabels=skill.altLabels
                ))

            experiences.append(Experience(
                UUID=experience_details.uuid,
                experience_title=experience_details.experience_title,
                company=experience_details.company,
                location=experience_details.location,
                start_date=experience_details.timeline.start,
                end_date=experience_details.timeline.end,
                work_type=experience_details.work_type,
                top_skills=top_skills
            ))

        return experiences