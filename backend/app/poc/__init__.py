from fastapi import FastAPI, APIRouter

from app.poc.poc_routes import add_poc_route_endpoints
from app.users.auth import Authentication


def add_poc_routes(app: FastAPI, authentication: Authentication):

    poc_router = APIRouter(prefix="/poc")

    ############################################
    # Add the poc routes
    ############################################
    add_poc_route_endpoints(poc_router, authentication)

    ############################################
    # Add the poc router to the app
    ############################################
    app.include_router(poc_router)