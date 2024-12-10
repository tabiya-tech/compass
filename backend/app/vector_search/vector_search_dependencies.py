import asyncio
import logging

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, \
    EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity, SkillEntity
from app.vector_search.esco_search_service import VectorSearchConfig, OccupationSearchService, \
    OccupationSkillSearchService, SkillSearchService
from app.vector_search.settings import VectorSearchSettings
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.constants import EmbeddingConfig

logger = logging.getLogger(__name__)

# Define a singleton instance of the Google VertexAI embeddings
_embeddings = GoogleGeckoEmbeddingService()

_embedding_config = EmbeddingConfig()


def get_gecko_embeddings() -> GoogleGeckoEmbeddingService:
    """ Get the Google VertexAI embeddings singleton instance."""
    return _embeddings


# Lock to ensure that the singleton instances are thread-safe
_lock = asyncio.Lock()

_vector_search_settings = VectorSearchSettings()

# Define a singleton instance of the skill search service
_skill_search_service_singleton: SimilaritySearchService[SkillEntity] | None = None


async def get_skill_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                   embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> SimilaritySearchService[SkillEntity]:
    """ Get the skill search service singleton instance."""
    global _skill_search_service_singleton
    if _skill_search_service_singleton is None:  # initial check
        async with _lock:  # before modifying the singleton instance, acquire the lock
            if _skill_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the skill search service.")
                skill_vector_search_config = VectorSearchConfig(
                    collection_name=_embedding_config.skill_collection_name,
                    index_name=_embedding_config.embedding_index,
                    embedding_key=_embedding_config.embedding_key,
                )
                _skill_search_service_singleton = SkillSearchService(db, embedding_model, skill_vector_search_config, _vector_search_settings)

    return _skill_search_service_singleton


# Define a singleton instance of the occupation search service
_occupation_search_service_singleton = None


async def get_occupation_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                        embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> SimilaritySearchService[OccupationEntity]:
    """ Get the occupation search service singleton instance."""
    global _occupation_search_service_singleton
    if _occupation_search_service_singleton is None:  # initial check
        async with _lock:  # before modifying the singleton instance, acquire the lock
            if _occupation_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the occupation search service.")
                occupation_vector_search_config = VectorSearchConfig(
                    collection_name=_embedding_config.occupation_collection_name,
                    index_name=_embedding_config.embedding_index,
                    embedding_key=_embedding_config.embedding_key,
                )
                _occupation_search_service_singleton = OccupationSearchService(db, embedding_model, occupation_vector_search_config, _vector_search_settings)

    return _occupation_search_service_singleton


_occupation_skill_search_service_singleton = None


async def get_occupation_skill_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                              embedding_model: EmbeddingService = Depends(get_gecko_embeddings)) -> (
        SimilaritySearchService)[OccupationSkillEntity]:
    """ Get the occupation search service singleton instance."""
    global _occupation_skill_search_service_singleton
    if _occupation_skill_search_service_singleton is None:  # initial check
        async with _lock:  # before modifying the singleton instance, acquire the lock
            if _occupation_skill_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the occupation search service.")
                _occupation_skill_search_service_singleton = OccupationSkillSearchService(db, embedding_model, _vector_search_settings)

    return _occupation_skill_search_service_singleton


class SearchServices:
    """
    A class to hold all the search services.
    """

    def __init__(self, skill_search_service: SkillSearchService,
                 occupation_search_service: OccupationSearchService,
                 occupation_skill_search_service: OccupationSkillSearchService):
        self.skill_search_service: SkillSearchService = skill_search_service
        self.occupation_search_service: OccupationSearchService = occupation_search_service
        self.occupation_skill_search_service: OccupationSkillSearchService = occupation_skill_search_service


def get_all_search_services(skill_search_service=Depends(get_skill_search_service),
                            occupation_search_service=Depends(get_occupation_search_service),
                            occupation_skill_search_service=Depends(get_occupation_skill_search_service)
                            ) -> SearchServices:
    """
    Get all search services via FastAPI dependency injection.
    """
    return SearchServices(
        skill_search_service,
        occupation_search_service,
        occupation_skill_search_service
    )
