from fastapi import APIRouter, HTTPException, Depends

from app.constants.errors import ErrorService, HTTPErrorResponse
from app.invitations.service import UserInvitationService
from app.invitations.types import InvitationCodeStatus, InvitationType
from app.users.auth import Authentication, UserInfo, SignInProvider
from app.users.repositories import UserPreferenceRepository
from app.users.sessions import generate_new_session_id, SessionsService
from app.users.types import UserPreferencesUpdateRequest, UserPreferences, UpdateUserLanguageRequest, \
    CreateUserPreferencesRequest

import logging

logger = logging.getLogger(__name__)


async def _update_user_language(
        repository: UserPreferenceRepository,
        user_preferences: UpdateUserLanguageRequest,
        authed_user: UserInfo) -> UserPreferences:
    try:
        if authed_user.user_id != user_preferences.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        user_language = await repository.get_user_preference_by_user_id(user_preferences.user_id)

        if user_language is None:
            raise HTTPException(status_code=404, detail="user not found")

        return await repository.update_user_preference(user_preferences.user_id,
                                                       UserPreferencesUpdateRequest(language=user_preferences.language))
    except Exception as e:
        logger.exception(e)

        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(status_code=500, detail="internal server error - " + e.__str__())


async def _get_user_preferences(
        repository: UserPreferenceRepository,
        user_id: str,
        authed_user: UserInfo) -> UserPreferences:
    try:
        if user_id != authed_user.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        user_preferences = await repository.get_user_preference_by_user_id(user_id)

        if user_preferences is None:
            raise HTTPException(
                status_code=404,
                detail="user not found"
            )

        # Check if the sessions field is missing or empty, and add a new session if needed
        if not user_preferences.sessions or len(user_preferences.sessions) == 0:
            session_id = generate_new_session_id()  # nosec
            user_preferences = await repository.update_user_preference(user_id,
                                                                       UserPreferencesUpdateRequest(
                                                                           sessions=[session_id]))

        return user_preferences
    except Exception as e:
        logger.exception(e)

        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


async def _create_user_preferences(
        user_invitation_service: UserInvitationService,
        repository: UserPreferenceRepository,
        preferences: CreateUserPreferencesRequest,
        authed_user: UserInfo) -> UserPreferences:
    try:
        if preferences.user_id != authed_user.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        # If an invitation code is provided, perform the validation
        # TODO: The invitation code is optional since register with invitation code is not yet implemented
        # make invitation code required when the feature is implemented
        if preferences.invitation_code:
            # validation of invitation code.
            invitation = await user_invitation_service.get_invitation_status(preferences.invitation_code)

            if invitation.status == InvitationCodeStatus.INVALID:
                raise HTTPException(status_code=400, detail="Invalid invitation code")

            # an authenticated user can't use an auto-register invitation code
            if (invitation.invitation_type == InvitationType.AUTO_REGISTER.value
                    and authed_user.sign_in_provider != SignInProvider.ANONYMOUS):
                raise HTTPException(status_code=400, detail="Invalid invitation code")

            # an anonymous user can't use a register invitation code because it requires user to register
            if (invitation.invitation_type == InvitationType.REGISTER.value and
                    authed_user.sign_in_provider == SignInProvider.ANONYMOUS):
                raise HTTPException(status_code=400, detail="Invalid invitation code")

            # Reduce the invitation code capacity
            is_reduced = await user_invitation_service.reduce_invitation_code_capacity(preferences.invitation_code)

            if not is_reduced:
                raise HTTPException(status_code=400, detail="Invalid invitation code")

        # Check if user preferences already exist
        user_already_exists = await repository.get_user_preference_by_user_id(preferences.user_id)

        if user_already_exists:
            raise HTTPException(
                status_code=409,
                detail="user already exists"
            )

        # Generating a 64-bit integer session ID
        session_id = generate_new_session_id()  # nosec
        preferences.sessions = [session_id]

        # Create the user preferences
        created = await repository.insert_user_preference(preferences.user_id, UserPreferences(
            language=preferences.language,
            accepted_tc=preferences.accepted_tc,
            sessions=preferences.sessions
        ))

        return created

    except Exception as e:
        logger.exception(e)

        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(status_code=500, detail="failed to create user preferences")


async def _get_new_session(user_repository: UserPreferenceRepository, user_id: str, authed_user: UserInfo) -> UserPreferences:
    """
    Get a new session for the user
    :param user_id:  id of the user
    :param authed_user: authenticated user
    :return: UserPreferences - with the new session
    """
    try:
        # Check if the user is the same as the authenticated user
        if user_id != authed_user.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        session_service = SessionsService(user_repository)
        return await session_service.new_session(user_id)
    except Exception as e:
        ErrorService.handle(__name__, e)
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


def add_user_preference_routes(users_router: APIRouter, auth: Authentication):
    """
    Add all routes related to user preferences to the users router.
    :param users_router: APIRouter: The router to add the user preferences routes to.
        This route contains all endpoints related to users module on the platform
    :param auth: Authentication: The authentication instance to use for the routes.
    """
    router = APIRouter(prefix="/preferences", tags=["user-preferences"])

    #########################
    # Dependency Injection - User Preference Repository
    #########################
    user_preference_repository = UserPreferenceRepository()
    user_invitation_service = UserInvitationService()

    #########################
    # GET /preferences - Get user preferences by user id
    #########################
    @router.get("",
                response_model=UserPreferences,
                status_code=200,
                responses={403: {"model" : HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                name="get user preferences",
                description="Get user preferences, (language and time when they accepted terms and conditions)")
    async def _get_user_preferences_handler(user_id: str, user_info: UserInfo = Depends(auth.get_user_info())):
        return await _get_user_preferences(user_preference_repository, user_id, user_info)

    #########################
    # POST /preferences - Add user preferences, this is a one-time operation otherwise it will return 409
    #########################
    @router.post("",
                 response_model=UserPreferences,
                 status_code=201,
                 responses={403: {"model" : HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                 name="add user preferences",
                 description="Add user preferences, (language and time when they accepted terms and conditions)"
                 )
    async def _create_handler(user_preferences: CreateUserPreferencesRequest,
                              user_info: UserInfo = Depends(auth.get_user_info())):
        return await _create_user_preferences(user_invitation_service, user_preference_repository, user_preferences, user_info)

    #########################
    # PUT /update-language - Update user preferences - language
    #########################
    @router.put("/update-language",
                response_model=UserPreferences,
                status_code=200,
                responses={403: {"model" : HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                name="update user preferences, specifically language",
                description="Update user preferences - language"
                )
    async def _update_user_language_handler(user: UpdateUserLanguageRequest,
                                            user_info: UserInfo = Depends(auth.get_user_info())):
        return await _update_user_language(user_preference_repository, user, user_info)

    #########################
    # GET /new-session - Get a new session for the user
    #########################
    @router.get("/new-session",
                response_model=UserPreferences,
                status_code=201,
                responses={403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                description="""Endpoint for starting a new conversation session.""")
    async def _get_new_session_handler(user_id: str, user_info: UserInfo = Depends(auth.get_user_info())):
        """
        Endpoint for starting a new conversation session.
        The function creates a new session id and adds it to the user sessions on the top of the list.

        :param user_info: UserInfo - The logged-in user information
        :return: UserPreferences - The updated user preferences
        """
        return await _get_new_session(user_preference_repository, user_id, user_info)

    #########################
    # Add the router to the users router
    #########################
    users_router.include_router(router)
