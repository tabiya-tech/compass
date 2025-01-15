"""
This module contains functions to add reaction routes to the conversations router.
"""
import logging
from http import HTTPStatus
from typing import Annotated
from pydantic import BaseModel
from datetime import datetime, timezone

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
from app.conversations.reactions.types import Reaction, ReactionKind, DislikeReason
from app.users.auth import UserInfo, Authentication
from app.users.repositories import IUserPreferenceRepository, UserPreferenceRepository

logger = logging.getLogger(__name__)

# This service cannot be a singleton since it has state that should not be shared
# across requests (application_state_manager state and conversation_memory_manager_state)
async def get_reaction_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
                             conversation_memory_manager: ConversationMemoryManager = Depends(
                                 get_conversation_memory_manager),
                             application_state_manager: ApplicationStateManager = Depends(
                                 get_application_state_manager)) -> IReactionService:
    return ReactionService(
        reaction_repository=ReactionRepository(db),
        conversation_memory_manager=conversation_memory_manager,
        application_state_manager=application_state_manager)


async def get_user_preferences_repository(
        db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> IUserPreferenceRepository:
    return UserPreferenceRepository(db)


class _ReactionRequest(BaseModel):
    """
    Request model for creating or updating a reaction.

    :param kind: Type of reaction (LIKED or DISLIKED)
    :param reasons: List of reasons if the reaction is DISLIKED
    """
    kind: ReactionKind
    reasons: list[DislikeReason]

    def to_reaction(self, *, message_id: str, session_id: int) -> Reaction:
        """
        Converts request model to a Reaction object.
        
        :param message_id: ID of the message being reacted to
        :param session_id: ID of the session containing the message
        :return: Reaction object
        """
        return Reaction(
            message_id=message_id,
            session_id=session_id,
            kind=ReactionKind(self.kind),
            reasons=[DislikeReason(r) for r in self.reasons],
            created_at=datetime.now(timezone.utc)
        )

    class Config:
        extra = "forbid"


class _ReactionResponse(BaseModel):
    """
    Response model for reactions.

    :param id: Unique identifier of the reaction
    :param message_id: ID of the message that was reacted to
    :param session_id: ID of the session containing the message
    :param kind: Type of reaction (LIKED or DISLIKED)
    :param reasons: List of reasons if the reaction is DISLIKED
    :param created_at: When the reaction was created
    """
    id: str
    message_id: str
    session_id: int
    kind: ReactionKind
    reasons: list[DislikeReason]
    created_at: datetime

    @classmethod
    def from_reaction(cls, reaction: Reaction) -> '_ReactionResponse':
        """
        Converts a Reaction object to a response model.

        :param reaction: Reaction object to convert
        :return: response model instance
        :raises ValueError: If the reaction has no ID
        """
        if not reaction.id:
            raise ValueError("Cannot convert Reaction without an id to ReactionResponse")
        return cls(
            id=reaction.id,
            message_id=reaction.message_id,
            session_id=reaction.session_id,
            kind=reaction.kind,
            reasons=reaction.reasons,
            created_at=reaction.created_at
        )

    class Config:
        extra = "forbid"


def add_reaction_routes(conversation_router: APIRouter, auth: Authentication):
    """
    Adds reaction routes to the conversations router.

    :param conversation_router: Router to add the reaction routes to
    :param auth: Authentication service to use for the routes
    """
    reaction_router = APIRouter(
        tags=["reactions"],
    )

    @reaction_router.put(
        path="/messages/{message_id}/reactions",
        status_code=HTTPStatus.CREATED,
        response_model=_ReactionResponse,
        description="saves user's reaction to a message",
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            # user is not allowed to react to messages sent by the user, only messages from compass
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            # user is not allowed to react to messages in another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _add_reaction(
            reaction_request: _ReactionRequest,
            session_id: Annotated[int, Path(description="the unique identifier of the session", examples=[123])],
            message_id: Annotated[str, Path(description="the unique identifier of the message", examples=["message123"])],
            reaction_service: IReactionService = Depends(get_reaction_service),
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            user_info: UserInfo = Depends(auth.get_user_info())
    ) -> _ReactionResponse:
        """
        Creates or updates a reaction to a message.

        :param reaction_request: The reaction details
        :param session_id: ID of the session containing the message
        :param message_id: ID of the message to react to
        :param reaction_service: Service for managing reactions
        :param user_preferences_repository: Repository for user preferences
        :param user_info: Information about the authenticated user
        :return: The created or updated reaction
        :raises HTTPException: If the request is invalid or unauthorized
        """
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            reaction = reaction_request.to_reaction(message_id=message_id, session_id=session_id)
            added_reaction = await reaction_service.add(reaction)
            return _ReactionResponse.from_reaction(added_reaction)
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
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            # user is not allowed to delete reactions in another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _delete_reaction(
            session_id: Annotated[int, Path(description="the unique identifier of the session")],
            message_id: Annotated[str, Path(description="the unique identifier of the message")],
            service: IReactionService = Depends(get_reaction_service),
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            user_info: UserInfo = Depends(auth.get_user_info())
    ):
        """
        Deletes a reaction from a message.

        :param session_id: ID of the session containing the message
        :param message_id: ID of the message to remove the reaction from
        :param service: Service for managing reactions
        :param user_preferences_repository: Repository for user preferences
        :param user_info: Information about the authenticated user
        :raises HTTPException: If the request is unauthorized
        """
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
