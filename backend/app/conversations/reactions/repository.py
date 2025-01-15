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
    """Interface for storing and retrieving reactions."""

    @abstractmethod
    async def add(self, reaction: Reaction) -> Reaction:
        """
        Inserts or updates a reaction in the database.

        :param reaction: The reaction to store
        :return: The stored reaction with its database ID
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete(self, session_id: int, message_id: str):
        """
        Deletes a reaction from the database.

        :param session_id: ID of the session containing the message
        :param message_id: ID of the message that was reacted to
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_reactions(self, session_id: int) -> list[Reaction]:
        """
        Retrieves all reactions for a session.

        :param session_id: ID of the session to get reactions for
        :return: List of reactions in the session
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()


class ReactionRepository(IReactionRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(Collections.REACTIONS)

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> Reaction:
        """
        Converts a MongoDB document to a Reaction object.

        :param doc: MongoDB document
        :return: Reaction object
        """
        doc_dict = dict(doc)
        return Reaction(
            id=str(doc_dict.get("_id")) if "_id" in doc_dict else None,
            message_id=doc_dict.get("message_id"),
            session_id=doc_dict.get("session_id"),
            kind=ReactionKind(doc_dict.get("kind")),
            reasons=[DislikeReason(r) for r in doc_dict.get("reasons", [])],
            created_at=mongo_date_to_datetime(doc_dict.get("created_at"))
        )

    @classmethod
    def _to_db_doc(cls, reaction: Reaction) -> Mapping:
        """
        Converts a Reaction object to a MongoDB document.Excludes the id field

        :param reaction: Reaction object to convert
        :return: MongoDB document (ID field is excluded)
        """
        return {
            "message_id": reaction.message_id,
            "session_id": reaction.session_id,
            "kind": reaction.kind.value,
            "reasons": [r.value for r in reaction.reasons],
            "created_at": datetime_to_mongo_date(reaction.created_at)
        }

    async def add(self, reaction: Reaction) -> Reaction:
        # Convert the reaction to a MongoDB document
        _doc = self._to_db_doc(reaction)

        # Use find_one_and_update to get the updated document directly
        doc = await self._collection.find_one_and_update(
            {
                "session_id": {"$eq": reaction.session_id},
                "message_id": {"$eq": reaction.message_id}
            },
            {"$set": _doc},
            upsert=True,
            return_document=True  # Return the document after the update
        )

        return self._from_db_doc(doc)

    async def delete(self, session_id: int, message_id: str):
        await self._collection.delete_one({
            "session_id": {"$eq": session_id},
            "message_id": {"$eq": message_id}
        })

    async def get_reactions(self, session_id: int) -> list[Reaction]:
        cursor = self._collection.find({
            "session_id": {"$eq": session_id},
        })
        
        reactions = []
        async for doc in cursor:
            reactions.append(self._from_db_doc(doc))
            
        return reactions
