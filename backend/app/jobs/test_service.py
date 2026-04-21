from http import HTTPStatus
from typing import Any, Dict, List, Optional

import pytest
from fastapi import HTTPException

from app.jobs.repository import IJobRepository
from app.jobs.service import JobService


class _FakeJobRepository(IJobRepository):
    def __init__(self, docs: List[Dict[str, Any]], total: int):
        self._docs = docs
        self._total = total
        self.last_filter_query: Optional[Dict[str, Any]] = None
        self.last_offset: Optional[int] = None
        self.last_limit: Optional[int] = None
        self.count_called = False

    async def list_jobs(
        self,
        filter_query: Dict[str, Any],
        offset: int,
        limit: int,
        sort_by: Optional[str] = None,
        sort_dir: str = "asc",
    ) -> List[Dict[str, Any]]:
        self.last_filter_query = filter_query
        self.last_offset = offset
        self.last_limit = limit
        return self._docs

    async def count_jobs(self, filter_query: Dict[str, Any]) -> int:
        self.count_called = True
        return self._total

    async def distinct_values(self, field: str, filter_query: Dict[str, Any]) -> List[str]:
        return []


class TestJobService:
    @pytest.mark.asyncio
    async def test_list_jobs_returns_paginated_meta(self):
        # GIVEN docs with one extra record beyond limit
        given_docs = [{"title": "A"}, {"title": "B"}, {"title": "C"}]
        repo = _FakeJobRepository(docs=given_docs, total=999)
        service = JobService(repository=repo)

        # WHEN list_jobs is called with limit=2 and include=count
        result = await service.list_jobs(
            search=None,
            category="Engineering",
            employment_type="Full-time",
            location="Lusaka",
            days=7,
            cursor="3",
            limit=2,
            sort_by=None,
            sort_dir="asc",
            include="count",
        )

        # THEN filter, paging, and count metadata are correct
        assert repo.last_filter_query is not None
        assert repo.last_filter_query["category"] == {"$regex": "Engineering", "$options": "i"}
        assert repo.last_filter_query["employment_type"] == "Full-time"
        assert repo.last_filter_query["location"] == {"$regex": "Lusaka", "$options": "i"}
        assert "posted_date" in repo.last_filter_query
        assert repo.last_offset == 3
        assert repo.last_limit == 2

        assert len(result.data) == 2
        assert result.meta.limit == 2
        assert result.meta.has_more is True
        assert result.meta.next_cursor == "5"
        assert result.meta.total == 999
        assert repo.count_called is True

    @pytest.mark.asyncio
    async def test_list_jobs_without_count_does_not_call_count(self):
        # GIVEN docs not exceeding page limit
        given_docs = [{"title": "A"}]
        repo = _FakeJobRepository(docs=given_docs, total=123)
        service = JobService(repository=repo)

        # WHEN include=count is not requested
        result = await service.list_jobs(
            search=None,
            category=None,
            employment_type=None,
            location=None,
            days=None,
            cursor=None,
            limit=20,
            sort_by=None,
            sort_dir="asc",
            include=None,
        )

        # THEN total is omitted and count is not called
        assert repo.count_called is False
        assert result.meta.total is None
        assert result.meta.has_more is False
        assert result.meta.next_cursor is None

    @pytest.mark.asyncio
    async def test_list_jobs_builds_case_insensitive_space_tolerant_filters(self):
        # GIVEN category/location queries with mixed case and extra spaces
        repo = _FakeJobRepository(docs=[], total=0)
        service = JobService(repository=repo)

        # WHEN list_jobs is called
        await service.list_jobs(
            search=None,
            category="accounting   auditing",
            employment_type=None,
            location="ka fue",
            days=None,
            cursor=None,
            limit=20,
            sort_by=None,
            sort_dir="asc",
            include=None,
        )

        # THEN filters support partial matching and spacing tolerance
        assert repo.last_filter_query is not None
        assert repo.last_filter_query["category"] == {"$regex": "accounting.*auditing", "$options": "i"}
        assert repo.last_filter_query["location"] == {"$regex": "ka.*fue", "$options": "i"}

    @pytest.mark.asyncio
    async def test_list_jobs_with_invalid_cursor_raises_400(self):
        # GIVEN a non-numeric cursor
        repo = _FakeJobRepository(docs=[], total=0)
        service = JobService(repository=repo)

        # WHEN list_jobs is called
        with pytest.raises(HTTPException) as exc_info:
            await service.list_jobs(
                search=None,
                category=None,
                employment_type=None,
                location=None,
                days=None,
                cursor="not-a-number",
                limit=20,
                sort_by=None,
                sort_dir="asc",
                include=None,
            )

        # THEN HTTP 400 is raised
        assert exc_info.value.status_code == HTTPStatus.BAD_REQUEST
        assert exc_info.value.detail == "Invalid cursor"
