"""
This module contains the routes for the conversation module.
"""

import logging
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.application_state import ApplicationStateManager
from app.constants.errors import HTTPErrorResponse
from app.context_vars import (
    client_id_ctx_var,
    session_id_ctx_var,
    user_id_ctx_var,
    user_profile_context_var,
)
from app.conversation_memory.conversation_memory_manager import (
    ConversationMemoryManager,
)
from app.conversations.constants import MAX_MESSAGE_LENGTH, UNEXPECTED_FAILURE_MESSAGE
from app.conversations.experience.routes import add_experience_routes
from app.conversations.feedback.routes.routes import add_user_feedback_routes
from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.routes import (
    add_reaction_routes,
    get_user_preferences_repository,
)
from app.conversations.service import (
    ConversationAlreadyConcludedError,
    ConversationService,
    IConversationService,
)
from app.conversations.types import ConversationInput, ConversationResponse
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.job_preferences.get_job_preferences_service import get_job_preferences_service
from app.job_preferences.service import IJobPreferencesService
from app.metrics.application_state_metrics_recorder.recorder import (
    ApplicationStateMetricsRecorder,
)
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.agent_director_dependencies import get_agent_director
from app.server_dependencies.application_state_dependencies import (
    get_application_state_manager,
)
from app.server_dependencies.conversation_manager_dependencies import (
    get_conversation_memory_manager,
)
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_recommendations.services.get_user_recommendations_service import (
    get_user_recommendations_service,
)
from app.user_recommendations.services.service import IUserRecommendationsService
from app.users.auth import Authentication, UserInfo
from app.users.plain_personal_data.routes import get_plain_personal_data_service
from app.users.plain_personal_data.service import (
    IPlainPersonalDataService,
    format_plain_personal_data_for_prompt,
)


async def get_conversation_service(
    agent_director: LLMAgentDirector = Depends(get_agent_director),
    application_state_manager: ApplicationStateManager = Depends(
        get_application_state_manager
    ),
    conversation_memory_manager: ConversationMemoryManager = Depends(
        get_conversation_memory_manager
    ),
    db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    metrics_service: IMetricsService = Depends(get_metrics_service),
    job_preferences_service: IJobPreferencesService = Depends(
        get_job_preferences_service
    ),
    user_recommendations_service: IUserRecommendationsService = Depends(
        get_user_recommendations_service
    ),
) -> IConversationService:
    return ConversationService(
        agent_director=agent_director,
        application_state_metrics_recorder=ApplicationStateMetricsRecorder(
            application_state_manager=application_state_manager,
            metrics_service=metrics_service,
        ),
        conversation_memory_manager=conversation_memory_manager,
        reaction_repository=ReactionRepository(db),
        job_preferences_service=job_preferences_service,
        user_recommendations_service=user_recommendations_service,
    )


def add_conversation_routes(app: FastAPI, authentication: Authentication):
    """
    Adds all the conversation routes to the FastAPI app

    :param app: FastAPI: The FastAPI app to add the routes to.
    :param authentication: Authentication Module Dependency: The authentication instance to use for the routes.
    """
    logger = logging.getLogger(__name__)

    conversation_router = APIRouter(
        prefix="/conversations/{session_id}", tags=["conversations"]
    )

    @conversation_router.post(
        path="/messages",
        status_code=HTTPStatus.CREATED,
        response_model=ConversationResponse,
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            # user is not allowed to send a message on a session where the conversation is already concluded
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            # user is not allowed to send a message on another user's session
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": HTTPErrorResponse},
            # user is not allowed to send a message longer than 1000 characters
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        # Internal server error, any server error
        description="""The main conversation route used to interact with the agent.""",
    )
    async def _send_message(
        request: Request,
        body: ConversationInput,
        session_id: Annotated[
            int,
            Path(
                description="The session id for the conversation history.",
                examples=[123],
            ),
        ],
        clear_memory: bool = False,
        filter_pii: bool = False,
        user_info: UserInfo = Depends(authentication.get_user_info()),
        user_preferences_repository=Depends(get_user_preferences_repository),
        service: IConversationService = Depends(get_conversation_service),
        plain_personal_data_service: IPlainPersonalDataService = Depends(
            get_plain_personal_data_service
        ),
    ):
        """
        Endpoint for conducting the conversation with the agent.
        """
        user_input = body.user_input
        user_id = user_info.user_id

        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_id)

        # Do not allow user input that is too long,
        # as a basic measure to prevent abuse.
        if len(user_input) > MAX_MESSAGE_LENGTH:
            logger.warning(
                "User input exceeded maximum length of %d characters",
                MAX_MESSAGE_LENGTH,
            )
            raise HTTPException(
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                detail="Too long user input",
            )
        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = (
                await user_preferences_repository.get_user_preference_by_user_id(
                    user_id
                )
            )
            if (
                current_user_preferences is None
                or session_id not in current_user_preferences.sessions
            ):
                raise UnauthorizedSessionAccessError(user_id, session_id)

            # set the client_id in the context variable.
            client_id_ctx_var.set(current_user_preferences.client_id)

            # Set user profile context from plain personal data
            plain_personal_data = await plain_personal_data_service.get(user_id)
            if plain_personal_data:
                user_profile_context_var.set(
                    format_plain_personal_data_for_prompt(plain_personal_data)
                )

            return await service.send(
                user_id, session_id, user_input, clear_memory, filter_pii
            )
        except ConversationAlreadyConcludedError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=warning_msg)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION
            )
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(
                "Error for request: %s %s?%s with session id: %s : %s",
                request.method,
                request.url.path,
                request.query_params,
                session_id,
                e,
            )
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail=UNEXPECTED_FAILURE_MESSAGE,
            )

    @conversation_router.get(
        path="/messages",
        response_model=ConversationResponse,
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            # user is not allowed to get the messages of another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
            # Internal server error, any server error
        },
        description="""Endpoint for retrieving the conversation history.""",
    )
    async def _get_conversation_history(
        session_id: Annotated[
            int,
            Path(
                description="The session id for the conversation history.",
                examples=[123],
            ),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        user_preferences_repository=Depends(get_user_preferences_repository),
        service: ConversationService = Depends(get_conversation_service),
    ):
        """
        Endpoint for retrieving the conversation history.
        """
        user_id = user_info.user_id
        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = (
                await user_preferences_repository.get_user_preference_by_user_id(
                    user_id
                )
            )
            if (
                current_user_preferences is None
                or session_id not in current_user_preferences.sessions
            ):
                raise UnauthorizedSessionAccessError(user_id, session_id)

            # set the client_id in the context variable.
            client_id_ctx_var.set(current_user_preferences.client_id)
            return await service.get_history_by_session_id(user_id, session_id)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION
            )
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Oops! something went wrong",
            )

    ############################################
    # Add the reaction routes
    ############################################
    add_reaction_routes(conversation_router, authentication)

    ############################################
    # Add the user feedback routes
    ############################################
    add_user_feedback_routes(conversation_router, authentication)

    ##############################################
    # Add the experience routes
    ##############################################
    add_experience_routes(conversation_router, authentication)

    app.include_router(conversation_router)
