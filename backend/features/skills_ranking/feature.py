import asyncio
import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.auth import Authentication
from features.skills_ranking.config import SkillsRankingConfig, set_skills_ranking_config, get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_job_seekers_db import get_job_seekers_db, \
    initialize_job_seekers_db
from features.skills_ranking.ranking_service.repositories.get_opportunities_data_db import get_opportunities_data_db, \
    initialize_opportunities_data_db
from features.skills_ranking.state.repositories.get_registration_data_db import get_registration_data_db
from features.skills_ranking.state.repositories.get_skills_ranking_state_db import get_skills_ranking_state_db, \
    initialize_skills_ranking_state_db
from features.skills_ranking.state.routes.routes import get_skills_ranking_router
from features.types import IFeature


class SkillsRankingFeature(IFeature):
    config: dict[str, Any]
    _databases: list[AsyncIOMotorDatabase]

    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._databases = []

    async def init(self, config: dict[str, Any], application_db):
        self.config = config

        self._logger.info("initializing skills ranking feature")

        # Set the feature configuration
        skills_ranking_config = SkillsRankingConfig(**config)
        set_skills_ranking_config(skills_ranking_config)

        # Get the skills ranking databases and initialize it
        await self.initialize_databases()

        self._logger.info("skills ranking feature initialized successfully")

    def get_api_router(self, auth: Authentication):
        # Add skills ranking routes (Endpoints)
        router = get_skills_ranking_router(auth)
        return router

    async def initialize_databases(self):
        # get the databases

        _config = get_skills_ranking_config()

        (skills_ranking_state_db,
         opportunity_data_db,
         job_seekers_data_db,
         registration_data_db) = await asyncio.gather(
            get_skills_ranking_state_db(_config.skills_ranking_state_mongodb_uri,
                                        _config.skills_ranking_state_database_name),
            get_opportunities_data_db(
                _config.opportunity_data_mongodb_uri, _config.opportunity_data_database_name),
            get_job_seekers_db(
                _config.job_seekers_mongodb_uri, _config.job_seekers_database_name),
            get_registration_data_db(_config.registration_data_mongodb_uri, _config.registration_data_database_name)
        )

        # Initialize the databases
        await asyncio.gather(
            initialize_skills_ranking_state_db(skills_ranking_state_db, _config.skills_ranking_state_collection_name,
                                               self._logger),
            initialize_opportunities_data_db(opportunity_data_db, _config.opportunity_data_collection_name),
            initialize_job_seekers_db(job_seekers_data_db, _config.job_seekers_collection_name),
        )

        # cache the databases so that they can be closed later, on tear down
        self._databases = [
            skills_ranking_state_db,
            opportunity_data_db,
            job_seekers_data_db,
            registration_data_db
        ]

    def _close_databases(self):
        for db in self._databases:
            if db.client is not None:
                db.client.close()
            else:
                self._logger.warning("Database client is None, cannot close connection.")

    async def tear_down(self):
        self._logger.info("tearing down skills ranking feature")
        # Clear the feature databases
        self._close_databases()
