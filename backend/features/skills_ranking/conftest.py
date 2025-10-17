import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase

from conftest import random_db_name
from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.test_utilities import get_random_printable_string
from features.skills_ranking.config import set_skills_ranking_config, SkillsRankingConfig


@pytest.fixture(scope='function')
def in_memory_skills_ranking_state_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    skills_ranking_state_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return skills_ranking_state_db


@pytest.fixture(scope='function')
def in_memory_registration_data_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    registration_data_db = get_mongo_db_connection(in_memory_mongo_server.connection_string, random_db_name())
    return registration_data_db


@pytest.fixture(scope='function')
def setup_skills_ranking_feature_config(in_memory_skills_ranking_state_db: AsyncIOMotorDatabase,
                                        in_memory_registration_data_db: AsyncIOMotorDatabase) -> None:
    set_skills_ranking_config(SkillsRankingConfig(
        skills_ranking_service_url=get_random_printable_string(10),
        skills_ranking_service_api_key=get_random_printable_string(10),
        skills_ranking_state_mongodb_uri=f"{in_memory_skills_ranking_state_db.client.HOST}:{in_memory_skills_ranking_state_db.client.PORT}",
        skills_ranking_state_database_name=in_memory_skills_ranking_state_db.name,
        registration_data_mongodb_uri=f"{in_memory_registration_data_db.client.HOST}:{in_memory_registration_data_db.client.PORT}",
        registration_data_database_name=in_memory_registration_data_db.name,
        registration_data_collection_name=get_random_printable_string(10),
        high_difference_threshold=0.2,
    ))
