from fastapi import APIRouter, HTTPException

from app.users.repositories import UserPreferenceRepository
from app.users.types import UserLanguage, UserPreferences

router = APIRouter(prefix="/preferences", tags=["user-preferences"])

user_preference_repository = UserPreferenceRepository()


@router.get("")
async def get_user_preferences(user_id: str):
    user = await user_preference_repository.get_user_preference_by_user_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="user not found"
        )

    return {
        "accepted_tc": user.get("accepted_tc"),
        "language": user.get("language")
    }


@router.post("")
async def create_user_preferences(user: UserPreferences):
    user_already_exists = await user_preference_repository.get_user_preference_by_user_id(user.user_id)

    if user_already_exists:
        raise HTTPException(
            status_code=409,
            detail="user already exists"
        )

    created = await user_preference_repository.insert_user_preference({
        "user_id": user.user_id,
        "language": user.language,
        "accepted_tc": user.accepted_tc
    })

    return {
        "user_preference_id": str(created.inserted_id),
        "user_preferences": user
    }


@router.put("/update-language")
async def update_user_language(user_preferences: UserLanguage):
    user_language = await user_preference_repository.get_user_preference_by_user_id(user_preferences.user_id)

    if user_language is None:
        raise HTTPException(status_code=404, detail="user not found")

    user_language = await user_preference_repository.update_user_preference({
        "user_preference_id": user_preferences.user_id
    }, {
        "language": user_preferences.language
    })

    return user_language
