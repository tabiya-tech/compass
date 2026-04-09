import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.career_explorer_agent.agent import CareerExplorerAgent
from app.agent.career_explorer_agent.sector_search_service import SectorSearchService
from app.app_config import get_application_config
from app.career_explorer.repository import CareerExplorerConversationRepository
from app.career_explorer.service import CareerExplorerService
from app.career_explorer.types import (
    CareerExplorerConversationInput,
    CareerExplorerConversationResponse,
)
from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_profile_context_var
from app.conversations.constants import MAX_MESSAGE_LENGTH
from app.i18n.translation_service import get_i18n_manager
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_profile.repository import UserProfileRepository
from app.user_profile.service import UserProfileService
from app.users.auth import Authentication, UserInfo
from app.users.plain_personal_data.routes import get_plain_personal_data_service
from app.users.plain_personal_data.service import (
    IPlainPersonalDataService,
    format_plain_personal_data_for_prompt,
)
from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.vector_search_dependencies import get_embeddings_service

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_service_singleton: Optional[CareerExplorerService] = None


async def get_career_explorer_service(
    career_explorer_db: AsyncIOMotorDatabase = Depends(
        CompassDBProvider.get_career_explorer_db
    ),
    embedding_service: EmbeddingService = Depends(get_embeddings_service),
    metrics_service: IMetricsService = Depends(get_metrics_service),
    application_db: AsyncIOMotorDatabase = Depends(
        CompassDBProvider.get_application_db
    ),
    userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
) -> CareerExplorerService:
    global _service_singleton
    if _service_singleton is None:
        async with _lock:
            if _service_singleton is None:
                collection = career_explorer_db.get_collection(
                    Collections.CAREER_EXPLORER_SECTOR_CHUNKS
                )
                sector_search = SectorSearchService(
                    collection=collection,
                    embedding_service=embedding_service,
                    embedding_key="embedding",
                    index_name="sector_chunks_embedding_index",
                )
                agent_factory = lambda: CareerExplorerAgent(
                    sector_search_service=sector_search
                )
                user_profile_repository = UserProfileRepository(
                    application_db, userdata_db
                )
                user_profile_service = UserProfileService(user_profile_repository)
                _service_singleton = CareerExplorerService(
                    repository=CareerExplorerConversationRepository(career_explorer_db),
                    agent_factory=agent_factory,
                    metrics_service=metrics_service,
                    user_profile_service=user_profile_service,
                )
    return _service_singleton


def add_career_explorer_routes(app: FastAPI, authentication: Authentication):
    router = APIRouter(prefix="/career-explorer", tags=["career-explorer"])

    @router.post(
        "/conversation",
        status_code=HTTPStatus.CREATED,
        response_model=CareerExplorerConversationResponse,
        responses={HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
    )
    async def _get_or_create_conversation(
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: CareerExplorerService = Depends(get_career_explorer_service),
    ):
        try:
            app_config = get_application_config()
            get_i18n_manager().set_locale(app_config.language_config.default_locale)
            return await service.get_or_create_conversation(user_info.user_id)
        except Exception as e:
            logger.exception("Error in career explorer: %s", e)
            raise HTTPException(
                HTTPStatus.INTERNAL_SERVER_ERROR, "Unexpected error"
            ) from e

    @router.post(
        "/conversation/messages",
        status_code=HTTPStatus.CREATED,
        response_model=CareerExplorerConversationResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
    )
    async def _send_message(
        body: CareerExplorerConversationInput,
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: CareerExplorerService = Depends(get_career_explorer_service),
        plain_personal_data_service: IPlainPersonalDataService = Depends(
            get_plain_personal_data_service
        ),
    ):
        if len(body.user_input) > MAX_MESSAGE_LENGTH:
            raise HTTPException(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Message too long")
        try:
            app_config = get_application_config()
            get_i18n_manager().set_locale(app_config.language_config.default_locale)

            # Set user profile context from plain personal data
            plain_personal_data = await plain_personal_data_service.get(
                user_info.user_id
            )
            if plain_personal_data:
                user_profile_context_var.set(
                    format_plain_personal_data_for_prompt(plain_personal_data)
                )

            return await service.send_message(user_info.user_id, body.user_input)
        except ValueError as e:
            raise HTTPException(HTTPStatus.NOT_FOUND, str(e)) from e
        except Exception as e:
            logger.exception("Error in career explorer: %s", e)
            raise HTTPException(
                HTTPStatus.INTERNAL_SERVER_ERROR, "Unexpected error"
            ) from e

    @router.get(
        "/conversation",
        response_model=CareerExplorerConversationResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
    )
    async def _get_conversation(
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: CareerExplorerService = Depends(get_career_explorer_service),
    ):
        try:
            app_config = get_application_config()
            get_i18n_manager().set_locale(app_config.language_config.default_locale)
            return await service.get_conversation(user_info.user_id)
        except ValueError as e:
            raise HTTPException(HTTPStatus.NOT_FOUND, str(e)) from e
        except Exception as e:
            logger.exception("Error in career explorer: %s", e)
            raise HTTPException(
                HTTPStatus.INTERNAL_SERVER_ERROR, "Unexpected error"
            ) from e

    app.include_router(router)
