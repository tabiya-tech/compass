import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.tool.extract_experience_tool import ExtractExperienceTool
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import VectorSearchConfig, OccupationSearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig

load_dotenv()
MONGO_SETTINGS = MongoDbSettings()


async def _evaluate_with_llm(prompt: str) -> str:
    llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409"))
    return (await llm.generate_content(prompt)).text


@pytest.fixture()
def extract_experience_tool():
    # TODO: Consider mocking some of those dependencies.
    config = VectorSearchConfig(
        collection_name=MONGO_SETTINGS.embedding_settings.occupation_collection_name,
        index_name=MONGO_SETTINGS.embedding_settings.embedding_index,
        embedding_key=MONGO_SETTINGS.embedding_settings.embedding_key,
    )
    compass_db = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(MONGO_SETTINGS.database_name)
    gecko_embedding_service = GoogleGeckoEmbeddingService()
    _occupation_search_service = OccupationSearchService(compass_db, gecko_embedding_service,
                                                         config)
    return ExtractExperienceTool(occupation_search_service=_occupation_search_service)


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_extract_one_simple_experience_simple_reply(extract_experience_tool: ExtractExperienceTool):
    """ Test the extraction of a single experience from a user reply."""
    output = await extract_experience_tool.extract_experience_from_user_reply(
        "I have been working as a baker for 5 years.")
    assert len(output) == 1
    assert output[0].job_title == "Baker"
    assert "baker" in [o.preferredLabel.lower() for o in output[0].esco_occupations]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_extract_multiple_experience_simple_reply(extract_experience_tool: ExtractExperienceTool):
    """ Test the extraction of multiple experiences from a user reply."""
    output = await extract_experience_tool.extract_experience_from_user_reply(
        "I have been working as a baker for 5 years and as a ski instructor in the past 2 years.")
    assert len(output) == 2
    assert output[0].job_title.lower() == "baker"
    assert output[1].job_title.lower() == "ski instructor"
    assert "baker" in [o.preferredLabel.lower() for o in output[0].esco_occupations]
    assert "ski instructor" in [o.preferredLabel.lower() for o in output[1].esco_occupations]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_extract_multiple_experiences_conversation(extract_experience_tool: ExtractExperienceTool):
    """ Test the extraction of multiple experiences from a conversation."""
    output = await extract_experience_tool.extract_experience_from_user_reply(
        """
        User: "Hello."
        LLM: "Hi there! I'm here to help you outline your previous experiences for the job market. This includes paid 
        work, but also unpaid work like caregiving for family or volunteering.  Let's start with your first 
        experience: can you tell me the date and place where you held this position?"
        User: "I was a baker."
        LLM: "Okay, that's great!  Can you tell me the dates you were a baker and the place where you worked?"
        User: ""yes sure, I think that was between February and May 2023 at Chef's Pastries.""
        LLM: "Got it!  Do you have any other past experiences you'd like to share?"
        User: "I was also a ski instructor in the winter"
        LLM: "Okay, great! Can you tell me the dates and location of that position?"
        User: "It was winter 2022 at Mountain's Top."
        LLM: "Excellent. Do you have any other experiences you'd like to share?"
        User: "I helped my sick grandmother."
        LLM: "That's wonderful, and it's definitely worth noting for your resume.  It's important to recognize the 
        value of unpaid work and caregiving!  Do you have any other experiences you'd like to share?"
        User: "No that's it"
        LLM: "Okay, that's great! It sounds like you have a diverse background!  I'll pass your information along to 
        my colleague who will help you identify the skills you've developed from these experiences.  Before I do, 
        would you like to add anything else?"
        User: "No I'm good"
        LLM: "Okay, great! I'll pass your information along to my colleague. They'll help you identify the skills 
        from your experiences.  You'll be hearing from them shortly!"
        """)
    assert len(output) == 3
    assert output[0].job_title.lower() == "baker"
    assert output[1].job_title.lower() == "ski instructor"
    assert output[2].job_title.lower() == "caregiver"
    assert "baker" in [o.preferredLabel.lower() for o in output[0].esco_occupations]
    assert "ski instructor" in [o.preferredLabel.lower() for o in output[1].esco_occupations]
    assert "care at home worker" in [o.preferredLabel.lower() for o in output[2].esco_occupations]
