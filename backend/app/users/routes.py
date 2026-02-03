import logging

from fastapi import APIRouter, FastAPI

from app.app_config import get_application_config
from app.users.sensitive_personal_data.routes import add_user_sensitive_personal_data_routes
from app.users.cv.routes import add_user_cv_routes
from app.users.auth import Authentication
from app.users.preferences import add_user_preference_routes

"""
This module is responsible for managing all the routes related to the users.
It includes the following:
- User preferences routes
..and many more to come in the future.
"""

logger = logging.getLogger(__name__)


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

    ############################################
    # Add the sensitive personal data routes
    ############################################
    add_user_sensitive_personal_data_routes(users_router, authentication)

    # we can add more routes related to the users management here

    ############################################
    # Add the user CV upload routes (conditionally)
    ############################################
    app_config = get_application_config()
    if app_config.enable_cv_upload:
        add_user_cv_routes(users_router, authentication)
        logger.info("CV upload routes registered")
    else:
        logger.info("CV upload routes skipped")

    ############################################
    # Add the users router to the app
    ############################################
    app.include_router(users_router)
