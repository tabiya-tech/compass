"""
This module contains the routes for the career readiness module.
"""

import asyncio
import logging
from http import HTTPStatus
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.career_readiness.errors import (
    CareerReadinessModuleNotFoundError,
    ConversationAccessDeniedError,
    ConversationAlreadyExistsError,
    ConversationModuleMismatchError,
    ConversationNotFoundError,
    QuizAlreadyPassedError,
    QuizNotAvailableError,
)
from app.career_readiness.module_loader import get_module_registry
from app.career_readiness.repository import CareerReadinessConversationRepository
from app.career_readiness.service import CareerReadinessService, ICareerReadinessService
from app.career_readiness.types import (
    CareerReadinessConversationInput,
    CareerReadinessConversationResponse,
    ModuleDetail,
    ModuleListResponse,
    QuizResponse,
    QuizSubmissionInput,
    QuizSubmissionResponse,
)
from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_profile_context_var
from app.conversations.constants import MAX_MESSAGE_LENGTH
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.plain_personal_data.routes import get_plain_personal_data_service
from app.users.plain_personal_data.service import (
    IPlainPersonalDataService,
    format_plain_personal_data_for_prompt,
)

logger = logging.getLogger(__name__)

# Lock to ensure that the singleton instance is thread-safe
_career_readiness_service_lock = asyncio.Lock()
_career_readiness_service_singleton: Optional[ICareerReadinessService] = None


async def get_career_readiness_service(
    application_db: AsyncIOMotorDatabase = Depends(
        CompassDBProvider.get_application_db
    ),
) -> ICareerReadinessService:
    """Get or create the career readiness service singleton."""
    global _career_readiness_service_singleton
    if _career_readiness_service_singleton is None:
        async with _career_readiness_service_lock:
            if _career_readiness_service_singleton is None:
                _career_readiness_service_singleton = CareerReadinessService(
                    repository=CareerReadinessConversationRepository(application_db),
                    module_registry=get_module_registry(),
                )
    return _career_readiness_service_singleton


def add_career_readiness_routes(app: FastAPI, authentication: Authentication):
    """
    Adds all the career readiness routes to the FastAPI app.

    :param app: FastAPI: The FastAPI app to add the routes to.
    :param authentication: Authentication Module Dependency: The authentication instance to use for the routes.
    """

    router = APIRouter(prefix="/career-readiness", tags=["career-readiness"])

    @router.get(
        path="/modules",
        response_model=ModuleListResponse,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="List all career readiness modules with the current user's progress status.",
    )
    async def _list_modules(
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            return await service.list_modules(user_info.user_id)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.get(
        path="/modules/{module_id}",
        response_model=ModuleDetail,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Get details of a specific career readiness module, including active conversation ID.",
    )
    async def _get_module(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            return await service.get_module(user_info.user_id, module_id)
        except CareerReadinessModuleNotFoundError as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Module not found: {module_id}",
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.post(
        path="/modules/{module_id}/conversations",
        status_code=HTTPStatus.CREATED,
        response_model=CareerReadinessConversationResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Start a new conversation for a career readiness module. Returns the introductory message.",
    )
    async def _create_conversation(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
        plain_personal_data_service: IPlainPersonalDataService = Depends(
            get_plain_personal_data_service
        ),
    ):
        try:
            # Set user profile context from plain personal data
            plain_personal_data = await plain_personal_data_service.get(
                user_info.user_id
            )
            if plain_personal_data:
                user_profile_context_var.set(
                    format_plain_personal_data_for_prompt(plain_personal_data)
                )

            return await service.create_conversation(user_info.user_id, module_id)
        except CareerReadinessModuleNotFoundError as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Module not found: {module_id}",
            ) from exc
        except ConversationAlreadyExistsError as exc:
            raise HTTPException(
                status_code=HTTPStatus.CONFLICT,
                detail=f"A conversation already exists for module {module_id}",
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.post(
        path="/modules/{module_id}/conversations/{conversation_id}/messages",
        status_code=HTTPStatus.CREATED,
        response_model=CareerReadinessConversationResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Send a message in an active career readiness conversation and receive the AI response.",
    )
    async def _send_message(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        conversation_id: Annotated[
            str,
            Path(description="The conversation identifier.", examples=["conv_abc123"]),
        ],
        body: CareerReadinessConversationInput,
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
        plain_personal_data_service: IPlainPersonalDataService = Depends(
            get_plain_personal_data_service
        ),
    ):
        if len(body.user_input) > MAX_MESSAGE_LENGTH:
            logger.warning(
                "User input exceeded maximum length of %d characters",
                MAX_MESSAGE_LENGTH,
            )
            raise HTTPException(
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                detail="Too long user input",
            )

        try:
            # Set user profile context from plain personal data
            plain_personal_data = await plain_personal_data_service.get(
                user_info.user_id
            )
            if plain_personal_data:
                user_profile_context_var.set(
                    format_plain_personal_data_for_prompt(plain_personal_data)
                )

            return await service.send_message(
                user_info.user_id, module_id, conversation_id, body.user_input
            )
        except (
            CareerReadinessModuleNotFoundError,
            ConversationNotFoundError,
            ConversationModuleMismatchError,
        ) as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND, detail="Conversation not found"
            ) from exc
        except ConversationAccessDeniedError as exc:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail="Access denied"
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.get(
        path="/modules/{module_id}/conversations/{conversation_id}/messages",
        response_model=CareerReadinessConversationResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Retrieve the full message history for a career readiness conversation.",
    )
    async def _get_conversation_history(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        conversation_id: Annotated[
            str,
            Path(description="The conversation identifier.", examples=["conv_abc123"]),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            return await service.get_conversation_history(
                user_info.user_id, module_id, conversation_id
            )
        except (
            CareerReadinessModuleNotFoundError,
            ConversationNotFoundError,
            ConversationModuleMismatchError,
        ) as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND, detail="Conversation not found"
            ) from exc
        except ConversationAccessDeniedError as exc:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail="Access denied"
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.delete(
        path="/modules/{module_id}/conversations/{conversation_id}",
        status_code=HTTPStatus.NO_CONTENT,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Delete a career readiness conversation. The module returns to the unlocked (ready to start) state.",
    )
    async def _delete_conversation(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        conversation_id: Annotated[
            str,
            Path(description="The conversation identifier.", examples=["conv_abc123"]),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            await service.delete_conversation(
                user_info.user_id, module_id, conversation_id
            )
        except (
            CareerReadinessModuleNotFoundError,
            ConversationNotFoundError,
            ConversationModuleMismatchError,
        ) as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND, detail="Conversation not found"
            ) from exc
        except ConversationAccessDeniedError as exc:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail="Access denied"
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.get(
        path="/modules/{module_id}/conversations/{conversation_id}/quiz",
        response_model=QuizResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Get quiz questions for the active quiz.",
    )
    async def _get_quiz(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        conversation_id: Annotated[
            str,
            Path(description="The conversation identifier.", examples=["conv_abc123"]),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            return await service.get_quiz(user_info.user_id, module_id, conversation_id)
        except (
            CareerReadinessModuleNotFoundError,
            ConversationNotFoundError,
            ConversationModuleMismatchError,
        ) as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND, detail="Conversation not found"
            ) from exc
        except ConversationAccessDeniedError as exc:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail="Access denied"
            ) from exc
        except (QuizNotAvailableError, QuizAlreadyPassedError) as exc:
            raise HTTPException(
                status_code=HTTPStatus.CONFLICT, detail="Quiz is not available"
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    @router.post(
        path="/modules/{module_id}/conversations/{conversation_id}/quiz",
        status_code=HTTPStatus.OK,
        response_model=QuizSubmissionResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Submit quiz answers for evaluation.",
    )
    async def _submit_quiz(
        module_id: Annotated[
            str,
            Path(
                description="The module identifier slug.",
                examples=["cv-resume-creation"],
            ),
        ],
        conversation_id: Annotated[
            str,
            Path(description="The conversation identifier.", examples=["conv_abc123"]),
        ],
        body: Annotated[
            QuizSubmissionInput,
            Body(
                openapi_examples={
                    "three_questions": {
                        "summary": "Answers for a 3-question quiz",
                        "value": {"answers": {"1": "B", "2": "A", "3": "C"}},
                    },
                },
            ),
        ],
        user_info: UserInfo = Depends(authentication.get_user_info()),
        service: ICareerReadinessService = Depends(get_career_readiness_service),
    ):
        try:
            return await service.submit_quiz(
                user_info.user_id, module_id, conversation_id, body.answers
            )
        except (
            CareerReadinessModuleNotFoundError,
            ConversationNotFoundError,
            ConversationModuleMismatchError,
        ) as exc:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND, detail="Conversation not found"
            ) from exc
        except ConversationAccessDeniedError as exc:
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN, detail="Access denied"
            ) from exc
        except (QuizNotAvailableError, QuizAlreadyPassedError) as exc:
            raise HTTPException(
                status_code=HTTPStatus.CONFLICT, detail="Quiz is not available"
            ) from exc
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e

    app.include_router(router)
