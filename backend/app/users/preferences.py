from fastapi import APIRouter, HTTPException

from app.users.repositories import UserPreferenceRepository
from app.users.types import UserPreferencesUpdateRequest, UserPreferences, UpdateUserLanguageRequest, \
    CreateUserPreferencesRequest

import random


async def _update_user_language(repository: UserPreferenceRepository,
                                user_preferences: UpdateUserLanguageRequest) -> UserPreferences:
    user_language = await repository.get_user_preference_by_user_id(user_preferences.user_id)

    if user_language is None:
        raise HTTPException(status_code=404, detail="user not found")

    return await repository.update_user_preference(user_preferences.user_id,
                                                   UserPreferencesUpdateRequest(language=user_preferences.language))


async def _get_user_preferences(repository: UserPreferenceRepository, user_id: str) -> UserPreferences:
    user_preferences = await repository.get_user_preference_by_user_id(user_id)
    if user_preferences is None:
        raise HTTPException(
            status_code=404,
            detail="user not found"
        )

    # Check if the sessions field is missing or empty, and add a new session if needed
    if 'sessions' not in user_preferences or not user_preferences['sessions']:
        session_id = random.randint(0, (1 << 48) - 1)  # nosec
        user_preferences = await repository.update_user_preference(user_id,
                                                                   UserPreferencesUpdateRequest(sessions=[session_id]))

    return user_preferences


async def _create_user_preferences(repository: UserPreferenceRepository, user: CreateUserPreferencesRequest) \
        -> UserPreferences:
    user_already_exists = await repository.get_user_preference_by_user_id(user.user_id)

    if user_already_exists:
        raise HTTPException(
            status_code=409,
            detail="user already exists"
        )
    # Generating a 64-bit integer session ID
    session_id = random.randint(0, (1 << 48) - 1)  # nosec

    user.sessions = [session_id]

    created = await repository.insert_user_preference(user.user_id, UserPreferences(**user.dict()))

    return created


def add_user_preference_routes(_router: APIRouter):
    router = APIRouter(prefix="/preferences", tags=["user-preferences"])

    user_preference_repository = UserPreferenceRepository()

    @router.get("",
                response_model=UserPreferences,
                name="get user preferences",
                description="Get user preferences, (language and time when they accepted terms and conditions)")
    async def _get_user_preferences_handler(user_id: str):
        return await _get_user_preferences(user_preference_repository, user_id)

    @router.post("",
                 response_model=UserPreferences,
                 status_code=201,
                 name="add user preferences",
                 description="Add user preferences, (language and time when they accepted terms and conditions)"
                 )
    async def _create_handler(user_preferences: CreateUserPreferencesRequest):
        return await _create_user_preferences(user_preference_repository, user_preferences)

    @router.put("/update-language",
                response_model=UserPreferences,
                name="update user preferences, specifically language",
                description="Update user preferences - language"
                )
    async def _update_user_language_handler(user: UpdateUserLanguageRequest):
        return await _update_user_language(user_preference_repository, user)

    _router.include_router(router)
