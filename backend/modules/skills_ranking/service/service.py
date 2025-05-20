from abc import ABC, abstractmethod

from modules.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.service.types import SkillsRankingState, SkillRankingExperimentGroups, SkillsRankingPhase
from modules.skills_ranking.utils import get_possible_next_states


class ISkillsRankingService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self, state: SkillsRankingState) -> SkillsRankingState:
        """
        Upsert the skills ranking state.

        :param new_state: The new skills ranking state to upsert.
        :type new_state: SkillsRankingState
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

    def __init__(self, repository: ISkillsRankingRepository):
        self._repository = repository

    async def upsert_state(self, new_state: SkillsRankingState) -> SkillsRankingState:
        existing_state = await self._repository.get_by_session_id(new_state.session_id)

        # see if the state already exists, if not create it
        if existing_state is None:
            saved_state = await self._repository.create(new_state)
            return saved_state

        # validate the new state against the existing state
        possible_next_states = get_possible_next_states(existing_state.phase)
        if new_state.phase not in possible_next_states:
            raise InvalidNewPhaseError(
                current_phase=existing_state.phase,
                expected_phases=possible_next_states)

        # update the existing state using named arguments
        saved_state = await self._repository.update(
            session_id=new_state.session_id,
            experiment_groups=new_state.experiment_groups,
            phase=new_state.phase,
            ranking=new_state.ranking,
            self_ranking=new_state.self_ranking
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
