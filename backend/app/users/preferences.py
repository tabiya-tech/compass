import asyncio

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import ErrorService, HTTPErrorResponse
from app.invitations.service import UserInvitationService
from app.invitations.types import InvitationCodeStatus, InvitationType
from app.users.sensitive_personal_data.routes import get_sensitive_personal_data_service
from app.users.sensitive_personal_data.service import ISensitivePersonalDataService
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo, SignInProvider
from app.users.feedback.service import UserFeedbackService
from app.users.repositories import UserPreferenceRepository
from app.users.sessions import generate_new_session_id, SessionsService
from app.users.types import UserPreferencesUpdateRequest, UserPreferences, \
    CreateUserPreferencesRequest, UserPreferencesRepositoryUpdateRequest, UsersPreferencesResponse

import logging

logger = logging.getLogger(__name__)


async def _get_user_preferences(
        repository: UserPreferenceRepository,
        user_feedback_service: UserFeedbackService,
        sensitive_personal_data_service: ISensitivePersonalDataService,
        user_id: str,
        authed_user: UserInfo) -> UsersPreferencesResponse:
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
            user_preferences = await repository.update_user_preference(
                user_id,
                UserPreferencesRepositoryUpdateRequest(
                    sessions=[session_id]
                )
            )

        # Fetch feedback sessions together with if they have sensitive personal data
        sessions_with_feedback, has_sensitive_personal_data = await asyncio.gather(
            user_feedback_service.get_user_feedback(user_id),
            sensitive_personal_data_service.exists_by_user_id(user_id)
        )

        return UsersPreferencesResponse(
            **user_preferences.model_dump(),
            has_sensitive_personal_data=has_sensitive_personal_data,
            sessions_with_feedback=sessions_with_feedback
        )
    except Exception as e:
        logger.exception(e)

        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


INVALID_INVITATION_CODE_MESSAGE = "Invalid invitation code"


async def _create_user_preferences(
        user_invitation_service: UserInvitationService,
        repository: UserPreferenceRepository,
        preferences: CreateUserPreferencesRequest,
        authed_user: UserInfo) -> UsersPreferencesResponse:
    try:
        if preferences.user_id != authed_user.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        # validation of invitation code.
        invitation = await user_invitation_service.get_invitation_status(preferences.invitation_code)

        if invitation.status == InvitationCodeStatus.INVALID:
            raise HTTPException(status_code=400, detail=INVALID_INVITATION_CODE_MESSAGE)

        # an authenticated user can't use a login invitation code
        if (invitation.invitation_type == InvitationType.LOGIN.value
                and authed_user.sign_in_provider != SignInProvider.ANONYMOUS):
            raise HTTPException(status_code=400, detail=INVALID_INVITATION_CODE_MESSAGE)

        # an anonymous user can't use a register invitation code because it requires user to register
        if (invitation.invitation_type == InvitationType.REGISTER.value and
                authed_user.sign_in_provider == SignInProvider.ANONYMOUS):
            raise HTTPException(status_code=400, detail=INVALID_INVITATION_CODE_MESSAGE)

        # Check if user preferences already exist
        user_already_exists = await repository.get_user_preference_by_user_id(preferences.user_id)

        if user_already_exists:
            raise HTTPException(
                status_code=409,
                detail="user already exists"
            )

        # Reduce the invitation code capacity
        is_reduced = await user_invitation_service.reduce_invitation_code_capacity(preferences.invitation_code)

        if not is_reduced:
            raise HTTPException(status_code=400, detail=INVALID_INVITATION_CODE_MESSAGE)

        # Generating a 64-bit integer session ID
        session_id = generate_new_session_id()
        sessions = [session_id]

        # Create the user preferences
        newly_created = await repository.insert_user_preference(preferences.user_id, UserPreferences(
            language=preferences.language,
            invitation_code=preferences.invitation_code,
            sensitive_personal_data_requirement=invitation.sensitive_personal_data_requirement,
            sessions=sessions
        ))

        return UsersPreferencesResponse(
            **newly_created.model_dump(),
            has_sensitive_personal_data=False,
            sessions_with_feedback=[]
        )
    except Exception as e:
        logger.exception(e)

        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(status_code=500, detail="failed to create user preferences")


async def _get_new_session(user_repository: UserPreferenceRepository,
                           user_feedback_service: UserFeedbackService,
                           sensitive_personal_data_service: ISensitivePersonalDataService,
                           user_id: str,
                           authed_user: UserInfo) -> UsersPreferencesResponse:
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

        updated_user_preferences, sessions_with_feedback, has_sensitive_personal_data = await asyncio.gather(
            session_service.new_session(user_id),
            user_feedback_service.get_user_feedback(user_id),
            sensitive_personal_data_service.exists_by_user_id(user_id)
        )

        return UsersPreferencesResponse(
            **updated_user_preferences.model_dump(),
            has_sensitive_personal_data=has_sensitive_personal_data,
            sessions_with_feedback=sessions_with_feedback
        )

    except Exception as e:
        ErrorService.handle(__name__, e)
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


async def _update_user_preferences(
        repository: UserPreferenceRepository,
        user_feedback_service: UserFeedbackService,
        sensitive_personal_data_service: ISensitivePersonalDataService,
        preferences: UserPreferencesUpdateRequest,
        authed_user: UserInfo) -> UsersPreferencesResponse:
    """
    Update user preferences
    :param repository: UserPreferenceRepository - The user preference repository
    :param preferences: CreateUserPreferencesRequest - The user preferences to update
    :param authed_user: UserInfo - The authenticated user
    :return:
    """
    try:
        if preferences.user_id != authed_user.user_id:
            raise HTTPException(status_code=403, detail="forbidden")

        # Check if user preferences already exist
        user_already_exists = await repository.get_user_preference_by_user_id(preferences.user_id)

        if not user_already_exists:
            raise HTTPException(
                status_code=404,
                detail="user does not exist exists"
            )

        # you can't update the accepted terms and conditions when it's already accepted
        if preferences.accepted_tc and user_already_exists.accepted_tc:
            raise HTTPException(
                status_code=400,
                detail="accepted terms and conditions can't be updated once accepted"
            )

        updated_user_preferences, sessions_with_feedback, has_sensitive_personal_data = await asyncio.gather(
            repository.update_user_preference(preferences.user_id, UserPreferencesRepositoryUpdateRequest(
                language=preferences.language,
                accepted_tc=preferences.accepted_tc,
            )),
            user_feedback_service.get_user_feedback(preferences.user_id),
            sensitive_personal_data_service.exists_by_user_id(preferences.user_id)
        )

        return UsersPreferencesResponse(
            **updated_user_preferences.model_dump(),
            has_sensitive_personal_data=has_sensitive_personal_data,
            sessions_with_feedback=sessions_with_feedback
        )

    except Exception as e:
        ErrorService.handle(__name__, e)


async def _get_user_preferences_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserPreferenceRepository(db)


async def _get_user_invitations_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserInvitationService(db)


async def _get_user_feedback_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserFeedbackService(db)


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

    #########################
    # GET /preferences - Get user preferences by user id
    #########################
    @router.get("",
                response_model=UsersPreferencesResponse,
                status_code=200,
                responses={403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                name="get user preferences",
                description="Get user preferences, (language and time when they accepted terms and conditions)")
    async def _get_user_preferences_handler(
            user_id: str, user_info: UserInfo = Depends(auth.get_user_info()),
            user_preference_repository: UserPreferenceRepository = Depends(_get_user_preferences_service),
            sensitive_personal_data_service: ISensitivePersonalDataService = Depends(get_sensitive_personal_data_service),
            user_feedback_service: UserFeedbackService = Depends(_get_user_feedback_service)
    ) -> UsersPreferencesResponse:
        return await _get_user_preferences(
            user_preference_repository,
            user_feedback_service,
            sensitive_personal_data_service,
            user_id,
            user_info
        )

    #########################
    # POST /preferences - Add user preferences, this is a one-time operation otherwise it will return 409
    #########################
    @router.post("",
                 response_model=UsersPreferencesResponse,
                 status_code=201,
                 responses={403: {"model": HTTPErrorResponse}, 409: {"model": HTTPErrorResponse},
                            500: {"model": HTTPErrorResponse}},
                 name="add user preferences",
                 description="Add user preferences, (language and time when they accepted terms and conditions)"
                 )
    async def _create_handler(body: CreateUserPreferencesRequest,
                              user_info: UserInfo = Depends(auth.get_user_info()),
                              user_invitation_service: UserInvitationService = Depends(_get_user_invitations_service),
                              user_preference_repository: UserPreferenceRepository = Depends(
                                  _get_user_preferences_service)
                              ) -> UsersPreferencesResponse:
        return await _create_user_preferences(user_invitation_service, user_preference_repository, body, user_info)

    #########################
    # POS /users/preferences - Create a user preferences
    #########################
    @router.patch(
        path="",
        status_code=200,
        response_model=UsersPreferencesResponse,
        responses={404: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
        description="Update user preferences",
    )
    async def _update_user_preferences_handler(
            request: UserPreferencesUpdateRequest,
            user_info: UserInfo = Depends(auth.get_user_info()),
            user_preference_repository: UserPreferenceRepository = Depends(_get_user_preferences_service),
            sensitive_personal_data_service: ISensitivePersonalDataService = Depends(get_sensitive_personal_data_service),
            user_feedback_service: UserFeedbackService = Depends(_get_user_feedback_service)
    ) -> UsersPreferencesResponse:
        return await _update_user_preferences(
            user_preference_repository,
            user_feedback_service,
            sensitive_personal_data_service,
            request,
            user_info
        )

    #########################
    # GET /new-session - Get a new session for the user
    #########################
    @router.get("/new-session",
                response_model=UsersPreferencesResponse,
                status_code=201,
                responses={403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                description="""Endpoint for starting a new conversation session.""")
    async def _get_new_session_handler(user_id: str, user_info: UserInfo = Depends(auth.get_user_info()),
                                       user_preference_repository: UserPreferenceRepository = Depends(_get_user_preferences_service),
                                       sensitive_personal_data_service: ISensitivePersonalDataService = Depends(get_sensitive_personal_data_service),
                                       user_feedback_service: UserFeedbackService = Depends(_get_user_feedback_service)
                                       ) -> UsersPreferencesResponse:
        """
        Endpoint for starting a new conversation session.
        The function creates a new session id and adds it to the user sessions on the top of the list.

        :param user_info: UserInfo - The logged-in user information
        :return: UserPreferences - The updated user preferences
        """
        return await _get_new_session(user_preference_repository,
                                      user_feedback_service,
                                      sensitive_personal_data_service,
                                      user_id,
                                      user_info)

    #########################
    # Add the router to the users router
    #########################
    users_router.include_router(router)
