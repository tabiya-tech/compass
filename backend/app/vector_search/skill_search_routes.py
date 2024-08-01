import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic.main import BaseModel

from app.vector_search.esco_entities import SkillEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.vector_search_dependencies import get_skill_search_service

logger = logging.getLogger(__name__)


def add_skill_search_routes(app: APIRouter) -> None:
    """
    Temporary function to add the routes for the skill search service to the FastAPI app for testing purposes.
    """

    class SkillsResponse(BaseModel):
        """
        The response model for the skills search endpoint.
        """
        skills: list[SkillEntity]

    # Add routes relevant for skills search
    @app.get("/search/skills",
             response_model=SkillsResponse,
             description="""
             Semantically search for skills based on a query. The search is based on the embeddings of the skills, 
             and uses the cosine similarity to find the most similar skills.""",
             )
    async def _search_skills(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching skills")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of skills to return")] = 5,
            skill_service: SimilaritySearchService[SkillEntity] = Depends(get_skill_search_service)):
        try:
            skills = await skill_service.search(query=query, k=top_k)
            return SkillsResponse(skills=skills)
        except Exception as e:
            logger.exception(e)
            return {"error": str(e)}
