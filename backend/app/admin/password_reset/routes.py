"""Public forgot-password endpoint.

Generates a Firebase password-reset link for the given email and logs it for
the dev team to forward. Always returns 204 — no enumeration of which emails
correspond to real accounts.
"""
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, FastAPI, Response
from firebase_admin.auth import UserNotFoundError
from pydantic import BaseModel, EmailStr

from app.admin.firebase import FirebaseService, get_firebase_service
from app.admin.registrations.rate_limit import password_reset_rate_limiter
from app.app_config import get_application_config

logger = logging.getLogger(__name__)


class PasswordResetRequest(BaseModel):
    email: EmailStr

    model_config = {"extra": "forbid"}


def add_password_reset_routes(app: FastAPI) -> None:
    """Register the public POST /password-reset endpoint."""
    router = APIRouter(tags=["password-reset"])

    @router.post(
        "/password-reset",
        status_code=HTTPStatus.NO_CONTENT,
        name="request password reset",
        dependencies=[Depends(password_reset_rate_limiter)],
    )
    async def _request_reset(
        request: PasswordResetRequest,
        firebase_service: FirebaseService = Depends(get_firebase_service),
    ) -> Response:
        tenant_id = get_application_config().admin_firebase_tenant_id
        try:
            link = firebase_service.generate_password_reset_link(
                tenant_id=tenant_id, email=request.email
            )
            logger.info("Password reset link for %s: %s", request.email, link)
        except UserNotFoundError:
            # Silently ignore — never leak whether an account exists.
            logger.info("Password reset requested for unknown email: %s", request.email)
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to generate password reset link for %s: %s", request.email, e)
        return Response(status_code=HTTPStatus.NO_CONTENT)

    app.include_router(router)
