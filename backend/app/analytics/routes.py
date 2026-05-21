import logging

from fastapi import APIRouter, FastAPI

from app.analytics.institutions.routes import add_institutions_routes
from app.analytics.users.routes import add_users_routes
from app.analytics.adoption_trends.routes import add_adoption_trends_routes
from app.analytics.stats.routes import add_stats_routes
from app.analytics.career_readiness.routes import add_career_readiness_analytics_routes
from app.analytics.job_demand.routes import add_job_demand_analytics_routes
from app.analytics.skills_discovery.routes import add_skills_discovery_analytics_routes
from app.analytics.skills_supply.routes import add_skills_supply_analytics_routes
from app.analytics.sector_engagement.routes import add_sector_engagement_routes
from app.analytics.career_explorer.routes import add_career_explorer_analytics_routes
from app.users.auth import Authentication

logger = logging.getLogger(__name__)


def add_analytics_routes(app: FastAPI, auth: Authentication):
    users_router = APIRouter(prefix="/students", tags=["analytics", "users"])
    add_users_routes(users_router, auth)
    app.include_router(users_router)

    analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])
    add_institutions_routes(analytics_router, auth)
    add_adoption_trends_routes(analytics_router, auth)
    add_stats_routes(analytics_router, auth)
    add_career_readiness_analytics_routes(analytics_router, auth)
    add_job_demand_analytics_routes(analytics_router, auth)
    add_skills_discovery_analytics_routes(analytics_router, auth)
    add_skills_supply_analytics_routes(analytics_router, auth)
    add_sector_engagement_routes(analytics_router, auth)
    add_career_explorer_analytics_routes(analytics_router, auth)
    app.include_router(analytics_router)
