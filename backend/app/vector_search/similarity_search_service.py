from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T = TypeVar("T")


class SimilaritySearchService(ABC, Generic[T]):
    """
    An abstract class for a search service that uses a vector store to perform similarity searches.
    """

    @abstractmethod
    async def search(self, query: str, k: int = 5) -> list[T]:
        """
        Perform a similarity search on the vector store.

        :param query: The query to search for.
        :param k: The number of results to return.
        """
        raise NotImplementedError

    @abstractmethod
    async def search_mmr(self, query: str, k: int = 5, fetch_k: int = 100, lambda_mult: float = 0.5) -> list[T]:
        """
        Perform a Maximal Marginal Relevance search on the vector store.
        See MongoDBAtlasVectorSearch.amax_marginal_relevance_search for more information.

        :param query: The query to search for.
        :param k: The number of results to return.
        :param fetch_k: The number of documents to pass to the MMR algorythm.
        :param lambda_mult: The lambda multiplier for the MMR algorythm.
        """
        raise NotImplementedError