import logging
from typing import Optional, Awaitable

import pytest

from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline import ExperiencePipeline, ExperiencePipelineConfig
from app.countries import Country
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


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
        expected_top_skills=['communicate with customers',
                             'maintain work area cleanliness',
                             'order supplies',
                             'prepare bakery products',
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
        expected_top_skills=['communicate health and safety measures',
                             'disinfect surfaces',
                             'measure temperature',
                             'supervise children',
                             'write work-related reports']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I42_3",
        given_experience_title="I fill my grandma’s taxes",
        given_company_name="Home",
        given_responsibilities=['Maintain accurate financial records for dependent adults.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['maintain statutory books']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I42_2",
        given_experience_title="I give my uncle his medication ",
        given_company_name="Home",
        given_responsibilities=['Maintain a clean and sanitary environment to ensure my uncle\'s well-being.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['hygiene in a health care setting']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I42_5",
        given_experience_title="I keep an eye on my Grandpa",
        given_company_name="Home",
        given_responsibilities=["Maintain Grandpa's laundry needs."],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['wash the laundry']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I34_2",
        given_experience_title="I dry the laundry ",
        given_company_name="Home",
        given_responsibilities=['Inspect clothing to determine appropriate drying methods.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['evaluate garment quality']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I34_1",
        given_experience_title="I clean the sheets ",
        given_company_name="Home",
        given_responsibilities=['Inspect garments for damage before washing.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['evaluate garment quality']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I34_4",
        given_experience_title="I clean my shoes",
        given_company_name="Home",
        given_responsibilities=['Repair and restore damaged clothing and footwear to a presentable condition.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['manufacture wearing apparel products']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I32_1",
        given_experience_title="I clean the windows ",
        given_company_name="Home",
        given_responsibilities=['Maintain an adequate supply of cleaning materials.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['maintain inventory of cleaning supplies']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I32_2",
        given_experience_title="I take away the snow around the house",
        given_company_name="Home",
        given_responsibilities=['Efficiently manage time to complete outdoor cleaning tasks.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['manage time in landscaping']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I31_1",
        given_experience_title="I make cookies for my daughter",
        given_company_name="Home",
        given_responsibilities=['Prepare meals and snacks while adhering to strict food safety standards.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['comply with food safety and hygiene']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I31_4",
        given_experience_title="I put fruits in bocals to store them for the winter.",
        given_company_name="Home",
        given_responsibilities=['Maintain food safety and hygiene standards when storing and preserving food.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['comply with food safety and hygiene']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I35_1",
        given_experience_title="I pay my bills online. ",
        given_company_name="Home",
        given_responsibilities=['Track and reconcile financial transactions to ensure timely bill payments.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['trace financial transactions']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I37_2",
        given_experience_title="I look for a hairdresser for my mom and pay for an appointment.",
        given_company_name="Home",
        given_responsibilities=['Negotiate pricing and services with potential hairdressers to find the best value for your mother.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['sales argumentation']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I52_4",
        given_experience_title="I help my church with accounting. ",
        given_company_name="Home",
        given_responsibilities=['Maintain accurate financial records in compliance with legal requirements.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['maintain statutory books']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I52_2",
        given_experience_title="I sell cake at my dauther’s school baking parties",
        given_company_name="Home",
        given_responsibilities=['Maintain a consistent supply of cleaning materials for the kitchen.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['maintain inventory of cleaning supplies']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I52_1",
        given_experience_title="I help clean the beach after a storm. ",
        given_company_name="Home",
        given_responsibilities=['Remove debris and debris-laden surfaces to restore the beach to a clean and safe condition.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['remove road surface']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I51_4",
        given_experience_title="I check on my eldery neighboor when it’s very hot outside. ",
        given_company_name="Home",
        given_responsibilities=['Assist with laundry tasks to maintain a clean and comfortable environment.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['wash the laundry']
    ),
    ExperiencePipelineTestCase(
        name="Icatus I51_5",
        given_experience_title="I replace my uncle in his shop when he is away. ",
        given_company_name="Home",
        given_responsibilities=['Provide excellent customer service to ensure a positive shopping experience.'],
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_work_type=WorkType.UNSEEN_UNPAID,
        expected_top_skills=['guarantee customer satisfaction']
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_experience_pipeline(test_case: ExperiencePipelineTestCase, setup_search_services: Awaitable[SearchServices], caplog: pytest.LogCaptureFixture):
    search_services = await setup_search_services
    given_config = ExperiencePipelineConfig()
    experience_pipeline = ExperiencePipeline(
        config=given_config,
        search_services=search_services
    )

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        # Guards to ensure that the loggers are correctly set up,
        guard_caplog(logger=experience_pipeline._logger, caplog=caplog)
        # When the skill linking tool is called with the given occupation and responsibilities
        response = await experience_pipeline.execute(
            experience_title=test_case.given_experience_title,
            responsibilities=test_case.given_responsibilities,
            company_name=test_case.given_company_name,
            country_of_interest=test_case.given_country_of_interest,
            work_type=test_case.given_work_type
        )

        # Then the expected top skills are returned
        actual_top_skill_preferred_labels = [skill.preferredLabel for skill in response.top_skills]

        logging.log(logging.INFO, "Found Skills Occupations (labels): \n -%s", "\n -".join(sorted(actual_top_skill_preferred_labels)))
        logging.log(logging.INFO, "Expected Skills (labels): \n -%s", "\n -".join(sorted(test_case.expected_top_skills)))

        # AND the expected top skills are in the actual top skills
        if not set(test_case.expected_top_skills).issubset(set(actual_top_skill_preferred_labels)):
            # do the assertion in a way that the test fails and the diff can be shown in the IDE
            assert sorted(actual_top_skill_preferred_labels) == sorted(test_case.expected_top_skills)

        # AND the number of skills returned is equal to the number of configured clusters
        assert len(actual_top_skill_preferred_labels) == given_config.number_of_clusters

        # AND the logs should not contain any errors
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
