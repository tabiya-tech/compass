from abc import ABC, abstractmethod

from features.skills_ranking.state.services.type import SkillsRankingState, UpdateSkillsRankingRequest
from features.skills_ranking.types import PriorBeliefs


class IRegistrationDataRepository(ABC):
    """
    Interface for registration repository to manage user's registration data including prior belief.
    """

    @abstractmethod
    async def get_prior_beliefs(self, user_id: str) -> PriorBeliefs:
        """
        Get the prior belief of the rank for a given user ID.

        :param user_id: The ID of the user to retrieve the prior belief for.
        :return: PriorBeliefs the prior belief of the rank for the user.
        :raises RegistrationDataNotFoundError — if the user ID is not found in the registration data.
        """
        raise NotImplementedError


class ISkillsRankingStateRepository(ABC):
    @abstractmethod
    async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
        """
        Get skills ranking state by session ID.
        :param session_id: conversation unique identifier
        :return: SkillsRankingState
        """
        raise NotImplementedError()

    @abstractmethod
    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        """
        Initialize a new skills ranking state.
        """
        raise NotImplementedError()

    @abstractmethod
    async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
        """
        Updates an existing skills ranking state using a structured update request.

        :param session_id: The ID of the session to update (required)
        :param update_request: The structured update request containing the fields to update
        :return: The updated SkillsRankingState
        """
        raise NotImplementedError()
