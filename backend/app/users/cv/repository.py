import logging
from abc import ABC, abstractmethod
from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.server_dependencies.database_collections import Collections
from app.users.cv.errors import DuplicateCVUploadError
from app.users.cv.types import UserCVUpload, UploadProcessState
from common_libs.time_utilities import get_now, datetime_to_mongo_date, mongo_date_to_datetime


class IUserCVRepository(ABC):
    @abstractmethod
    async def insert_upload(self, upload: UserCVUpload) -> str:
        raise NotImplementedError()

    @abstractmethod
    async def count_uploads_for_user(self, user_id: str) -> int:
        raise NotImplementedError()

    @abstractmethod
    async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
        raise NotImplementedError()

    @abstractmethod
    async def update_state(self, user_id: str, upload_id: str, *, to_state: UploadProcessState) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def get_upload_by_id(self, user_id: str, upload_id: str) -> dict | None:
        raise NotImplementedError()

    @abstractmethod
    async def get_upload_by_upload_id(self, upload_id: str) -> dict | None:
        raise NotImplementedError()

    @abstractmethod
    async def request_cancellation(self, user_id: str, upload_id: str) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def atomic_state_transition(self,
                                      user_id: str,
                                      upload_id: str,
                                      *,
                                      from_states: list[UploadProcessState],
                                      to_state: UploadProcessState) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def mark_failed(self, user_id: str, upload_id: str, *, error_code: str, error_detail: str) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def store_experiences(self, user_id: str, upload_id: str, *, experiences: list[str]) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def mark_cancelled(self, user_id: str, upload_id: str) -> bool:
        raise NotImplementedError()

    async def get_user_uploads(self, *, user_id: str) -> list[UserCVUpload]:
        """Optional extension point: return completed uploads for a user."""
        raise NotImplementedError()

    @abstractmethod
    async def mark_state_injected(self, user_id: str, upload_id: str) -> bool:
        raise NotImplementedError()

    @abstractmethod
    async def mark_injection_failed(self, user_id: str, upload_id: str, *, error: str) -> bool:
        raise NotImplementedError()


class UserCVRepository(IUserCVRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(Collections.USER_CV_UPLOADS)

    @staticmethod
    def _to_db_doc(upload: UserCVUpload) -> dict:
        return {
            "user_id": upload.user_id,
            "created_at": datetime_to_mongo_date(upload.created_at or get_now()),
            "filename": upload.filename,
            "content_type": upload.content_type,
            "object_path": upload.object_path,
            "markdown_object_path": upload.markdown_object_path,
            "markdown_char_len": upload.markdown_char_len,
            "md5_hash": upload.md5_hash,
            "upload_id": upload.upload_id,
            "upload_process_state": upload.upload_process_state,
            "cancel_requested": upload.cancel_requested,
            "last_activity_at": datetime_to_mongo_date(upload.last_activity_at or get_now()),
            "error_code": getattr(upload, "error_code", None),
            "error_detail": getattr(upload, "error_detail", None),
            "state_injected": getattr(upload, "state_injected", False),
            "injection_error": getattr(upload, "injection_error", None),
            "experience_bullets": getattr(upload, "experience_bullets", None),
        }

    @staticmethod
    def _from_db_doc(doc: dict) -> UserCVUpload:
        return UserCVUpload(
            user_id=doc.get("user_id"),
            created_at=mongo_date_to_datetime(doc.get("created_at")),
            filename=doc.get("filename"),
            content_type=doc.get("content_type"),
            object_path=doc.get("object_path"),
            markdown_object_path=doc.get("markdown_object_path"),
            markdown_char_len=doc.get("markdown_char_len"),
            md5_hash=doc.get("md5_hash"),
            upload_id=doc.get("upload_id"),
            upload_process_state=doc.get("upload_process_state"),
            cancel_requested=doc.get("cancel_requested"),
            last_activity_at=mongo_date_to_datetime(doc.get("last_activity_at")),
            error_code=doc.get("error_code"),
            error_detail=doc.get("error_detail"),
            state_injected=doc.get("state_injected", False),
            injection_error=doc.get("injection_error"),
            experience_bullets=doc.get("experience_bullets"),
        )

    async def insert_upload(self, upload: UserCVUpload) -> str:
        payload = self._to_db_doc(upload)
        try:
            # Log before insert to trace writes
            self._logger.info(
                "Inserting CV upload {user_id=%s, upload_id=%s, filename='%s'}",
                payload.get("user_id"), payload.get("upload_id"), payload.get("filename")
            )
            result = await self._collection.insert_one(payload)
            self._logger.info(
                "Inserted CV upload {user_id=%s, upload_id=%s, inserted_id=%s}",
                payload.get("user_id"), payload.get("upload_id"), str(result.inserted_id)
            )
            return str(result.inserted_id)
        except DuplicateKeyError as e:
            # Check if this is specifically a duplicate CV upload by examining the error details
            # PyMongo DuplicateKeyError includes details about which fields caused the violation
            error_details = getattr(e, 'details', {})
            key_value = error_details.get('keyValue', {})

            # If both user_id and md5_hash are in the keyValue, it's our compound index violation
            if 'user_id' in key_value and 'md5_hash' in key_value:
                # Allow re-upload if the previous record is in a terminal state (FAILED or CANCELLED)
                existing = await self._collection.find_one({
                    "user_id": upload.user_id,
                    "md5_hash": upload.md5_hash,
                })
                if existing and existing.get("upload_process_state") in [
                    UploadProcessState.FAILED,
                    UploadProcessState.CANCELLED,
                ]:
                    # Reset the existing record with new upload metadata and restart pipeline
                    reset_payload = self._to_db_doc(upload)
                    # Preserve immutable keys
                    reset_payload["user_id"] = existing["user_id"]
                    reset_payload["md5_hash"] = existing["md5_hash"]
                    # Clear terminal-related flags explicitly
                    reset_payload["cancel_requested"] = False
                    reset_payload["error_code"] = None
                    reset_payload["error_detail"] = None
                    reset_payload["experience_bullets"] = None
                    await self._collection.update_one(
                        {"_id": existing["_id"]}, {"$set": reset_payload}
                    )
                    self._logger.info(
                        "Reinitialized terminal CV upload {user_id=%s, upload_id=%s, md5=%s}",
                        upload.user_id, upload.upload_id, upload.md5_hash,
                    )
                    return str(existing["_id"])
                # Otherwise, still considered duplicate
                raise DuplicateCVUploadError(upload.md5_hash)
            else:
                # Re-raise other duplicate key errors (object_path, markdown_object_path)
                raise

    async def count_uploads_for_user(self, user_id: str) -> int:
        return await self._collection.count_documents({"user_id": {"$eq": user_id}})

    async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
        window_start = get_now() - timedelta(minutes=minutes)
        return await self._collection.count_documents({
            "user_id": {"$eq": user_id},
            "created_at": {"$gte": datetime_to_mongo_date(window_start)}
        })

    async def get_upload_by_id(self, user_id: str, upload_id: str) -> dict | None:
        doc = await self._collection.find_one({
            "user_id": user_id,
            "upload_id": upload_id,
        })
        if doc:
            self._logger.debug(
                "Found CV upload {user_id=%s, upload_id=%s}", user_id, upload_id
            )
        else:
            self._logger.debug(
                "CV upload not found {user_id=%s, upload_id=%s}", user_id, upload_id
            )
        return doc

    async def get_upload_by_upload_id(self, upload_id: str) -> dict | None:
        return await self._collection.find_one({
            "upload_id": upload_id,
        })

    async def request_cancellation(self, user_id: str, upload_id: str) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$nin": [
                    UploadProcessState.COMPLETED,
                    UploadProcessState.FAILED,
                    UploadProcessState.CANCELLED,
                ]}
            },
            {"$set": {"cancel_requested": True, "last_activity_at": datetime_to_mongo_date(get_now())}},
        )
        return res.modified_count > 0

    async def atomic_state_transition(self,
                                      user_id: str,
                                      upload_id: str,
                                      *,
                                      from_states: list[UploadProcessState],
                                      to_state: UploadProcessState) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$in": from_states},
                "cancel_requested": False,
            },
            {"$set": {"upload_process_state": to_state,
                      "last_activity_at": datetime_to_mongo_date(get_now())}},
        )
        return res.modified_count > 0

    async def mark_failed(self, user_id: str, upload_id: str, *, error_code: str, error_detail: str) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$nin": [UploadProcessState.COMPLETED, UploadProcessState.CANCELLED]},
            },
            {
                "$set": {
                    "upload_process_state": UploadProcessState.FAILED,
                    "error_code": error_code,
                    "error_detail": error_detail,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def store_experiences(self, user_id: str, upload_id: str, *, experiences: list[str]) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$nin": [UploadProcessState.CANCELLED, UploadProcessState.FAILED]},
            },
            {
                "$set": {
                    "experience_bullets": experiences,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def update_state(self, user_id: str, upload_id: str, *, to_state: UploadProcessState) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$nin": [UploadProcessState.COMPLETED, UploadProcessState.CANCELLED]},
            },
            {
                "$set": {
                    "upload_process_state": to_state,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def mark_cancelled(self, user_id: str, upload_id: str) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
                "upload_process_state": {"$nin": [UploadProcessState.COMPLETED, UploadProcessState.FAILED]},
            },
            {
                "$set": {
                    "upload_process_state": UploadProcessState.CANCELLED,
                    "cancel_requested": True,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def mark_state_injected(self, user_id: str, upload_id: str) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
            },
            {
                "$set": {
                    "state_injected": True,
                    "injection_error": None,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def mark_injection_failed(self, user_id: str, upload_id: str, *, error: str) -> bool:
        res = await self._collection.update_one(
            {
                "user_id": user_id,
                "upload_id": upload_id,
            },
            {
                "$set": {
                    "state_injected": False,
                    "injection_error": error,
                    "last_activity_at": datetime_to_mongo_date(get_now()),
                },
            },
        )
        return res.modified_count > 0

    async def get_user_uploads(self, *, user_id: str) -> list[UserCVUpload]:
        """
        Get all COMPLETED uploads for a specific user
        """

        query = {
            "user_id": {"$eq": user_id},
            "upload_process_state": {"$eq": UploadProcessState.COMPLETED},
        }

        cursor = self._collection.find(query, sort=[("created_at", -1)])  # Most recent first
        docs = await cursor.to_list(length=None)

        self._logger.debug(
            "Fetched %d COMPLETED CV uploads for user_id=%s", len(docs), user_id
        )

        # Convert MongoDB documents to UserCVUpload objects
        return [UserCVRepository._from_db_doc(doc) for doc in docs]
