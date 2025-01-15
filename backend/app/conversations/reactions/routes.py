"""
This module contains functions to add reaction routes to the conversations router.
"""
import asyncio
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.service import ReactionService, IReactionService
from app.conversations.reactions.types import ReactionRequest

# Lock to ensure that the singleton instance is thread-safe
_reaction_service_lock = asyncio.Lock()
_reaction_service_singleton: IReactionService | None = None

async def get_reaction_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> IReactionService:
    global _reaction_service_singleton
    if _reaction_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created
        async with _reaction_service_lock:  # before modifying the singleton instance, acquire the lock
            if _reaction_service_singleton is None:  # double check after acquiring the lock
                _reaction_service_singleton = ReactionService(ReactionRepository(db))
    return _reaction_service_singleton


def add_reaction_routes(conversation_router: APIRouter):
    """
    Adds the reaction routes to the conversation router.

    :param conversation_router: the conversation router
    """
    logger = logging.getLogger(__name__)

    reaction_router = APIRouter(
        prefix="/{session_id}/messages/{message_id}/reaction"
    )

    @reaction_router.put(
        path="",
        status_code=HTTPStatus.CREATED,
        response_model=None,
        description="saves user's reaction to a message",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},  # user is not allowed to react to messages in another user's session
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _add_reaction(
            reaction: ReactionRequest,
            session_id: int = Path(description="the unique identifier of the session"),
            message_id: str = Path(description="the unique identifier of the message"),
            service: IReactionService = Depends(get_reaction_service)
    ):
        try:
            await service.add(session_id, message_id, reaction)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @reaction_router.delete(
        path="",
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
            service: IReactionService = Depends(get_reaction_service)
    ):
        try:
            await service.delete(session_id, message_id)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    conversation_router.include_router(reaction_router)
