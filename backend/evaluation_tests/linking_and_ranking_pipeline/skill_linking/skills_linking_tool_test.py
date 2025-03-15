import logging
from typing import Optional

from app.types import Skill
import pytest

from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.agent.linking_and_ranking_pipeline.skill_linking_tool import SkillLinkingTool
from app.countries import Country
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.esco_search_service import OccupationSearchService, OccupationSkillSearchService, VectorSearchConfig, SkillSearchService
from app.vector_search.settings import VectorSearchSettings
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.environment_settings.constants import EmbeddingConfig
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope='function')
async def get_search_services():
    db = await CompassDBProvider.get_taxonomy_db()
    embedding_service = GoogleGeckoEmbeddingService()
    settings = VectorSearchSettings()
    occupation_skill_search_service = OccupationSkillSearchService(db, embedding_service, settings)
    return occupation_skill_search_service

@pytest.fixture(scope="function")
async def setup_infer_occupation_tool():
    db = await CompassDBProvider.get_taxonomy_db()
    settings = VectorSearchSettings()
    embedding_service = GoogleGeckoEmbeddingService()
    search_service = OccupationSkillSearchService(db, embedding_service, settings)
    tool = InferOccupationTool(search_service)
    return tool

@pytest.fixture(scope="function")
async def setup_skill_linking_tool():
    db = await CompassDBProvider.get_taxonomy_db()
    settings = VectorSearchSettings()
    embedding_service = GoogleGeckoEmbeddingService()
    embedding_config = EmbeddingConfig()
    search_service = SkillSearchService(db, embedding_service, VectorSearchConfig(
        collection_name=embedding_config.skill_collection_name,
        index_name=embedding_config.embedding_index,
        embedding_key=embedding_config.embedding_key
    ), settings)
    tool = SkillLinkingTool(search_service)
    return tool

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
    SkillLinkingToolTestCase(
        name="Brand Ambassador",
        given_occupation_title="Ambassador",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I publicize beauty products.",
                                "I decide the branding strategy."],
        expected_skills=['content marketing strategy',
                         'design brand\'s online communication plan']
    ),
    SkillLinkingToolTestCase(
        name="Brand Ambassador2",
        given_occupation_title="Ambassador",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I manage social media presence."],
        expected_skills=['social media management',
                         'design brand\'s online communication plan']
    ),
    SkillLinkingToolTestCase(
        name="Brand Ambassador3",
        given_occupation_title="Ambassador",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I publish make-up tutorials for my followers"],
        expected_skills=['make-up techniques',
                         'perform video editing']
    ),
    SkillLinkingToolTestCase(
        name="Livestock trader",
        given_occupation_title="Livestock Trader",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I sell cows at the local market.",
                                "I buy cows at the local market."],
        expected_skills=['select livestock',
                         'manage livestock',
                         'assist in transportation of animals']
    ),
    SkillLinkingToolTestCase(
        name="Plant Operator",
        given_occupation_title="Plant Operator",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I oversee the power plant production process",
                                "I monitor equipment in the plant",
                                "I write weekly reports"],
        expected_skills=['monitor equipment condition',
                         'maintain power plant machinery',
                         'write inspection reports']
    ),
    SkillLinkingToolTestCase(
        name="Carwash",
        given_occupation_title="Service provider",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I wash cars",
                                "I clean the interiors of cars"],
        expected_skills=['clean vehicle exterior',
                         'clean vehicles interior']
    ),
    SkillLinkingToolTestCase(
        name="generic salesperson",
        given_occupation_title="Salesperson",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I sell goods and wares on the street",
                                "I contact my supplier to get household items",
                                "I look through old stuff to see what could be sold",],
        expected_skills=['order products',
                         'sell household goods',
                         ]
    ),
    SkillLinkingToolTestCase(
        name="generic salesperson2",
        given_occupation_title="Salesperson",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I organize my stall every day"],
        expected_skills=['organise product display']
    ),
    SkillLinkingToolTestCase(
        name="influencer",
        given_occupation_title="Influencer",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=[
                    "I create content for social media",
                    "I work with brands for social media campaigns",
                    "I make videos to publicize products"
                ],
        expected_skills=['apply social media marketing',
                         'social media management',
                         'perform video editing']
    ),
    SkillLinkingToolTestCase(
        name="casual worker",
        given_occupation_title="Casual worker",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=[
                    "I fill shelves at the supermarket",
                ],
        expected_skills=['stock shelves']
    ),
    SkillLinkingToolTestCase(
        name="voice-over artist",
        given_occupation_title="Voice-over Artist",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=[
                    "I do audiobook narrations",
                    "I act according to the character",
                    "I edit some of my work"
                ],
        expected_skills=['perform scripted dialogue',
                         'edit recorded sound']
    ),
    SkillLinkingToolTestCase(
        name="voice-over artist2",
        given_occupation_title="Voice-over Artist",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=[
                    "I inform and educate communities",
                    "I teach my skills", 
                ],
        expected_skills=['conduct educational activities',
                         'use pedagogic strategies for creativity']
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_skill_linking_tool(test_case: SkillLinkingToolTestCase, get_search_services, setup_infer_occupation_tool, setup_skill_linking_tool):
    # Given the occupation with it's associated skills
    inference_tool = await setup_infer_occupation_tool
    search_service_tool = await get_search_services
    skill_linking_tool = await setup_skill_linking_tool
    given_job_titles: list[str] = []
    given_occupations_with_skills: list[OccupationSkillEntity] = []
    if test_case.given_occupation_code:
        given_occupation_skills: OccupationSkillEntity = await search_service_tool.get_by_esco_code(
            code=test_case.given_occupation_code,
        )
        given_occupations_with_skills.append(given_occupation_skills)
        given_job_titles.append(given_occupation_skills.occupation.preferredLabel)

    if test_case.given_occupation_title:
        result = await inference_tool.execute(
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
