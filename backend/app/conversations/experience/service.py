import logging
from abc import ABC, abstractmethod

from app.agent.explore_experiences_agent_director import DiveInPhase
from app.conversations.experience._types import UpdateExperienceRequest, ExperienceEntity
from app.conversations.experience.utils import update_experience_entity, compute_top_skill_changes, \
    get_work_type_from_experience
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder
from app.metrics.services.service import IMetricsService
from app.metrics.types import ExperienceChangedEvent, SkillChangedEvent, ActionLiteral


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
                 application_state_metrics_recorder: IApplicationStateMetricsRecorder,
                 metrics_service: IMetricsService):
        self._logger = logging.getLogger(ExperienceService.__name__)
        self._application_state_metrics_recorder = application_state_metrics_recorder
        self._metrics_service = metrics_service

    async def _record_experience_change(self, user_id: str, session_id: int, work_type: str, edited_fields: list[str]) -> None:
        """Record metrics for experience changes."""
        if not edited_fields:
            return

        try:
            await self._metrics_service.record_event(
                ExperienceChangedEvent(
                    user_id=user_id,
                    session_id=session_id,
                    action="EDITED",
                    work_type=work_type,
                    edited_fields=edited_fields
                )
            )
        except Exception as e:
            self._logger.exception(f"Unexpected error recording metrics for experience edit: {str(e)}")

    async def _record_skill_changes(self, user_id: str, session_id: int, work_type: str,
                                    skill_changes: dict[ActionLiteral, set[str]]) -> None:
        """Record metrics for skill changes."""
        if not any(skill_changes.values()):
            return

        for action_str, uuid_set in skill_changes.items():
            if not uuid_set:
                continue
            try:
                await self._metrics_service.record_event(
                    SkillChangedEvent(
                        user_id=user_id,
                        session_id=session_id,
                        uuids=list(uuid_set),
                        action=action_str,
                        work_type=work_type
                    )
                )
            except Exception as e:
                self._logger.exception(f"Failed recording SkillChangedEvent for action {action_str}: {e}")

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

        # compute skill diffs before mutating the entity
        skill_changes: dict[ActionLiteral, set[str]] = compute_top_skill_changes(
            experience_to_update, update_data.get("top_skills", None)
        )

        # Update the experience entity with the remaining update data
        update_experience_entity(experience_to_update, update_data)

        await self._application_state_metrics_recorder.save_state(state, user_id)

        # Record metrics for the update
        edited_fields = list(update_data.keys())
        if "top_skills" in edited_fields:
            edited_fields.remove("top_skills")

        work_type = get_work_type_from_experience(experience_to_update)

        await self._record_experience_change(user_id, session_id, work_type, edited_fields)
        await self._record_skill_changes(user_id, session_id, work_type, skill_changes)

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

        # record the delete event for an experience entity changed event
        try:
            work_type = get_work_type_from_experience(experience_to_delete)

            event = ExperienceChangedEvent(
                user_id=user_id,
                session_id=session_id,
                action="DELETED",
                work_type=work_type
            )
            await self._metrics_service.record_event(event)
        except Exception as e:
            self._logger.exception(f"Unexpected error recording metrics for experience delete: {str(e)}")

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

        # record the restore event for an experience entity changed event
        try:
            work_type = get_work_type_from_experience(deleted_experience)

            event = ExperienceChangedEvent(
                user_id=user_id,
                session_id=session_id,
                action="RESTORED",
                work_type=work_type
            )
            await self._metrics_service.record_event(event)
        except Exception as e:
            self._logger.exception(f"Unexpected error recording metrics for experience delete: {str(e)}")

        return deleted_experience, DiveInPhase.PROCESSED
