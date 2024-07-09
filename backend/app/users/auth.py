import base64
import logging
import json
import os
import jwt

from pydantic import BaseModel
from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)


class UserInfo(BaseModel):
    """
    This class is used to represent the user info.
    """
    user_id: str
    """
    The user id. This is the unique identifier for the user. We get it from idp (identity provider) like firebase.
    """

    name: str
    """
    name of the user.
    """

    email: str

    token: str

    class Config:
        extra = "forbid"


# Document this class

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
        ############################################
        # Security Definitions
        ############################################
        # Used for adding the security definitions for OpenAPI docs
        # For now we are using HTTPBearer. This is a bearer token that is sent in the Authorization header.
        # It now uses the firebase scheme.
        self.provider = HTTPBearer(scheme_name="firebase")

    def get_user_info(self):
        """
        This function is a dependency that will be used to authenticate the user.
        Returns: UserInfo object.
        """

        def construct_user_info(request: Request, provider: HTTPAuthorizationCredentials = Depends(self.provider)):
            """
            This function is a dependency that will be used to authenticate the user.
            :param provider: provider auth provider.
            :param request: Request object.
            :return: UserInfo object.
            """

            target_env = os.getenv("TARGET_ENVIRONMENT")

            try:
                credentials: str = provider.credentials
                user_info: UserInfo

                # when deployed api gateway sends the user info in base64 encoded format on this header
                # when running locally, this header will not be present.
                # and we will use the credentials from Authorization header.
                auth_info_b64 = request.headers.get('x-apigateway-api-userinfo')

                if target_env != "local":
                    # when deployed api gateway sends the user info in base64 encoded format on this header
                    # if the header is not present, then the user is not authenticated
                    # this is done for debugging and security purposes
                    if not auth_info_b64:
                        raise HTTPException(status_code=403, detail="forbidden")

                    """The user info is encoded in base64 and then appended with '==' to make it a valid base64 
                    string. This is done because the user info is sent as a json object and the base64 encoding of 
                    the json object"""
                    stringed_user_indo = base64.b64decode(auth_info_b64.encode() + b'==').decode()
                    token_info = json.loads(stringed_user_indo)
                else:
                    # when running locally, this header will not be present.
                    # and we will use the credentials from Authorization header.
                    if not credentials:
                        raise HTTPException(status_code=403, detail="forbidden")

                    """
                    Locally, the user info is sent in the Authorization header as a JWT token.
                    """
                    token_info = jwt.decode(credentials, options={"verify_signature": False})
                # decoded credentials.

                user_info = UserInfo(
                    user_id=token_info["sub"],
                    name=token_info["name"],
                    email=token_info["email"],
                    token=credentials
                )

                logger.info(f"authenticated user : {user_info.user_id}")

                return user_info

            except Exception as e:
                logger.exception(e)
                raise HTTPException(status_code=403, detail="forbidden")

        return construct_user_info
