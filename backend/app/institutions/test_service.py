from http import HTTPStatus
from typing import Any, Dict, List, Optional

import pytest
from fastapi import HTTPException

from app.institutions.repository import IInstitutionRepository
from app.institutions.service import InstitutionService

_SAMPLE_INSTITUTION = {
    "name": "Test College",
    "reg_no": "TVA/001",
    "province": "Lusaka",
    "sectors_covered": ["ICT"],
    "location": {"province": "Lusaka", "address": "123 Main St"},
    "programmes": [
        {"name": "Web Development", "qualification_type": "Certificate (Level 3)", "zqf_level": "3", "sectors": ["ICT"]}
    ],
}


class _FakeInstitutionRepository(IInstitutionRepository):
    def __init__(self, docs: List[Dict[str, Any]], total: int = 0):
        self._docs = docs
        self._total = total
        self.search_called_with: Optional[Dict[str, Any]] = None
        self.count_called = False

    async def search_institutions(self, keywords, province, sector, offset, limit, name_only=False):
        self.search_called_with = {"keywords": keywords, "province": province, "sector": sector, "offset": offset, "limit": limit, "name_only": name_only}
        return self._docs

    async def count_institutions(self, keywords, province, sector):
        self.count_called = True
        return self._total

    async def get_programmes_by_institution(self, institution_id: str):
        return next((d for d in self._docs if d.get("reg_no") == institution_id), None)

    async def get_institution_by_name(self, name: str):
        return next((d for d in self._docs if d.get("name") == name), None)


class TestInstitutionService:
    @pytest.mark.asyncio
    async def test_search_returns_paginated_results(self):
        # GIVEN three docs but limit=2 → has_more=True
        docs = [_SAMPLE_INSTITUTION.copy(), _SAMPLE_INSTITUTION.copy(), _SAMPLE_INSTITUTION.copy()]
        repo = _FakeInstitutionRepository(docs=docs, total=100)
        service = InstitutionService(repository=repo)

        result = await service.search_institutions(
            keywords="development",
            province="Lusaka",
            sector=None,
            cursor=None,
            limit=2,
            include="count",
        )

        assert len(result.data) == 2
        assert result.meta.has_more is True
        assert result.meta.next_cursor == "2"
        assert result.meta.total == 100
        assert repo.count_called is True
        assert repo.search_called_with["keywords"] == "development"
        assert repo.search_called_with["province"] == "Lusaka"

    @pytest.mark.asyncio
    async def test_search_without_count_skips_count_query(self):
        repo = _FakeInstitutionRepository(docs=[_SAMPLE_INSTITUTION.copy()], total=50)
        service = InstitutionService(repository=repo)

        result = await service.search_institutions(
            keywords=None, province=None, sector=None, cursor=None, limit=20, include=None
        )

        assert repo.count_called is False
        assert result.meta.total is None
        assert result.meta.has_more is False

    @pytest.mark.asyncio
    async def test_search_with_invalid_cursor_raises_400(self):
        repo = _FakeInstitutionRepository(docs=[], total=0)
        service = InstitutionService(repository=repo)

        with pytest.raises(HTTPException) as exc_info:
            await service.search_institutions(
                keywords=None, province=None, sector=None, cursor="bad", limit=10, include=None
            )

        assert exc_info.value.status_code == HTTPStatus.BAD_REQUEST

    @pytest.mark.asyncio
    async def test_get_programmes_returns_programmes(self):
        repo = _FakeInstitutionRepository(docs=[_SAMPLE_INSTITUTION.copy()])
        service = InstitutionService(repository=repo)

        result = await service.get_programmes_by_institution("TVA/001")

        assert result.name == "Test College"
        assert result.reg_no == "TVA/001"
        assert len(result.programmes) == 1
        assert result.programmes[0].name == "Web Development"

    @pytest.mark.asyncio
    async def test_get_programmes_not_found_raises_404(self):
        repo = _FakeInstitutionRepository(docs=[])
        service = InstitutionService(repository=repo)

        with pytest.raises(HTTPException) as exc_info:
            await service.get_programmes_by_institution("NONEXISTENT")

        assert exc_info.value.status_code == HTTPStatus.NOT_FOUND
