from abc import ABC, abstractmethod
from typing import Tuple

from app.users.repositories import IUserPreferenceRepository
from common_libs.time_utilities import get_now
from features.skills_ranking.constants import SKILLS_RANKING_EXPERIMENT_ID
from features.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound, InvalidFieldsForPhaseError
from features.skills_ranking.repository.repository import ISkillsRankingRepository
from features.skills_ranking.service.calculate_skills_ranking import calculate_belief_difference, get_experiment_group, calculate_skills_to_job_matching_rank, \
    calculate_skills_to_job_seekers_rank, get_ranking_comparison_label
from features.skills_ranking.service.types import SkillsRankingState, SkillRankingExperimentGroup, SkillsRankingPhase, SkillsRankingScore
from features.skills_ranking.utils import get_possible_next_phase, get_valid_fields_for_phase


class ISkillsRankingService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self, session_id: int,
                           user_id: str | None = None,
                           phase: SkillsRankingPhase | None = None,
                           cancelled_after: str | None = None,
                           perceived_rank_percentile: float | None = None,
                           retyped_rank_percentile: float | None = None) -> SkillsRankingState:
        """
        Upsert the SkillsRankingState for a given session ID.
        :param session_id: the session ID to upsert the state for.
        :param user_id: the user ID to associate with the state.
        :param phase: the phase of the skills ranking process.
        :param cancelled_after: the proof_of_value spent by the user before they cancelled the skills ranking process.
        :param perceived_rank_percentile: the rank the user perceives themselves to be at
        :param retyped_rank_percentile: the retyped rank for the attention check step
        :return: SkillsRankingState
        """
        raise NotImplementedError()

    @abstractmethod
    async def calculate_ranking_and_groups(self) -> Tuple[SkillsRankingScore, SkillRankingExperimentGroup]:
        """
        Calculate the ranking and experiment groups for a given session ID.
        :return: A tuple containing the SkillsRankingScore and SkillRankingExperimentGroup.
        """
        raise NotImplementedError()


class SkillsRankingService(ISkillsRankingService):
    """
    SkillsRankingService implementation.
    """

    def __init__(self, repository: ISkillsRankingRepository, user_preferences_repository: IUserPreferenceRepository):
        self._repository = repository
        self._user_preferences_repository = user_preferences_repository

    async def upsert_state(
            self,
            session_id: int,
            user_id: str | None = None,
            phase: SkillsRankingPhase | None = None,
            cancelled_after: float | None = None,
            perceived_rank_percentile: float | None = None,
            retyped_rank_percentile: float | None = None,
    ) -> SkillsRankingState:
        existing_state = await self._repository.get_by_session_id(session_id)

        # see if the state already exists, if not create it
        if existing_state is None:
            if phase != "INITIAL":
                raise SkillsRankingStateNotFound(session_id=session_id)

            score, experiment_group = await self.calculate_ranking_and_groups()

            await self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=SKILLS_RANKING_EXPERIMENT_ID,
                experiment_config=experiment_group.name
            )

            new_state = SkillsRankingState(
                session_id=session_id,
                phase="INITIAL",
                experiment_group=experiment_group,
                score=score,
                started_at=get_now()
            )
            saved_state = await self._repository.create(new_state)
            return saved_state

        # For updates, validate the new phase if provided
        if phase is not None:
            possible_next_states = get_possible_next_phase(existing_state.phase)
            if phase not in possible_next_states:
                raise InvalidNewPhaseError(
                    current_phase=existing_state.phase,
                    expected_phases=possible_next_states
                )

        # Gather all fields that are being updated (i.e., are not None)
        updated_fields = {
            "phase": phase,
            "cancelled_after": cancelled_after,
            "perceived_rank_percentile": perceived_rank_percentile,
            "retyped_rank_percentile": retyped_rank_percentile,
        }
        passed_fields = [field for field, value in updated_fields.items() if value is not None]

        # Get the valid fields for this phase
        valid_fields = get_valid_fields_for_phase(existing_state.phase)

        # Check for any invalid fields
        invalid_fields = [field for field in passed_fields if field not in valid_fields]
        if invalid_fields:
            raise InvalidFieldsForPhaseError(
                current_phase=existing_state.phase,
                invalid_fields=invalid_fields,
                valid_fields=valid_fields,
            )

        saved_state = await self._repository.update(
            session_id=session_id,
            phase=phase,
            cancelled_after=cancelled_after,
            perceived_rank_percentile=perceived_rank_percentile,
            retyped_rank_percentile=retyped_rank_percentile,
            completed_at=get_now() if phase == "COMPLETED" else None
        )
        return saved_state

    async def calculate_ranking_and_groups(self) -> Tuple[SkillsRankingScore, SkillRankingExperimentGroup]:
        # first step is to calculate the difference between the baseline belief and the truth
        # not yet sure how/where we're getting the baseline belief and truth from
        baseline_belief = 0.5
        truth = 0.7
        difference = calculate_belief_difference(
            baseline_belief=baseline_belief,
            truth=truth
        )
        # then we get the experiment group based on the difference
        experiment_group = get_experiment_group(difference=difference)
        # finally, we calculate the rankings based on the experiment group
        # again, not sure what the source of truth for the skills is yet
        skills_uuids = ["skill1", "skill2", "skill3"]
        skills_to_job_matching_rank = await calculate_skills_to_job_matching_rank(skills_uuids=skills_uuids)
        skills_to_job_seekers_rank = await calculate_skills_to_job_seekers_rank(skills_uuids=skills_uuids)

        return SkillsRankingScore(
            jobs_matching_rank=skills_to_job_matching_rank,
            comparison_rank=skills_to_job_seekers_rank,
            comparison_label=get_ranking_comparison_label(skills_to_job_seekers_rank),  #label based on comparison to job seekers rank
            calculated_at=get_now()
        ), experiment_group
