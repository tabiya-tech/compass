from abc import abstractmethod
from typing import TypeVar, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.esco_entities import SkillEntity
from app.vector_search.similarity_search_service import SimilaritySearchService


class VectorSearchConfig(BaseModel):
    """
    A configuration class for the vector search.
    """
    collection_name: str
    """
    The name of the collection in the database.
    """

    index_name: str
    """
    The name of the atlas search index to use for the vector search.
    """

    embedding_key: str
    """
    The key in the document that contains the embedding.
    """


# Define a type variable
T = TypeVar('T')


class AbstractEscoSearchService(SimilaritySearchService[T]):
    """
    A service class to perform similarity searches on esco entities using a MongoDB database.
    The db, embedding model used and a config with the collection name, index name, and other parameters is provided
    during initialization.

    Subclasses must implement the to_entity method to convert the document returned by the vector search
    to an entity object of type ``T``.
    """

    def __init__(self, db: AsyncIOMotorDatabase, embedding_service: EmbeddingService, config: VectorSearchConfig):
        """
        Initialize the OccupationSearch object.
        :param db: The MongoDB database object.
        :param embedding_service: The embedding service to use to embed the queries.
        :param config: The configuration for the vector search.
        """

        self.collection = db.get_collection(config.collection_name)
        self.embedding_service = embedding_service
        self.config = config

    @abstractmethod
    def _to_entity(self, doc: dict) -> T:
        """
        Convert a Document object to a T object.
        This method should be implemented by the subclass.
        :param doc: The Document object to convert.
        :return: An object of type T.
        """
        raise NotImplementedError

    async def search(self, query: str, k: int = 5) -> List[T]:
        """
        Perform a similarity search on the vector store. It uses the default similarity search set during vector
        generation.

        :param query: The query to search for.
        :param k: The number of results to return.
        :return: A list of T objects.
        """
        params = {
            "queryVector": await self.embedding_service.embed(query),
            "path": self.config.embedding_key,
            "numCandidates": k * 10,
            "limit": k,
            "index": self.config.index_name,
        }
        query = {"$vectorSearch": params}
        pipeline = [
            query,
            {"$set": {"score": {"$meta": "vectorSearchScore"}}},
        ]
        return [self._to_entity(entry) async for entry in self.collection.aggregate(pipeline)]


class OccupationSearchService(AbstractEscoSearchService[OccupationEntity]):
    """
    A service class to perform similarity searches on the occupations' collection.
    """

    def _to_entity(self, doc: dict) -> OccupationEntity:
        """
        Convert a Document object to an OccupationEntity object.
        """

        return OccupationEntity(
            id=str(doc.get("_id", "")),
            UUID=doc.get("UUID", ""),
            code=doc.get("code", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            altLabels=doc.get("altLabels", []),
        )


class SkillSearchService(AbstractEscoSearchService[SkillEntity]):
    """
    A service class to perform similarity searches on the skills' collection.
    """

    def _to_entity(self, doc: dict) -> SkillEntity:
        """
        Convert a Document object to a SkillEntity object.
        """

        return SkillEntity(
            id=str(doc.get("_id", "")),
            UUID=doc.get("UUID", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            altLabels=doc.get("altLabels", []),
            skillType=doc.get("skillType", ""),
        )
