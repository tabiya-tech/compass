import logging

import pytest

from app.countries import Country
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.work_type import WorkType
from app.agent.infer_occupation_tool.infer_occupation_tool import InferOccupationTool
from app.server_dependecies.db_dependecies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService


def get_test_cases():
    return [
        (
            ExperienceEntity(
                experience_title="Software Engineer",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                company="Google",
                location="Cape Town",
            ),
            Country.SOUTH_AFRICA,
            True,
        ),
        (
            ExperienceEntity(
                experience_title="I sell kota to the local community",
                work_type=WorkType.SELF_EMPLOYMENT,
                company="",
                location="downtown",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        (
            ExperienceEntity(
                experience_title="I make bunny chow",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                company="Hungry Lion",
                location="uptown",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        (
            ExperienceEntity(
                experience_title="I make bunny chow",
                work_type=WorkType.SELF_EMPLOYMENT,
                company="Hungry Tiger",
                location="uptown",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        (
            ExperienceEntity(
                experience_title="Help sick parents",
                work_type=WorkType.UNSEEN_UNPAID,
                company="",
                location="home",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        (
            ExperienceEntity(
                experience_title="GDE Brigade member",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                company="School",
                location="Gauteng Province",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        (
            ExperienceEntity(
                experience_title="I braid hair of my friends",
                work_type=WorkType.UNSEEN_UNPAID,
                company="home",
                location="Pretoria",
            ),
            Country.SOUTH_AFRICA,
            False,
        ),
        # Add more test cases as needed
    ]


@pytest.fixture(scope="function")
def setup_agent_tool():
    db = get_mongo_db()
    embedding_service = GoogleGeckoEmbeddingService()
    search_service = OccupationSkillSearchService(db, embedding_service)
    tool = InferOccupationTool(search_service)
    return tool


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "given_experience, given_country_of_interest,  expected_same_title", get_test_cases(),
    ids=[f"{index} -  {case[0].experience_title}" for index, case in enumerate(get_test_cases())])
async def test_occupation_inference_tool(given_experience,
                                         given_country_of_interest,
                                         expected_same_title,
                                         setup_agent_tool):
    tool = setup_agent_tool
    # GIVEN an experience and a country of interest
    # AND a top_k value
    given_top_k = 5
    # WHEN the tool is executed with the given experience and country

    result = await tool.execute(given_country_of_interest, given_experience, top_k=given_top_k)
    logging.log(logging.INFO, "Given Title '%s' -> Contextualized Title '%s'", given_experience.experience_title,
                result.contextualized_title)
    # THEN the result should contain a contextualized title
    assert len(result.contextualized_title) > 0

    if expected_same_title:
        # AMD the contextualized title should be the same as the given experience title
        assert result.contextualized_title == given_experience.experience_title
        # AND a list of ESCO occupations is equal to the top_k value
        assert len(result.esco_occupations) == given_top_k
    else:
        # AMD the contextualized title should be different from the given experience title
        assert result.contextualized_title != given_experience.experience_title
        # AND a list of ESCO occupations is between given_top_k and 2*given_top_k
        # depending on the search results for each title
        assert len(result.esco_occupations) >= given_top_k
        assert len(result.esco_occupations) <= 2 * given_top_k

    # log the preferred labels of the occupations
    labels = []
    for skill_occupation in result.esco_occupations:
        labels.append(skill_occupation.occupation.preferredLabel)
    logging.log(logging.INFO, "Liked to ESCO Occupation: \n -%s", "\n -".join(labels))
