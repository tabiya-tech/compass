import logging

import pytest

from app.countries import Country
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.work_type import WorkType
from app.agent.infer_occupation_tool.infer_occupation_tool import InferOccupationTool
from app.server_dependecies.db_dependecies import get_mongo_db
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class InferOccupationToolTestCase(CompassTestCase):
    given_experience: ExperienceEntity
    given_country_of_interest: Country
    expected_same_title: bool
    expected_occupation_found: str


test_cases = [
    InferOccupationToolTestCase(
        name="Title is not useful, infer from responsibilities",
        given_experience=ExperienceEntity(
            experience_title="Foo",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="",
            location="downtown",
            responsibilities=ResponsibilitiesData(
                responsibilities=["I cook street food", "I sell food to the local community"]),
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="street food vendor",
    ),
    InferOccupationToolTestCase(
        name="Title is misleading, infer from responsibilities",
        given_experience=ExperienceEntity(
            experience_title="I sell gully to the local community",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="",
            location="downtown",
            responsibilities=ResponsibilitiesData(
                responsibilities=["I visit the Embassy every day", "I talk with the embassy staff", "I am diplomat"],
            ),
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="ambassador",
    ),
    InferOccupationToolTestCase(
        name="Should not change title (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="Software Engineer",
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            company="Google",
            location="Cape Town",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=True,
        expected_occupation_found="software developer",
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="I sell kota to the local community",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="",
            location="downtown",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="street food vendor",
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="I make bunny chow",
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            company="Hungry Lion",
            location="uptown",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="cook",
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary & company name (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="I make bunny chow",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="Hungry Tiger",
            location="uptown",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="street food vendor",
    ),
    InferOccupationToolTestCase(
        name="Rephrase title (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="Help sick parents",
            work_type=WorkType.UNSEEN_UNPAID,
            company="",
            location="home",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="home care aide",
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary & company name (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="GDE Brigade member",
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            company="School",
            location="Gauteng Province",
            responsibilities=ResponsibilitiesData(
                responsibilities=[
                    # https://search67.com/2021/07/19/careers-employment-opportunity-for-youth-as-c0vid-19-screeners/
                    "I make sure everyone follows the Covid-19 rules.",
                    "I keep an eye on the kids to make sure they stay apart from each other.",
                    "I check and record temperatures and other health signs.",
                    "I clean and disinfect students, teachers, and visitors.",
                    "I put together weekly and monthly reports."
                ]),
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="health and safety officer",
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="I braid hair of my friends",
            work_type=WorkType.UNSEEN_UNPAID,
            company="home",
            location="Pretoria",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupation_found="hairdresser",
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

    # log the preferred labels of the occupations
    labels = []
    found_expected_occupation = False
    for skill_occupation in result.esco_occupations:
        labels.append(skill_occupation.occupation.preferredLabel)
        if not found_expected_occupation and skill_occupation.occupation.preferredLabel == test_case.expected_occupation_found:
            found_expected_occupation = True
            logging.log(logging.INFO, "Found expected occupation: %s", test_case.expected_occupation_found)
    logging.log(logging.INFO, "Liked to ESCO Occupation: \n -%s", "\n -".join(labels))
    assert found_expected_occupation
