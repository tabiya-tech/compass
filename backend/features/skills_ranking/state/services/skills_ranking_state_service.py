from abc import ABC, abstractmethod
from typing import Tuple, cast
import random
import logging

from app.application_state import IApplicationStateManager
from app.users.repositories import IUserPreferenceRepository
from common_libs.time_utilities import get_now
from features.skills_ranking.constants import SKILLS_RANKING_EXPERIMENT_ID
from features.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound, InvalidFieldsForPhaseError
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.state.services.type import SkillsRankingState, SkillRankingExperimentGroup, \
    SkillsRankingScore, \
    SkillsRankingPhase, UpdateSkillsRankingRequest, SkillsRankingPhaseName
from features.skills_ranking.ranking_service.services.ranking_service import IRankingService
from features.skills_ranking.state.utils.get_group import get_group
from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase

CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH = 30

class ISkillsRankingStateService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self, session_id: int,
                           update_request: UpdateSkillsRankingRequest,
                           user_id: str) -> SkillsRankingState:
        """
        Upsert the SkillsRankingState for a given session ID.
        :param session_id: the session ID to upsert the state for.
        :param update_request: the structured update request containing the fields to update.
        :param user_id: the user ID to associate with the state.
        :return: SkillsRankingState
        """
        raise NotImplementedError()

    @abstractmethod
    async def calculate_ranking_and_groups(self, user_id: str, session_id: int) -> Tuple[
        SkillsRankingScore, SkillRankingExperimentGroup]:
        """
        Calculate the ranking and experiment groups for a given session ID.
        :return: A tuple containing the SkillsRankingScore and SkillRankingExperimentGroup.
        """
        raise NotImplementedError()


class SkillsRankingStateService(ISkillsRankingStateService):
    """
    SkillsRankingService implementation.
    """

    def __init__(self, repository: ISkillsRankingStateRepository,
                 user_preferences_repository: IUserPreferenceRepository,
                 registration_data_repository: IRegistrationDataRepository,
                 application_state_manage: IApplicationStateManager,
                 ranking_service: IRankingService,
                 high_difference_threshold: float):

        self._repository = repository
        self._user_preferences_repository = user_preferences_repository
        self._ranking_service = ranking_service
        self._registration_data_repository = registration_data_repository
        self._application_state_manager = application_state_manage
        self._high_difference_threshold = high_difference_threshold

    def _should_apply_random_group_switch(self, experiment_group: SkillRankingExperimentGroup) -> bool:
        """
        Determine if the random group switch should be applied.
        Only applies to groups 2 and 3 with a 5% probability.
        """
        if experiment_group not in [SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_3]:
            return False

        # 5% chance of triggering the random check
        return random.random() < 0.05 # nosec B311 # we are intentionally using a random check here for group switching


    def _get_switched_update_request(self, update_request: UpdateSkillsRankingRequest, existing_state: SkillsRankingState) -> UpdateSkillsRankingRequest:
        """
        Determine if a group switch should occur and return an updated request with the correct phase and group.
        Only switches groups if the random check passes and the user is transitioning from PROOF_OF_VALUE.
        """
        # Only apply group switching when transitioning FROM PROOF_OF_VALUE
        if update_request.phase is None or existing_state.phase[-1].name != "PROOF_OF_VALUE":
            return update_request
            
        # Only apply to groups 2 and 3
        if existing_state.experiment_group not in [SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_3]:
            return update_request
            
        # Only apply if random check passes (5% chance)
        if not self._should_apply_random_group_switch(existing_state.experiment_group):
            return update_request
            
        # Determine the new group based on correct_rotations
        if existing_state.correct_rotations is None or existing_state.correct_rotations <= CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH:
            new_group = SkillRankingExperimentGroup.GROUP_2  # No information
        else:
            new_group = SkillRankingExperimentGroup.GROUP_3  # Information
            
        # Determine the correct phase for the new group
        # Group 2 and 4 skip MARKET_DISCLOSURE, while Group 1 and 3 see it
        if new_group in [SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_4]:
            correct_phase = "JOB_SEEKER_DISCLOSURE"
        else:
            correct_phase = "MARKET_DISCLOSURE"

        # Create a new update request with both the group change and phase adjustment
        return UpdateSkillsRankingRequest(
            phase=cast(SkillsRankingPhaseName, correct_phase),
            experiment_group=new_group,
            **update_request.model_dump(exclude={'phase', 'experiment_group'})
        )

    async def upsert_state(
            self,
            session_id: int,
            update_request: UpdateSkillsRankingRequest,
            user_id: str
    ) -> SkillsRankingState:
        existing_state = await self._repository.get_by_session_id(session_id)

        # see if the state already exists, if not create it
        if existing_state is None:
            if update_request.phase != "INITIAL":
                raise SkillsRankingStateNotFound(session_id=session_id)

            participant_rank, experiment_group = await self.calculate_ranking_and_groups(user_id=user_id,
                                                                                         session_id=session_id)

            await self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                experiment_config=experiment_group.name
            )

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

            saved_state = await self._repository.create(new_state)
            return saved_state

        # For updates, validate the new phase if provided
        if update_request.phase is not None:
            last_phase = existing_state.phase[-1]  # latest phase in history
            possible_next_states = get_possible_next_phase(last_phase.name)
            if update_request.phase not in possible_next_states:
                raise InvalidNewPhaseError(
                    current_phase=last_phase.name,
                    expected_phases=possible_next_states
                )

        # Apply random group switching logic - this may modify the update_request
        # Only applies when transitioning FROM PROOF_OF_VALUE for groups 2 and 3 with 5% probability
        updated_request = self._get_switched_update_request(update_request, existing_state)
        
        # Automatically set completed_at when transitioning to COMPLETED phase
        if updated_request.phase == "COMPLETED":
            updated_request.completed_at = get_now()
        
        # Update user preferences if group actually changed
        if (updated_request.experiment_group is not None and 
            updated_request.experiment_group != existing_state.experiment_group):
            await self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                experiment_config=updated_request.experiment_group.name
            )

        saved_state = await self._repository.update(
            session_id=session_id,
            update_request=updated_request
        )

        if saved_state is None:
            raise SkillsRankingStateNotFound(session_id=session_id)

        return saved_state

    async def calculate_ranking_and_groups(self,
                                           user_id: str,
                                           session_id: int) -> Tuple[SkillsRankingScore, SkillRankingExperimentGroup]:

        # First step, we need to get the prior belief
        prior_belief = await self._registration_data_repository.get_prior_belief(user_id=user_id)

        # Second, let's get all the skills for this specific session.
        state = await self._application_state_manager.get_state(session_id=session_id)
        experiences_data = state.explore_experiences_director_state.experiences_state.values()
        top_skills_uuids = {skill.originUUID for experience in experiences_data for skill in experience.experience.top_skills}

        # Compute the ranking score for this participant
        score = await self._ranking_service.get_participant_ranking(
            user_id=user_id,
            prior_belief=prior_belief,
            participants_skills_uuids=top_skills_uuids
        )

        # Because the ranking service returns scores between 0 and 1, we need to convert it to a values between 0 and 100
        savable_score = SkillsRankingScore(
            jobs_matching_rank= score.jobs_matching_rank * 100,
            comparison_rank=score.comparison_rank * 100,
            comparison_label=score.comparison_label,
            calculated_at=score.calculated_at
        )

        # THEN compute the experiment group based on the prior belief and the actual rank
        experiment_group = get_group(
            self_estimated_rank=prior_belief,
            actual_rank=score.jobs_matching_rank,
            high_difference_threshold=self._high_difference_threshold
        )

        # Return the score, and the experiment group
        return savable_score, experiment_group
