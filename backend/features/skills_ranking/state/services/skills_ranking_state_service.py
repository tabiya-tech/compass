import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Tuple

from app.app_config import get_application_config
from app.application_state import IApplicationStateManager
from app.users.repositories import IUserPreferenceRepository
from common_libs.time_utilities import get_now
from features.skills_ranking.constants import SKILLS_RANKING_EXPERIMENT_ID
from features.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound
from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingServiceRequestError,
    SkillsRankingServiceError,
    SkillsRankingGenericError,
)
from features.skills_ranking.services.skills_ranking_service import SkillsRankingService
from features.skills_ranking.state.repositories.errors import RegistrationDataNotFoundError
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.state.services.type import SkillsRankingState, SkillRankingExperimentGroup, \
    SkillsRankingScore, \
    SkillsRankingPhase, UpdateSkillsRankingRequest, ProcessMetadata, UserResponses
from features.skills_ranking.state.utils.get_group import get_group
from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase
from features.skills_ranking.types import PriorBeliefs


class ISkillsRankingStateService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self,
                           session_id: int,
                           update_request: UpdateSkillsRankingRequest,
                           user_id: str) -> SkillsRankingState:
        """
        Upsert the SkillsRankingState for a given session ID.

        :param session_id: The session ID to upsert the state for.
        :param update_request: The structured update request containing the fields to update.
        :param user_id: The user ID to associate with the state.

        :return: SkillsRankingState
        """
        raise NotImplementedError

    @abstractmethod
    async def calculate_ranking_and_groups(self,
                                           user_id: str,
                                           session_id: int) -> Tuple[SkillsRankingScore, SkillRankingExperimentGroup]:
        """
        Calculate the ranking and experiment groups for a given session ID.
        :return: A tuple containing the SkillsRankingScore and SkillRankingExperimentGroup.
        """

        raise NotImplementedError


class SkillsRankingStateService(ISkillsRankingStateService):
    """
    SkillsRankingService implementation.
    """

    def __init__(self,
                 repository: ISkillsRankingStateRepository,
                 user_preferences_repository: IUserPreferenceRepository,
                 registration_data_repository: IRegistrationDataRepository,
                 application_state_manager: IApplicationStateManager,
                 skills_ranking_service: SkillsRankingService):
        # repositories
        self._repository = repository
        self._user_preferences_repository = user_preferences_repository
        self._registration_data_repository = registration_data_repository

        # services
        self._http_client = skills_ranking_service
        self._application_state_manager = application_state_manager

        # Logger
        self._logger = logging.getLogger(self.__class__.__name__)

    async def _initialize_state(self,
                                session_id: int,
                                update_request: UpdateSkillsRankingRequest,
                                user_id: str) -> SkillsRankingState:
        # 1. If the update_request.phase not INITIAL, raise an error
        #    Because we expect the method client to send INITIAL for the first time.
        #    So that we can create/initialize the state.
        if update_request.phase != "INITIAL":
            raise SkillsRankingStateNotFound(session_id=session_id)

        # 2. Compute the ranking and experiment group
        #    For this specific user and session
        participant_rank, experiment_group = await self.calculate_ranking_and_groups(user_id=user_id,
                                                                                     session_id=session_id)

        # 3. Construct the new SkillsRankingState with the INITIAL phase.
        #    AND the `started at` as now, as it is the first time the user is calling this method.
        new_state = SkillsRankingState(
            session_id=session_id,
            phase=[
                SkillsRankingPhase(
                    name=update_request.phase,  # INITIAL
                    time=get_now()
                )
            ],
            metadata=ProcessMetadata(
                experiment_group=experiment_group,
                started_at=get_now()
            ),
            score=participant_rank,
            user_responses=UserResponses()
        )

        # 4. Save the new state to the database and update user preferences.
        _, saved_state = await asyncio.gather(
            # 4.1 Update the `user_preferences.experiments.SKILLS_RANKING_EXPERIMENT_ID` with the new calculated group.
            self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                experiment_config=experiment_group.name
            ),

            # 4.2 Save the new state to the `skills ranking state repository`.
            self._repository.create(new_state)
        )

        return saved_state

    async def _update_state(self,
                            session_id: int,
                            existing_state: SkillsRankingState,
                            update_request: UpdateSkillsRankingRequest,
                            user_id: str) -> SkillsRankingState:
        # update_request.phase is optional, but if provided, it must be a valid next phase
        if update_request.phase is not None:
            last_phase = existing_state.phase[-1]
            possible_next_states = get_possible_next_phase(last_phase.name, existing_state.metadata.experiment_group)
            if update_request.phase not in possible_next_states:
                raise InvalidNewPhaseError(
                    current_phase=last_phase.name,
                    expected_phases=possible_next_states
                )

        updated_request = update_request

        if update_request.metadata is None:
            update_request.metadata = {}
        if update_request.user_responses is None:
            update_request.user_responses = {}

        if "experiment_group" in update_request.metadata:
            experiment_group = update_request.metadata["experiment_group"]
            if isinstance(experiment_group, str):
                experiment_group = SkillRankingExperimentGroup[experiment_group]
            experiment_group_changed = experiment_group != existing_state.metadata.experiment_group
            if experiment_group_changed:
                await self._user_preferences_repository.set_experiment_by_user_id(
                    user_id=user_id,
                    experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                    experiment_config=experiment_group.name
                )

        # Automatically set completed at when transitioning to COMPLETED phase
        if update_request.phase == "COMPLETED":
            update_request.completed_at = get_now()

        # Update the state in the database with the new request
        saved_state = await self._repository.update(session_id=session_id,
                                                    update_request=updated_request)

        if saved_state is None:
            raise SkillsRankingStateNotFound(session_id=session_id)

        return saved_state

    async def upsert_state(
            self,
            session_id: int,
            update_request: UpdateSkillsRankingRequest,
            user_id: str
    ) -> SkillsRankingState:
        existing_state = await self._repository.get_by_session_id(session_id)

        if existing_state is None:
            # If the `existing_state` is None, this means that the user is calling this method for the first time
            # We need to:-
            #   1. Calculate ranking and experiment group
            #   2. Create a new SkillsRankingState with the INITIAL phase.
            return await self._initialize_state(session_id, update_request, user_id)
        else:
            # Else update we update the state in the database.
            return await self._update_state(session_id, existing_state, update_request, user_id)

    async def calculate_ranking_and_groups(self,
                                           user_id: str,
                                           session_id: int) -> Tuple[SkillsRankingScore, SkillRankingExperimentGroup]:

        # 1. we need to get the prior beliefs
        try:
            prior_beliefs = await self._registration_data_repository.get_prior_beliefs(user_id=user_id)
        except RegistrationDataNotFoundError as e:
            # A new algorithm doesn't require prior beliefs,
            # so we can continue with default values.
            # Log an exception in this case to evaluate this separately.
            # Also, for local development and testing, we can continue with default values.
            _default_prior_beliefs = PriorBeliefs()
            self._logger.error(
                f"Registration data not found for user: {user_id}. "
                f"Continuing with default values. {_default_prior_beliefs} "
                f"Exception: {e}", exc_info=e)
            prior_beliefs = _default_prior_beliefs

        # 2. let's get all the skills for this specific session.
        state = await self._application_state_manager.get_state(session_id=session_id)
        #  Get all the experience data from the state of the user
        #  All the experience user explored in the session.
        experiences_data = state.explore_experiences_director_state.experiences_state.values()

        # a list of all experiences that the user has discovered and explored
        participant_experiences = [exp_state.experience for exp_state in experiences_data]

        # for each experience, we will get the top skills and the remaining skills
        participant_skills = []
        for experience in participant_experiences:
            participant_skills += experience.top_skills
            participant_skills += experience.remaining_skills

        # Ranking algorithm v2 uses skill UUIDs
        participant_skills_uuids: set[str] = {skill.UUID for skill in participant_skills}

        # Get the taxonomy model id used to generate the skills.
        # Prefer the taxonomy model id used to generate the skills.
        # If not found, fall back to the config taxonomy model id.
        # Be more tolerant.
        taxonomy_model_ids = [skill.modelId for skill in participant_skills]
        taxonomy_model_id = None
        match len(set(taxonomy_model_ids)):
            case 0:
                taxonomy_model_id = get_application_config().tabiya_model_id
            case 1:
                taxonomy_model_id = taxonomy_model_ids
            case _:
                taxonomy_model_id = taxonomy_model_ids[0]
                self._logger.warning(
                    f"User had more than one taxonomy model id. {taxonomy_model_ids}, going with {taxonomy_model_id}")

        # 3. Compute the ranking score for this participant
        try:
            score = await self._http_client.get_participant_ranking(
                user_id=user_id,
                prior_beliefs=prior_beliefs,
                participants_skills_uuids=participant_skills_uuids,
                taxonomy_model_id=taxonomy_model_id
            )
        except SkillsRankingServiceHTTPError as e:
            self._logger.error(f"HTTP error from skills ranking service: {e.status_code} - {e.body}")
            raise SkillsRankingGenericError("Skills ranking service HTTP error") from e
        except SkillsRankingServiceTimeoutError as e:
            self._logger.error(f"Timeout from skills ranking service: {e.details}")
            raise SkillsRankingGenericError("Skills ranking service timeout") from e
        except SkillsRankingServiceRequestError as e:
            self._logger.error(f"Request error from skills ranking service: {e.details}")
            raise SkillsRankingGenericError("Skills ranking service request error") from e
        except SkillsRankingServiceError as e:
            self._logger.error(f"Generic error from skills ranking service: {e.message}")
            raise SkillsRankingGenericError("Skills ranking service error") from e

        savable_score = score

        # 5. Compute the experiment group via randomized assignment
        experiment_group = self._get_group()

        # 6. Return the score, and the experiment group
        return savable_score, experiment_group

    def _get_group(self) -> SkillRankingExperimentGroup:
        return get_group()
