import logging
from datetime import datetime, timezone
from typing import Optional

from pymongo import ReturnDocument

from app.constants.database import Collections
from app.invitations.types import UserInvitation
from app.server_dependecies.db_dependecies import get_mongo_db

logger = logging.getLogger(__name__)


class UserInvitationRepository:
    """
    UserInvitationRepository class is responsible for managing the user invitations in the database.
    """
    def __init__(self):
        self._collection = get_mongo_db().get_collection(Collections.USER_INVITATIONS)

    async def get_valid_invitation_by_code(self, invitation_code: str) -> Optional[UserInvitation]:
        """
        Find a user invitation by the code
        Returns None if the invitation is not found or invalid
        Otherwise, returns the UserInvitation object

        :param invitation_code: str the invitation code
        :return: Optional[UserInvitation] the user invitation object
        """
        now = datetime.now(timezone.utc)

        try:
            _doc = await self._collection.find_one({
                "invitation_code": {"$eq": invitation_code},
                "remaining_usage": {"$gt": 0},
                "valid_from": {"$lte": now},
                "valid_until": {"$gte": now}
            })

            if not _doc:
                return None

            return UserInvitation.from_dict(_doc)
        except Exception as e:
            logger.exception(e)
            raise e

    async def reduce_capacity(self, invitation_code: str) -> bool:
        """
        Reduce the remaining usage of the invitation code
        :param invitation_code: str
        :return: bool: True if the capacity was reduced, else False
        """
        now = datetime.now(timezone.utc)

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

            _dict = await self._collection.find_one_and_update(
                filter=query,
                update=update,
                return_document=ReturnDocument.AFTER
            )

            # If the document is not found
            if not _dict:
                return False

            invitation = UserInvitation.from_dict(_dict)

            # If the remaining usage is less than 0, know that the invitation is invalid and return False
            if invitation.remaining_usage < 0:
                return False

            return True
        except Exception as e:
            logger.exception(e)
            raise e
