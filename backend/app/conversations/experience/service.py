import logging
from abc import ABC, abstractmethod

from app.agent.explore_experiences_agent_director import DiveInPhase
from app.conversations.experience.types import UpdateExperienceRequest, ExperienceResponse, Skill
from app.conversations.experience.utils import update_experience_entity
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder
from app.vector_search.esco_entities import SkillEntity


class ExperienceNotFoundError(Exception):
    """
    Exception raised when an experience is not found in the conversation state.
    """

    def __init__(self, experience_uuid: str):
        super().__init__(f"Experience with uuid {experience_uuid} not found")


class IExperienceService(ABC):
    @abstractmethod
    async def get_experiences_by_session_id(self, session_id: int) -> list[ExperienceResponse]:
        """
        Get all the experiences that have been discovered for this session so far
        :param session_id: int - id for the conversation session
        :return: list[Experience] - an array containing a list of experience objects
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def update_experience(self, user_id: str, session_id: int, experience_uuid: str,
                                update_payload: UpdateExperienceRequest) -> ExperienceResponse:
        """
        Update an experience for a given session.
        :param user_id: str - the id of the requesting user
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to update
        :param update_payload: UpdateExperienceRequest - the payload with the fields to update
        :return: Experience - the updated experience object
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
    async def get_original_experience_by_uuid(self, session_id: int, experience_uuid: str) -> ExperienceResponse:
        """
        Get the original experience by UUID
        :param session_id: int - id for the conversation session
        :param experience_uuid: str - the uuid of the experience to retrieve
        :return: ExperienceResponse - the original experience object
        :raises ExperienceNotFoundError: if the experience is not found
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_original_experiences(self, session_id: int) -> list[ExperienceResponse]:
        """
        Get all original experiences for a given session.
        :param session_id: int - id for the conversation session
        :return: list[ExperienceResponse] - a list of original experience objects
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()


class ExperienceService(IExperienceService):
    def __init__(self, *,
                 application_state_metrics_recorder: IApplicationStateMetricsRecorder):
        self._logger = logging.getLogger(ExperienceService.__name__)
        self._application_state_metrics_recorder = application_state_metrics_recorder

    async def update_experience(self, user_id: str, session_id: int, experience_uuid: str,
                                update_payload: UpdateExperienceRequest) -> ExperienceResponse:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # find the experience to update
        experience_to_update = None

        for exp in director_state.explored_experiences:
            if exp.uuid == experience_uuid:
                experience_to_update = exp
                break

        if not experience_to_update:
            raise ExperienceNotFoundError(experience_uuid)

        # build a map of all skills available in this experience
        all_skills: dict[str, SkillEntity] = {}
        for skill in director_state.experiences_state.get(experience_uuid, {}).experience.top_skills:
            all_skills[skill.UUID] = skill

        update_data = update_payload.model_dump(exclude_unset=True)

        # Update the experience entity with the provided update data
        # it mutates the experience_entity in place
        update_experience_entity(experience_to_update, update_data, all_skills)

        await self._application_state_metrics_recorder.save_state(state, user_id)

        # Convert ExperienceEntity to Experience DTO to return
        top_skills = [
            Skill(
                UUID=skill.UUID,
                preferredLabel=skill.preferredLabel,
                description=skill.description,
                altLabels=skill.altLabels,
                skillType=skill.skillType,
            )
            for skill in experience_to_update.top_skills
        ]

        return ExperienceResponse(
            uuid=experience_to_update.uuid,
            experience_title=experience_to_update.experience_title,
            company=experience_to_update.company,
            location=experience_to_update.location,
            timeline=experience_to_update.timeline,
            work_type=experience_to_update.work_type,
            top_skills=top_skills,
            summary=experience_to_update.summary,
            # since we can only update processed experiences right now, we set the exploration phase to PROCESSED
            exploration_phase=DiveInPhase.PROCESSED.name
        )

    async def get_experiences_by_session_id(self, session_id: int) -> list[ExperienceResponse]:
        # Get the experiences from the application state
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # experiences to return to the user.
        experiences: list[ExperienceResponse] = []

        # 1. First, get the explored experiences from the `director_state`
        for experience_details in director_state.explored_experiences:
            experiences.append(ExperienceResponse.from_experience_entity(experience_details, DiveInPhase.PROCESSED))

        # 2. Then, get the experiences that are in the `experiences_state` but not yet explored.
        #    Append them to the experiences to return to the user.
        for uuid, exp_state in director_state.experiences_state.items():
            if exp_state.dive_in_phase == DiveInPhase.PROCESSED:
                continue  # Skip ones we already explored

            experiences.append(ExperienceResponse.from_experience_entity(exp_state.experience, exp_state.dive_in_phase))

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

        # Remove the experience from explored experiences
        director_state.explored_experiences.remove(experience_to_delete)

        await self._application_state_metrics_recorder.save_state(state, user_id)

    async def get_original_experience_by_uuid(self, session_id: int, experience_uuid: str) -> ExperienceResponse:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # Find the experience in the explored experiences
        for exp_uuid, exp_state in director_state.experiences_state.items():
            if exp_uuid == experience_uuid:
                return ExperienceResponse.from_experience_entity(exp_state.experience, exp_state.dive_in_phase)

        # If not found, raise an error
        raise ExperienceNotFoundError(experience_uuid)

    async def get_original_experiences(self, session_id: int) -> list[ExperienceResponse]:
        state = await self._application_state_metrics_recorder.get_state(session_id)
        director_state = state.explore_experiences_director_state

        # Collect all original experiences
        original_experiences: list[ExperienceResponse] = []

        for exp_uuid, exp_state in director_state.experiences_state.items():
            original_experiences.append(ExperienceResponse.from_experience_entity(exp_state.experience, exp_state.dive_in_phase))

        return original_experiences
