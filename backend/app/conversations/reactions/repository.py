"""
This module contains the repository layer for handling reactions.
"""
import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.conversations.reactions.types import Reaction, ReactionDocModel


class IReactionRepository(ABC):
    """
    Interface for the reaction repository.

    Allows to mock the repository in tests
    """

    @abstractmethod
    async def add(self, reaction: Reaction) -> ReactionDocModel:
        """
        Creates or updates a reaction.

        :param reaction: ReactionModel - the reaction to create or update
        :return: ReactionDocModel - the created/updated reaction document
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete(self, session_id: int, message_id: str):
        """
        Deletes a reaction.

        :param session_id: the id of the session containing the message
        :param message_id: the id of the message that was reacted to
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_reactions(self, session_id: int) -> list[ReactionDocModel]:
        """
        Gets the full list of reactions for the given session

        :param session_id: the id of the session containing the messages
        :return: Optional[List[Reaction]] - the reactions if found, otherwise None
        """
        raise NotImplementedError()


class ReactionRepository(IReactionRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._logger = logging.getLogger(ReactionRepository.__name__)
        self._collection = db.get_collection(Collections.REACTIONS)

    async def add(self, reaction: Reaction) -> ReactionDocModel:
        # Convert the pydantic model to a dictionary
        payload = reaction.model_dump()

        # Use find_one_and_update to get the updated document directly
        doc = await self._collection.find_one_and_update(
            {
                "session_id": {"$eq": reaction.session_id},
                "message_id": {"$eq": reaction.message_id}
            },
            {"$set": payload},
            upsert=True,
            return_document=True  # Return the document after the update
        )

        # Convert to ReactionDocModel
        return ReactionDocModel.from_dict(doc)

    async def delete(self, session_id: int, message_id: str):
        await self._collection.delete_one({
            "session_id": {"$eq": session_id},
            "message_id": {"$eq": message_id}
        })

    async def get_reactions(self, session_id: int) -> list[ReactionDocModel] | None:
        """
        Gets the full list of reactions for a session

        :param session_id: the id of the session containing the message
        :return: Optional[List[Reaction]] - the list of reactions if found, otherwise None
        """
        cursor = self._collection.find({
            "session_id": {"$eq": session_id},
        })
        
        reactions = []
        async for doc in cursor:
            reactions.append(ReactionDocModel.from_dict(doc))
            
        return reactions if reactions else None
