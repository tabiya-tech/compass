"""
This module contains the service layer for handling reactions.
"""
import logging
from abc import ABC, abstractmethod

from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.types import ReactionRequest, Reaction


class IReactionService(ABC):
    """
    Interface for the reaction service.
    """

    @abstractmethod
    async def add(self, session_id: int, message_id: str, reaction: ReactionRequest):
        """
        Creates or updates a reaction for a message.

        :param session_id: the id of the session containing the message
        :param message_id: the id of the message being reacted to
        :param reaction: the reaction details
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete(self, session_id: int, message_id: str):
        """
        Deletes a reaction for a message.

        :param session_id: the id of the session containing the message
        :param message_id: the id of the message being unreacted to
        """
        raise NotImplementedError()


class ReactionService(IReactionService):
    def __init__(self, repository: IReactionRepository):
        self._repository = repository
        self._logger = logging.getLogger(ReactionService.__name__)

    async def add(self, session_id: int, message_id: str, reaction: ReactionRequest):
        reaction_model = Reaction(
            session_id=session_id,
            message_id=message_id,
            kind=reaction.kind,
            reason=reaction.reason
        )
        await self._repository.add(reaction_model)

    async def delete(self, session_id: int, message_id: str):
        await self._repository.delete(session_id, message_id)
