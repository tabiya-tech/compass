from typing import Optional

from app.agent.experience.work_type import WorkType
from app.countries import Country
from evaluation_tests.compass_test_case import CompassTestCase


class InferIcatusActivitiesToolTestCase(CompassTestCase):
    given_experience_title: str
    given_company: Optional[str] = None
    given_work_type: WorkType
    given_responsibilities: list[str]
    given_country_of_interest: Country
    given_top_k: int = 10
    given_top_p: int = 20
    number_of_titles: int = 5
    expected_occupations_found: list[str]


test_cases = [
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_4",
        given_experience_title="I keep company to my grandma when she is not feeling well",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
    ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_3",
        given_experience_title="I fill my grandma’s taxes",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_2",
        given_experience_title="I give my uncle his medication ",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_1",
        given_experience_title="I make my grandma have lunch and I help her wash herself",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_6",
        given_experience_title="I take care of my dad’s medical appointments",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I42_0_5",
        given_experience_title="I keep an eye on my Grandpa",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping adults who need care or are sick"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_1",
        given_experience_title="I change my little brother’s diapers",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_3",
        given_experience_title="I help my sister with her homework. ",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_7",
        given_experience_title="I go to teacher/parents meetings.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_6",
        given_experience_title="I keep an eye on my siblings during the day",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_5",
        given_experience_title="I play football with my cousins",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_2",
        given_experience_title="I give my brother medication",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I41_0_4",
        given_experience_title="I read bedtime stories to my niece",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["caring for and teaching children in your family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I44_0_3",
        given_experience_title="I take my grandma to the supermarket",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["accompanying own children and/or dependent adults"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I44_0_2",
        given_experience_title="I bring my sister to school",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["accompanying own children and/or dependent adults"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I43_0_2",
        given_experience_title="I take care of my brother when he is having a hard time",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping other adults in the house or family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I43_0_1",
        given_experience_title="I help my brother move because he broke his ankle",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["helping other adults in the house or family"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I34_0_2",
        given_experience_title="I dry the laundry",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning or fixing clothes and shoes"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I34_0_1",
        given_experience_title="I clean the sheets",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning or fixing clothes and shoes"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I34_0_3",
        given_experience_title="I iron my dad’s shirts",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning or fixing clothes and shoes"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I34_0_4",
        given_experience_title="I clean my shoes",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning or fixing clothes and shoes"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I32_0_1",
        given_experience_title="I clean the windows",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning and looking after your home or garden"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I32_0_2",
        given_experience_title="I take away the snow around the house",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning and looking after your home or garden"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I32_0_3",
        given_experience_title="I make compost with vegetable peals",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning and looking after your home or garden"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I32_0_4",
        given_experience_title="I water the plants",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cleaning and looking after your home or garden"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I33_0_1",
        given_experience_title="I paint the house’s walls",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["fixing things in your home or car"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I33_0_2",
        given_experience_title="I install the TV",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["fixing things in your home or car"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I33_0_3",
        given_experience_title="I change the car’s oil",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["fixing things in your home or car"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I31_0_3",
        given_experience_title="I do the dishes",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cooking and planning meals"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I31_0_1",
        given_experience_title="I make cookies for my daughter",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cooking and planning meals"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I31_0_2",
        given_experience_title="I set the table and serve my family",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cooking and planning meals"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I31_0_4",
        given_experience_title="I put fruits in bocals to store them for the winter.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["cooking and planning meals"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I35_0_2",
        given_experience_title="I check the savings to plan for trips.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["managing and planning for your household"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I35_0_1",
        given_experience_title="I pay my bills online.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["managing and planning for your household"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I36_0_1",
        given_experience_title="I play with my dog outside.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["taking care of pets"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I36_0_2",
        given_experience_title="I take my dog to the dog-sitter.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["taking care of pets"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I37_0_2",
        given_experience_title="I look for a hairdresser for my mom and pay for an appointment.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["shopping for your family or household"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I37_0_1",
        given_experience_title="I buy my parents fournitures.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["shopping for your family or household"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I52_0_3",
        given_experience_title="I take care of yougnpeople in the community.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer cultural activities recreation and sports activities"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I52_0_4",
        given_experience_title="I help my church with accounting. ",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer office/administrative work"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I52_0_2",
        given_experience_title="I sell cake at my dauther’s school baking parties",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer preparing/serving meals, cleaning up"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I52_0_1",
        given_experience_title="I help clean the beach after a storm.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer work on road/building repair, clearing and preparing land, cleaning (streets, markets, etc.), and construction"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I51_0_4",
        given_experience_title="I check on my eldery neighboor when it’s very hot outside.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer care for adults"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I51_0_3",
        given_experience_title="I teach my young neighbor spanish.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer childcare and instruction"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I51_0_1",
        given_experience_title="I babysit my cousin’s cats.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer household maintenance, management, construction, renovation and repair"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I51_0_2",
        given_experience_title="I bring groceries to my elderly neighbor.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer shopping/purchasing goods and services"],
        ),
    InferIcatusActivitiesToolTestCase(
        name="Icatus I51_0_5",
        given_experience_title="I replace my uncle in his shop when he is away.",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.SOUTH_AFRICA,
        given_responsibilities=[],
        expected_occupations_found=["unpaid volunteer unpaid help in enterprises owned by other households"],
        ),
    # Add more test cases as needed
]
