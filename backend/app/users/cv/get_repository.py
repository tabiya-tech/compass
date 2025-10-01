import asyncio
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.cv.repository import UserCVRepository, IUserCVRepository

_repo_singleton: IUserCVRepository | None = None
_repo_lock = asyncio.Lock()


async def get_user_cv_repository(user_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db)) -> IUserCVRepository:
    global _repo_singleton
    if _repo_singleton is None:
        async with _repo_lock:
            if _repo_singleton is None:
                _repo_singleton = UserCVRepository(user_db)
    return _repo_singleton


