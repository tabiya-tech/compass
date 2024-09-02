from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService, OccupationSearchService, \
    SkillSearchService, VectorSearchConfig
from app.vector_search.settings import VectorSearchSettings
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.environment_settings.constants import EmbeddingConfig


async def get_search_services():
    db = await CompassDBProvider.get_taxonomy_db()
    embedding_service = GoogleGeckoEmbeddingService()
    settings = VectorSearchSettings()
    occupation_skill_search_service = OccupationSkillSearchService(db, embedding_service, settings)
    embedding_config = EmbeddingConfig()
    occupation_search_service = OccupationSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.occupation_to_skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ), settings)
    skill_search_service = SkillSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ), settings)
    search_services = SearchServices(
        occupation_search_service=occupation_search_service,
        skill_search_service=skill_search_service,
        occupation_skill_search_service=occupation_skill_search_service
    )
    return search_services
