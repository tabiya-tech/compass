from abc import ABC, abstractmethod

from modules.skills_ranking.errors import InvalidNewPhaseError, SkillsRankingStateNotFound
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.service.types import SkillsRankingState, SkillRankingExperimentGroups, SkillsRankingCurrentState
from modules.skills_ranking.utils import get_possible_next_states


class ISkillsRankingService(ABC):
    """
    SkillsRankingService interface.
    """

    @abstractmethod
    async def upsert_state(self, state: SkillsRankingState) -> SkillsRankingState:
        """
        Get skills ranking state by session ID.
        :param state: the skills ranking state to upsert
        :return: SkillsRankingState
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_ranking(self, session_id: int) -> str:
        """
        Get the ranking for a session.
        :param session_id: conversation unique identifier
        :return: The ranking as a string
        :raises SkillsRankingStateNotFound: if the state doesn't exist
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
        possible_next_states = get_possible_next_states(existing_state.current_state)
        if new_state.current_state not in possible_next_states:
            raise InvalidNewPhaseError(
                current_phase=existing_state.current_state,
                expected_phases=possible_next_states)

        # update the existing state
        saved_state = await self._repository.update(new_state)
        return saved_state

    async def get_ranking(self, session_id: int) -> str:
        state = await self._repository.get_by_session_id(session_id)
        if state is None:
            raise SkillsRankingStateNotFound(session_id)

        # Update the state with the default ranking
        # TODO: get this from external ranking service
        state.ranking = "50%"
        updated_state = await self._repository.update(state)
        return updated_state.ranking
