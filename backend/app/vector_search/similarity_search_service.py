from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Mapping, Any

from pydantic import BaseModel

T = TypeVar("T")


class FilterSpec(BaseModel):
    """
    A class to represent a filter to apply to the vector search.
    The filter keys must be indexed so that they can be used by the vector search
    See https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#about-the-filter-type
    and scripts/generate_esco_embeddings.py for more information.
    """

    UUID: list[str] = []
    """
    Search for entities with the given UUIDs.
    """

    def to_query_filter(self) -> Mapping[str, Any]:
        query = {}
        if self.UUID:
            query["UUID"] = {"$in": self.UUID}
        return query


class SimilaritySearchService(ABC, Generic[T]):
    """
    An abstract class for a search service to perform similarity searches (see
    https://en.wikipedia.org/wiki/Similarity_search).
    """

    @abstractmethod
    async def search(self, *, query: str, filter_spec: FilterSpec = None, k: int = 5) -> list[T]:
        """
        Perform a similarity search on the vector store.

        :param query: The query to search for.
        :param filter_spec: A dictionary of filters to apply to the search results.
        :param k: The number of results to return.

        :return: A list of T objects.
        """
        raise NotImplementedError
