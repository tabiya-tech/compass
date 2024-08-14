import logging
import os
from abc import ABC, abstractmethod
from typing import List

import vertexai
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel, TextEmbedding

from common_libs.llm.models_utils import Retry


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
        if os.getenv("VERTEX_API_REGION") is None:
            raise ValueError("Environment variable 'VERTEX_API_REGION' is not set.")
        self.region = os.getenv("VERTEX_API_REGION")
        self.model = TextEmbeddingModel.from_pretrained(f"textembedding-gecko@{version}")
        self.logger = logging.getLogger(self.__class__.__name__)

    async def embed(self, text: str) -> List[float]:
        """
         Generates embeddings for a text input.
         Retries the embedding generation in case of errors.
         """
        return (await self.embed_batch([text]))[0]

    async def embed_batch(self, text_list: List[str]) -> List[List[float]]:
        """
        Generates embeddings for a list of texts.
        Splits the texts into batches, according to the region's maximum batch size, and processes them.
        Retries the embedding generation in case of errors.
        """
        # make sure we are in the correct region
        vertexai.init(location=self.region)

        # https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#supported-models
        # As of 14 August 2024, the maximum batch size is 250 of us-central1, and in other regions it is 5
        # create batches of 250 queries at a time
        batch_size = 250
        if self.region != "us-central1":
            batch_size = 5
        embeddings = []
        for i in range(0, len(text_list), batch_size):
            inputs = [TextEmbeddingInput(query, self._TASK) for query in text_list[i:i + batch_size]]
            batch_embeddings = await Retry[str].call_with_exponential_backoff(lambda: self._run_batch(inputs))
            embeddings.extend(batch_embeddings)
        return [embedding.values for embedding in embeddings]

    async def _run_batch(self, inputs: List[TextEmbeddingInput]) -> list[TextEmbedding]:
        try:
            return await self.model.get_embeddings_async(inputs)
        except Exception as e:  # pylint: disable=broad-except
            self.logger.error("An error occurred while generating embeddings for the batch of texts", exc_info=True)
            raise e
