from fastapi import APIRouter, FastAPI

from app.users.preferences import add_user_preference_routes


def add_users_routes(app: FastAPI):
    users_router = APIRouter(prefix="/users")

    add_user_preference_routes(users_router)

    app.include_router(users_router)
