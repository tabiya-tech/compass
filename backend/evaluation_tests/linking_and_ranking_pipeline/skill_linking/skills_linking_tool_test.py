import logging
from typing import Optional

import pytest

from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.agent.linking_and_ranking_pipeline.skill_linking_tool import SkillLinkingTool
from app.countries import Country
from app.server_dependecies.db_dependecies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.esco_search_service import OccupationSearchService, OccupationSkillSearchService, VectorSearchConfig, SkillSearchService
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.environment_settings.constants import EmbeddingConfig
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope='function')
async def get_search_services():
    db = await CompassDBProvider.get_taxonomy_db()
    embedding_service = GoogleGeckoEmbeddingService()
    occupation_skill_search_service = OccupationSkillSearchService(db, embedding_service)
    embedding_config = EmbeddingConfig()
    occupation_search_service = OccupationSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.occupation_to_skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ))
    skill_search_service = SkillSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ))
    search_services = SearchServices(
        occupation_search_service=occupation_search_service,
        skill_search_service=skill_search_service,
        occupation_skill_search_service=occupation_skill_search_service
    )

    return search_services


class SkillLinkingToolTestCase(CompassTestCase):
    given_occupation_code: Optional[str] = None
    given_occupation_title: Optional[str] = None
    given_responsibilities: list[str]
    given_work_type: WorkType
    expected_skills: list[str]


test_cases = [
    SkillLinkingToolTestCase(
        name="Baker by code",
        given_occupation_code="7512.1",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies"],
        expected_skills=['bake goods', 'ensure sanitation']
    ),
    SkillLinkingToolTestCase(
        name="Baker by title",
        given_occupation_title="Baker",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread", "I talk to customers"],
        expected_skills=['bake goods', 'prepare bakery products', 'order supplies', 'ensure sanitation', 'maintain relationship with customers']
    ),
    SkillLinkingToolTestCase(
        name="GDE Brigade member by title",
        given_occupation_title="GDE Brigade member",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I make sure everyone follows the Covid-19 rules.",
                                "I keep an eye on the kids to make sure they stay apart from each other.",
                                "I check and record temperatures and other health signs.",
                                "I clean and disinfect students, teachers, and visitors.",
                                "I put together weekly and monthly reports."],
        expected_skills=['manage health and safety standards', 'health and safety regulations', 'undertake inspections', 'write work-related reports', 'communicate health and safety measures']
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_skill_linking_tool(test_case: SkillLinkingToolTestCase, get_search_services):
    # Given the occupation with it's associated skills
    given_job_titles: list[str] = []
    given_occupations_with_skills: list[OccupationSkillEntity] = []
    if test_case.given_occupation_code:
        given_occupation_skills: OccupationSkillEntity = await get_search_services.occupation_skill_search_service.get_by_esco_code(
            code=test_case.given_occupation_code,
        )
        given_occupations_with_skills.append(given_occupation_skills)
        given_job_titles.append(given_occupation_skills.occupation.preferredLabel)

    if test_case.given_occupation_title:
        tool = InferOccupationTool(get_search_services.occupation_skill_search_service)
        result = await tool.execute(
            experience_title=test_case.given_occupation_title,
            work_type=test_case.given_work_type,
            company=None,
            responsibilities=test_case.given_responsibilities,
            country_of_interest=Country.SOUTH_AFRICA,
            number_of_titles=5,
            top_k=5,
            top_p=10
        )
        logging.getLogger().info(f"Contextual titles: {result.contextual_titles}")
        logging.getLogger().info(f"ESCO occupations: {[esco_occupation.occupation.preferredLabel for esco_occupation in result.esco_occupations]}")
        given_occupations_with_skills.extend(result.esco_occupations)
        given_job_titles.extend(result.contextual_titles)

    # When the skill linking tool is called with the given occupation and responsibilities
    skill_linking_tool = SkillLinkingTool(get_search_services.skill_search_service)
    response = await skill_linking_tool.execute(
        job_titles=given_job_titles,
        esco_occupations=given_occupations_with_skills,
        responsibilities=test_case.given_responsibilities,
        top_k=5,
        top_p=10)
    # Then the expected skills are returned
    # get the preferred labels fo the found skills
    actual_skills_labels = [skill.preferredLabel.lower() for skill in response.top_skills]
    # assert the expected skills are in the actual skills
    # Find missing skills
    missing_skills = [skill for skill in test_case.expected_skills if skill not in actual_skills_labels]

    # Assert all expected skills are in the actual skills list
    logging.getLogger().info(f"Found skills: {actual_skills_labels}")
    assert not missing_skills, f"Missing skills: {missing_skills}"
