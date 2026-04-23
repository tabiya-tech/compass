import asyncio
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from typing import Any, Dict, Optional

from fastapi import HTTPException
from app.analytics.types import PaginatedListMeta, PaginatedListResponse
from app.jobs.repository import IJobRepository
from pydantic import BaseModel


class JobStats(BaseModel):
    total: int
    sectors: int
    platforms: int


class IJobService(ABC):
    """
    Interface for the Job Service.
    Allows to mock the service in tests.
    """

    @abstractmethod
    async def get_job_stats(self) -> JobStats:
        pass

    @abstractmethod
    async def list_jobs(
        self,
        search: Optional[str],
        category: Optional[str],
        employment_type: Optional[str],
        location: Optional[str],
        days: Optional[int],
        page: Optional[int],
        cursor: Optional[str],
        limit: int,
        sort_by: Optional[str],
        sort_dir: str,
        include: Optional[str],
    ) -> PaginatedListResponse["JobDocument"]:
        pass


class JobDocument(BaseModel):
    model_config = {"extra": "ignore"}

    title: Optional[str] = None
    employer: Optional[str] = None
    category: Optional[str] = None
    employment_type: Optional[str] = None
    location: Optional[str] = None
    posted_date: Optional[str] = None
    closing_date: Optional[str] = None
    application_url: Optional[str] = None
    source_platform: Optional[str] = None
    skills: Optional[list[str]] = None


class JobService(IJobService):
    """
    JobService class is responsible for business logic related to jobs.
    """

    def __init__(self, repository: IJobRepository):
        self._repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)

    @staticmethod
    def _case_insensitive_space_tolerant_match(value: str) -> Dict[str, str]:
        normalized_tokens = [re.escape(token) for token in value.strip().split() if token]
        pattern = ".*".join(normalized_tokens) if normalized_tokens else re.escape(value)
        return {"$regex": pattern, "$options": "i"}

    @staticmethod
    def _build_jobs_mongo_filter(
        search: Optional[str],
        category: Optional[str],
        employment_type: Optional[str],
        location: Optional[str],
        days: Optional[int],
    ) -> Dict[str, Any]:
        fquery: Dict[str, Any] = {}
        if search:
            fquery["title"] = {"$regex": re.escape(search), "$options": "i"}
        if category:
            fquery["category"] = JobService._case_insensitive_space_tolerant_match(category)
        if employment_type:
            fquery["employment_type"] = employment_type
        if location:
            fquery["location"] = JobService._case_insensitive_space_tolerant_match(location)
        if days is not None:
            cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
            fquery["posted_date"] = {"$gte": cutoff_date}
        return fquery

    @staticmethod
    def _parse_cursor_offset(cursor: Optional[str]) -> int:
        if cursor is None:
            return 0
        try:
            return int(cursor)
        except ValueError as exc:
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid cursor") from exc

    @staticmethod
    def _include_total(include: Optional[str]) -> bool:
        return include is not None and "count" in include.split(",")

    async def get_job_stats(self) -> JobStats:
        total, sectors, platforms = await asyncio.gather(
            self._repository.count_jobs({}),
            self._repository.distinct_values("category", {}),
            self._repository.distinct_values("source_platform", {}),
        )
        return JobStats(total=total, sectors=len(sectors), platforms=len(platforms))

    @staticmethod
    def _extract_skills(doc: Dict[str, Any]) -> Optional[list[str]]:
        """Extract unique skill labels from classification.entities."""
        try:
            entities = doc.get("classification", {}).get("entities", [])
            seen: set[str] = set()
            skills: list[str] = []
            for entity in entities:
                if entity.get("entity_type") != "skill":
                    continue
                linked = entity.get("linked_entities", [])
                label = linked[0]["label"] if linked else entity.get("surface_form", "")
                if label and label not in seen:
                    seen.add(label)
                    skills.append(label)
            return skills if skills else None
        except Exception:
            return None

    async def list_jobs(
        self,
        search: Optional[str],
        category: Optional[str],
        employment_type: Optional[str],
        location: Optional[str],
        days: Optional[int],
        page: Optional[int],
        cursor: Optional[str],
        limit: int,
        sort_by: Optional[str],
        sort_dir: str,
        include: Optional[str],
    ) -> PaginatedListResponse[JobDocument]:
        filter_query = self._build_jobs_mongo_filter(search, category, employment_type, location, days)
        include_count = self._include_total(include) or page is not None
        if page is not None:
            if page < 1:
                raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid page")
            offset = (page - 1) * limit
        else:
            offset = self._parse_cursor_offset(cursor)

        docs = await self._repository.list_jobs(
            filter_query=filter_query,
            offset=offset,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

        has_more = len(docs) > limit
        page_docs = docs[:limit]
        next_cursor = str(offset + limit) if has_more else None

        job_documents = []
        for doc in page_docs:
            job_doc = JobDocument.model_validate(doc)
            if job_doc.skills is None:
                job_doc.skills = self._extract_skills(doc)
            job_documents.append(job_doc)

        total = await self._repository.count_jobs(filter_query) if include_count else None
        meta = PaginatedListMeta(
            limit=limit,
            next_cursor=next_cursor,
            has_more=has_more,
            total=total if include_count else None,
        )
        return PaginatedListResponse(data=job_documents, meta=meta)
