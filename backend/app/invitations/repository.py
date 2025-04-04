import logging
from typing import Optional, Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument, UpdateOne

from app.server_dependencies.database_collections import Collections
from app.invitations.types import UserInvitation, InvitationType
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from common_libs.time_utilities import get_now, datetime_to_mongo_date, mongo_date_to_datetime

# The threshold to log a warning when the remaining usage is less than 10% of the allowed usage
REMAINING_USAGE_WARNING_THRESHOLD = 0.1  # 10%


class UserInvitationRepository:
    """
    UserInvitationRepository class is responsible for managing the user invitations in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.USER_INVITATIONS)
        self._logger = logging.getLogger(self.__class__.__name__)

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> UserInvitation:
        """
        Convert a mongodb document to a UserInvitation object
        :param doc:
        :return:
        """
        return UserInvitation(
            invitation_code=doc.get("invitation_code"),
            remaining_usage=doc.get("remaining_usage"),
            allowed_usage=doc.get("allowed_usage"),
            valid_from=mongo_date_to_datetime(doc.get("valid_from")),
            valid_until=mongo_date_to_datetime(doc.get("valid_until")),
            invitation_type=InvitationType(doc.get("invitation_type")),  # Lookup by value
            # If the key is not found, default to NOT_AVAILABLE
            # for legacy invitation codes
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement(doc.get(
                "sensitive_personal_data_requirement",
                SensitivePersonalDataRequirement.NOT_AVAILABLE.value
            ))  # Lookup by value
        )

    @classmethod
    def _to_db_doc(cls, invitation: UserInvitation) -> Mapping:
        """
        Convert a UserInvitation object to a mongodb document
        :param invitation: UserInvitation the user invitation object
        :return: dict the dictionary
        """
        return {
            "invitation_code": invitation.invitation_code,
            "remaining_usage": invitation.remaining_usage,
            "allowed_usage": invitation.allowed_usage,
            "valid_from": datetime_to_mongo_date(invitation.valid_from),
            "valid_until": datetime_to_mongo_date(invitation.valid_until),
            "invitation_type": invitation.invitation_type.value,  # Store the value of the enum
            "sensitive_personal_data_requirement": invitation.sensitive_personal_data_requirement.value  # Store the value of the enum
        }

    async def upsert_many_invitations(self, invitations: list[UserInvitation]) -> None:
        """
        Upsert many user invitation objects in the database.
        If the invitation code already exists, it's properties are updated with the new values.
        :param invitations: list[UserInvitation] the list of user invitation objects
        :return: None
        """
        try:
            requests = []
            for invitation in invitations:
                requests.append(UpdateOne(
                    {
                        "invitation_code": invitation.invitation_code
                    },
                    {
                        "$set": self._to_db_doc(invitation)
                    },
                    upsert=True
                ))

            # Bulk write the requests.
            await self._collection.bulk_write(requests)

        except Exception as e:
            self._logger.exception(e)
            raise e

    async def get_valid_invitation_by_code(self, invitation_code: str) -> Optional[UserInvitation]:
        """
        Find a user invitation by the code
        Returns None if the invitation is not found or invalid
        Otherwise, returns the UserInvitation object

        :param invitation_code: str the invitation code
        :return: Optional[UserInvitation] the user invitation object
        """

        now = get_now()
        try:
            _doc = await self._collection.find_one({
                "invitation_code": {"$eq": invitation_code},
                "remaining_usage": {"$gt": 0},
                "valid_from": {"$lte": now},
                "valid_until": {"$gte": now}
            })

            if not _doc:
                self._logger.warning(f"Invitation with code '{invitation_code}' not found or invalid")
                return None

            return self._from_db_doc(_doc)
        except Exception as e:
            self._logger.exception(e)
            raise e

    async def reduce_capacity(self, invitation_code: str) -> bool:
        """
        Reduce the remaining usage of the invitation code
        :param invitation_code: str
        :return: bool: True if the capacity was reduced, else False
        """

        now = get_now()
        try:
            query = {
                "invitation_code": {"$eq": invitation_code},
                "remaining_usage": {"$gt": 0},
                "valid_from": {"$lte": now},
                "valid_until": {"$gte": now}
            }

            update = {
                "$inc": {"remaining_usage": -1}
            }

            _doc = await self._collection.find_one_and_update(
                filter=query,
                update=update,
                return_document=ReturnDocument.AFTER
            )

            # If the document is not found
            if not _doc:
                return False

            # If the remaining usage is < than 10% of te allowed usage, log a warning
            remaining_usage = _doc.get("remaining_usage")
            if remaining_usage < (_doc.get("allowed_usage") * REMAINING_USAGE_WARNING_THRESHOLD):
                self._logger.warning(
                    f"Invitation '{_doc.get('invitation_type')}' with code '{invitation_code}' has less than 10% remaining usage: ({remaining_usage})")

            # If the remaining usage is less than 0, know that the invitation is invalid and return False
            # This is for an edge case, when the two requests are made at the same time and the remaining usage gets reduced to -1.
            if remaining_usage < 0:
                return False

            return True
        except Exception as e:
            self._logger.exception(e)
            raise e
