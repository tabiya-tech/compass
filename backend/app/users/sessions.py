import random

from fastapi import HTTPException

from app.constants.errors import ErrorService
from app.users.repositories import UserPreferenceRepository
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest


def generate_new_session_id():
    """
    Generate a new session ID
    :return: a new session ID
    """

    # TODO: Ensure that the session ID is unique in the database.

    return random.randint(0, (1 << 48) - 1)  # nosec


class SessionsService:
    def __init__(self, user_repository: UserPreferenceRepository):
        self.user_repository = user_repository

    async def new_session(self, user_id: str) -> UserPreferences:
        """
        Create a new session for the user
        :param user_id: str - the user ID
        :return: UserPreferences - the updated user preferences
        """
        try:
            new_session_id = generate_new_session_id()

            # Get the user preferences
            user_preferences = await self.user_repository.get_user_preference_by_user_id(user_id)

            # If the user does not exist, raise an HTTPException
            if user_preferences is None:
                raise HTTPException(status_code=404, detail="User not found")

            # Add the new session to the user preferences
            # we are using the new session ID as the first element of the list
            # And the client must use the new session ID for the next requests
            # :note: This must be in sync with frontend-new/src/chat/Chat.tsx#L179
            new_sessions = [new_session_id, *user_preferences.sessions]

            return await self.user_repository.update_user_preference(
                user_id=user_id,
                update=UserPreferencesRepositoryUpdateRequest(sessions=new_sessions)
            )

        except Exception as e:
            ErrorService.handle(__name__, e)
