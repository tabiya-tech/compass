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
    
    @abstractmethod
    async def embed_batch(self, queries: List[str]) -> List[List[float]]:
        """
        Embeds the given batch of query texts.
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
    
    async def embed_batch(self, queries: List[str]) -> List[List[float]]:
        """Embeds texts with a pre-trained, foundational model."""
        inputs = [TextEmbeddingInput(query, self._TASK) for query in queries]
        embeddings = await self.model.get_embeddings_async(inputs)
        return [embedding.values for embedding in embeddings]
