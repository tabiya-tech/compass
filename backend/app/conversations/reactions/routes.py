"""
This module contains functions to add reaction routes to the conversations router.
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.context_vars import session_id_ctx_var, user_id_ctx_var
from app.application_state import ApplicationStateManager
from app.constants.errors import HTTPErrorResponse
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.server_dependencies.application_state_dependencies import get_application_state_manager
from app.server_dependencies.conversation_manager_dependencies import get_conversation_memory_manager
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.service import ReactionService, IReactionService, ReactingToUserMessageError
from app.conversations.reactions.types import ReactionRequest, Reaction
from app.users.auth import UserInfo, Authentication
from app.users.repositories import IUserPreferenceRepository, UserPreferenceRepository

logger = logging.getLogger(__name__)


async def get_reaction_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db), conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager), application_state_manager: ApplicationStateManager = Depends(get_application_state_manager)) -> IReactionService:
    return ReactionService(
        reaction_repository=ReactionRepository(db),
        conversation_memory_manager=conversation_memory_manager,
        application_state_manager=application_state_manager)


async def get_user_preferences_repository(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> IUserPreferenceRepository:
    return UserPreferenceRepository(db)


def add_reaction_routes(conversation_router: APIRouter, auth: Authentication):
    """
    Adds reaction routes to the conversations router.

    :param conversation_router: the conversations router to add the reaction routes to
    :param auth: the authentication service to use for the routes
    """
    reaction_router = APIRouter(
        tags=["reactions"],
    )

    @reaction_router.put(
        path="/messages/{message_id}/reactions",
        status_code=HTTPStatus.CREATED,
        response_model=Reaction,
        description="saves user's reaction to a message",
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},  # user is not allowed to react to messages sent by the user, only messages from compass
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},  # user is not allowed to react to messages in another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _add_reaction(
            reaction: ReactionRequest,
            session_id: Annotated[int, Path(description="the unique identifier of the session", examples=[123])],
            message_id: Annotated[str, Path(description="the unique identifier of the message", examples=["message123"])],
            reaction_service: IReactionService = Depends(get_reaction_service),
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            user_info: UserInfo = Depends(auth.get_user_info())
    ) -> Reaction:
        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            return await reaction_service.add(session_id, message_id, reaction)
        except ReactingToUserMessageError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=warning_msg)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @reaction_router.delete(
        path="/messages/{message_id}/reactions",
        status_code=204,
        response_model=None,
        description="deletes user's reaction to a message",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},  # user is not allowed to delete reactions in another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _delete_reaction(
            session_id: int = Path(description="the unique identifier of the session"),
            message_id: str = Path(description="the unique identifier of the message"),
            service: IReactionService = Depends(get_reaction_service),
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            user_info: UserInfo = Depends(auth.get_user_info())
    ):
        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            await service.delete(session_id, message_id)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    # Include the reaction router directly with the conversation router
    # The conversation router already has the prefix /conversations/{session_id}
    conversation_router.include_router(reaction_router)
