from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T = TypeVar("T")


class SimilaritySearchService(ABC, Generic[T]):
    """
    An abstract class for a search service to perform similarity searches (see
    https://en.wikipedia.org/wiki/Similarity_search).
    """

    @abstractmethod
    async def search(self, query: str, k: int = 5) -> list[T]:
        """
        Perform a similarity search on the vector store.

        :param query: The query to search for.
        :param k: The number of results to return.

        :return: A list of T objects.
        """
        raise NotImplementedError
