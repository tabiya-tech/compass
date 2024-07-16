from fastapi import APIRouter, FastAPI

from app.users.auth import Authentication
from app.users.preferences import add_user_preference_routes
from app.chat.poc_chat_routes import router as poc_router

"""
This module is responsible for managing all the routes related to the users.
It includes the following:
- User preferences routes
..and many more to come in the future.
"""


def add_users_routes(app: FastAPI, authentication: Authentication):
    """
    Add all routes related to users to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :param authentication: Authentication Module Dependency: The authentication instance to use for the routes.
    """

    users_router = APIRouter(prefix="/users")

    ############################################
    # Add the user preference routes
    ############################################
    add_user_preference_routes(users_router, authentication)

    # we can add more routes related to the users management here

    ############################################
    # Add the users router to the app
    ############################################
    app.include_router(users_router)


def add_poc_chat_routes(app: FastAPI):
    """
    Add the POC chat routes to the FastAPI app.
    These routes are used for testing the chat functionality and will be removed in the future.
    :param app: FastAPI: The FastAPI app to add the routes to.
    """

    ############################################
    # Add the poc router to the app
    ############################################
    app.include_router(poc_router, prefix="/poc", tags=["POC"])