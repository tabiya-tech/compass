import logging
from typing import Any

from app.users.auth import Authentication
from modules.skills_ranking.repository.collections import Collections
from modules.skills_ranking.routes.routes import get_skills_ranking_router
from modules.types import IFeature


class Feature(IFeature):
    config: dict[str, Any]

    def __init__(self):
        self._logger = logging.getLogger(__name__)

    async def init(self, config: dict[str, Any], application_db):
        self.config = config

        self._logger.info("initializing skills ranking feature")

        # Create the skills ranking state collection and create the index.
        await application_db.get_collection(Collections.SKILLS_RANKING_STATE).create_index([
            ("session_id", 1)
        ], unique=True)

    def get_api_router(self, auth: Authentication):
        # Add skills ranking routes (Endpoints)
        router = get_skills_ranking_router(auth)
        return router

    async def tear_down(self):
        self._logger.info("tearing down skills ranking feature")
