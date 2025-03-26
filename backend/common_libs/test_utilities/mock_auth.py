# Mock the auth dependency
import random
from http import HTTPStatus
from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.users.auth import Authentication, UserInfo, SignInProvider
from common_libs.test_utilities.random_data import get_random_user_id, get_random_base64_string


class MockAuth(Authentication):
    """
    Mock the authentication dependency.
    If the user is not provided, a mocked user is created.
    """

    def __init__(self, user: UserInfo | None = None):
        super().__init__()
        if user is None:
            given_user_id = get_random_user_id()
            self.mocked_user = UserInfo(
                user_id=given_user_id,
                token=get_random_base64_string(10),
                decoded_token=dict(
                    sub=given_user_id,
                    iat=random.randint(1, 100),  # nosec B311 # random is used for testing purposes
                    exp=random.randint(1, 100)   # nosec B311 # random is used for testing purposes
                ),
                sign_in_provider=SignInProvider.ANONYMOUS
            )
        else:
            self.mocked_user = user

    def get_user_info(self) -> Callable[[Request, HTTPAuthorizationCredentials], UserInfo]:
        # Ensure the type of credential defaults to a Depends() with an empty lambda function,
        # as the credential is not used in the mocked function. Otherwise, a TypeError
        # will be raised when the route is called using the TestClient
        def construct_user_info(request: Request,
                                credential: HTTPAuthorizationCredentials = Depends(lambda: None)) -> UserInfo:
            return self.mocked_user

        return construct_user_info


# Create an unauthenticated mock auth that raises 401
class UnauthenticatedMockAuth(MockAuth):
    def get_user_info(self):
        def construct_user_info(request: Request,
                                credential: HTTPAuthorizationCredentials = Depends(lambda: None)) -> UserInfo:
            raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Not authenticated")

        return construct_user_info
