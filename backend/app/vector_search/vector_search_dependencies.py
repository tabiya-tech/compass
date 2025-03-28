import asyncio
import logging

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.app_config import get_application_config
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleEmbeddingService, \
    EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity, SkillEntity
from app.vector_search.esco_search_service import VectorSearchConfig, OccupationSearchService, \
    OccupationSkillSearchService, SkillSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.constants import EmbeddingConfig

logger = logging.getLogger(__name__)

# Define a singleton instance of the Google VertexAI embeddings
_embedding_config = EmbeddingConfig()

# Lock to ensure that the singleton instances are thread-safe
_lock = asyncio.Lock()

# Define a singleton instance of the Google VertexAI embeddings
_embeddings_service_singleton = None


async def get_embeddings_service(*, service_name: str = Depends(lambda: get_application_config().embeddings_service_name),
                                 model_name: str = Depends(lambda: get_application_config().embeddings_model_name)
                                 ) -> EmbeddingService:
    """
    Get the embeddings service singleton instance.
    :param service_name: The name of the service to use. If not provided, the one from the application config is used.
    :param model_name: The name of the model to use. If not provided, the one from the application config is used.
    :return: The embeddings service singleton instance.
    """

    global _embeddings_service_singleton

    if _embeddings_service_singleton is None:  # initial check to avoid the lock if the instance is already created (lock is expensive)
        async with _lock:  # before modifying the singleton instance, acquire the lock
            if _embeddings_service_singleton is None:  # double check after acquiring the lock
                if service_name != "GOOGLE-VERTEX-AI":
                    raise ValueError(f"Unsupported embedding service: {service_name}. Only Google Vertex AI is supported.")
                logger.info(f"Creating a new instance of the Google VertexAI embeddings using model:{model_name}.")
                _embeddings_service_singleton = GoogleEmbeddingService(model_name=model_name)

    """ Get the Google VertexAI embeddings singleton instance."""
    return _embeddings_service_singleton


# Define a singleton instance of the skill search service
_skill_search_service_singleton: SimilaritySearchService[SkillEntity] | None = None


async def get_skill_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                   embedding_model: EmbeddingService = Depends(get_embeddings_service),
                                   taxonomy_model_id: str = Depends(lambda: get_application_config().taxonomy_model_id)
                                   ) -> SimilaritySearchService[SkillEntity]:
    """
    Get the skill search service singleton instance.
    :param db: The database instance. If not provided, it will be fetched from the CompassDBProvider.
    :param embedding_model: The embedding model instance. if not provided, it will be fetched from the get_embeddings_service function.
    :param taxonomy_model_id: The taxonomy model id. If not provided, the one from the application config is used.
    :return: The skill search service singleton instance.
    """
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
                _skill_search_service_singleton = SkillSearchService(db, embedding_model, skill_vector_search_config, taxonomy_model_id)

    return _skill_search_service_singleton


# Define a singleton instance of the occupation search service
_occupation_search_service_singleton = None


async def get_occupation_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                        embedding_model: EmbeddingService = Depends(get_embeddings_service),
                                        taxonomy_model_id: str = Depends(lambda: get_application_config().taxonomy_model_id)
                                        ) -> SimilaritySearchService[OccupationEntity]:
    """
    Get the occupation search service singleton instance.
    :param db: The database instance. If not provided, it will be fetched from the CompassDBProvider.
    :param embedding_model: The embedding model instance. if not provided, it will be fetched from the get_embeddings_service function.
    :param taxonomy_model_id: The taxonomy model id. If not provided, the one from the application config is used.
    :return: The occupation search service singleton instance.
    """
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
                _occupation_search_service_singleton = OccupationSearchService(db, embedding_model, occupation_vector_search_config, taxonomy_model_id)

    return _occupation_search_service_singleton


_occupation_skill_search_service_singleton = None


async def get_occupation_skill_search_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_taxonomy_db),
                                              embedding_model: EmbeddingService = Depends(get_embeddings_service),
                                              taxonomy_model_id: str = Depends(lambda: get_application_config().taxonomy_model_id)
                                              ) -> (
        SimilaritySearchService)[OccupationSkillEntity]:
    """
    Get the occupation search service singleton instance.
    :param db: The database instance. If not provided, it will be fetched from the CompassDBProvider.
    :param embedding_model: The embedding model instance. if not provided, it will be fetched from the get_embeddings_service function.
    :param taxonomy_model_id: The taxonomy model id. If not provided, the one from the application config is used.
    :return: The occupation search service singleton instance.
    """
    global _occupation_skill_search_service_singleton
    if _occupation_skill_search_service_singleton is None:  # initial check
        async with _lock:  # before modifying the singleton instance, acquire the lock
            if _occupation_skill_search_service_singleton is None:  # double check after acquiring the lock
                logger.info("Creating a new instance of the occupation search service.")
                _occupation_skill_search_service_singleton = OccupationSkillSearchService(db, embedding_model, taxonomy_model_id)

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
    :param skill_search_service: The skill search service instance.
           If not provided, it will be fetched from the get_skill_search_service function.
    :param occupation_search_service: The occupation search service instance.
           If not provided, it will be fetched from the get_occupation_search_service function.
    :param occupation_skill_search_service: The occupation skill search service instance.
           If not provided, it will be fetched from the get_occupation_skill_search_service function.
    :return: An instance of SearchServices containing all the search services.
    """
    return SearchServices(
        skill_search_service,
        occupation_search_service,
        occupation_skill_search_service
    )
