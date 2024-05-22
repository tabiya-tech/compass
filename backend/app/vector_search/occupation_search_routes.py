from typing import Annotated

from fastapi import FastAPI, Depends, Query
from pydantic.main import BaseModel

from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.vector_search_dependencies import get_occupation_search_service


def add_occupation_search_routes(app: FastAPI) -> None:
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
        occupations = await occupation_service.search(query, k=top_k)
        return OccupationsResponse(occupations=occupations)
