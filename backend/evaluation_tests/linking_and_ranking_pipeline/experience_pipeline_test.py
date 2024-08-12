from typing import Optional

import pytest

from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.experience_pipeline import ExperiencePipeline
from app.countries import Country
from app.server_dependecies.db_dependecies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSearchService, OccupationSkillSearchService, VectorSearchConfig, SkillSearchService
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.environment_settings.constants import EmbeddingConfig
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope='function')
def get_search_services():
    db = get_mongo_db()
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


class ExperiencePipelineTestCase(CompassTestCase):
    given_experience_title: str
    given_responsibilities: list[str]
    given_company_name: Optional[str]
    given_country_of_interest: Country
    given_work_type: WorkType
    expected_top_skills: list[str]


test_cases = [
    ExperiencePipelineTestCase(
        name="Baker (I sell bread)",
        given_experience_title="Baker",
        given_company_name="Baker's Delight",
        given_responsibilities=["I sell bread"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        expected_top_skills=["advise customers on bread"]
    ),
    ExperiencePipelineTestCase(
        name="Baker",
        given_experience_title="Baker",
        given_company_name="Baker's Delight",
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread", "I talk to customers"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        expected_top_skills=['bake goods',
                             'maintain relationship with customers',
                             'maintain work area cleanliness',
                             'order supplies',
                             'prepare bread products']
    ),
    ExperiencePipelineTestCase(
        name="Help Parents",
        given_experience_title="Help parents",
        given_company_name="",
        given_responsibilities=["I help my parents with the house chores", "I do cleaning", "I do the laundry",
                                "I do the shopping", "I do the cooking",
                                "I drive them to the doctor", "I help them with their medication",
                                ],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=[]
    ),
    ExperiencePipelineTestCase(
        name="Project manager",
        given_experience_title="PM",
        given_company_name="University of Greenwich",
        given_responsibilities=["I manage the project",
                                "I make sure the project is on time",
                                "I make sure the project is on budget",
                                "I remove obstacles for the team",
                                "I talk to the team",
                                "I talk to the client",
                                "I write reports",
                                "I present the status to the client",
                                "I make sure stay on scope",
                                "I ensure the quality",
                                "I manage risks",
                                "I handle communication with stakeholders",
                                ],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        expected_top_skills=[]
    ),
    ExperiencePipelineTestCase(
        name="GDE Brigade member",
        given_experience_title="GDE Brigade member",
        given_company_name="Gauteng Department of Education",
        given_responsibilities=["I make sure everyone follows the Covid-19 rules.",
                                "I keep an eye on the kids to make sure they stay apart from each other.",
                                "I check and record temperatures and other health signs.",
                                "I clean and disinfect students, teachers, and visitors.",
                                "I put together weekly and monthly reports."],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        expected_top_skills=['follow health and safety precautions in social care practices',
                             "guarantee students' safety",
                             'perform security checks',
                             'maintain incident reporting records',
                             'present reports']
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_experience_pipeline(test_case: ExperiencePipelineTestCase, get_search_services):
    # When the skill linking tool is called with the given occupation and responsibilities
    experience_pipeline = ExperiencePipeline(get_search_services)
    response = await experience_pipeline.execute(
        experience_title=test_case.given_experience_title,
        responsibilities=test_case.given_responsibilities,
        company_name=test_case.given_company_name,
        country_of_interest=test_case.given_country_of_interest,
        work_type=test_case.given_work_type
    )
    # Then the expected top skills are returned
    actual_top_skill_preferred_labels = [skill.preferredLabel for skill in response.top_skills]
    assert sorted(actual_top_skill_preferred_labels) == sorted(test_case.expected_top_skills)
