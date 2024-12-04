import json
import logging
import random

import pytest

from app.agent.linking_and_ranking_pipeline.infer_icatus_activities import InferIcatusActivitiesTool
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService
from app.vector_search.settings import VectorSearchSettings
from .test_icatus_inference_test_case import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.linking_and_ranking_pipeline.infer_occupation_tool.test_occupation_inference_test_case import InferOccupationToolTestCase


@pytest.fixture(scope="function")
async def setup_agent_tool():
    db = await CompassDBProvider.get_taxonomy_db()
    settings = VectorSearchSettings()
    embedding_service = GoogleGeckoEmbeddingService()
    search_service = OccupationSkillSearchService(db, embedding_service, settings)
    tool = InferIcatusActivitiesTool(search_service)
    return tool


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case", get_test_cases_to_run(test_cases),
    ids=[f"{index} - {case.name} - {case.given_experience_title}" for index, case in enumerate(get_test_cases_to_run(test_cases))])
async def test_occupation_inference_tool(test_case: InferOccupationToolTestCase, setup_agent_tool):
    tool = await setup_agent_tool
    # GIVEN an experience and a country of interest
    # shuffle the responsibilities to ensure the test is not dependent on the order of the responsibilities
    random.shuffle(test_case.given_responsibilities)
    # WHEN the tool is executed with the given experience and country

    result = await tool.execute(
        experience_title=test_case.given_experience_title,
        company=test_case.given_company,
        work_type=test_case.given_work_type,
        responsibilities=test_case.given_responsibilities,
        country_of_interest=test_case.given_country_of_interest,
        top_k=test_case.given_top_k,
        top_p=test_case.given_top_p,
        number_of_titles=test_case.number_of_titles
    )
    logging.log(logging.INFO, "Given Title '%s' -> Contextual Titles: %s", test_case.given_experience_title,
                json.dumps(result.contextual_titles))

    occupations = [{"title": skill_occupation.occupation.preferredLabel, "description": skill_occupation.occupation.description} for skill_occupation in
                   result.esco_occupations]
    logging.log(logging.INFO, "Found ESCO Occupations(preferredLabel,code): \n -%s", json.dumps(occupations))
    # expected_occupations_found should be a subset of the preferred labels of the occupations
    labels = [skill_occupation.occupation.preferredLabel for skill_occupation in result.esco_occupations]
    logging.log(logging.INFO, "Found ESCO Occupations: \n -%s", "\n -".join(labels))
    assert set(test_case.expected_occupations_found).issubset(labels)
