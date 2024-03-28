from typing import Annotated

from fastapi import FastAPI, Query
from langchain_core.embeddings.embeddings import Embeddings
from pydantic.main import BaseModel
from pymongo.database import Database

from esco_search.esco_abs_search_service import VectorSearchConfig
from esco_search.skill_search.skill_search_service import SkillSearchService, SkillEntity


def add_skills_search_routes(app: FastAPI, db: Database, embedder: Embeddings) -> SkillSearchService:
    skill_vector_search_config = VectorSearchConfig(
        embedding_model=embedder,
        collection_name="skillmodels",
        text_key="all_skill",
        index_name="all_skill_gecko_embeddings_vector_index",
        embedding_key="all_skill_gecko_embeddings",
        relevance_score_fn="cosine"
    )

    skill_search_service = SkillSearchService(db=db, config=skill_vector_search_config)

    class SkillsResponse(BaseModel):
        skills: list[SkillEntity]

    # Add routes relevant for skills search
    @app.get("/search/skills",
             response_model=SkillsResponse,
             description="""
             Semantically search for skills based on a query. The search is based on the embeddings of the skills, and uses
             the cosine similarity to find the most similar skills.""",
             )
    async def search_skills(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching skills")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of skills to return")] = 5):
        skills = await skill_search_service.search(query, k=top_k)
        return SkillsResponse(skills=skills)

    @app.get("/search_mmr/skills",
             response_model=SkillsResponse,
             description="""
             Semantically search for skills based on a query using max marginal relevance (MMR) to diversify the search results.  
             The search is based on the embeddings of the skills, and uses
             the cosine similarity to find the most similar skills.""",
             )
    async def search_mmr_skills(
            query: Annotated[str, Query(max_length=3000, description="The text to search for matching skills")],
            top_k: Annotated[int, Query(ge=1, le=100, description="The number of skills to return")] = 5,
            fetch_k: Annotated[
                int, Query(ge=1, le=100, description="The number of skills to pass to the MMR algorithm")] = 100,
            lambda_mult: Annotated[float, Query(ge=0, le=1,
                                                description="""The degree
                        of diversity among the results with 0 corresponding
                        to maximum diversity and 1 to minimum diversity.
                        """)] = 0.5,
    ):
        skills = await skill_search_service.search_mmr(query, k=top_k, fetch_k=fetch_k, lambda_mult=lambda_mult)
        return SkillsResponse(skills=skills)

    return skill_search_service
