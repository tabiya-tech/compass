"""
Consolidated progress endpoint: GET /users/me/progress?session_id=

Returns skills/interests chat progress, career readiness module statuses,
and career explorer sector engagement in a single call, replacing:
  - GET /conversations/{session_id}/messages  (only percentage is used)
  - GET /career-readiness/modules
  - GET /analytics/sector-engagement/me
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.analytics.sector_engagement.types import UserSectorEngagementItem, UserSectorEngagementMeta
from app.career_readiness.routes import get_career_readiness_service
from app.career_readiness.service import ICareerReadinessService
from app.career_readiness.types import ModuleSummary
from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var, session_id_ctx_var, client_id_ctx_var
from app.conversations.routes import get_conversation_service
from app.conversations.service import IConversationService
from app.conversations.reactions.routes import get_user_preferences_repository
from app.errors.errors import UnauthorizedSessionAccessError
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.users.auth import Authentication, UserInfo
from common_libs.time_utilities import mongo_date_to_datetime

logger = logging.getLogger(__name__)


class UserProgressResponse(BaseModel):
    skills_interests_progress: float = 0
    career_readiness_modules: list[ModuleSummary] = []
    sector_engagement: list[UserSectorEngagementItem] = []


def add_user_me_progress_routes(users_router: APIRouter, auth: Authentication) -> None:
    """
    Add GET /users/me/progress to the users router.

    This endpoint consolidates:
      - GET /conversations/{session_id}/messages  (percentage only)
      - GET /career-readiness/modules
      - GET /analytics/sector-engagement/me
    """

    router = APIRouter(prefix="/me", tags=["user-profile"])

    @router.get(
        path="/progress",
        response_model=UserProgressResponse,
        status_code=HTTPStatus.OK,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Returns the authenticated user's skills/interests chat progress percentage, "
            "career readiness module statuses, and career explorer sector engagement "
            "in a single call. Pass session_id to include chat progress; omit it "
            "to get modules and sector engagement only (progress defaults to 0)."
        ),
    )
    async def _get_user_progress(
        session_id: Optional[int] = Query(
            default=None,
            description="The active session ID used to compute skills/interests progress percentage.",
        ),
        user_info: UserInfo = Depends(auth.get_user_info()),
        career_readiness_service: ICareerReadinessService = Depends(get_career_readiness_service),
        metrics_service: IMetricsService = Depends(get_metrics_service),
        conversation_service: IConversationService = Depends(get_conversation_service),
        user_preferences_repository=Depends(get_user_preferences_repository),
    ) -> UserProgressResponse:
        user_id = user_info.user_id
        user_id_ctx_var.set(user_id)

        try:
            # Fetch modules and sector engagement concurrently; chat history is conditional
            async def _get_chat_progress() -> float:
                if session_id is None:
                    return 0.0
                # Validate session ownership (same check as GET /conversations/{session_id}/messages)
                session_id_ctx_var.set(session_id)
                current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
                if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                    raise UnauthorizedSessionAccessError(user_id, session_id)
                client_id_ctx_var.set(current_user_preferences.client_id)
                history = await conversation_service.get_history_by_session_id(user_id, session_id)
                return history.current_phase.percentage if history.current_phase else 0.0

            async def _get_sector_engagement() -> list[UserSectorEngagementItem]:
                results = await metrics_service.get_sector_engagement_for_user(user_id)
                return [
                    UserSectorEngagementItem(
                        sector_name=item["sector_name"],
                        is_priority=item["is_priority"],
                        inquiry_count=item["inquiry_count"],
                        last_asked_at=mongo_date_to_datetime(item.get("timestamp")),
                    )
                    for item in results
                ]

            modules_response, sector_data, progress = await asyncio.gather(
                career_readiness_service.list_modules(user_id),
                _get_sector_engagement(),
                _get_chat_progress(),
            )

            return UserProgressResponse(
                skills_interests_progress=progress,
                career_readiness_modules=modules_response.modules,
                sector_engagement=sector_data,
            )

        except UnauthorizedSessionAccessError as e:
            logger.warning("Unauthorized session access in /users/me/progress: %s", e)
            raise HTTPException(
                status_code=HTTPStatus.FORBIDDEN,
                detail="No permission for the given session",
            ) from e
        except Exception as exc:
            logger.exception("Error fetching user progress for user %s: %s", user_id, exc)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch user progress",
            ) from exc

    users_router.include_router(router)
