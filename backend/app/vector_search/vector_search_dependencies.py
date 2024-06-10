import logging
from threading import Lock
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, \
    EmbeddingService
from app.vector_search.esco_entities import SkillEntity, OccupationEntity
from app.vector_search.esco_search_service import SkillSearchService, VectorSearchConfig, OccupationSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService

logger = logging.getLogger(__name__)

# Define a singleton instance of the Google VertexAI embeddings
_embeddings = GoogleGeckoEmbeddingService()


def get_gecko_embeddings() -> GoogleGeckoEmbeddingService:
    """ Get the Google VertexAI embeddings singletone instance."""
    return _embeddings


# Lock to ensure that the singleton instances are thread-safe
_lock = Lock()

# Define a singleton instance of the skill search service
_skill_search_service_singleton: SimilaritySearchService[SkillEntity] = None


def get_skill_search_service(db: AsyncIOMotorDatabase = Depends(get_mongo_db),
                             embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> \
        SimilaritySearchService[SkillEntity]:
    """ Get the skill search service singleton instance."""
    global _skill_search_service_singleton
    if _skill_search_service_singleton is None:  # initial check
        with _lock:  # before modifying the singleton instance, acquire the lock
            if _skill_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the skill search service.")
                skill_vector_search_config = VectorSearchConfig(
                    collection_name="skillmodels",
                    index_name="all_skill_gecko_embeddings_vector_index",
                    embedding_key="all_skill_gecko_embeddings",
                )
                _skill_search_service_singleton = SkillSearchService(db, embedding_model, skill_vector_search_config)

    return _skill_search_service_singleton


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
                    collection_name="occupationmodels",
                    index_name="all_occupation_gecko_embeddings_vector_index",
                    embedding_key="all_occupation_gecko_embeddings",
                )
                _occupation_search_service_singleton = OccupationSearchService(db, embedding_model,
                                                                               occupation_vector_search_config)

    return _occupation_search_service_singleton
