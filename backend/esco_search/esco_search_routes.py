import os

from fastapi import FastAPI

from app.vector_search.esco_search_serivce import SkillSearchService
from esco_search.database_service import DatabaseService
from esco_search.embeddings.google_gecko.google_gecko import GoogleGeckoConfig, GoogleGecko
from esco_search.occupation_search.occupation_search_routes import add_occupation_search_routes
from esco_search.skill_search.skill_search_routes import add_skills_search_routes

from dotenv import load_dotenv

load_dotenv()

def add_esco_search_routes(app: FastAPI) -> SkillSearchService:
    """
    Temporary function to add the routes for the esco search
    service to the FastAPI app for testing purposes.
    """
    # Embedder route
    google_gecko_config = GoogleGeckoConfig(
        version="latest",
        location="us-central1",
        max_retries=3
    )

    embeddings_service = GoogleGecko.create(google_gecko_config)

    # Add routes relevant for generating embeddings
    # This is a temp route and will be removed in the future.
    @app.get("/embedding/gecko")
    async def _embed_query(query: str):
        embeddings = await embeddings_service.aembed_query(query)
        return {"embedding": embeddings}

    db = DatabaseService.connect_to_sync_mongo_db(os.getenv("MONGO_URI"), "compass-poc")

    # Add routes relevant for skill search
    skill_search_service = add_skills_search_routes(app, db, embeddings_service)

    # Add routes relevant for occupations search
    add_occupation_search_routes(app, db, embeddings_service)

    return skill_search_service
