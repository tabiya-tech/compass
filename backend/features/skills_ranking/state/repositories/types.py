from abc import ABC, abstractmethod


class IRegistrationDataRepository(ABC):
    """
    Interface for registration repository to manage user's registration data including prior belief.
    """

    @abstractmethod
    async def get_prior_belief(self, user_id: str) -> float:
        """
        Get the prior belief of the rank for a given user ID.

        :param user_id: The ID of the user to retrieve the prior belief for.
        :return: Float representing the prior belief of the rank.
        :raises RegistrationDataNotFoundError — if the user ID is not found in the registration data.
        """
        raise NotImplementedError
