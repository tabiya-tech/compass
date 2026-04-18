"""
Repository for career readiness conversation data in MongoDB.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.career_readiness.errors import ConversationAlreadyExistsError
from app.career_readiness.types import (
    CareerReadinessConversationDocument,
    CareerReadinessMessage,
    ConversationMode,
    TopicStatusRecord,
)
from app.server_dependencies.database_collections import Collections


class ICareerReadinessConversationRepository(ABC):
    """Interface for the career readiness conversation repository."""

    @abstractmethod
    async def create(self, document: CareerReadinessConversationDocument) -> None:
        """Insert a new conversation document."""
        raise NotImplementedError()

    @abstractmethod
    async def find_by_conversation_id(self, conversation_id: str) -> CareerReadinessConversationDocument | None:
        """Find a conversation by its ID."""
        raise NotImplementedError()

    @abstractmethod
    async def find_by_user_and_module(self, user_id: str, module_id: str) -> CareerReadinessConversationDocument | None:
        """Find a conversation for a specific user and module."""
        raise NotImplementedError()

    @abstractmethod
    async def find_all_by_user(self, user_id: str) -> list[CareerReadinessConversationDocument]:
        """Find all conversations for a specific user."""
        raise NotImplementedError()

    @abstractmethod
    async def append_message(self, conversation_id: str, message: CareerReadinessMessage) -> None:
        """Append a message to a conversation and update the updated_at timestamp."""
        raise NotImplementedError()

    @abstractmethod
    async def update_topic_status(self, conversation_id: str, topic_status: list[TopicStatusRecord]) -> None:
        """Update the per-topic coverage state for a conversation."""
        raise NotImplementedError()

    @abstractmethod
    async def update_quiz_delivered(self, conversation_id: str, delivered: bool) -> None:
        """Update whether the quiz has been delivered to the user."""
        raise NotImplementedError()

    @abstractmethod
    async def update_quiz_passed(self, conversation_id: str, passed: bool) -> None:
        """Update whether the user passed the quiz."""
        raise NotImplementedError()

    @abstractmethod
    async def update_conversation_mode(self, conversation_id: str, mode: ConversationMode) -> None:
        """Update the conversation mode (INSTRUCTION or SUPPORT)."""
        raise NotImplementedError()

    @abstractmethod
    async def delete_by_conversation_id(self, conversation_id: str) -> bool:
        """Delete a conversation. Returns True if deleted, False if not found."""
        raise NotImplementedError()


class CareerReadinessConversationRepository(ICareerReadinessConversationRepository):
    """MongoDB implementation of the career readiness conversation repository."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.CAREER_READINESS_CONVERSATIONS)
        self._logger = logging.getLogger(CareerReadinessConversationRepository.__name__)

    async def create(self, document: CareerReadinessConversationDocument) -> None:
        try:
            await self._collection.insert_one(document.model_dump())
        except DuplicateKeyError as e:
            raise ConversationAlreadyExistsError(document.module_id, document.user_id) from e

    async def find_by_conversation_id(self, conversation_id: str) -> CareerReadinessConversationDocument | None:
        result = await self._collection.find_one(
            {"conversation_id": {"$eq": conversation_id}}
        )
        if result is None:
            return None
        return CareerReadinessConversationDocument.from_dict(result)

    async def find_by_user_and_module(self, user_id: str, module_id: str) -> CareerReadinessConversationDocument | None:
        result = await self._collection.find_one(
            {"user_id": {"$eq": user_id}, "module_id": {"$eq": module_id}}
        )
        if result is None:
            return None
        return CareerReadinessConversationDocument.from_dict(result)

    async def find_all_by_user(self, user_id: str) -> list[CareerReadinessConversationDocument]:
        cursor = self._collection.find({"user_id": {"$eq": user_id}})
        results = []
        async for doc in cursor:
            results.append(CareerReadinessConversationDocument.from_dict(doc))
        return results

    async def append_message(self, conversation_id: str, message: CareerReadinessMessage) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._collection.update_one(
            {"conversation_id": {"$eq": conversation_id}},
            {
                "$push": {"messages": message.model_dump()},
                "$set": {"updated_at": now},
            },
        )

    async def update_topic_status(self, conversation_id: str, topic_status: list[TopicStatusRecord]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._collection.update_one(
            {"conversation_id": {"$eq": conversation_id}},
            {
                "$set": {
                    "topic_status": [r.model_dump(mode="json") for r in topic_status],
                    "updated_at": now,
                },
            },
        )

    async def update_quiz_delivered(self, conversation_id: str, delivered: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._collection.update_one(
            {"conversation_id": {"$eq": conversation_id}},
            {"$set": {"quiz_delivered": delivered, "updated_at": now}},
        )

    async def update_quiz_passed(self, conversation_id: str, passed: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._collection.update_one(
            {"conversation_id": {"$eq": conversation_id}},
            {"$set": {"quiz_passed": passed, "updated_at": now}},
        )

    async def update_conversation_mode(self, conversation_id: str, mode: ConversationMode) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._collection.update_one(
            {"conversation_id": {"$eq": conversation_id}},
            {"$set": {"conversation_mode": mode.value, "updated_at": now}},
        )

    async def delete_by_conversation_id(self, conversation_id: str) -> bool:
        result = await self._collection.delete_one(
            {"conversation_id": {"$eq": conversation_id}}
        )
        return result.deleted_count > 0
