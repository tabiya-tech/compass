import logging
from typing import Optional, Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument, UpdateOne

from app.server_dependencies.database_collections import Collections
from app.invitations.types import UserInvitation, InvitationType, SecureLinkCodeClaim, ClaimSource
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from common_libs.time_utilities import get_now, datetime_to_mongo_date, mongo_date_to_datetime

# The threshold to log a warning when the remaining usage is less than 10% of the allowed usage
REMAINING_USAGE_WARNING_THRESHOLD = 0.1  # 10%


class UserInvitationRepository:
    """
    UserInvitationRepository class is responsible for managing the user invitations in the database.
    """

    CLAIM_DOCUMENT_TYPE = "SECURE_LINK_CLAIM"

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

    @classmethod
    def _claim_from_db(cls, doc: Mapping) -> SecureLinkCodeClaim:
        return SecureLinkCodeClaim(
            registration_code=doc.get("registration_code"),
            claimed_user_id=doc.get("claimed_user_id"),
            claimed_at=mongo_date_to_datetime(doc.get("claimed_at")),
            claim_source=ClaimSource(doc.get("claim_source", ClaimSource.SECURE_LINK.value)),
            report_token_hash=doc.get("report_token_hash"),
            invitation_code_template=doc.get("invitation_code_template"),
            metadata=doc.get("metadata")
        )

    @classmethod
    def _claim_to_db(cls, claim: SecureLinkCodeClaim) -> Mapping:
        claim_source = claim.claim_source
        # Pydantic's `use_enum_values=True` stores enum fields as raw values; tolerate both strings and enums
        claim_source_value = claim_source.value if isinstance(claim_source, ClaimSource) else ClaimSource(claim_source).value

        return {
            "document_type": cls.CLAIM_DOCUMENT_TYPE,
            # invitation_code is indexed as unique in the collection; use registration_code to avoid null collisions
            "invitation_code": claim.registration_code,
            "registration_code": claim.registration_code,
            "claimed_user_id": claim.claimed_user_id,
            "claimed_at": datetime_to_mongo_date(claim.claimed_at),
            "claim_source": claim_source_value,
            "report_token_hash": claim.report_token_hash,
            "invitation_code_template": claim.invitation_code_template,
            "metadata": claim.metadata or {},
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

    async def get_claim_by_registration_code(self, registration_code: str) -> Optional[SecureLinkCodeClaim]:
        try:
            doc = await self._collection.find_one({"registration_code": {"$eq": registration_code}})

            if not doc:
                return None

            return self._claim_from_db(doc)
        except Exception as e:
            self._logger.exception(e)
            raise e

    async def upsert_claim(self, claim: SecureLinkCodeClaim) -> SecureLinkCodeClaim:
        try:
            existing = await self.get_claim_by_registration_code(claim.registration_code)
            if existing is not None:
                return existing

            payload = self._claim_to_db(claim)
            await self._collection.update_one(
                {"registration_code": {"$eq": claim.registration_code}},
                {"$setOnInsert": payload},
                upsert=True
            )

            fresh = await self.get_claim_by_registration_code(claim.registration_code)
            if fresh:
                return fresh

            raise RuntimeError("Failed to persist secure link claim")
        except Exception as e:
            self._logger.exception(e)
            raise e

    async def get_valid_invitation_by_code(self, invitation_code: str, enforce_capacity: bool = True) -> Optional[UserInvitation]:
        """
        Find a user invitation by the code
        Returns None if the invitation is not found or invalid
        Otherwise, returns the UserInvitation object

        :param invitation_code: str the invitation code
        :return: Optional[UserInvitation] the user invitation object
        """

        now = get_now()
        try:
            query = {
                "invitation_code": {"$eq": invitation_code},
                "valid_from": {"$lte": now},
                "valid_until": {"$gte": now}
            }

            if enforce_capacity:
                query["remaining_usage"] = {"$gt": 0}

            _doc = await self._collection.find_one(query)

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
