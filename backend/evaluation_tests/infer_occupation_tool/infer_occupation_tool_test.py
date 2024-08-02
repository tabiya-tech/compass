import logging

import pytest

from app.agent.infer_occupation_tool.infer_occupation_tool import InferOccupationTool
from app.server_dependecies.db_dependecies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService
from .test_occupation_inference_test_case import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.infer_occupation_tool.test_occupation_inference_test_case import InferOccupationToolTestCase


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
    "test_case", get_test_cases_to_run(test_cases),
    ids=[f"{index} - {case.name} - {case.given_experience.experience_title}" for index, case in enumerate(get_test_cases_to_run(test_cases))])
async def test_occupation_inference_tool(test_case: InferOccupationToolTestCase, setup_agent_tool):
    tool = setup_agent_tool
    # GIVEN an experience and a country of interest
    # AND a top_k value
    given_top_k = 5
    # WHEN the tool is executed with the given experience and country

    result = await tool.execute(test_case.given_country_of_interest, test_case.given_experience, top_k=given_top_k)
    logging.log(logging.INFO, "Given Title '%s' -> Contextualized Title '%s'", test_case.given_experience.experience_title,
                result.contextualized_title)
    # THEN the result should contain a contextualized title
    assert len(result.contextualized_title) > 0

    if test_case.expected_same_title:
        # AMD the contextualized title should be the same as the given experience title
        assert result.contextualized_title == test_case.given_experience.experience_title
        # AND a list of ESCO occupations is equal to the top_k value
        assert len(result.esco_occupations) == given_top_k
    else:
        # AMD the contextualized title should be different from the given experience title
        assert result.contextualized_title != test_case.given_experience.experience_title
        # AND a list of ESCO occupations is between given_top_k and 2*given_top_k
        # depending on the search results for each title
        assert len(result.esco_occupations) >= given_top_k
        assert len(result.esco_occupations) <= 2 * given_top_k

    # expected_occupations_found should be a subset of the preferred labels of the occupations
    labels = [skill_occupation.occupation.preferredLabel for skill_occupation in result.esco_occupations]
    logging.log(logging.INFO, "Found ESCO Occupations: \n -%s", "\n -".join(labels))
    assert set(test_case.expected_occupations_found).issubset(labels)
