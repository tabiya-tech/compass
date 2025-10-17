import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Tuple, cast
import random

from app.app_config import get_application_config
from app.application_state import IApplicationStateManager
from app.users.repositories import IUserPreferenceRepository
from common_libs.time_utilities import get_now
from features.skills_ranking.constants import SKILLS_RANKING_EXPERIMENT_ID
from features.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.state.services.type import SkillsRankingState, SkillRankingExperimentGroup, \
    SkillsRankingScore, \
    SkillsRankingPhase, UpdateSkillsRankingRequest, SkillsRankingPhaseName
from features.skills_ranking.services.skills_ranking_service import SkillsRankingService
from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingServiceRequestError,
    SkillsRankingServiceError,
    SkillsRankingGenericError,
)
from features.skills_ranking.state.utils.get_group import get_group
from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase

CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH = 30


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
                 skills_ranking_service: SkillsRankingService,
                 high_difference_threshold: float,
                 correct_rotations_threshold_for_group_switch: int):
        # repositories
        self._repository = repository
        self._user_preferences_repository = user_preferences_repository
        self._registration_data_repository = registration_data_repository

        # services
        self._http_client = skills_ranking_service
        self._application_state_manager = application_state_manager

        # Configurations
        self._high_difference_threshold = high_difference_threshold
        self._correct_rotations_threshold_for_group_switch = correct_rotations_threshold_for_group_switch
        
        # Logger
        self._logger = logging.getLogger(self.__class__.__name__)

    def _get_switched_update_request(self,
                                     update_request: UpdateSkillsRankingRequest,
                                     existing_state: SkillsRankingState) -> UpdateSkillsRankingRequest:
        """
        Determine if a group switch should occur and return an updated request with the correct phase and group.
        """

        # Only apply group switching when transitioning FROM PROOF_OF_VALUE
        # If the new phase is not PROOF_OF_VALUE, return the original update request
        if update_request.phase is None or existing_state.phase[-1].name != "PROOF_OF_VALUE":
            return update_request

        # Only apply to groups 2 and 3
        # We are only left with Group 2 and Group 3,
        if existing_state.experiment_group not in [SkillRankingExperimentGroup.GROUP_2,
                                                   SkillRankingExperimentGroup.GROUP_3]:
            return update_request

        # Only apply if we should apply the random group switch
        # 95% we don't switch.
        # 5% we are going to do a switch of the group.
        should_apply_switch = random.random() < 0.05  # nosec B311 # we are intentionally using a random check here for group switching
        # if the random value gets between 0.05 and 1, (95% of the time), we will do not apply the switch and return.
        if not should_apply_switch:
            return update_request

        # Otherwise, apply the switching of the groups
        # Determine the new group based on `correct rotations` switch
        if existing_state.correct_rotations is None or existing_state.correct_rotations <= self._correct_rotations_threshold_for_group_switch:
            new_group = SkillRankingExperimentGroup.GROUP_2  # No information
        else:
            new_group = SkillRankingExperimentGroup.GROUP_3  # Information

        # Determine the correct phase for the new group.
        # Group 2 and 4 skip `MARKET_DISCLOSURE`, while Group 1 and 3 see it.
        if new_group == SkillRankingExperimentGroup.GROUP_2:
            # Job Seeker Disclosure phase applies differently.
            # If in Group 1 and Group 3 -> You see the actual jobseeker rank.
            # But if the Group 2 and Group 4 -> You see the message telling you, we will contact you later.
            # @see: frontend-new/src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingJobSeekerDisclosure/SkillsRankingJobSeekerDisclosure.tsx
            # So that is why we are jumping to the `JOB_SEEKER_DISCLOSURE` phase if you have been moved to Group 2.
            # Otherwise, you get to see the `MARKET_DISCLOSURE` phase. (which comes before the `JOB_SEEKER_DISCLOSURE` phase)
            correct_phase = "JOB_SEEKER_DISCLOSURE"
        else:
            correct_phase = "MARKET_DISCLOSURE"

        # Create a new update request with both the group change and phase adjustment
        return UpdateSkillsRankingRequest(
            phase=cast(SkillsRankingPhaseName, correct_phase),
            experiment_group=new_group,
            **update_request.model_dump(exclude={'phase', 'experiment_group'}))

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
            phase=[SkillsRankingPhase(
                name=update_request.phase,
                time=get_now()
            )],
            experiment_group=experiment_group,
            score=participant_rank,
            started_at=get_now()
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
            last_phase = existing_state.phase[-1]  # latest phase in history
            possible_next_states = get_possible_next_phase(last_phase.name)
            if update_request.phase not in possible_next_states:
                raise InvalidNewPhaseError(
                    current_phase=last_phase.name,
                    expected_phases=possible_next_states
                )

        # Apply random group switching logic — this may modify the update request
        # Only applies when transitioning FROM PROOF_OF_VALUE for groups 2 and 3 with 5% probability
        # This will add the experiment_group in the update_request if needed
        updated_request = self._get_switched_update_request(update_request, existing_state)

        # If the experiment group has changed (because a previous step of randomly switching groups was applied),
        # update the user preferences with the new experiment group.
        experiment_group_changed = updated_request.experiment_group != existing_state.experiment_group
        if updated_request.experiment_group is not None and experiment_group_changed:
            # update the repository with the new experiment group
            await self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                experiment_config=updated_request.experiment_group.name
            )

        # Automatically set completed at when transitioning to COMPLETED phase
        if updated_request.phase == "COMPLETED":
            updated_request.completed_at = get_now()

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
        prior_beliefs = await self._registration_data_repository.get_prior_beliefs(user_id=user_id)

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

        # Flatten the list of skills and get the originUUIDs
        participant_skills_uuids: set[str] = {skill.originUUID for skill in participant_skills}

        # 3. Compute the ranking score for this participant
        taxonomy_model_id = get_application_config().taxonomy_model_id
        
        try:
            score = await self._http_client.get_participant_ranking(
                user_id=user_id,
                prior_beliefs=prior_beliefs,
                participants_skills_uuids=participant_skills_uuids,
                taxonomy_model_id=taxonomy_model_id
            )
        except SkillsRankingServiceHTTPError as e:
            self._logger.error(f"HTTP error from skills ranking service: {e.status_code} - {e.body}")
            raise SkillsRankingGenericError("Skills ranking service HTTP error")
        except SkillsRankingServiceTimeoutError as e:
            self._logger.error(f"Timeout from skills ranking service: {e.details}")
            raise SkillsRankingGenericError("Skills ranking service timeout")
        except SkillsRankingServiceRequestError as e:
            self._logger.error(f"Request error from skills ranking service: {e.details}")
            raise SkillsRankingGenericError("Skills ranking service request error")
        except SkillsRankingServiceError as e:
            self._logger.error(f"Generic error from skills ranking service: {e.message}")
            raise SkillsRankingGenericError("Skills ranking service error")

        # 4. Because the ranking service returns scores between 0 and 1,
        #    we need to convert it to a values between 0 and 100 and round to 2 decimal places
        jobs_matching_rank_percentage = round(score.jobs_matching_rank * 100, 2)
        comparison_rank_percentage = round(score.comparison_rank * 100, 2)

        savable_score = SkillsRankingScore(
            jobs_matching_rank=jobs_matching_rank_percentage,
            comparison_rank=comparison_rank_percentage,
            comparison_label=score.comparison_label,
            calculated_at=score.calculated_at
        )

        # 5. THEN compute the experiment group based on the prior belief, and the actual rank
        experiment_group = self._get_group(
            # Using the prior belief as opportunity_rank_prior_belief
            self_estimated_rank=prior_beliefs.opportunity_rank_prior_belief,
            actual_rank=score.jobs_matching_rank
        )

        # 6. Return the score, and the experiment group
        return savable_score, experiment_group

    def _get_group(self,
                   self_estimated_rank: float,
                   actual_rank: float):

        return get_group(
            self_estimated_rank=self_estimated_rank,
            actual_rank=actual_rank,
            high_difference_threshold=self._high_difference_threshold
        )
