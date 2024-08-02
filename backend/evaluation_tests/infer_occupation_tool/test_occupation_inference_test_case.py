from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.work_type import WorkType
from app.countries import Country
from evaluation_tests.compass_test_case import CompassTestCase


class InferOccupationToolTestCase(CompassTestCase):
    given_experience: ExperienceEntity
    given_country_of_interest: Country
    expected_same_title: bool
    expected_occupations_found: list[str]


test_cases = [
    InferOccupationToolTestCase(
        name="Baker",
        given_experience=ExperienceEntity(
            experience_title="Baker",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="",
            location="downtown",
            responsibilities=ResponsibilitiesData(
                responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"]),
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=True,
        expected_occupations_found=["baker", "bakery shop manager", "bakery specialized seller"],
    ),
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
        expected_occupations_found=["street food vendor"],
    ),
    InferOccupationToolTestCase(
        name="Title is misleading, infer from responsibilities",
        given_experience=ExperienceEntity(
            experience_title="I sell gully to the local community",
            work_type=WorkType.SELF_EMPLOYMENT,
            company="",
            location="downtown",
            responsibilities=ResponsibilitiesData(
                responsibilities=["I visit the Embassy every day", "I talk with the embassy staff", "I talk with the minister of foreign affairs"],
            ),
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupations_found=["foreign affairs officer", "diplomat"],
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
        expected_occupations_found=["software developer"],
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
        expected_occupations_found=["street food vendor"],
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
        expected_occupations_found=["cook"],
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
        expected_occupations_found=["street food vendor"],
    ),
    InferOccupationToolTestCase(
        name="Rephrase title (emtpy responsibilities)",
        given_experience=ExperienceEntity(
            experience_title="Help my sick parents",
            work_type=WorkType.UNSEEN_UNPAID,
            company="",
            location="home",
        ),
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_same_title=False,
        expected_occupations_found=["home care aide", "social care worker"],
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
        expected_occupations_found=["health and safety officer"],
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
        expected_occupations_found=["hairdresser"],
    ),
    # Add more test cases as needed
]
