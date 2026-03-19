from fastapi import APIRouter

from app.admin.users.routes import get_admin_users_routes


def get_admin_routes():
    """
    Create and return the admin router with all admin sub-routes.

    :return: APIRouter with all admin endpoints.
    """
    router = APIRouter()
    users = get_admin_users_routes()
    router.include_router(users, prefix="/users", tags=["Admin Users"])
    return router
