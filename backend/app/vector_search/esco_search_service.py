import asyncio
import logging
import time
from abc import abstractmethod
from typing import TypeVar, List, cast
import re

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from pydantic import BaseModel

from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity, AssociatedSkillEntity, SkillTypeLiteral
from app.vector_search.esco_entities import SkillEntity
from app.vector_search.lru_cache import AsyncLRUCache, CacheClearDebouncer
from app.vector_search.similarity_search_service import SimilaritySearchService, FilterSpec
from common_libs.environment_settings.constants import EmbeddingConfig


# Caching the skills of occupations for the complete esco model (3035 occupations and their associated skills) requires approx 223 MB
# Here are some measured metrics for the memory footprint of the cache:
#   3035 occupations require approx 223 MB of memory
#   2000 occupations require approx 150 MB of memory
#   1000 occupations require approx 85 MB of memory
#    500 occupations require approx 50 MB of memory
#    100 occupations require approx 25 MB of memory

_skills_of_occupation_cache = AsyncLRUCache(name="Skills of Occupations", max_size=3050)

# The Occupations cache is not required to be large, as it is usually used for exact or regex matches
# for unseen and the microentrepreneurship.
_occupations_cache = AsyncLRUCache(name="Occupations", max_size=10)


async def clear_caches():
    """
    Clear the caches used by the search services.
    """
    await _skills_of_occupation_cache.clear()
    await _occupations_cache.clear()


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
        self._logger = logging.getLogger(self.__class__.__name__)

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
        search_start_time = time.time()
        # Each ESCO entity is duplicated three times, each duplication has a different embedding, one for the
        # preferredLabel, one for the description and one for the altLabels. The search is performed on all three
        # fields, so we need to multiply the number of results by 3 to account for the possible duplication. Those
        # are then grouped by the UUID and the best score is selected. The final number of results is limited to k.
        embedding: list[float]
        if isinstance(query, str):
            stripped_query = query.strip()
            if not stripped_query:
                self._logger.warning("Empty text query received; returning no results without embedding.")
                return []
            embedding = await self.embedding_service.embed(stripped_query)
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
        result = [self._to_entity(entry) for entry in entries]
        search_end_time = time.time()
        self._logger.debug("Search by embeddings took %.2f seconds (db)", search_end_time - search_start_time)
        return result


def _re_flags_to_mongo_options(flags: int) -> str:
    options = ""
    if flags & re.IGNORECASE:
        options += "i"
    if flags & re.MULTILINE:
        options += "m"
    if flags & re.DOTALL:
        options += "s"
    return options


async def watch_db_changes(*, collection: AsyncIOMotorCollection, debouncer: CacheClearDebouncer, logger: logging.Logger):
    try:
        logger.info("Watching database changes for collection: %s", collection.name)
        async with collection.watch() as stream:
            async for change in stream:
                operation = change["operationType"]
                if operation in {"update", "replace", "delete"}:
                    logger.debug("Detected DB change (%s)", operation)
                    await debouncer.schedule_clear()
                else:
                    logger.debug("Ignoring change (%s)", operation)
    except Exception as e:
        logger.error("Error watching database changes: %s", e)


class OccupationSearchService(AbstractEscoSearchService[OccupationEntity]):
    """
    A service class to perform similarity searches on the occupations' collection.
    """

    async def watch_db_changes(self):
        """
        Watch for changes in the "Occupations" collection.
        If there are any changes, clear the caches to ensure that the next search will retrieve the latest data.
        :return:
        """
        await watch_db_changes(
            collection=self.collection,
            debouncer=CacheClearDebouncer(cache=_occupations_cache, logger=self._logger),
            logger=self._logger
        )

    def _group_fields(self) -> dict:
        return {"_id": "$occupationId",
                "modelId": {"$first": "$modelId"},
                "occupationId": {"$first": "$occupationId"},
                "UUID": {"$first": "$UUID"},
                "preferredLabel": {"$first": "$preferredLabel"},
                "description": {"$first": "$description"},
                "scopeNote": {"$first": "$scopeNote"},
                "originUUID": {"$first": "$originUUID"},
                "UUIDHistory": {"$first": "$UUIDHistory"},
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
            originUUID=doc.get("originUUID", ""),
            UUIDHistory=doc.get("UUIDHistory", []),
            altLabels=doc.get("altLabels", []),
            score=doc.get("score", 0.0),
        )

    async def get_by_esco_code(self, *, code: str | re.Pattern) -> list[OccupationEntity]:
        """
        Get occupations by occupation code (supports exact and regex match).

        There may be up to 3 documents for each occupation due to the embedding strategy used.
        This function groups by modelId and code, and returns one document per group.

        :param code: The code of the occupation.
        :return: The OccupationEntity object.
        """
        search_start_time = time.time()

        #  Try cache
        cached_result = await _occupations_cache.get(code if isinstance(code, str) else code.pattern)
        if cached_result is not None:
            self._logger.debug("Search by code took %.2f seconds (cached)", time.time() - search_start_time)
            return cached_result

        # There should be up to 3 entries (one for each embedded field) for each entity,
        # so we group by the modelId and code, and keep the first document for each group.
        query: dict = {
            "modelId": self._model_id
        }
        if isinstance(code, re.Pattern):
            query["code"] = {
                "$regex": code.pattern,
                "$options": _re_flags_to_mongo_options(code.flags)
            }
        else:
            query["code"] = {"$eq": code}

        pipeline = [
            {
                "$match": query
            },
            {
                "$group": {
                    "_id": {
                        "modelId": "$modelId",
                        "code": "$code"
                    },
                    "doc": {"$first": "$$ROOT"}  # Keep the first full document
                }
            },
            {
                "$replaceRoot": {"newRoot": "$doc"}  # Output the document directly
            }
        ]

        docs = await self.collection.aggregate(pipeline).to_list(length=None)
        result = [self._to_entity(doc) for doc in docs if doc]  # transform the documents to OccupationEntity objects

        # Cache the result
        await _occupations_cache.set(code if isinstance(code, str) else code.pattern, result)

        self._logger.debug("Search by code took %.2f seconds (db)", time.time() - search_start_time)
        return result


class SkillSearchService(AbstractEscoSearchService[SkillEntity]):
    """
    A service class to perform similarity searches on the skills' collection.
    """

    def _to_entity(self, doc: dict) -> SkillEntity:
        """
        Convert a Document object to a SkillEntity object.
        """

        skill_id = doc.get("skillId") or doc.get("_id") or doc.get("$skillId") or ""

        return SkillEntity(
            id=str(skill_id),
            modelId=str(doc.get("modelId", "")),
            UUID=doc.get("UUID", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            scopeNote=doc.get("scopeNote", ""),
            originUUID=doc.get("originUUID", ""),
            UUIDHistory=doc.get("UUIDHistory", []),
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
                "originUUID": {"$first": "$originUUID"},
                "UUIDHistory": {"$first": "$UUIDHistory"},
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
        self._logger = logging.getLogger(self.__class__.__name__)

        occupation_vector_search_config = VectorSearchConfig(
            collection_name=self.embedding_config.occupation_collection_name,
            index_name=self.embedding_config.embedding_index,
            embedding_key=self.embedding_config.embedding_key)
        self.occupation_search_service = OccupationSearchService(db, embedding_service, occupation_vector_search_config, taxonomy_model_id)
        self.relations_collection = db.get_collection(self.embedding_config.occupation_to_skill_collection_name)

    async def watch_db_changes(self):
        """
        Watch for changes in the "Relations" and "Occupations" collections.
        If there are any changes, clear the caches to ensure that the next search will retrieve the latest data.
        :return:
        """
        await watch_db_changes(
            collection=self.relations_collection,
            debouncer=CacheClearDebouncer(cache=_skills_of_occupation_cache, logger=self._logger),
            logger=self._logger
        )
        await watch_db_changes(
            collection=self.occupation_search_service.collection,
            debouncer=CacheClearDebouncer(cache=_skills_of_occupation_cache, logger=self._logger),
            logger=self._logger
        )

    async def _find_skills_of_occupation(self, occupation: OccupationEntity):
        """
        Find the skills associated with an occupation.
        :param occupation: The occupation entity.
        :return: A list of SkillEntity objects.
        """
        if occupation.modelId != self._model_id.__str__():
            raise ValueError(f"Occupation {occupation.id} does not belong to the model {self._model_id}")

        #  Try cache
        cached_result = await _skills_of_occupation_cache.get(occupation.id)
        if cached_result is not None:
            return cached_result

        skills = await self.relations_collection.aggregate([
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
                        "originUUID": {"$first": "$skills.originUUID"},
                        "UUIDHistory": {"$first": "$skills.UUIDHistory"},
                        "altLabels": {"$first": "$skills.altLabels"},
                        "skillType": {"$first": "$skills.skillType"},
                        "relationType": {"$first": "$relationType"},
                        "signallingValueLabel": {"$first": "$signallingValueLabel"},
                        }
             }
        ]).to_list(length=None)
        result = [AssociatedSkillEntity(
            id=str(skill.get("skillId", "")),
            modelId=str(skill.get("modelId", "")),
            UUID=skill.get("UUID", ""),
            preferredLabel=skill.get("preferredLabel", ""),
            description=skill.get("description", ""),
            scopeNote=skill.get("scopeNote", ""),
            altLabels=skill.get("altLabels", []),
            skillType=skill.get("skillType", ""),
            originUUID=skill.get("originUUID", ""),
            UUIDHistory=skill.get("UUIDHistory", []),
            relationType=skill.get("relationType", ""),
            signallingValueLabel=skill.get("signallingValueLabel", ""),
            score=0.0
        ) for skill in skills]

        # Cache the result
        await _skills_of_occupation_cache.set(occupation.id, result)
        return result

    async def _retrieve_skills_of_occupations(self, occupations: list[OccupationEntity]) -> List[OccupationSkillEntity]:
        # Retrieve the skills of the given occupations by concurrently searching for each occupation,
        # this is done to speed up the search process.

        search_start_time = time.time()

        async def task(occupation: OccupationEntity) -> OccupationSkillEntity:
            associated_skills = await self._find_skills_of_occupation(occupation)
            return OccupationSkillEntity(occupation=occupation, associated_skills=associated_skills)

        tasks = [task(occupation) for occupation in occupations]
        results = await asyncio.gather(*tasks)
        search_end_time = time.time()
        self._logger.debug("Retrieving skills of occupations took %.2f seconds", search_end_time - search_start_time)
        return results

    async def search(self, *, query: str, filter_spec: FilterSpec = None, k: int = 5) -> list[OccupationSkillEntity]:
        search_start_time = time.time()
        occupations: list[OccupationEntity] = await self.occupation_search_service.search(query=query, filter_spec=filter_spec, k=k)
        occupation_skills: List[OccupationSkillEntity] = await self._retrieve_skills_of_occupations(occupations=occupations)
        search_end_time = time.time()
        self._logger.debug("Search by embeddings took %.2f seconds", search_end_time - search_start_time)
        return occupation_skills

    async def get_by_esco_code(self, *, code: str | re.Pattern) -> list[OccupationSkillEntity]:
        """
        Get an occupation by its ESCO code.
        :param code: The ESCO code of the occupation.
        :return: The OccupationSkillEntity object.
        """
        search_start_time = time.time()
        occupations: list[OccupationEntity] = await self.occupation_search_service.get_by_esco_code(code=code)
        occupation_skills: List[OccupationSkillEntity] = await self._retrieve_skills_of_occupations(occupations=occupations)
        search_end_time = time.time()
        self._logger.debug("Search by esco code took %.2f seconds", search_end_time - search_start_time)
        return occupation_skills
