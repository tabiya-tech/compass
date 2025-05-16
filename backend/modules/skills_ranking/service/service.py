from abc import ABC, abstractmethod
from urllib import request

from app.users.repositories import IUserPreferenceRepository
from modules.skills_ranking.constants import FEATURE_ID
from modules.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound, InvalidSkillsRankingInitializationRequest
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.service.types import SkillsRankingState, SkillRankingExperimentGroups, SkillsRankingPhase
from modules.skills_ranking.utils import get_possible_next_states


class ISkillsRankingService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self, session_id: int,
                           user_id: str | None = None,
                           phase: SkillsRankingPhase | None = None,
                           experiment_groups: SkillRankingExperimentGroups | None = None,
                           ranking: str | None = None,
                           self_ranking: str | None = None) -> SkillsRankingState:
        """
        Upsert the skills ranking state.

        :param session_id:
        :param user_id:
        :param self_ranking:
        :param ranking:
        :param experiment_groups:
        :param phase:
        :return: The upserted SkillsRankingState.
        :raises InvalidNewPhaseError: If the new phase is not a valid transition from the current phase.
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_ranking(self, session_id: int) -> str:
        """
        Get the ranking for a session. If the state does not exist, raises SkillsRankingStateNotFound.
        Updates the ranking to a default value ("50%") for demonstration purposes.

        :param session_id: The session ID to retrieve the ranking for.
        :type session_id: int
        :return: The ranking as a string.
        :rtype: str
        :raises SkillsRankingStateNotFound: If the state does not exist for the given session_id.
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
        experiment_groups: SkillRankingExperimentGroups | None = None,
        ranking: str | None = None,
        self_ranking: str | None = None
    ) -> SkillsRankingState:
        existing_state = await self._repository.get_by_session_id(session_id)

        # see if the state already exists, if not create it
        if existing_state is None:
            if phase != SkillsRankingPhase.INITIAL:
                raise SkillsRankingStateNotFound(session_id=session_id)
            if experiment_groups is not None:
                raise InvalidSkillsRankingInitializationRequest(session_id=session_id)

            new_experiment_groups = SkillRankingExperimentGroups()

            await self._user_preferences_repository.set_experiment_by_user_id(
                user_id=user_id,
                experiment_id=FEATURE_ID,
                experiment_config=new_experiment_groups.model_dump()
            )

            new_state = SkillsRankingState(
                session_id=session_id,
                phase=phase,
                experiment_groups=new_experiment_groups,
                ranking=ranking,
                self_ranking=self_ranking
            )
            saved_state = await self._repository.create(new_state)
            return saved_state

        # For updates, validate the new phase if provided
        if phase is not None:
            possible_next_states = get_possible_next_states(existing_state.phase)
            if phase not in possible_next_states:
                raise InvalidNewPhaseError(
                    current_phase=existing_state.phase,
                    expected_phases=possible_next_states
                )

        # update the existing state using named arguments
        saved_state = await self._repository.update(
            session_id=session_id,
            phase=phase,
            experiment_groups=experiment_groups,
            ranking=ranking,
            self_ranking=self_ranking
        )
        return saved_state

    async def get_ranking(self, session_id: int) -> str:
        """
        Get the ranking for a session. If the state does not exist, raises SkillsRankingStateNotFound.
        Updates the ranking to a default value ("50%") for demonstration purposes.

        :param session_id: The session ID to retrieve the ranking for.
        :type session_id: int
        :return: The ranking as a string.
        :rtype: str
        :raises SkillsRankingStateNotFound: If the state does not exist for the given session_id.
        """
        state = await self._repository.get_by_session_id(session_id)
        if state is None:
            raise SkillsRankingStateNotFound(session_id)

        # Update the state with the default ranking
        updated_state = await self._repository.update(
            session_id=state.session_id,
            ranking="50%"
        )
        return updated_state.ranking
