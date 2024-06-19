import logging
from threading import Lock

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, \
    EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity
from app.vector_search.esco_search_service import VectorSearchConfig, OccupationSearchService, \
    OccupationSkillSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from constants.database import EmbeddingConfig

logger = logging.getLogger(__name__)

# Define a singleton instance of the Google VertexAI embeddings
_embeddings = GoogleGeckoEmbeddingService()

_settings = MongoDbSettings()
_embedding_settings = EmbeddingConfig()


def get_gecko_embeddings() -> GoogleGeckoEmbeddingService:
    """ Get the Google VertexAI embeddings singleton instance."""
    return _embeddings


# Lock to ensure that the singleton instances are thread-safe
_lock = Lock()


# Define a singleton instance of the occupation search service
_occupation_search_service_singleton = None


def get_occupation_search_service(db: AsyncIOMotorDatabase = Depends(get_mongo_db),
                                  embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> \
        SimilaritySearchService[OccupationEntity]:
    """ Get the occupation search service singleton instance."""
    global _occupation_search_service_singleton
    if _occupation_search_service_singleton is None: # initial check
        with _lock:  # before modifying the singleton instance, acquire the lock
            if _occupation_search_service_singleton is None: # double check after acquiring the lock
                logger.info("Creating a new instance of the occupation search service.")
                occupation_vector_search_config = VectorSearchConfig(
                    collection_name=_embedding_settings.occupation_collection_name,
                    index_name=_embedding_settings.embedding_index,
                    embedding_key=_embedding_settings.embedding_key,
                )
                _occupation_search_service_singleton = OccupationSearchService(db, embedding_model,
                                                                               occupation_vector_search_config)

    return _occupation_search_service_singleton


_occupation_skill_search_service_singleton = None


def get_occupation_skill_search_service(db: AsyncIOMotorDatabase = Depends(get_mongo_db),
                                        embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> \
        SimilaritySearchService[OccupationSkillEntity]:
    """ Get the occupation search service singleton instance."""
    global _occupation_skill_search_service_singleton
    if _occupation_skill_search_service_singleton is None:  # initial check
        with _lock:  # before modifying the singleton instance, acquire the lock
            if _occupation_skill_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the occupation search service.")
                _occupation_skill_search_service_singleton = OccupationSkillSearchService(db, embedding_model)

    return _occupation_skill_search_service_singleton
