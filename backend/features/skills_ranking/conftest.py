import asyncio
from typing import Awaitable

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient

from conftest import random_db_name
from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.test_utilities import get_random_printable_string
from features.skills_ranking.config import set_skills_ranking_config, SkillsRankingConfig


@pytest.fixture(scope='function')
def in_memory_skills_ranking_state_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    skills_ranking_state_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return skills_ranking_state_db


@pytest.fixture(scope='function')
def in_memory_opportunity_data_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    opportunity_data_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return opportunity_data_db


@pytest.fixture(scope='function')
def in_memory_registration_data_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    registration_data_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return registration_data_db


@pytest.fixture(scope='function')
def in_memory_job_seekers_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    job_seekers_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return job_seekers_db


@pytest.fixture(scope='function')
def setup_skills_ranking_feature_config(in_memory_skills_ranking_state_db: AsyncIOMotorDatabase,
                                              in_memory_opportunity_data_db: AsyncIOMotorDatabase,
                                              in_memory_registration_data_db: AsyncIOMotorDatabase,
                                              in_memory_job_seekers_db: AsyncIOMotorDatabase) -> None:

    set_skills_ranking_config(SkillsRankingConfig(
        skills_ranking_state_mongodb_uri=f"{in_memory_skills_ranking_state_db.client.HOST}:{in_memory_skills_ranking_state_db.client.PORT}",
        skills_ranking_state_database_name=in_memory_skills_ranking_state_db.name,
        opportunity_data_mongodb_uri=f"{in_memory_opportunity_data_db.client.HOST}:{in_memory_opportunity_data_db.client.PORT}",
        opportunity_data_database_name=in_memory_opportunity_data_db.name,
        opportunity_data_collection_name=get_random_printable_string(10),
        registration_data_mongodb_uri=f"{in_memory_registration_data_db.client.HOST}:{in_memory_registration_data_db.client.PORT}",
        registration_data_database_name=in_memory_registration_data_db.name,
        registration_data_collection_name=get_random_printable_string(10),
        job_seekers_mongodb_uri=f"{in_memory_job_seekers_db.client.HOST}:{in_memory_job_seekers_db.client.PORT}",
        job_seekers_database_name=in_memory_job_seekers_db.name,
        job_seekers_collection_name=get_random_printable_string(10),
        matching_threshold=0.5,
        high_difference_threshold=0.2,
    ))
