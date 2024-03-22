from abc import ABC, abstractmethod

from langchain_core.embeddings.embeddings import Embeddings
from langchain_mongodb import MongoDBAtlasVectorSearch
from pydantic import BaseModel, constr, validator
from pymongo.database import Database


class VectorSearchConfig(BaseModel):
    embedding_model: Embeddings
    """
    The embedding model to use for calculating the embeddings of the search queries.
    """

    @validator('embedding_model', pre=True)
    def validate_embedding_model(cls, v):
        if not isinstance(v, Embeddings):
            raise ValueError("embedding_model must be an instance of Embeddings")
        # Return the value
        return v

    class Config:
        arbitrary_types_allowed = True

    collection_name: str
    """
    The name of the collection in the database.
    """

    text_key: str
    """
    The key in the document that contains the text that was used to generate the embeddings for the documents.
    """

    index_name: str
    """
    The name of the atlas search index to use for the vector search.
    """

    embedding_key: str
    """
    The key in the document that contains the embedding.
    """

    relevance_score_fn: constr(regex="^(cosine|euclidean|dotProduct)$")
    """
    The name of the function to use to calculate the relevance score.
    Currently supported. 'euclidean', 'cosine', and 'dotProduct'
    """


from typing import Generic, TypeVar

# Define a type variable
T = TypeVar('T')


class AbstractEscoSearchService(ABC, Generic[T]):
    """
    An abstract class to perform similarity searches on esco entities.
    It uses the MongoDBAtlasVectorSearch to perform the similarity search.
    The embedding model used is provided in the config along with the collection name, index name, and other parameters.

    Subclasses must implement the to_entity method to convert the document returned by the vector search to an entity object of type ``T``.
    """

    def __init__(self, db: Database, config: VectorSearchConfig):
        """
        Initialize the OccupationSearch object.
        :param db: The MongoDB database object.
        :param config: The configuration for the vector search.
        """

        collection = db.get_collection(config.collection_name)

        # Set up the vector store
        self.store: MongoDBAtlasVectorSearch = MongoDBAtlasVectorSearch(
            collection=collection,
            text_key=config.text_key,
            embedding=config.embedding_model,
            index_name=config.index_name,
            embedding_key=config.embedding_key,
            relevance_score_fn=config.relevance_score_fn
        )

    @abstractmethod
    def to_entity(self, doc: dict) -> T:
        """
        Convert a Document object to a T object.
        This method should be implemented by the subclass.
        :param doc:
        :return:
        """
        raise NotImplementedError

    async def search(self, query, k=5) -> list[T]:
        """
        Perform a similarity search on the vector store.
        See MongoDBAtlasVectorSearch.asimilarity_search for more information.

        :param query: The query to search for. An embedding is generated for the query
        with the embedding model provided in the config.
        The ``embed_query`` method of the embedding model is used to generate the embedding.
        :param k: The number of results to return.
        """
        # Perform the search
        results = await self.store.asimilarity_search_with_score(query, k=k)
        # Extract the metadata from the documents
        return [self.to_entity(document.metadata) for document, _ in results]

    async def search_mmr(self, query, k=5, fetch_k=100, lambda_mult=0.5) -> list[T]:
        """
        Perform a Maximal Marginal Relevance search on the vector store.
        See MongoDBAtlasVectorSearch.amax_marginal_relevance_search for more information.

        :param query: The query to search for. An embedding is generated for the query
        with the embedding model provided in the config.
        The ``embed_query`` method of the embedding model is used to generate the embedding.
        :param k: The number of results to return.
        :param fetch_k: The number of documents to pass to the MMR algorythm.
        :param lambda_mult: The lambda multiplier for the MMR algorythm.
        """
        results = await self.store.amax_marginal_relevance_search(query, k=k, fetch_k=fetch_k, lambda_mult=lambda_mult)
        return [self.to_entity(document.metadata) for document in results]
