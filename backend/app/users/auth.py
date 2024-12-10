import base64
import logging
import json
import os
from enum import Enum
from typing import Optional, Callable, Any

import jwt

from pydantic import BaseModel
from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)


class SignInProvider(Enum):
    ANONYMOUS = "anonymous"
    PASSWORD = "password"  # nosec
    GOOGLE = "google.com"


class UserInfo(BaseModel):
    """
    This class is used to represent the user info.
    """
    user_id: str
    """
    The user id. This is the unique identifier for the user. We get it from idp (identity provider) like firebase.
    """

    name: Optional[str] = None
    """
    name of the user.
    It is optional because the user may not have a name. ie: Anonymous user.
    """

    email: Optional[str] = None

    token: str

    sign_in_provider: SignInProvider
    """
    Sign in Provider
    """

    class Config:
        extra = "forbid"


def _get_user_info(decoded_token: Any, token: str) -> UserInfo:
    """
    This function is used to get the user info from the decoded token.
    :param decoded_token: The decoded token.
    :param token: The token.
    :return: UserInfo object.
    """
    return UserInfo(
        user_id=decoded_token["sub"],
        name=decoded_token["name"] if "name" in decoded_token else None,  # Anon user will not have a name
        email=decoded_token["email"] if "email" in decoded_token else None,  # Anon user will not have an email
        token=token,
        sign_in_provider=decoded_token["firebase"]["sign_in_provider"]
    )


def _decode_user_info_api_gateway(auth_info_b64):
    """
    Decodes a base64-encoded string containing user information and returns it as a dictionary.
    The api-gateway does not allways send the correct padding, so this function
    handles partial padding (missing one or two `=` characters). Rejects invalid input.

    Args:
        auth_info_b64 (str): The base64-encoded string containing JSON user data.

    Returns:
        dict: Decoded user information as a Python dictionary.

    Raises:
        ValueError: If the input is not valid base64 or if the JSON is invalid.
    """
    try:
        # Check if padding is needed and apply it
        padding_needed = len(auth_info_b64) % 4
        if padding_needed == 1:
            raise ValueError("Invalid base64 input: length is not compatible with base64 encoding")
        elif padding_needed == 2:
            padded_base64 = auth_info_b64 + '=='  # Add two `=` characters
        elif padding_needed == 3:
            padded_base64 = auth_info_b64 + '='  # Add one `=` character
        else:
            padded_base64 = auth_info_b64  # No padding needed

        # Decode the base64 string
        decoded_bytes = base64.b64decode(padded_base64.encode('utf-8'))

        # Convert bytes to string
        decoded_string = decoded_bytes.decode('utf-8')

        # Parse JSON from the decoded string
        user_info = json.loads(decoded_string)

        return user_info

    except Exception as e:
        raise ValueError("Invalid base64 or JSON input") from e


class Authentication:
    ############################################
    # Authentication
    ############################################
    """
    This class is responsible for managing the authentication of the users. It serves two main purposes:
    - Add the  security definitions for OpenAPI docs. We achieve on our api by using the HTTPBearer.
        To use you will need to add the function get_user_info in dependencies. If you don't want to get user info
        and just add only on the API docs you can use this class's object provider in the dependencies
        eg  `credentials = Depends(auth.provider)`
    - Get authenticated user. This is done by using the get_user_info
        function as a dependency in the route. the return value of this function is the user info.
    """
    provider: HTTPBearer
    """
    provider is an instance of HTTPBearer. It is used to add the security definitions for OpenAPI docs.
    """

    def __init__(self):
        # Currently one provider is supported, and it is the firebase scheme.
        self.provider = HTTPBearer(scheme_name="firebase")

    def get_user_info(self) -> Callable[[Request, HTTPAuthorizationCredentials], UserInfo]:
        """
        This function is a dependency that will be used to authenticate the user.
        Returns: UserInfo object.
        """

        def construct_user_info(request: Request, provider: HTTPAuthorizationCredentials = Depends(self.provider)) -> UserInfo:
            """
            This function is a dependency that will be used to authenticate the user.
            :param provider: provider auth provider.
            :param request: Request object.
            :return: UserInfo object.
            """
            target_env = os.getenv("TARGET_ENVIRONMENT")
            try:
                credentials: str = provider.credentials
                token_info: Any
                if target_env != "local":
                    # When deployed, the credentials are verified by the API Gateway, which sends
                    # the decoded user information in a Base64-encoded format through the `x-apigateway-api-userinfo` header.
                    # If the header is missing, the user should be treated as unauthenticated, and a 403 error must be raised.
                    # While this scenario should not occur under normal circumstances, since the
                    # API Gateway is expected to always include the header, we implement this check
                    # as a precautionary measure. For example, such an issue could arise if the API
                    # Gateway is improperly configured or if the incoming request does not originate
                    # from the API Gateway.
                    auth_info_b64 = request.headers.get('x-apigateway-api-userinfo')
                    if not auth_info_b64:
                        raise HTTPException(status_code=401, detail="forbidden")

                    # The user info is encoded as base 64 string by the api-gateway
                    token_info = _decode_user_info_api_gateway(auth_info_b64)
                else:
                    # When running locally, use the jwt token from Authorization header.
                    if not credentials:
                        raise HTTPException(status_code=401, detail="Unauthorized, missing credentials")
                    # Decode the token without verifying the signature as we are running locally.
                    token_info = jwt.decode(credentials, options={"verify_signature": False})
                # decoded credentials.
                return _get_user_info(token_info, credentials)

            except HTTPException as e:
                raise e
            except Exception as e:
                # Log as warning as it is not clear if this is due to an unauthenticated request or some other "internal" reason.
                # Do not include any stack trace to avoid performance issues.
                logger.warning("Error while getting user info: %s - %s", e.__class__.__name__, e)
                raise HTTPException(status_code=401, detail="Unauthorized")

        return construct_user_info
