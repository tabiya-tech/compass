from fastapi import APIRouter

from app.admin.users.routes import get_admin_users_routes
from app.users.auth import Authentication


def get_admin_routes(auth: Authentication):
    """
    Create and return the admin router with all admin sub-routes.

    :param auth: Authentication instance threaded into role-gated sub-routes.
    :return: APIRouter with all admin endpoints.
    """
    router = APIRouter()
    users = get_admin_users_routes(auth)
    router.include_router(users, prefix="/users", tags=["Admin Users"])
    return router
