"""
This module contains the service layer for handling reactions.
"""
import logging
from abc import ABC, abstractmethod

from app.application_state import ApplicationStateManager, IApplicationStateManager
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager, IConversationMemoryManager
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.types import Reaction


class ReactingToUserMessageError(Exception):
    """
    Exception raised when there is an attempt to add a reaction to a user message
    """

    def __init__(self, message_id: str):
        super().__init__(
            f"The message with id {message_id} is a message from the user. User messages cannot be reacted to.")


class IReactionService(ABC):
    """
    Interface for the reaction service.
    """

    @abstractmethod
    async def add(self, reaction: Reaction) -> Reaction:
        """
        Creates or updates a reaction for a message.

        :param reaction: the reaction to create or update
        :return: Reaction - the created or updated reaction
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
    def __init__(self, *, reaction_repository: IReactionRepository,
                 conversation_memory_manager: IConversationMemoryManager,
                 application_state_manager: IApplicationStateManager):
        self._reaction_repository = reaction_repository
        self._conversation_memory_manager = conversation_memory_manager
        self._application_state_manager = application_state_manager
        self._logger = logging.getLogger(ReactionService.__name__)

    async def add(self, reaction: Reaction) -> Reaction:
        state = await self._application_state_manager.get_state(reaction.session_id)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # check if the message with the given message id is a user message or not
        # if it is, raise an error, since reacting to a user message is not allowed
        if await self._conversation_memory_manager.is_user_message(reaction.message_id):
            raise ReactingToUserMessageError(reaction.message_id)

        return await self._reaction_repository.add(reaction)

    async def delete(self, session_id: int, message_id: str):
        await self._reaction_repository.delete(session_id, message_id)
