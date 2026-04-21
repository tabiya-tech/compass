from unittest.mock import AsyncMock, MagicMock

import pytest

from app.jobs.repository import JobRepository


class _AsyncCursor:
    def __init__(self, docs):
        self._docs = docs
        self._index = 0

    def skip(self, _offset):
        return self

    def limit(self, _limit):
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._index]
        self._index += 1
        return doc


class TestJobRepository:
    @pytest.mark.asyncio
    async def test_list_jobs_reads_from_collection_with_projection(self):
        # GIVEN a collection that returns an async cursor
        collection = MagicMock()
        docs = [{"title": "A"}, {"title": "B"}]
        collection.find.return_value = _AsyncCursor(docs)
        repo = JobRepository(collection=collection)

        # WHEN listing jobs
        result = await repo.list_jobs(filter_query={"category": "Engineering"}, offset=10, limit=20)

        # THEN docs are collected and find is called with expected projection
        assert result == docs
        collection.find.assert_called_once_with({"category": "Engineering"}, projection={"_id": 0})

    @pytest.mark.asyncio
    async def test_list_jobs_with_sort_uses_aggregate_pipeline_with_missing_values_last(self):
        # GIVEN a collection that returns an async cursor for aggregate
        collection = MagicMock()
        docs = [{"title": "Analyst"}, {"title": None}]
        collection.aggregate.return_value = _AsyncCursor(docs)
        repo = JobRepository(collection=collection)

        # WHEN listing jobs with sorting
        result = await repo.list_jobs(filter_query={"category": "Engineering"}, offset=5, limit=20, sort_by="title", sort_dir="desc")

        # THEN repository uses an aggregation pipeline with null/empty-last sort semantics
        assert result == docs
        collection.aggregate.assert_called_once()
        pipeline = collection.aggregate.call_args.args[0]
        assert pipeline[0] == {"$match": {"category": "Engineering"}}
        assert pipeline[2] == {"$sort": {"__sort_missing": 1, "__sort_value": -1, "_id": 1}}
        assert pipeline[4] == {"$skip": 5}
        assert pipeline[5] == {"$limit": 21}
        collection.find.assert_not_called()

    @pytest.mark.asyncio
    async def test_count_jobs_delegates_to_collection(self):
        # GIVEN a collection with count_documents
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=42)
        repo = JobRepository(collection=collection)

        # WHEN counting jobs
        total = await repo.count_jobs({"location": "Lusaka"})

        # THEN repository delegates to motor collection
        assert total == 42
        collection.count_documents.assert_awaited_once_with({"location": "Lusaka"})
