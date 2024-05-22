from typing import Annotated

from fastapi import FastAPI, Query
from langchain_core.embeddings.embeddings import Embeddings
from pydantic.main import BaseModel
from pymongo.database import Database

from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.esco_search_serivce import OccupationSearchService, VectorSearchConfig


def add_occupation_search_routes(app: FastAPI, db: Database, embedder: Embeddings) -> None:
    """
    Temporary function to add the routes for the occupation search service to the FastAPI app for testing purposes.
    """
    occupation_vector_search_config = VectorSearchConfig(
        embedding_model=embedder,
        collection_name="occupationmodels",
        text_key="all_occupation",
        index_name="all_occupation_gecko_embeddings_vector_index",
        embedding_key="all_occupation_gecko_embeddings",
        relevance_score_fn="cosine"
    )

    occupation_search = OccupationSearchService(db=db, config=occupation_vector_search_config)

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
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of occupations to return")] = 5):
        occupations = await occupation_search.search(query, k=top_k)
        return OccupationsResponse(occupations=occupations)

    @app.get("/search_mmr/occupations",
             response_model=OccupationsResponse,
             description="""
             Semantically search for occupations based on a query using max marginal relevance (MMR) to diversify the search results.
             The search is based on the embeddings of the occupations, and uses
             the cosine similarity to find the most similar occupations.""",
             )
    async def _search_mmr_occupations(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching occupations")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of occupations to return")] = 5,
            fetch_k: Annotated[
                int, Query(ge=1, le=100, description="The number of occupations to pass to the MMR algorithm")] = 100,
            lambda_mult: Annotated[float, Query(ge=0, le=1,
                                                description="""The degree
                            of diversity among the results with 0 corresponding
                            to maximum diversity and 1 to minimum diversity.
                            """)] = 0.5,
    ):
        occupations = await occupation_search.search_mmr(query, k=top_k, fetch_k=fetch_k, lambda_mult=lambda_mult)
        return OccupationsResponse(occupations=occupations)
