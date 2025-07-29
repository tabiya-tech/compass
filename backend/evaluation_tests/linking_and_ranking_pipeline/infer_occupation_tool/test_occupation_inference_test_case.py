import os
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.agent.experience.work_type import WorkType
from app.countries import Country
from evaluation_tests.compass_test_case import CompassTestCase


class OccupationFound(BaseModel):
    code: str
    preferred_label: str
    model_config = ConfigDict(
        frozen=True
    )


class InferOccupationToolTestCase(CompassTestCase):
    given_experience_title: str
    given_company: Optional[str] = None
    given_work_type: WorkType
    given_responsibilities: list[str]
    given_country_of_interest: Country
    given_top_k: int = 10
    given_top_p: int = 20
    given_number_of_titles: int = 5
    expected_occupations_found: list[OccupationFound]


test_cases = [
    InferOccupationToolTestCase(
        name="Baker",
        given_experience_title="Baker",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="",
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_occupations_found=[OccupationFound(preferred_label="baker", code="7512.1"),
                                    OccupationFound(preferred_label="bakery shop manager", code="1420.4.5"),
                                    OccupationFound(preferred_label="pastry maker", code="7512.5")],
    ),
    InferOccupationToolTestCase(
        name="Baker at the limits of LLM response Context size ",
        given_experience_title="Baker",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="",
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_occupations_found=[OccupationFound(preferred_label="baker", code="7512.1"),
                                    OccupationFound(preferred_label="bakery shop manager", code="1420.4.5"),
                                    OccupationFound(preferred_label="pastry maker", code="7512.5"),
                                    OccupationFound(preferred_label="microentrepreneur", code="5221_2")
                                    ],
        given_top_k=15,
        given_top_p=100,
        given_number_of_titles=15
    ),
    InferOccupationToolTestCase(
        name="Title is not useful, infer from responsibilities",
        given_experience_title="Foo",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="",
        given_responsibilities=["I cook street food", "I sell food to the local community"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_occupations_found=[OccupationFound(preferred_label="street food vendor", code="5212.1")],
    ),
    InferOccupationToolTestCase(
        name="Title is misleading, infer from responsibilities",
        given_experience_title="I sell gully to the local community",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="",
        given_responsibilities=["I visit the Embassy every day",
                                "I talk with the embassy staff",
                                "I talk with the minister of foreign affairs"],
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_occupations_found=[OccupationFound(preferred_label="import export specialist", code="3331.2.1")
                                    ],
    ),
    InferOccupationToolTestCase(
        name="Infer from responsibilities",
        given_experience_title="GDE Brigade member",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_company="Gauteng Department of Education",
        given_responsibilities=[
            # https://search67.com/2021/07/19/careers-employment-opportunity-for-youth-as-c0vid-19-screeners/
            "I make sure everyone follows the Covid-19 rules.",
            "I keep an eye on the kids to make sure they stay apart from each other.",
            "I check and record temperatures and other health signs.",
            "I clean and disinfect students, teachers, and visitors.",
            "I put together weekly and monthly reports."
        ],
        given_country_of_interest=Country.SOUTH_AFRICA,
        expected_occupations_found=[OccupationFound(preferred_label="health and safety officer", code="2263.3")],
    ),
    InferOccupationToolTestCase(
        name="Should not change title (emtpy responsibilities)",
        given_experience_title="Software Engineer",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_company="Google",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[
            OccupationFound(preferred_label="software developer", code="2512.4")
        ],
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience_title="I sell kota to the local community",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[OccupationFound(preferred_label="street food vendor", code="5212.1")],
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience_title="I make bunny chow",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_company="Hungry Lion",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[OccupationFound(preferred_label="cook", code="5120.1")],
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary & company name (emtpy responsibilities)",
        given_experience_title="I make bunny chow",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="Hungry Tiger",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[OccupationFound(preferred_label="street food vendor", code="5212.1")],
    ),
    InferOccupationToolTestCase(
        name="Rephrase title (emtpy responsibilities)",
        given_experience_title="Help my sick parents",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[
            OccupationFound(preferred_label="home care aide", code="5322.1"),
            OccupationFound(preferred_label="care at home worker", code="3412.4.2"),
            OccupationFound(preferred_label="caring for adults who are sick", code="I42_0")
        ],
    ),
    InferOccupationToolTestCase(
        name="Infer from glossary (emtpy responsibilities)",
        given_experience_title="I braid hair of my friends",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=[OccupationFound(preferred_label="hairdresser", code="5141.1")],
    )
]

