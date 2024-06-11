from typing import List

from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.similarity_search_service import SimilaritySearchService


class FakeOccupationSimilaritySearchService(SimilaritySearchService[OccupationEntity]):
    """ A fake similarity search service that returns a single occupation entity for any query."""

    async def search(self, query: str, k: int = 5) -> List[OccupationEntity]:
        return [OccupationEntity(id='1', UUID='1', preferredLabel='Baker', code='123', description='Bakes bread',
                                 altLabels=['Baker'])]
