from typing import List, Any, Mapping

from app.server_dependecies.db_dependecies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.esco_search_service import OccupationSkillSearchService, OccupationSearchService, \
    SkillSearchService, VectorSearchConfig
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.environment_settings.constants import EmbeddingConfig


class FakeOccupationSimilaritySearchService(SimilaritySearchService[OccupationEntity]):
    """ A fake similarity search service that returns a single occupation entity for any query."""

    async def search(self, *, query: str, filter_spec: Mapping[str, Any] = None, k: int = 5) -> List[OccupationEntity]:
        return [OccupationEntity(id='1', UUID='1', preferredLabel='Baker', code='123', description='Bakes bread',
                                 altLabels=['Baker'])]


def get_search_services():
    db = get_mongo_db()
    embedding_service = GoogleGeckoEmbeddingService()
    occupation_skill_search_service = OccupationSkillSearchService(db, embedding_service)
    embedding_config = EmbeddingConfig()
    occupation_search_service = OccupationSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.occupation_to_skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ))
    skill_search_service = SkillSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ))
    search_services = SearchServices(
        occupation_search_service=occupation_search_service,
        skill_search_service=skill_search_service,
        occupation_skill_search_service=occupation_skill_search_service
    )
    return search_services
