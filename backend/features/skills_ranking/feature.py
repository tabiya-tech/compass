import logging
from typing import Any

from app.users.auth import Authentication
from features.skills_ranking.db_provider import configure_skills_ranking_db, get_skills_ranking_state_db, initialize_skills_ranking_db, clear_skills_ranking_db_cache, SkillsRankingDbSettings
from features.skills_ranking.routes.routes import get_skills_ranking_router
from features.types import IFeature


class Feature(IFeature):
    config: dict[str, Any]

    def __init__(self):
        self._logger = logging.getLogger(__name__)

    async def init(self, config: dict[str, Any], application_db):
        self.config = config

        self._logger.info("initializing skills ranking feature")

        # Configure the database settings
        db_settings = SkillsRankingDbSettings(
            mongodb_uri=config.get("mongodb_uri", ""),
            database_name=config.get("database_name", "skills_ranking")
        )
        configure_skills_ranking_db(db_settings)

        # Get the skills ranking database and initialize it
        skills_ranking_db = await get_skills_ranking_state_db()
        await initialize_skills_ranking_db(skills_ranking_db, self._logger)

        self._logger.info("skills ranking feature initialized successfully")

    def get_api_router(self, auth: Authentication):
        # Add skills ranking routes (Endpoints)
        router = get_skills_ranking_router(auth)
        return router

    async def tear_down(self):
        self._logger.info("tearing down skills ranking feature")
        # Clear the database cache
        clear_skills_ranking_db_cache()
