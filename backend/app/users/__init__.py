from fastapi import APIRouter

from app.users.preferences import router as user_preferences_router

router = APIRouter(prefix="/users")

router.include_router(user_preferences_router)
