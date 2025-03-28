import os

from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.esco_search_service import OccupationSkillSearchService, OccupationSearchService, \
    SkillSearchService, VectorSearchConfig
from app.vector_search.validate_taxonomy_model import validate_taxonomy_model
from app.vector_search.vector_search_dependencies import SearchServices, get_embeddings_service
from common_libs.environment_settings.constants import EmbeddingConfig


async def get_search_services(*,
                              embeddings_service_name: str = None,
                              embeddings_model_name: str = None,
                              taxonomy_model_id: str = None) -> SearchServices:
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.")

    if not taxonomy_model_id:
        taxonomy_model_id: str = os.getenv("TAXONOMY_MODEL_ID")
        if not taxonomy_model_id:
            raise ValueError("TAXONOMY_MODEL_ID environment variable is not set.")

    if not embeddings_service_name:
        embeddings_service_name = os.getenv("EMBEDDINGS_SERVICE_NAME")
        if not embeddings_service_name:
            raise ValueError("EMBEDDINGS_SERVICE_NAME environment variable is not set.")

    if not embeddings_model_name:
        embeddings_model_name = os.getenv("EMBEDDINGS_MODEL_NAME")
        if not embeddings_model_name:
            raise ValueError("EMBEDDINGS_MODEL_NAME environment variable is not set.")

    db = await CompassDBProvider.get_taxonomy_db()
    await validate_taxonomy_model(
        taxonomy_db=db,
        taxonomy_model_id=taxonomy_model_id,
        embeddings_service_name=embeddings_service_name,
        embeddings_model_name=embeddings_model_name
    )

    embedding_service = await get_embeddings_service(service_name=embeddings_service_name, model_name=embeddings_model_name)
    occupation_skill_search_service = OccupationSkillSearchService(db, embedding_service, taxonomy_model_id)
    embedding_config = EmbeddingConfig()
    occupation_search_service = OccupationSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.occupation_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ), taxonomy_model_id)
    skill_search_service = SkillSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ), taxonomy_model_id)
    search_services = SearchServices(
        occupation_search_service=occupation_search_service,
        skill_search_service=skill_search_service,
        occupation_skill_search_service=occupation_skill_search_service
    )
    return search_services
