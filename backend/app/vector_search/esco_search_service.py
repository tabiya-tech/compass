from abc import abstractmethod
from typing import TypeVar, List, cast

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity, AssociatedSkillEntity, SkillTypeLiteral
from app.vector_search.esco_entities import SkillEntity
from app.vector_search.similarity_search_service import SimilaritySearchService, FilterSpec
from common_libs.environment_settings.constants import EmbeddingConfig


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
    The db, embedding model used and a config with the collection name, index name, and other parameters are provided
    during initialization.

    Subclasses must implement the to_entity method to convert the document returned by the vector search
    to an entity object of type ``T``.
    """

    def __init__(self, db: AsyncIOMotorDatabase, embedding_service: EmbeddingService, config: VectorSearchConfig, taxonomy_model_id: str):
        """
        Initialize the OccupationSearch object.
        :param db: The MongoDB database object.
        :param embedding_service: The embedding service to use to embed the queries.
        :param config: The configuration for the vector search.
        :param taxonomy_model_id: The taxonomy model id to use for the search.
        """

        self.collection = db.get_collection(config.collection_name)
        self.embedding_service = embedding_service
        self.config = config
        self._model_id = ObjectId(taxonomy_model_id)

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

    async def search(self, *, query: str | list[float], filter_spec: FilterSpec = None, k: int = 5) -> \
            List[T]:
        """
        Perform a similarity search on the vector store. It uses the default similarity search set during vector
        generation.

        :param query: The text query, or a vector representation to search for.
        :param filter_spec: A filter to apply to the search.
        :param k: The number of results to return.
        :return: A list of T objects.
        """
        # Each ESCO entity is duplicated three times, each duplication has a different embedding, one for the
        # preferredLabel, one for the description and one for the altLabels. The search is performed on all three
        # fields, so we need to multiply the number of results by 3 to account for the possible duplication. Those
        # are then grouped by the UUID and the best score is selected. The final number of results is limited to k.
        embedding: list[float]
        if isinstance(query, str):
            embedding = await self.embedding_service.embed(query)
        else:
            embedding = query
        params = {
            "queryVector": embedding,
            "path": self.config.embedding_key,
            "numCandidates": k * 10 * 3,
            "limit": k * 3,
            "index": self.config.index_name,
            "filter": {
                "modelId": self._model_id,
            },
        }
        if filter_spec:
            params["filter"].update(filter_spec.to_query_filter())

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
        return {"_id": "$occupationId",
                "modelId": {"$first": "$modelId"},
                "occupationId": {"$first": "$occupationId"},
                "UUID": {"$first": "$UUID"},
                "preferredLabel": {"$first": "$preferredLabel"},
                "description": {"$first": "$description"},
                "scopeNote": {"$first": "$scopeNote"},
                "altLabels": {"$first": "$altLabels"},
                "code": {"$first": "$code"},
                "score": {"$max": "$score"}
                }

    def _to_entity(self, doc: dict) -> OccupationEntity:
        """
        Convert a Document object to an OccupationEntity object.
        """

        return OccupationEntity(
            id=str(doc.get("occupationId", "")),
            modelId=str(doc.get("modelId", "")),
            UUID=doc.get("UUID", ""),
            code=doc.get("code", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            scopeNote=doc.get("scopeNote", ""),
            altLabels=doc.get("altLabels", []),
            score=doc.get("score", 0.0),
        )

    async def get_by_esco_code(self, *, code: str) -> OccupationEntity:
        """
        Get an occupation by its ESCO code.
        :param code: The ESCO code of the occupation.
        :return: The OccupationEntity object.
        """
        query = {
            "modelId": self._model_id,
            # use $eq to match the exact code
            "code": {"$eq": code}
        }
        # There should be up to 3 entries (one for each embedded field) for each occupation entity,
        # but we only need one, so we use find_one.
        doc = await self.collection.find_one(query)
        return self._to_entity(doc)


class SkillSearchService(AbstractEscoSearchService[SkillEntity]):
    """
    A service class to perform similarity searches on the skills' collection.
    """

    def _to_entity(self, doc: dict) -> SkillEntity:
        """
        Convert a Document object to a SkillEntity object.
        """

        return SkillEntity(
            id=str(doc.get("$skillId", "")),
            modelId=str(doc.get("modelId", "")),
            UUID=doc.get("UUID", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            scopeNote=doc.get("scopeNote", ""),
            altLabels=doc.get("altLabels", []),
            skillType=cast(SkillTypeLiteral, doc.get("skillType", "")),
            score=doc.get("score", 0.0),
        )

    def _group_fields(self) -> dict:
        return {"_id": "$skillId",
                "modelId": {"$first": "$modelId"},
                "UUID": {"$first": "$UUID"},
                "preferredLabel": {"$first": "$preferredLabel"},
                "description": {"$first": "$description"},
                "scopeNote": {"$first": "$scopeNote"},
                "altLabels": {"$first": "$altLabels"},
                "skillType": {"$first": "$skillType"},
                "score": {"$max": "$score"}
                }


class OccupationSkillSearchService(SimilaritySearchService[OccupationSkillEntity]):

    def __init__(self, db: AsyncIOMotorDatabase, embedding_service: EmbeddingService, taxonomy_model_id: str):
        """
        Initialize the OccupationSkillSearch object.
        :param db: The MongoDB database object.
        :param embedding_service: The embedding service to use to embed the queries.
        :param taxonomy_model_id: The taxonomy model id to use for the search.
        """
        self.embedding_config = EmbeddingConfig()
        self._model_id = ObjectId(taxonomy_model_id)
        self.embedding_service = embedding_service
        self.database = db
        occupation_vector_search_config = VectorSearchConfig(
            collection_name=self.embedding_config.occupation_collection_name,
            index_name=self.embedding_config.embedding_index,
            embedding_key=self.embedding_config.embedding_key)
        self.occupation_search_service = OccupationSearchService(db, embedding_service, occupation_vector_search_config, taxonomy_model_id)

    async def _find_skills_from_occupation(self, occupation: OccupationEntity):
        """
        Find the skills associated with an occupation.
        :param occupation: The occupation entity.
        :return: A list of SkillEntity objects.
        """
        if occupation.modelId != self._model_id.__str__():
            raise ValueError(f"Occupation {occupation.id} does not belong to the model {self._model_id}")

        skills = await self.database.get_collection(
            self.embedding_config.occupation_to_skill_collection_name).aggregate([
            {"$match": {"modelId": self._model_id, "requiringOccupationId": ObjectId(occupation.id)}},
            {
                "$lookup": {
                    "from": self.embedding_config.skill_collection_name,
                    "localField": "requiredSkillId",
                    "foreignField": "skillId",
                    "as": "skills",
                    "pipeline": [
                        {"$match": {"modelId": self._model_id}}
                    ]
                }
            },
            {"$unwind": "$skills"},
            {"$group": {"_id": "$skills.skillId",
                        "modelId": {"$first": "$modelId"},
                        "skillId": {"$first": "$skills.skillId"},
                        "UUID": {"$first": "$skills.UUID"},
                        "preferredLabel": {"$first": "$skills.preferredLabel"},
                        "description": {"$first": "$skills.description"},
                        "scopeNote": {"$first": "$skills.scopeNote"},
                        "altLabels": {"$first": "$skills.altLabels"},
                        "skillType": {"$first": "$skills.skillType"},
                        "relationType": {"$first": "$relationType"},
                        "signallingValueLabel": {"$first": "$signallingValueLabel"},
                        }
             }
        ]).to_list(length=None)
        return [AssociatedSkillEntity(
            id=str(skill.get("skillId", "")),
            modelId=str(skill.get("modelId", "")),
            UUID=skill.get("UUID", ""),
            preferredLabel=skill.get("preferredLabel", ""),
            description=skill.get("description", ""),
            scopeNote=skill.get("scopeNote", ""),
            altLabels=skill.get("altLabels", []),
            skillType=skill.get("skillType", ""),
            relationType=skill.get("relationType", ""),
            signallingValueLabel=skill.get("signallingValueLabel", ""),
            score=0.0
        ) for skill in skills]

    async def search(self, *, query: str, filter_spec: FilterSpec = None, k: int = 5) -> list[OccupationSkillEntity]:
        occupation_skills: List[OccupationSkillEntity] = []
        occupations: list[OccupationEntity] = await self.occupation_search_service.search(query=query, filter_spec=filter_spec, k=k)
        for occupation in occupations:
            associated_skills = await self._find_skills_from_occupation(occupation)
            occupation_skills.append(OccupationSkillEntity(occupation=occupation, associated_skills=associated_skills))
        return occupation_skills

    async def get_by_esco_code(self, *, code: str) -> OccupationSkillEntity:
        """
        Get an occupation by its ESCO code.
        :param code: The ESCO code of the occupation.
        :return: The OccupationSkillEntity object.
        """
        occupation = await self.occupation_search_service.get_by_esco_code(code=code)
        associated_skills = await self._find_skills_from_occupation(occupation)
        return OccupationSkillEntity(occupation=occupation, associated_skills=associated_skills)
