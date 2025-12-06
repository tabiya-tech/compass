import asyncio
import logging
import random
from abc import ABC, abstractmethod
from typing import Tuple, cast

from app.app_config import get_application_config
from app.application_state import IApplicationStateManager
from app.users.repositories import IUserPreferenceRepository
from common_libs.time_utilities import get_now
from features.skills_ranking.constants import SKILLS_RANKING_EXPERIMENT_ID, SKILLS_RANKING_FEATURE_ID
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
    SkillsRankingPhase, UpdateSkillsRankingRequest, ProcessMetadata, UserResponses, SkillsRankingPhaseName
from features.skills_ranking.state.utils.get_group import get_group
from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase
from features.skills_ranking.types import PriorBeliefs

CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH_DEFAULT = 30


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

    def _get_correct_rotations_threshold(self) -> int:
        """
        Get the correct rotations threshold for group switching from configuration.
        Falls back to the default value if not configured.
        """
        try:
            app_config = get_application_config()
            feature_config = app_config.features.get(SKILLS_RANKING_FEATURE_ID)
            if feature_config and isinstance(feature_config.config, dict):
                threshold = feature_config.config.get("correct_rotations_threshold_for_group_switch")
                if threshold is not None and isinstance(threshold, (int, float)):
                    return int(threshold)
        except Exception as e:
            self._logger.warning(
                f"Failed to get correct_rotations_threshold_for_group_switch from config, using default: {e}"
            )
        return CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH_DEFAULT

    def _get_switched_update_request(
        self,
        update_request: UpdateSkillsRankingRequest,
        existing_state: SkillsRankingState,
    ) -> UpdateSkillsRankingRequest:
        """
        Determine if a group switch should occur and return an updated request with the correct phase and group.
        
        Logic:
        - Only applies when transitioning FROM PROOF_OF_VALUE
        - 95% of the time, no switch occurs
        - 5% of the time:
          - If GROUP_1 and satisfactory (correct_rotations > threshold) → randomly assign to GROUP_2 or GROUP_3
          - If GROUP_2 or GROUP_3 and unsatisfactory (correct_rotations <= threshold) → assign to GROUP_1
          - Otherwise, keep the same group
        """
        # Only apply group switching when transitioning FROM PROOF_OF_VALUE
        if update_request.phase is None or existing_state.phase[-1].name != "PROOF_OF_VALUE":
            if update_request.phase is None:
                self._logger.info(
                    f"Group switching not applicable: no phase transition requested. "
                    f"Current group: {existing_state.metadata.experiment_group.name}"
                )
            else:
                self._logger.info(
                    f"Group switching not applicable: not transitioning from PROOF_OF_VALUE. "
                    f"Current phase: {existing_state.phase[-1].name}, "
                    f"Requested phase: {update_request.phase}, "
                    f"Current group: {existing_state.metadata.experiment_group.name}"
                )
            return update_request

        current_group = existing_state.metadata.experiment_group
        correct_rotations = existing_state.metadata.correct_rotations

        # 95% of the time, we don't switch
        should_apply_switch = random.random() < 0.05  # nosec B311 # we are intentionally using a random check here for group switching
        if not should_apply_switch:
            self._logger.info(
                f"Group switching not applied: random check failed (95% chance to keep group). "
                f"Current group: {current_group.name}, "
                f"Correct rotations: {correct_rotations}"
            )
            return update_request

        # Get the threshold from configuration, with fallback to default
        threshold = self._get_correct_rotations_threshold()

        # Determine if user is satisfactory based on correct_rotations
        is_satisfactory = (
            correct_rotations is not None
            and correct_rotations > threshold
        )

        new_group = None
        switch_reason = None

        # Apply switching logic
        if current_group == SkillRankingExperimentGroup.GROUP_1 and is_satisfactory:
            # GROUP_1 + satisfactory → randomly assign to GROUP_2 or GROUP_3 (treatment)
            new_group = random.choice([  # nosec B311 # we are intentionally using random for group assignment
                SkillRankingExperimentGroup.GROUP_2,
                SkillRankingExperimentGroup.GROUP_3,
            ])
            switch_reason = f"GROUP_1 satisfactory (correct_rotations={correct_rotations} > {threshold})"
        elif current_group in [
            SkillRankingExperimentGroup.GROUP_2,
            SkillRankingExperimentGroup.GROUP_3,
        ] and not is_satisfactory:
            # GROUP_2 or GROUP_3 + unsatisfactory → assign to GROUP_1 (control)
            new_group = SkillRankingExperimentGroup.GROUP_1
            switch_reason = f"{current_group.name} unsatisfactory (correct_rotations={correct_rotations} <= {threshold})"
        else:
            # Otherwise, keep the same group
            if current_group == SkillRankingExperimentGroup.GROUP_1:
                reason = f"GROUP_1 but not satisfactory (correct_rotations={correct_rotations} <= {threshold})"
            elif current_group in [SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_3]:
                reason = f"{current_group.name} but satisfactory (correct_rotations={correct_rotations} > {threshold})"
            else:
                reason = f"Unknown group or condition not met"
            self._logger.info(
                f"Group switching not applied: conditions not met. "
                f"Current group: {current_group.name}, "
                f"Correct rotations: {correct_rotations}, "
                f"Reason: {reason}"
            )
            return update_request

        # After PROOF_OF_VALUE, all groups go to PRIOR_BELIEF
        correct_phase = "PRIOR_BELIEF"

        # Create updated metadata dict with the new group
        updated_metadata = update_request.metadata.copy() if update_request.metadata else {}
        updated_metadata["experiment_group"] = new_group.name
        updated_metadata["user_reassigned"] = {
            "original_group": current_group.name,
            "reassigned_group": new_group.name,
        }

        self._logger.info(
            f"Group switching applied: {current_group.name} → {new_group.name}. "
            f"Reason: {switch_reason}, "
            f"Correct rotations: {correct_rotations}, "
            f"New phase: {correct_phase}"
        )

        # Create a new update request with both the group change and phase adjustment
        return UpdateSkillsRankingRequest(
            phase=cast(SkillsRankingPhaseName, correct_phase),
            metadata=updated_metadata,
            user_responses=update_request.user_responses,
            completed_at=update_request.completed_at,
        )

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

        # Apply random group switching logic — this may modify the update request
        # Only applies when transitioning FROM PROOF_OF_VALUE with 5% probability
        # This will add the experiment_group in the update_request.metadata if needed
        updated_request = self._get_switched_update_request(update_request, existing_state)

        if updated_request.metadata is None:
            updated_request.metadata = {}
        if updated_request.user_responses is None:
            updated_request.user_responses = {}

        # If the experiment group has changed (because a previous step of randomly switching groups was applied),
        # update the user preferences with the new experiment group.
        if "experiment_group" in updated_request.metadata:
            experiment_group = updated_request.metadata["experiment_group"]
            if isinstance(experiment_group, str):
                experiment_group = SkillRankingExperimentGroup[experiment_group]
            experiment_group_changed = experiment_group != existing_state.metadata.experiment_group
            if experiment_group_changed:
                self._logger.info(
                    f"Experiment group changed for user {user_id}, session {session_id}: "
                    f"{existing_state.metadata.experiment_group.name} → {experiment_group.name}. "
                    f"Updating user preferences."
                )
                await self._user_preferences_repository.set_experiment_by_user_id(
                    user_id=user_id,
                    experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                    experiment_config=experiment_group.name
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

        # for each experience, we will collect only the top skills
        participant_skills = []
        for experience in participant_experiences:
            participant_skills += experience.top_skills

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
                taxonomy_model_id = get_application_config().taxonomy_model_id
            case 1:
                taxonomy_model_id = taxonomy_model_ids[0]
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
