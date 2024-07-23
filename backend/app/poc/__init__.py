import os

from fastapi import FastAPI, APIRouter

from app.poc.poc_routes import add_poc_route_endpoints
from app.users.auth import Authentication


def add_poc_routes(app: FastAPI, authentication: Authentication):
    target_env = os.getenv("TARGET_ENVIRONMENT")
    include_in_schema = False

    # Only include poc routes in the schema if the target environment is local
    if target_env == "local":
        include_in_schema = True

    poc_router = APIRouter(prefix="/poc", include_in_schema=include_in_schema)

    ############################################
    # Add the poc routes
    ############################################
    add_poc_route_endpoints(poc_router, authentication)

    ############################################
    # Add the poc router to the app
    ############################################
    app.include_router(poc_router)
