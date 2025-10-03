import logging
from datetime import timedelta
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.server_dependencies.database_collections import Collections
from app.users.cv.types import UserCVUpload
from app.users.cv.errors import DuplicateCVUploadError
from common_libs.time_utilities import get_now, datetime_to_mongo_date


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
        }

    async def insert_upload(self, upload: UserCVUpload) -> str:
        payload = self._to_db_doc(upload)
        try:
            result = await self._collection.insert_one(payload)
            return str(result.inserted_id)
        except DuplicateKeyError as e:
            # Check if this is specifically a duplicate CV upload by examining the error details
            # PyMongo DuplicateKeyError includes details about which fields caused the violation
            error_details = getattr(e, 'details', {})
            key_value = error_details.get('keyValue', {})
            
            # If both user_id and md5_hash are in the keyValue, it's our compound index violation
            if 'user_id' in key_value and 'md5_hash' in key_value:
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


