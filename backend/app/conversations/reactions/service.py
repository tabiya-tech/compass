"""
This module contains the service layer for handling reactions.
"""
import logging
from abc import ABC, abstractmethod

from app.application_state import ApplicationStateManager, IApplicationStateManager
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager, IConversationMemoryManager
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.types import ReactionRequest, Reaction

class ReactingToUserMessageError(Exception):
    """
    Exception raised when there is an attempt to add a reaction to a user message
    """

    def __init__(self, message_id: str):
        super().__init__(f"The message with id {message_id} is a message from the user. User messages cannot be reacted to.")

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
    def __init__(self, *, reaction_repository: IReactionRepository, conversation_memory_manager: IConversationMemoryManager, application_state_manager: IApplicationStateManager):
        self._reaction_repository=reaction_repository
        self._conversation_memory_manager=conversation_memory_manager
        self._application_state_manager=application_state_manager
        self._logger=logging.getLogger(ReactionService.__name__)

    async def add(self, session_id: int, message_id: str, reaction: ReactionRequest):

        state = await self._application_state_manager.get_state(session_id)
        self._conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context =  await self._conversation_memory_manager.get_conversation_context()

        # find out if the message_id of the message to react to is an input or output message
        # if it is in the turns as an input, that means it was a user message and we should not allow a reaction
        user_message = next((r for r in context.all_history.turns or []
              if r.input.message_id == message_id), None)

        if user_message is not None:
            raise ReactingToUserMessageError(message_id)

        reaction_model = Reaction(
            session_id=session_id,
            message_id=message_id,
            kind=reaction.kind,
            reason=reaction.reason
        )
        await self._reaction_repository.add(reaction_model)

    async def delete(self, session_id: int, message_id: str):
        await self._reaction_repository.delete(session_id, message_id)
