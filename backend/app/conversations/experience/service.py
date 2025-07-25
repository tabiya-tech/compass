import logging
from abc import ABC, abstractmethod

from app.agent.explore_experiences_agent_director import DiveInPhase
from app.conversations.experience._types import UpdateExperienceRequest, ExperienceEntity
from app.conversations.experience.utils import update_experience_entity
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder


class ExperienceNotFoundError(Exception):
    """
    Exception raised when an experience is not found in the conversation state.
    """

    def __init__(self, experience_uuid: str):
        super().__init__(f"Experience with uuid {experience_uuid} not found")


class IExperienceService(ABC):
    @abstractmethod
    async def get_experiences_by_session_id(self, session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        """
        Get all the experiences on the given conversation session.

        :param session_id: int - id for the conversation session
        :return: List[Tuple[ExperienceEntity, DiveInPhase]] - an array containing tuples of (ExperienceEntity, DiveInPhase)
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_deleted_experiences_by_session_id(self,
                                                    session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        """
        Get all deleted the experiences.

        :param session_id: int - id for the conversation session
        :return: List[Tuple[ExperienceEntity, DiveInPhase]] - an array containing tuples of (ExperienceEntity, DiveInPhase)
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def update_experience(self,
                                user_id: str,
                                session_id: int,
                                experience_uuid: str,
                                update_payload: UpdateExperienceRequest) -> tuple[ExperienceEntity, DiveInPhase]:
        """
        Update an experience for a given session.
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to update
        :param update_payload: UpdateExperienceRequest - the payload with the fields to update
        :return Tuple[ExperienceEntity, DiveInPhase]: - a tuple containing the updated experience object and its dive-in phase
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete_experience(self, user_id: str, session_id: int, experience_uuid: str) -> None:
        """
        Delete an experience for a given session.
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to delete
        :raises ExperienceNotFoundError: if the experience is not found
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_unedited_experience_by_uuid(self,
                                              session_id: int,
                                              experience_uuid: str) -> tuple[ExperienceEntity, DiveInPhase]:
        """
        Get the unedited experience by UUID
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to retrieve
        :return: Tuple[ExperienceEntity, DiveInPhase] - a tuple containing the experience object and its dive-in phase
        :raises ExperienceNotFoundError: if the experience is not found
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_unedited_experiences(self, session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        """
        Get all unedited experiences for a given session.
        :param session_id: int - id for the conversation session
        :return: List[Tuple[ExperienceEntity, DiveInPhase]] - a list of tuples containing the experience objects and their dive-in phases
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def restore_deleted_experience(self,
                                         user_id: str,
                                         session_id: int,
                                         experience_uuid: str) -> tuple[ExperienceEntity, DiveInPhase]:
        """
        Restore a deleted experience for a given session.
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to restore
        :return: Tuple[ExperienceEntity, DiveInPhase] - a tuple containing the restored experience object and its dive-in phase
        :raises ExperienceNotFoundError: if the experience is not found
        """
        raise NotImplementedError()


class ExperienceService(IExperienceService):
    def __init__(self, *,
                 application_state_metrics_recorder: IApplicationStateMetricsRecorder):
        self._logger = logging.getLogger(ExperienceService.__name__)
        self._application_state_metrics_recorder = application_state_metrics_recorder

    async def update_experience(self, user_id: str, session_id: int, experience_uuid: str,
                                update_payload: UpdateExperienceRequest) -> tuple[ExperienceEntity, DiveInPhase]:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # find the experience to update
        experience_to_update: ExperienceEntity | None = None

        for exp in director_state.explored_experiences:
            if exp.uuid == experience_uuid:
                experience_to_update = exp
                break

        # if the experience to update is not found, throw an Error.
        if not experience_to_update:
            raise ExperienceNotFoundError(experience_uuid)

        update_data = update_payload.model_dump(exclude_unset=True)

        # Update the experience entity with the remaining update data
        update_experience_entity(experience_to_update, update_data)

        await self._application_state_metrics_recorder.save_state(state, user_id)

        # REVIEW: get DIVE_IN PHASE it from the experience_state
        return experience_to_update, DiveInPhase.PROCESSED

    async def get_experiences_by_session_id(self, session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        # Get the experiences from the application state
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # experiences to return to the user.
        experiences: list[tuple[ExperienceEntity, DiveInPhase]] = []

        # 1. First, get the explored experiences from the `director_state`
        for experience_details in director_state.explored_experiences:
            experiences.append((experience_details, DiveInPhase.PROCESSED))

        # 2. Then, get the experiences that are in the `experiences_state` but not yet explored.
        #    Append them to the experiences to return to the user.
        for uuid, exp_state in director_state.experiences_state.items():
            if exp_state.dive_in_phase == DiveInPhase.PROCESSED:
                continue  # Skip ones we already explored

            experiences.append((exp_state.experience, exp_state.dive_in_phase))

        return experiences

    async def get_deleted_experiences_by_session_id(self,
                                                    session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        # Get the experiences from the application state
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # experiences to return to the user.
        experiences: list[tuple[ExperienceEntity, DiveInPhase]] = []

        # 1. First, get the deleted experiences from the `director_state`
        for experience_details in director_state.deleted_experiences:
            experiences.append((experience_details, DiveInPhase.PROCESSED))

        return experiences

    async def delete_experience(self, user_id: str, session_id: int, experience_uuid: str) -> None:
        # Get the experience from the application state
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # find the experience to delete
        experience_to_delete = None

        for exp in director_state.explored_experiences:
            if exp.uuid == experience_uuid:
                experience_to_delete = exp
                break

        if not experience_to_delete:
            raise ExperienceNotFoundError(experience_uuid)

        # remove the experience from the explored_experiences to deleted_experiences
        director_state.explored_experiences = list(filter(lambda _exp: _exp.uuid != experience_uuid,
                                                          director_state.explored_experiences))

        director_state.deleted_experiences.append(experience_to_delete)

        await self._application_state_metrics_recorder.save_state(state, user_id)

    async def get_unedited_experience_by_uuid(self,
                                              session_id: int,
                                              experience_uuid: str) -> tuple[ExperienceEntity, DiveInPhase]:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # Find the experience in the explored experiences
        for exp_uuid, exp_state in director_state.experiences_state.items():
            if exp_uuid == experience_uuid:
                return exp_state.experience, exp_state.dive_in_phase

        # If not found, raise an error
        raise ExperienceNotFoundError(experience_uuid)

    async def get_unedited_experiences(self, session_id: int) -> list[tuple[ExperienceEntity, DiveInPhase]]:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # Collect all unedited experiences
        unedited_experiences: list[tuple[ExperienceEntity, DiveInPhase]] = []

        for exp_uuid, exp_state in director_state.experiences_state.items():
            unedited_experiences.append((exp_state.experience, exp_state.dive_in_phase))

        return unedited_experiences

    async def restore_deleted_experience(self,
                                         user_id: str,
                                         session_id: int,
                                         experience_uuid: str) -> tuple[ExperienceEntity, DiveInPhase]:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        deleted_experience: ExperienceEntity | None = None
        # Find the experience in the explored experiences
        for exp in director_state.deleted_experiences:
            if exp.uuid == experience_uuid:
                deleted_experience = exp

        if not deleted_experience:
            raise ExperienceNotFoundError(experience_uuid)

        # remove it from the deleted experiences to the explored experience
        director_state.deleted_experiences = list(filter(lambda _exp: _exp.uuid != experience_uuid,
                                                         director_state.deleted_experiences))

        director_state.explored_experiences.append(deleted_experience)

        await self._application_state_metrics_recorder.save_state(state, user_id)

        return deleted_experience, DiveInPhase.PROCESSED
