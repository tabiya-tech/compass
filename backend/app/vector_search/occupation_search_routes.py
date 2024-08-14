import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic.main import BaseModel

from app.vector_search.esco_entities import OccupationEntity, OccupationSkillEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.vector_search_dependencies import get_occupation_search_service, get_occupation_skill_search_service

logger = logging.getLogger(__name__)


def add_occupation_search_routes(app: APIRouter) -> None:
    """ Add the occupation search routes to the FastAPI app."""

    class OccupationsResponse(BaseModel):
        """
        The response model for the occupations search endpoint.
        """
        occupations: list[OccupationEntity]

    @app.get("/search/occupations",
             response_model=OccupationsResponse,
             description="""
             Semantically search for occupations based on a query. 
             The search is based on the embeddings of the occupations, and uses
             the cosine similarity to find the most similar occupations.""",
             )
    async def _search_occupations(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching occupations")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of occupations to return")] = 5,
            occupation_service: SimilaritySearchService[OccupationEntity] = Depends(get_occupation_search_service)):
        try:
            occupations = await occupation_service.search(query=query, k=top_k)
            return OccupationsResponse(occupations=occupations)
        except Exception as e:
            logger.exception(e)
            return {"error": str(e)}

    class OccupationsSkillsResponse(BaseModel):
        """
        The response model for the occupations search endpoint.
        """
        occupations_skills: list[OccupationSkillEntity]

    @app.get("/search/occupations-skills",
             response_model=OccupationsSkillsResponse,
             description="""
             Semantically search for occupations based on a query. 
             The search is based on the embeddings of the occupations, and uses
             the cosine similarity to find the most similar occupations.""",
             )
    async def _search_occupations(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching occupations")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of occupations to return")] = 5,
            occupation_skill_service: SimilaritySearchService[OccupationSkillEntity] = Depends(get_occupation_skill_search_service)):
        try:
            occupations_skills = await occupation_skill_service.search(query=query, k=top_k)
            return OccupationsSkillsResponse(occupations_skills=occupations_skills)
        except Exception as e:
            logger.exception(e)
            return {"error": str(e)}
