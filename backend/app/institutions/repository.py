import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorCollection

# Atlas Search index name — must be created manually in the Atlas UI or via the Atlas Admin API.
# Index definition (create under the institutions collection):
#
# {
#   "mappings": {
#     "dynamic": false,
#     "fields": {
#       "name": [
#         {
#           "type": "autocomplete",
#           "tokenization": "edgeGram",
#           "minGrams": 2,
#           "maxGrams": 15,
#           "foldDiacritics": true
#         },
#         { "type": "string", "analyzer": "lucene.standard" }
#       ],
#       "sectors_covered": { "type": "string", "analyzer": "lucene.standard" },
#       "programmes.name": { "type": "string", "analyzer": "lucene.standard" },
#       "location.province": { "type": "string", "analyzer": "lucene.standard" }
#     }
#   }
# }
_ATLAS_SEARCH_INDEX = "institutions_search"


class IInstitutionRepository(ABC):
    @abstractmethod
    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        offset: int,
        limit: int,
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def count_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> int:
        pass

    @abstractmethod
    async def get_programmes_by_institution(self, institution_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_institution_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        pass


class InstitutionRepository(IInstitutionRepository):
    """Handles MongoDB queries for the institutions collection.

    Keyword search uses Atlas Search ($search aggregation) for fuzzy/autocomplete matching.
    Province and sector filters are applied as post-search $match stages.
    When no keywords are provided, falls back to a regular find() with filter conditions.
    """

    _PROJECTION = {"_id": 0}
    _NAME_ONLY_PROJECTION = {"_id": 0, "name": 1}

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    @staticmethod
    def _build_search_pipeline(
        keywords: str,
        province: Optional[str],
        sector: Optional[str],
        offset: int,
        limit: int,
        name_only: bool,
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Build an aggregation pipeline using Atlas Search for keyword queries.

        Uses autocomplete on the name field (handles partial typing) combined with
        a multi-field text search across sectors and programmes. Results are sorted
        by relevance score so direct name matches surface first.
        """
        # Autocomplete on name handles partial typing ("Evelyn" → "Evelyn Hone College").
        # The compound/should on other fields boosts results that also match sectors or programmes.
        search_stage: Dict[str, Any] = {
            "$search": {
                "index": _ATLAS_SEARCH_INDEX,
                "compound": {
                    "should": [
                        # Autocomplete on name — highest boost, handles partial typing
                        {
                            "autocomplete": {
                                "query": keywords,
                                "path": "name",
                                "fuzzy": {"maxEdits": 1},
                                "score": {"boost": {"value": 5}},
                            }
                        },
                        # Full-text match on name — rewards exact word matches
                        {
                            "text": {
                                "query": keywords,
                                "path": "name",
                                "fuzzy": {"maxEdits": 1},
                                "score": {"boost": {"value": 3}},
                            }
                        },
                        # Broader matches on sectors and programmes (lower boost)
                        {
                            "text": {
                                "query": keywords,
                                "path": ["sectors_covered", "programmes.name"],
                                "fuzzy": {"maxEdits": 1},
                            }
                        },
                    ],
                    "minimumShouldMatch": 1,
                },
            }
        }

        pipeline: List[Dict[str, Any]] = [search_stage]

        # Apply province/sector filters and pilot whitelist exclusion as post-search $match
        post_match: Dict[str, Any] = {}
        if province:
            post_match["location.province"] = {"$regex": province, "$options": "i"}
        if sector:
            post_match["sectors_covered"] = {"$regex": sector, "$options": "i"}
        if exclude_reg_nos:
            post_match["reg_no"] = {"$nin": exclude_reg_nos}
        if post_match:
            pipeline.append({"$match": post_match})

        # Pagination
        if offset:
            pipeline.append({"$skip": offset})
        pipeline.append({"$limit": limit + 1})  # +1 to detect has_more

        # Projection
        project_fields = {"_id": 0, "name": 1} if name_only else {"_id": 0}
        pipeline.append({"$project": project_fields})

        return pipeline

    @staticmethod
    def _build_filter(
        province: Optional[str],
        sector: Optional[str],
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build a plain MongoDB filter for province/sector and pilot exclusions (no-keyword path)."""
        conditions: List[Dict[str, Any]] = []
        if province:
            conditions.append({"location.province": {"$regex": province, "$options": "i"}})
        if sector:
            conditions.append({"sectors_covered": {"$regex": sector, "$options": "i"}})
        if exclude_reg_nos:
            conditions.append({"reg_no": {"$nin": exclude_reg_nos}})
        if len(conditions) == 1:
            return conditions[0]
        if len(conditions) > 1:
            return {"$and": conditions}
        return {}

    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        offset: int,
        limit: int,
        name_only: bool = False,
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        if keywords and keywords.strip():
            pipeline = self._build_search_pipeline(
                keywords=keywords.strip(),
                province=province,
                sector=sector,
                offset=offset,
                limit=limit,
                name_only=name_only,
                exclude_reg_nos=exclude_reg_nos,
            )
            cursor = self._collection.aggregate(pipeline)
            return [doc async for doc in cursor]

        # No keywords — plain find() with optional province/sector filters
        query = self._build_filter(province, sector, exclude_reg_nos=exclude_reg_nos)
        projection = self._NAME_ONLY_PROJECTION if name_only else self._PROJECTION
        cursor = self._collection.find(query, projection=projection).skip(offset).limit(limit + 1)
        return [doc async for doc in cursor]

    async def count_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        exclude_reg_nos: Optional[List[str]] = None,
    ) -> int:
        if keywords and keywords.strip():
            # Use Atlas Search pipeline with $count instead of $limit
            pipeline = self._build_search_pipeline(
                keywords=keywords.strip(),
                province=province,
                sector=sector,
                offset=0,
                limit=10_000,  # generous upper bound for count
                name_only=False,
                exclude_reg_nos=exclude_reg_nos,
            )
            # Replace the $limit stage with a $count stage
            pipeline = [s for s in pipeline if "$limit" not in s and "$skip" not in s]
            pipeline.append({"$count": "total"})
            cursor = self._collection.aggregate(pipeline)
            result = await cursor.to_list(length=1)
            return result[0]["total"] if result else 0

        query = self._build_filter(province, sector, exclude_reg_nos=exclude_reg_nos)
        return await self._collection.count_documents(query)

    async def get_programmes_by_institution(self, institution_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single institution by reg_no, returning only its name and programmes."""
        doc = await self._collection.find_one(
            {"reg_no": institution_id},
            projection={"_id": 0, "name": 1, "reg_no": 1, "programmes": 1},
        )
        return doc

    async def get_institution_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Fetch a single institution by exact name, returning only its name and programmes."""
        doc = await self._collection.find_one(
            {"name": name},
            projection={"_id": 0, "name": 1, "reg_no": 1, "programmes": 1},
        )
        return doc
