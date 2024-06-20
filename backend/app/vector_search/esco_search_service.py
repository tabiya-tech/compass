from abc import abstractmethod
from typing import TypeVar, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity
from app.vector_search.esco_entities import SkillEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from constants.database import EmbeddingConfig


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

    def _group_fields(self) -> dict:
        """
        Fields to extract when grouping the results of the vector search.
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
        # Each ESCO entity is duplicated three times, each duplication has a different embedding, one for the
        # preferredLabel, one for the description and one for the altLabels. The search is performed on all three
        # fields, so we need to multiply the number of results by 3 to account for the possible duplication. Those
        # are then grouped by the UUID and the best score is selected. The final number of results is limited to k.
        embedding = await self.embedding_service.embed(query)
        params = {
            "queryVector": embedding,
            "path": self.config.embedding_key,
            "numCandidates": k * 10 * 3,
            "limit": k * 3,
            "index": self.config.index_name,
        }
        fields = self._group_fields().copy()
        fields.update({"score": {"$max": "$score"}})
        pipeline = [
            {"$vectorSearch": params},
            {"$set": {"score": {"$meta": "vectorSearchScore"}}},
            {"$group": fields},
            {"$sort": {"score": -1}},
            {"$limit": k},
        ]
        entries = await self.collection.aggregate(pipeline).to_list(length=k)
        return [self._to_entity(entry) for entry in entries]


class OccupationSearchService(AbstractEscoSearchService[OccupationEntity]):
    """
    A service class to perform similarity searches on the occupations' collection.
    """

    def _group_fields(self) -> dict:
        return {"_id": "$UUID",
                "occupationId": {"$first": "$occupationId"},
                "UUID": {"$first": "$UUID"},
                "preferredLabel": {"$first": "$preferredLabel"},
                "description": {"$first": "$description"},
                "altLabels": {"$first": "$altLabels"},
                "code": {"$first": "$code"},
                }

    def _to_entity(self, doc: dict) -> OccupationEntity:
        """
        Convert a Document object to an OccupationEntity object.
        """

        return OccupationEntity(
            id=str(doc.get("occupationId", "")),
            UUID=doc.get("UUID", ""),
            code=doc.get("code", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            altLabels=doc.get("altLabels", []),
        )


# TODO: Merge this with the OccupationSkillSearch to avoid duplication.
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
            relationType="N/A",
        )

    def _group_fields(self) -> dict:
        return {"_id": "$UUID",
                "UUID": {"$first": "$UUID"},
                "preferredLabel": {"$first": "$preferredLabel"},
                "description": {"$first": "$description"},
                "altLabels": {"$first": "$altLabels"},
                "skillType": {"$first": "skillType"},
                }


class OccupationSkillSearchService(SimilaritySearchService[OccupationSkillEntity]):

    def __init__(self, db: AsyncIOMotorDatabase, embedding_service: EmbeddingService):
        """
        Initialize the OccupationSkillSearch object.
        :param db: The MongoDB database object.
        :param embedding_service: The embedding service to use to embed the queries.
        """
        self.embedding_config = EmbeddingConfig()
        self.embedding_service = embedding_service
        self.database = db
        occupation_vector_search_config = VectorSearchConfig(
            collection_name=self.embedding_config.occupation_collection_name,
            index_name=self.embedding_config.embedding_index,
            embedding_key=self.embedding_config.embedding_key)
        self.occupation_search_service = OccupationSearchService(db, embedding_service, occupation_vector_search_config)

    async def _find_skills_from_occupation(self, occupation: OccupationEntity):
        """
        Find the skills associated with an occupation.
        :param occupation: The occupation entity.
        :return: A list of SkillEntity objects.
        """
        query = {"requiringOccupationId": ObjectId(occupation.id)}

        skills = await self.database.get_collection(
            self.embedding_config.occupation_to_skill_collection_name).aggregate([
            {"$match": query},
            {"$lookup": {
                "from": self.embedding_config.skill_collection_name,
                "localField": "requiredSkillId",
                "foreignField": "skillId",
                "as": "skills"
            }},
            {"$unwind": "$skills"},
            {"$group": {"_id": "$skills.UUID",
                        "skillId": {"$first": "$skills.skillId"},
                        "UUID": {"$first": "$skills.UUID"},
                        "preferredLabel": {"$first": "$skills.preferredLabel"},
                        "description": {"$first": "$skills.description"},
                        "altLabels": {"$first": "$skills.altLabels"},
                        "skillType": {"$first": "$skills.skillType"},
                        "relationType": {"$first": "$relationType"},
                        }}
        ]).to_list(length=None)
        # TODO: Also use embeddings for the skills.
        return [SkillEntity(
            id=str(skill.get("skillId", "")),
            UUID=skill.get("UUID", ""),
            preferredLabel=skill.get("preferredLabel", ""),
            description=skill.get("description", ""),
            altLabels=skill.get("altLabels", []),
            skillType=skill.get("skillType", ""),
            relationType=skill.get("relationType", ""),
        ) for skill in skills]

    async def search(self, query: str, k: int = 5) -> list[OccupationSkillEntity]:
        occupations = await self.occupation_search_service.search(query, k)
        return [OccupationSkillEntity(occupation=occupation, skills=await self._find_skills_from_occupation(occupation))
                for occupation in occupations]
