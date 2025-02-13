"""
This module contains the repository layer for handling reactions.
"""
import logging
from abc import ABC, abstractmethod
from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.conversations.reactions.types import Reaction, ReactionKind, DislikeReason
from common_libs.time_utilities import mongo_date_to_datetime, datetime_to_mongo_date


class IReactionRepository(ABC):
    """
    Interface for the reaction repository.

    Allows to mock the repository in tests
    """

    @abstractmethod
    async def add(self, reaction: Reaction) -> Reaction:
        """
        Creates or updates a reaction.

        :param reaction: ReactionModel - the reaction to create or update
        :return: Reaction - the created/updated reaction document
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
    async def get_reactions(self, session_id: int) -> list[Reaction]:
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

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> Reaction:
        """
        Convert a mongodb document to a Reaction object
        :param doc: The MongoDB document
        :return: Reaction business object
        """
        doc_dict = dict(doc)
        return Reaction(
            id=str(doc_dict.pop("_id")) if "_id" in doc_dict else None,
            message_id=doc_dict.get("message_id"),
            session_id=doc_dict.get("session_id"),
            kind=ReactionKind[doc_dict.get("kind")],  # Lookup by name
            reasons=[DislikeReason[r] for r in doc_dict.get("reasons", [])],  # Convert each reason name to enum
            created_at=mongo_date_to_datetime(doc_dict.get("created_at"))
        )

    @classmethod
    def _to_db_doc(cls, reaction: Reaction) -> Mapping:
        """
        Convert a Reaction object to a mongodb document
        :param reaction: Reaction business object
        :return: dict the MongoDB document
        """
        return {
            "message_id": reaction.message_id,
            "session_id": reaction.session_id,
            "kind": reaction.kind.name,  # Store the name of the enum
            "reasons": [r.name for r in reaction.reasons],  # Store the names of the enums
            "created_at": datetime_to_mongo_date(reaction.created_at)
        }

    async def add(self, reaction: Reaction) -> Reaction:
        # Convert the reaction to a MongoDB document
        payload = self._to_db_doc(reaction)

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

        return self._from_db_doc(doc)

    async def delete(self, session_id: int, message_id: str):
        await self._collection.delete_one({
            "session_id": {"$eq": session_id},
            "message_id": {"$eq": message_id}
        })

    async def get_reactions(self, session_id: int) -> list[Reaction] | None:
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
            reactions.append(self._from_db_doc(doc))
            
        return reactions
