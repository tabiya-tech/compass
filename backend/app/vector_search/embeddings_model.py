from abc import ABC, abstractmethod
from typing import List

from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel


class EmbeddingService(ABC):
    """ An abstract class for a text embedding service."""

    @abstractmethod
    async def embed(self, query: str) -> List[float]:
        """
        Embeds the given query text.
        """
        raise NotImplementedError
    
    async def embed_strings_in_batch(list_of_queries: List[str], model: TextEmbeddingModel, batch_size: int = 100) -> List[List[float]]:
        """Uses a TextEmbeddingModel to embed a list of queries in batches.

        Args:
            list_of_queries (List[str]): list of queries to be embedded in batches.
            model (TextEmbeddingModel): embedding model.
            batch_size (int, optional): size of each batch which should be less than or equal to 250.
                Defaults to 100.

        Returns:
            List[List[float]]: List of embeddings corresponding to the queries.
        """
        raise NotImplementedError


class GoogleGeckoEmbeddingService(EmbeddingService):
    """ A text embedding service that uses the Google Gecko model."""

    _TASK = "RETRIEVAL_QUERY"

    def __init__(self, version: str = "003"):
        self.model = TextEmbeddingModel.from_pretrained(f"textembedding-gecko@{version}")

    async def embed(self, query: str) -> List[float]:
        """Embeds texts with a pre-trained, foundational model."""
        inputs = TextEmbeddingInput(query, self._TASK)
        embeddings = await self.model.get_embeddings_async([inputs])
        return embeddings[0].values
    
    async def embed_strings_in_batch(self, list_of_queries: List[str], batch_size: int = 100) -> List[List[float]]:
        """Uses a TextEmbeddingModel to embed a list of queries in batches.

        Args:
            list_of_queries (List[str]): list of queries to be embedded in batches.
            batch_size (int, optional): size of each batch which should be less than or equal to 250.
                Defaults to 100.

        Returns:
            List[List[float]]: List of embeddings corresponding to the queries.
        """
        assert batch_size<=250
        embedding_results = []
        num_samples = len(list_of_queries)
        for i in range(int(num_samples/batch_size)+1):
            batch = list_of_queries[i*batch_size:(i+1)*batch_size]
            inputs = [TextEmbeddingInput(query, self._TASK) for query in batch]
            embedding_results += await self.model.get_embeddings_async(inputs)
        assert len(embedding_results) == len(list_of_queries)
        return [embedding_result.values for embedding_result in embedding_results]

