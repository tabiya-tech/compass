import logging
from datetime import datetime
from typing import Mapping, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.admin.registrations.types import (
    AdminRegistration,
    CreateRegistrationRequest,
    DuplicateActiveRegistrationError,
    RegistrationRoleRequest,
    RegistrationStatus,
)
from app.server_dependencies.database_collections import Collections
from common_libs.time_utilities import datetime_to_mongo_date, get_now, mongo_date_to_datetime


class AdminRegistrationRepository:
    """Repository for the admin_registrations collection."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.ADMIN_REGISTRATIONS)
        self._logger = logging.getLogger(self.__class__.__name__)

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> AdminRegistration:
        return AdminRegistration(
            id=str(doc.get("_id")),
            email=doc.get("email"),
            name=doc.get("name"),
            requested_role=RegistrationRoleRequest(doc.get("requested_role")),
            institution_id=doc.get("institution_id"),
            status=RegistrationStatus(doc.get("status")),
            submitted_at=mongo_date_to_datetime(doc.get("submitted_at")),
            decided_at=mongo_date_to_datetime(doc.get("decided_at")) if doc.get("decided_at") else None,
            decided_by=doc.get("decided_by"),
            rejection_reason=doc.get("rejection_reason"),
        )

    async def create_or_replace_pending(self, request: CreateRegistrationRequest) -> AdminRegistration:
        """
        Atomically insert a new pending registration, or replace an existing rejected row for the
        same email. Raises DuplicateActiveRegistrationError if an active (pending or approved)
        row already exists.

        Atomicity: a single find_one_and_replace + upsert ensures there is no window between
        the rejected-row delete and the new insert. If no row matches the filter (rejected),
        the upsert attempts an insert; the unique partial index on (email) where
        status ∈ {pending, approved} surfaces a DuplicateKeyError when an active row exists.
        """
        email = request.email.lower()
        now = get_now()
        new_doc = {
            "email": email,
            "name": request.name,
            "requested_role": request.requested_role.value,
            "institution_id": request.institution_id,
            "status": RegistrationStatus.PENDING.value,
            "submitted_at": datetime_to_mongo_date(now),
            "decided_at": None,
            "decided_by": None,
            "rejection_reason": None,
        }

        try:
            replaced = await self._collection.find_one_and_replace(
                {
                    "email": {"$eq": email},
                    "status": {"$eq": RegistrationStatus.REJECTED.value},
                },
                new_doc,
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as e:
            raise DuplicateActiveRegistrationError(
                f"An active registration already exists for {email}"
            ) from e

        return self._from_db_doc(replaced)

    async def get_by_email(self, email: str) -> Optional[AdminRegistration]:
        """Find the most recent registration for a given email (active row preferred)."""
        # Prefer active rows (pending/approved) over rejected if both somehow exist.
        doc = await self._collection.find_one(
            {"email": {"$eq": email.lower()}},
            sort=[("status", 1), ("submitted_at", -1)],
        )
        if not doc:
            return None
        return self._from_db_doc(doc)

    async def get_by_id(self, registration_id: str) -> Optional[AdminRegistration]:
        try:
            object_id = ObjectId(registration_id)
        except Exception:  # pylint: disable=broad-except
            return None
        doc = await self._collection.find_one({"_id": object_id})
        if not doc:
            return None
        return self._from_db_doc(doc)

    async def list_by_status(
        self, status: Optional[RegistrationStatus] = None
    ) -> list[AdminRegistration]:
        query: dict = {}
        if status is not None:
            query["status"] = status.value
        cursor = self._collection.find(query).sort("submitted_at", -1)
        return [self._from_db_doc(doc) async for doc in cursor]

    async def count_pending(self) -> int:
        return await self._collection.count_documents({"status": RegistrationStatus.PENDING.value})

    async def delete_by_email(self, email: str) -> int:
        """Delete all registration rows for a given email. Returns the deleted count."""
        result = await self._collection.delete_many({"email": {"$eq": email.lower()}})
        return result.deleted_count

    async def mark_decided(
        self,
        registration_id: str,
        *,
        status: RegistrationStatus,
        decided_by: str,
        decided_at: datetime,
        rejection_reason: Optional[str] = None,
    ) -> Optional[AdminRegistration]:
        try:
            object_id = ObjectId(registration_id)
        except Exception:  # pylint: disable=broad-except
            return None
        update = {
            "$set": {
                "status": status.value,
                "decided_by": decided_by,
                "decided_at": datetime_to_mongo_date(decided_at),
                "rejection_reason": rejection_reason,
            }
        }
        await self._collection.update_one({"_id": object_id}, update)
        return await self.get_by_id(registration_id)
