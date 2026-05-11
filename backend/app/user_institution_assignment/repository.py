import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorCollection


class UserInstitutionAssignment:
    """A user_id-to-institution assignment created by the admin before the pilot opens."""

    def __init__(self, user_id: str, institution_name: str, reg_no: Optional[str] = None):
        self.user_id = user_id
        self.institution_name = institution_name
        self.reg_no = reg_no


class IUserInstitutionAssignmentRepository(ABC):
    @abstractmethod
    async def find_by_user_id(self, user_id: str) -> Optional[UserInstitutionAssignment]:
        pass


class UserInstitutionAssignmentRepository(IUserInstitutionAssignmentRepository):
    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    async def find_by_user_id(self, user_id: str) -> Optional[UserInstitutionAssignment]:
        doc = await self._collection.find_one(
            {"user_id": {"$eq": user_id}},
            projection={"_id": 0, "user_id": 1, "institution_name": 1, "reg_no": 1},
        )
        if doc is None:
            return None
        return UserInstitutionAssignment(
            user_id=doc["user_id"],
            institution_name=doc["institution_name"],
            reg_no=doc.get("reg_no"),
        )
