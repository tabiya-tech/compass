"""
This module contains the routes for the conversation module.
"""
import logging
from http import HTTPStatus
from typing import List, Annotated

from fastapi import FastAPI, APIRouter, Request, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.application_state import ApplicationStateManager
from app.constants.errors import HTTPErrorResponse
from app.context_vars import session_id_ctx_var, user_id_ctx_var
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversations.constants import MAX_MESSAGE_LENGTH, UNEXPECTED_FAILURE_MESSAGE
from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.routes import add_reaction_routes, get_user_preferences_repository
from app.conversations.service import ConversationAlreadyConcludedError, IConversationService, ConversationService
from app.conversations.types import ConversationResponse, ConversationInput
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.server_dependencies.agent_director_dependencies import get_agent_director
from app.server_dependencies.application_state_dependencies import get_application_state_manager
from app.server_dependencies.conversation_manager_dependencies import get_conversation_memory_manager
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.types import Experience
from app.users.auth import Authentication, UserInfo
from app.users.repositories import UserPreferenceRepository


async def get_conversation_service(agent_director: LLMAgentDirector = Depends(get_agent_director),
                                   application_state_manager: ApplicationStateManager = Depends(
                                       get_application_state_manager),
                                   conversation_memory_manager: ConversationMemoryManager = Depends(
                                       get_conversation_memory_manager),
                                   db: AsyncIOMotorDatabase = Depends(
                                       CompassDBProvider.get_application_db)) -> IConversationService:
    return ConversationService(agent_director=agent_director, application_state_manager=application_state_manager,
                               conversation_memory_manager=conversation_memory_manager,
                               reaction_repository=ReactionRepository(db))


async def _get_user_preferences_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserPreferenceRepository(db)


def add_conversation_routes(app: FastAPI, authentication: Authentication):
    """
    Adds all the conversation routes to the FastAPI app

    :param app: FastAPI: The FastAPI app to add the routes to.
    :param authentication: Authentication Module Dependency: The authentication instance to use for the routes.
    """
    logger = logging.getLogger(__name__)

    conversation_router = APIRouter(prefix="/conversations/{session_id}", tags=["conversations"])

    @conversation_router.post(path="/messages", status_code=HTTPStatus.CREATED, response_model=ConversationResponse,
                              responses={HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
                                         # user is not allowed to send a message on a session where the conversation is already concluded
                                         HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                         # user is not allowed to send a message on another user's session
                                         HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": HTTPErrorResponse},
                                         # user is not allowed to send a message longer than 1000 characters
                                         HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
                              # Internal server error, any server error
                              description="""The main conversation route used to interact with the agent.""")
    async def _send_message(request: Request, body: ConversationInput, session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                            clear_memory: bool = False, filter_pii: bool = False,
                            user_info: UserInfo = Depends(authentication.get_user_info()),
                            user_preferences_repository=Depends(get_user_preferences_repository),
                            service: IConversationService = Depends(get_conversation_service)):
        """
        Endpoint for conducting the conversation with the agent.
        """
        user_input = body.user_input
        user_id = user_info.user_id

        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info)

        # Do not allow user input that is too long,
        # as a basic measure to prevent abuse.
        if len(user_input) > MAX_MESSAGE_LENGTH:
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail="Too long user input")
        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)
            return await service.send(user_id, session_id, user_input, clear_memory, filter_pii)
        except ConversationAlreadyConcludedError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=warning_msg)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:  # pylint: disable=broad-except
            logger.exception("Error for request: %s %s?%s with session id: %s : %s", request.method, request.url.path,
                             request.query_params, session_id, e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=UNEXPECTED_FAILURE_MESSAGE)

    @conversation_router.get(path="/messages", response_model=ConversationResponse,
                             responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                        # user is not allowed to get the messages of another user's session
                                        HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}
                                        # Internal server error, any server error
                                        }, description="""Endpoint for retrieving the conversation history.""")
    async def _get_conversation_history(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                                        user_info: UserInfo = Depends(authentication.get_user_info()),
                                        user_preferences_repository=Depends(get_user_preferences_repository),
                                        service: ConversationService = Depends(get_conversation_service)):
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
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            return await service.get_history_by_session_id(user_id, session_id)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! something went wrong")

    @conversation_router.get(path="/experiences", response_model=List[Experience],
                             responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                        # user is not allowed to get the experiences of another user's session
                                        HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}
                                        # Internal server error, any server error
                                        }, description="""Endpoint for retrieving the experiences of a user.""")
    async def _get_experiences(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                               user_info: UserInfo = Depends(authentication.get_user_info()),
                               user_preferences_repository=Depends(get_user_preferences_repository),
                               service: ConversationService = Depends(get_conversation_service)) -> List[Experience]:
        """
        Endpoint for retrieving the experiences of a user.
        """
        user_id = user_info.user_id

        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            return await service.get_experiences_by_session_id(user_id, session_id)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! something went wrong")

    ############################################
    # Add the reaction routes
    ############################################
    add_reaction_routes(conversation_router, authentication)

    app.include_router(conversation_router)
