"""
This module contains functions to add sensitive personal data routes to the users router.
"""

from fastapi import APIRouter, Depends, HTTPException, Path

from app.constants.errors import HTTPErrorResponse
from app.users.auth import Authentication, UserInfo
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.service import SensitivePersonalDataService


def add_user_sensitive_personal_data_routes(users_router: APIRouter, auth: Authentication):
    """
    Adds the sensitive personal data routes to the users router.

    :param users_router: the users router
    :param auth: Authentication
    """

    router = APIRouter(
        prefix="/{user_id}/sensitive-personal-data",
        tags=["user-sensitive-personal-data"]
    )

    @router.post(
        path="",
        status_code=201,
        response_model=None,
        description="saves user's sensitive personal data",
        responses={
            403: {"model": HTTPErrorResponse},  # user is not allowed to create sensitive personal data for another user
            409: {"model": HTTPErrorResponse},  # User already exists, has already created sensitive personal data
            500: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _create_sensitive_personal_data(
            sensitive_personal_data: CreateSensitivePersonalDataRequest,
            user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
            service: SensitivePersonalDataService = Depends(SensitivePersonalDataService),
            user_info: UserInfo = Depends(auth.get_user_info())
    ):
        # ensure that the user is creating sensitive personal data for themselves
        # before proceeding with the service handler
        if user_info.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        await service.create(user_id, sensitive_personal_data)

    users_router.include_router(router)
