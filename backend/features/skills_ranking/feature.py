import logging
from typing import Any

from app.users.auth import Authentication
from features.skills_ranking.db_provider import SkillsRankingDBProvider, SkillsRankingDbSettings
from features.skills_ranking.routes.routes import get_skills_ranking_router
from features.types import IFeature


class Feature(IFeature):
    config: dict[str, Any]

    def __init__(self):
        self._logger = logging.getLogger(__name__)

    async def init(self, config: dict[str, Any], application_db):
        self.config = config

        self._logger.info("initializing skills ranking feature")

        # Configure the database provider with settings from config
        db_settings = SkillsRankingDbSettings(
            mongodb_uri=config.get("mongodb_uri", ""),
            database_name=config.get("database_name", "skills_ranking")
        )
        SkillsRankingDBProvider.configure(db_settings)

        # Get the skills ranking database and initialize it
        skills_ranking_db = await SkillsRankingDBProvider.get_skills_ranking_db()
        await SkillsRankingDBProvider.initialize_skills_ranking_mongo_db(skills_ranking_db, self._logger)

        self._logger.info("skills ranking feature initialized successfully")

    def get_api_router(self, auth: Authentication):
        # Add skills ranking routes (Endpoints)
        router = get_skills_ranking_router(auth)
        return router

    async def tear_down(self):
        self._logger.info("tearing down skills ranking feature")
        # Clear the database cache
        SkillsRankingDBProvider.clear_cache()
