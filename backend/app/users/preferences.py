from fastapi import APIRouter, HTTPException

from app.users.repositories import UserPreferenceRepository
from app.users.types import UserLanguage, UserPreferences

import random


async def update_user_language(repository: UserPreferenceRepository, user_preferences: UserLanguage):
    user_language = await repository.get_user_preference_by_user_id(user_preferences.user_id)

    if user_language is None:
        raise HTTPException(status_code=404, detail="user not found")

    await repository.update_user_preference({
        "user_id": user_preferences.user_id
    }, {
        "language": user_preferences.language
    })

    return user_preferences


async def get_user_preferences(repository: UserPreferenceRepository, user_id: str):
    user = await repository.get_user_preference_by_user_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="user not found"
        )

    # Check if the sessions field is missing or empty, and add a new session if needed
    if 'sessions' not in user or not user['sessions']:
        session_id = random.randint(0, (1 << 48) - 1) # nosec
        await repository.update_user_preference({
            "user_id": user_id
        }, {
            "sessions": [session_id]
        })
        user['sessions'] = [session_id]

    return {
        "user_id": user_id,
        "accepted_tc": user.get("accepted_tc"),
        "language": user.get("language"),
        "sessions": user.get("sessions")
    }


async def create_user_preferences(repository: UserPreferenceRepository, user: UserPreferences):
    user_already_exists = await repository.get_user_preference_by_user_id(user.user_id)

    if user_already_exists:
        raise HTTPException(
            status_code=409,
            detail="user already exists"
        )
    # Generating a 64-bit integer session ID
    session_id = random.randint(0, (1 << 48) - 1)  # nosec

    created = await repository.insert_user_preference({
        "user_id": user.user_id,
        "language": user.language,
        "accepted_tc": user.accepted_tc,
        "sessions": [session_id]
    })

    return {
        "user_preference_id": str(created.inserted_id),
        "user_preferences": user
    }


def add_user_preference_routes(_router: APIRouter):
    router = APIRouter(prefix="/preferences", tags=["user-preferences"])

    user_preference_repository = UserPreferenceRepository()

    @router.get("",
                response_model=UserPreferences,
                name="get user preferences",
                description="Get user preferences, (language and time when they accepted terms and conditions)")
    async def get_user_preferences_handler(user_id: str):
        return await get_user_preferences(user_preference_repository, user_id)

    @router.post("",
                 status_code=201,
                 name="add user preferences",
                 description="Add user preferences, (language and time when they accepted terms and conditions)"
                 )
    async def create_handler(user: UserPreferences):
        return await create_user_preferences(user_preference_repository, user)

    @router.put("/update-language",
                response_model=UserLanguage,
                name="update user preferences, specifically language",
                description="Update user preferences - language"
                )
    async def update_user_language_handler(user: UserLanguage):
        return await update_user_language(user_preference_repository, user)

    _router.include_router(router)