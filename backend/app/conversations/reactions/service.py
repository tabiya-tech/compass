"""
Service layer for handling reactions to messages.
"""
import logging
from abc import ABC, abstractmethod

from app.application_state import IApplicationStateManager
from app.conversation_memory.conversation_memory_manager import IConversationMemoryManager
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.types import Reaction
from app.metrics.service import IMetricsService
from app.metrics.types import MessageReactionCreatedEvent


class ReactingToUserMessageError(Exception):
    """Error raised when attempting to react to a user's message."""

    def __init__(self, message_id: str):
        super().__init__(
            f"The message with id {message_id} is a message from the user. User messages cannot be reacted to.")


class IReactionService(ABC):
    """Interface for managing reactions to messages."""

    @abstractmethod
    async def add(self, reaction: Reaction, user_id: str) -> Reaction:
        """
        Creates or updates a reaction to a message.

        :param reaction: The reaction to store
        :param user_id: The id of the user who created the reaction
        :return: The stored reaction
        :raises ReactingToUserMessageError: If attempting to react to a user message
        :raises Exception: If any other error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete(self, session_id: int, message_id: str):
        """
        Removes a reaction from a message.

        :param session_id: ID of the session containing the message
        :param message_id: ID of the message to remove the reaction from
        :raises Exception: If any error occurs
        """
        raise NotImplementedError()


class ReactionService(IReactionService):
    """Service for managing reactions to messages."""
    
    def __init__(self, *, reaction_repository: IReactionRepository,
                 conversation_memory_manager: IConversationMemoryManager,
                 application_state_manager: IApplicationStateManager,
                 metrics_service: IMetricsService):
        self._reaction_repository = reaction_repository
        self._conversation_memory_manager = conversation_memory_manager
        self._application_state_manager = application_state_manager
        self._metrics_service = metrics_service
        self._logger = logging.getLogger(ReactionService.__name__)

    async def add(self, reaction: Reaction, user_id: str) -> Reaction:
        """
        Creates or updates a reaction to a message.

        :param user_id:
        :param reaction: The reaction to store
        :return: The stored reaction
        :raises ReactingToUserMessageError: If attempting to react to a user message
        :raises Exception: If any other error occurs
        """
        state = await self._application_state_manager.get_state(reaction.session_id)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        if await self._conversation_memory_manager.is_user_message(reaction.message_id):
            raise ReactingToUserMessageError(reaction.message_id)

        stored_reaction = await self._reaction_repository.add(reaction)

        # Record the reaction metric event
        await self._metrics_service.record_event(
            MessageReactionCreatedEvent(
                user_id=user_id,
                session_id=reaction.session_id,
                message_id=reaction.message_id,
                kind=reaction.kind,
                reasons=reaction.reasons or []
            )
        )

        return stored_reaction

    # TODO: deal with deleted reaction metrics
    async def delete(self, session_id: int, message_id: str):
        """
        Removes a reaction from a message.

        :param session_id: ID of the session containing the message
        :param message_id: ID of the message to remove the reaction from
        :raises Exception: If any error occurs
        """
        await self._reaction_repository.delete(session_id, message_id)
