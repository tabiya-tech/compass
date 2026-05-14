import logging
from abc import ABC, abstractmethod
from http import HTTPStatus
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel

from app.analytics.types import PaginatedListMeta, PaginatedListResponse
from app.institutions.repository import IInstitutionRepository
from app.institutions.types import InstitutionDocument, Programme
from app.user_institution_assignment.pilot_whitelist_repository import IPilotWhitelistRepository


class InstitutionProgrammes(BaseModel):
    """Response model for programmes-by-institution endpoint."""

    name: str
    reg_no: Optional[str] = None
    programmes: Optional[list[Programme]] = None


class IInstitutionService(ABC):
    @abstractmethod
    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        cursor: Optional[str],
        limit: int,
        include: Optional[str],
        name_only: bool = False,
    ) -> PaginatedListResponse[InstitutionDocument]:
        pass

    @abstractmethod
    async def get_programmes_by_institution(
        self, institution_id: str, caller_assigned: bool = False
    ) -> InstitutionProgrammes:
        pass


class InstitutionService(IInstitutionService):
    """Business logic for institutions."""

    def __init__(self, repository: IInstitutionRepository, whitelist_repository: IPilotWhitelistRepository):
        self._repository = repository
        self._whitelist_repository = whitelist_repository
        self._logger = logging.getLogger(self.__class__.__name__)

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

    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        cursor: Optional[str],
        limit: int,
        include: Optional[str],
        name_only: bool = False,
    ) -> PaginatedListResponse[InstitutionDocument]:
        offset = self._parse_cursor_offset(cursor)
        include_count = self._include_total(include)

        exclude_reg_nos = await self._whitelist_repository.get_whitelisted_reg_nos()

        docs = await self._repository.search_institutions(
            keywords=keywords,
            province=province,
            sector=sector,
            offset=offset,
            limit=limit,
            name_only=name_only,
            exclude_reg_nos=exclude_reg_nos or None,
        )

        has_more = len(docs) > limit
        page_docs = docs[:limit]
        next_cursor = str(offset + limit) if has_more else None

        institutions = [InstitutionDocument.model_validate(doc) for doc in page_docs]

        total = (
            await self._repository.count_institutions(keywords, province, sector, exclude_reg_nos=exclude_reg_nos or None)
            if include_count
            else None
        )
        meta = PaginatedListMeta(
            limit=limit,
            next_cursor=next_cursor,
            has_more=has_more,
            total=total,
        )
        return PaginatedListResponse(data=institutions, meta=meta)

    async def get_programmes_by_institution(
        self, institution_id: str, caller_assigned: bool = False
    ) -> InstitutionProgrammes:
        """
        Returns programmes for an institution.

        If the institution is whitelisted (pilot), it is only accessible when
        caller_assigned=True. The route layer is responsible for determining this
        by checking the caller's email against the user_institution_assignment collection.
        """
        doc = await self._repository.get_programmes_by_institution(institution_id)
        if doc is None:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Institution with reg_no '{institution_id}' not found",
            )
        doc_reg_no = doc.get("reg_no", "")
        if doc_reg_no and await self._whitelist_repository.is_whitelisted_by_reg_no(doc_reg_no) and not caller_assigned:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Institution with reg_no '{institution_id}' not found",
            )
        return InstitutionProgrammes.model_validate(doc)
