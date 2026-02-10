import logging
import random
import uuid
from typing import Optional

import pytest
from _pytest.logging import LogCaptureFixture
from bson import ObjectId

from app.agent.linking_and_ranking_pipeline.infer_occupation_tool._relevant_occupations_classifier_llm import \
    _RelevantOccupationsClassifierLLM
from app.vector_search.esco_entities import OccupationEntity
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


def _get_occupation_entity(*,
                           preferred_label: str,
                           altlabels: Optional[list[str]] = None,
                           description: Optional[str] = "",
                           scope_note: Optional[str] = "",
                           origin_uuid: Optional[str] = "",
                           uuid_history: Optional[list[str]] = None,
                           score: Optional[float] = 0) -> OccupationEntity:
    return OccupationEntity(
        id=f"{uuid.uuid4().hex[:24]}",  # id is a random sting 24 character hex string
        UUID=f"{uuid.uuid4()}",
        modelId=f"{str(ObjectId())}",
        code="1234.1",
        preferredLabel=preferred_label,
        altLabels=altlabels if altlabels is not None else [preferred_label],  # the preferred label is usually expected to be in the altlabels
        description=description,
        scopeNote=scope_note,
        originUUID=origin_uuid if origin_uuid else f"{uuid.uuid4()}",
        UUIDHistory=uuid_history if uuid_history is not None else [f"{uuid.uuid4()}"],
        score=score
    )


class RelevantOccupationClassifierLLMTestCase(CompassTestCase):
    given_job_titles: list[str]
    given_responsibilities: list[str]
    given_occupations: list[OccupationEntity]
    given_top_k: int = 5
    expected_relevant_occupations: list[str]
    expected_remaining_occupations: list[str]


test_cases = [
    RelevantOccupationClassifierLLMTestCase(
        name="Self-employed Baker",
        given_job_titles=["Baker", "Self-employed Baker"],
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"],
        given_occupations=[_get_occupation_entity(preferred_label="baker",
                                                  description="Bakers make a wide range of breads, pastries, and other baked goods. "
                                                              "They follow all the processes from receipt and storage of raw materials, "
                                                              "preparation of raw materials for bread-making, "
                                                              "measurement and mixing of ingredients into dough and proof. "
                                                              "They tend ovens to bake products to an adequate temperature and time."),
                           _get_occupation_entity(preferred_label="baking operator",
                                                  description="Baking operators tend automatic reels or conveyor-type ovens to bake bread, "
                                                              "pastries and other bakery products. "
                                                              "They interpret work orders to determine the products and the quantities to be baked. "
                                                              "They set the operational speed of conveyors, baking times, and temperatures. "
                                                              "They supervise the baking process and maintain oven operations in control."),
                           _get_occupation_entity(preferred_label="cook",
                                                  description="Cooks are culinary operatives who are able to prepare and present food, "
                                                              "normally in domestic and institutional environments."),
                           _get_occupation_entity(preferred_label="bakery specialised seller",
                                                  description="Bakery specialised sellers sell bread and cakes in specialised shops, "
                                                              "post-processing the products if required."),
                           _get_occupation_entity(preferred_label="pastry maker",
                                                  description=" Pastry makers prepare and bake cakes, cookies, croissants, "
                                                              "pies and alike products according to recipes."),
                           _get_occupation_entity(preferred_label="chef",
                                                  description="Chefs are culinary professionals with a flair for creativity "
                                                              "and innovation to provide a unique gastronomic experience."),
                           _get_occupation_entity(preferred_label="confectioner",
                                                  description="Confectioners make a varied range of cakes, "
                                                              "candies and other confectionery items for industrial purposes or for direct selling."),
                           _get_occupation_entity(preferred_label="blogger",
                                                  description="Bloggers write online articles on a wide range of subjects such as politics, "
                                                              "fashion, economics and sports. "
                                                              "They can relate objective facts, but often they also give their opinion on the related topic. "
                                                              "Bloggers also interact with their readers via comments."),
                           _get_occupation_entity(preferred_label="bakery shop manager",
                                                  description="Bakery shop managers assume responsibility for activities and staff in specialised shops."),
                           _get_occupation_entity(preferred_label="pastry chef",
                                                  description="Pastry chefs are responsible for preparing, cooking and presenting desserts, "
                                                              "sweet products and bakery products."),
                           _get_occupation_entity(preferred_label="miller",
                                                  description=" Millers tend mills to grind cereal crops to obtain flour. "
                                                              "They regulate the flow of materials that go into mills "
                                                              "and adjust the grind to a specified fineness. "
                                                              "They ensure basic maintenance and cleaning of equipments. "
                                                              "They evaluate sample of product to verify fineness of grind."),
                           _get_occupation_entity(preferred_label="weaver",
                                                  description="Weavers operate the weaving process at traditional hand powered weaving machines "
                                                              "(from silk to carpet, from flat to Jacquard). They monitor the condition of machines "
                                                              "and the fabric quality, such as woven fabrics for clothing, home-tex or technical end uses. "
                                                              "They carry out mechanic works on machines that convert yarns into fabrics such as blankets, "
                                                              "carpets, towels and clothing material. "
                                                              "They repair loom malfunctions as reported by the weaver, and complete loom check out sheets."),
                           _get_occupation_entity(preferred_label="butcher",
                                                  description=" Butchers order, inspect and buy meat to prepare it and sell it as consumable meat products. "
                                                              "They perform activities such as cutting, trimming, boning, tying, and grinding beef, "
                                                              "pork, and poultry meat. "
                                                              "They prepare those mentioned sorts of meat for consumption."),
                           _get_occupation_entity(preferred_label="blender operator",
                                                  description="Blender operators produce non-alcoholic flavoured waters by managing the administration of "
                                                              "a large selection of ingredients to water. "
                                                              "They handle and administer ingredients such as sugar, fruits juices, vegetable juices, "
                                                              "syrups based on fruit or herbs, natural flavours, synthetic food additives like artificial "
                                                              "sweeteners, colours, preservatives, acidity regulators, vitamins, minerals, and carbon dioxide. "
                                                              "They manage the quantities depending on the product."),
                           _get_occupation_entity(preferred_label="cake press operator",
                                                  description="Cake press operators set up and tend the hydraulic presses that compress and bake plastic chips "
                                                              "into cake moulds to produce plastic sheets. "
                                                              "They regulate and adjust the pressure and temperature."),
                           _get_occupation_entity(preferred_label="confectionery specialised seller",
                                                  description="Confectionery specialised sellers sell confectionery in specialised shops."),
                           _get_occupation_entity(preferred_label="confectionery shop manager",
                                                  description="Confectionery shop managers assume responsibility for activities and staff in specialised shops "
                                                              "for confectionery e.g. pastries, candy, and chocolate."),
                           _get_occupation_entity(preferred_label="chocolatier",
                                                  description="Chocolatiers make confectionery products with chocolate. "
                                                              "They perform activities such as examination, feeling, and tasting of ground chocolate paste. "
                                                              "Such analysis leads them to ascertain if colour, texture, "
                                                              "and taste of the chocolate paste meets specifications."),
                           _get_occupation_entity(preferred_label="cabinet maker",
                                                  description="Cabinet makers build cabinets or other pieces of furniture by cutting, "
                                                              "shaping and fitting pieces of wood. "
                                                              "They use different kind of power and hand tools, such as lathes, planers and saws."),
                           _get_occupation_entity(preferred_label="head pastry chef",
                                                  description="Head pastry chefs manage pastry staff and ensure the preparation, "
                                                              "cooking and presentation of desserts, sweet products and pastry products."),
                           _get_occupation_entity(preferred_label="private chef",
                                                  description="Private chefs comply with food and sanitation rules to prepare meals for their employers. "
                                                              "They take into consideration the employers intolerances to specific ingredients "
                                                              "or their preferences and cook the meals in the employer's home. "
                                                              "Private chefs may also be asked to organise small dinner parties "
                                                              "or other types of celebrations for special occasions.")],
        given_top_k=5,
        expected_relevant_occupations=["bakery specialised seller",
                                       "bakery shop manager",
                                       "baker",
                                       "pastry chef",
                                       "pastry maker",
                                       ],
        expected_remaining_occupations=['baking operator',
                                        'blender operator',
                                        'blogger',
                                        'butcher',
                                        'cabinet maker',
                                        'cake press operator',
                                        'chef',
                                        'chocolatier',
                                        'confectioner',
                                        'confectionery shop manager',
                                        'confectionery specialised seller',
                                        'cook',
                                        'head pastry chef',
                                        'miller',
                                        'private chef',
                                        'weaver'],
        expect_warnings_in_logs=True
    ),
    RelevantOccupationClassifierLLMTestCase(
        name="Special characters",
        given_job_titles=["Baker ✅", "Self-employed Baker 🔥"],
        given_responsibilities=["I clean my work place ✨"],
        given_occupations=[
            _get_occupation_entity(preferred_label="Baker 🍞", score=0.9),
            _get_occupation_entity(preferred_label="Bakery \"shop\" manager 🏪", score=0.8),
            _get_occupation_entity(preferred_label="Pastry \t\n chef 🥐", score=0.8),
            _get_occupation_entity(preferred_label="Bookmaker \"\"💸", score=0.7),
            _get_occupation_entity(preferred_label="*_@§\"$%\"':🤬", score=0.6),
        ],
        given_top_k=3,
        expected_relevant_occupations=["Baker 🍞",
                                       "Bakery \"shop\" manager 🏪",
                                       "Pastry \t\n chef 🥐",
                                       ],
        expected_remaining_occupations=[
            "Bookmaker \"\"💸",
            "*_@§\"$%\"':🤬",
        ],
        expect_warnings_in_logs=True
    ),
    RelevantOccupationClassifierLLMTestCase(
        name="Duplicate preferred labels without altlabels",
        given_job_titles=["Baker", "Self-employed Baker"],
        given_responsibilities=["I clean my work place"],
        given_occupations=[
            _get_occupation_entity(preferred_label="Baker", score=0.9),
            _get_occupation_entity(preferred_label="Baker", score=0.9),
        ],
        given_top_k=3,
        expected_relevant_occupations=["Baker"],
        expected_remaining_occupations=["Baker"],
        expect_warnings_in_logs=True
    ),
    RelevantOccupationClassifierLLMTestCase(
        name="Duplicate preferred labels with altlabels",
        given_job_titles=["Baker", "Self-employed Baker"],
        given_responsibilities=["I clean my work place"],
        given_occupations=[
            _get_occupation_entity(preferred_label="Baker", altlabels=["Bread maker"], score=0.9),
            _get_occupation_entity(preferred_label="Baker", altlabels=["Bookmaker"], score=0.9),
        ],
        given_top_k=1,
        expected_relevant_occupations=["Baker"],
        expected_remaining_occupations=["Baker"],  # this is the one with the altlabel "Bookmaker"
        expect_warnings_in_logs=True
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_relevant_occupations_classifier_llm(test_case: RelevantOccupationClassifierLLMTestCase, caplog: LogCaptureFixture):
    relevant_occupations_classifier = _RelevantOccupationsClassifierLLM()

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):

        # Guards to ensure that the loggers are correctly setup,
        guard_caplog(logger=relevant_occupations_classifier._logger, caplog=caplog)

        # GIVEN responsibilities and occupations
        random.shuffle(test_case.given_job_titles)  # shuffle the job titles to be certain that the order does not matter
        random.shuffle(test_case.given_responsibilities)  # shuffle the responsibilities to be certain that the order does not matter
        random.shuffle(test_case.given_occupations)  # shuffle the responsibilities to be certain that the order does not matter

        # WHEN the relevance classifier is called with the given title and responsibilities and occupations
        actual_result = await relevant_occupations_classifier.execute(
            job_titles=test_case.given_job_titles,
            responsibilities=test_case.given_responsibilities,
            occupations=test_case.given_occupations,
            top_k=test_case.given_top_k
        )

        # THEN the result should contain the expected relevant occupations
        actual_most_relevant_occupations_labels = [occupation.preferredLabel for occupation in actual_result.most_relevant]
        assert set(actual_most_relevant_occupations_labels) == set(test_case.expected_relevant_occupations)
        # AND the result should contain the expected remaining occupations
        actual_remaining_occupations_labels = [occupation.preferredLabel for occupation in actual_result.remaining]
        assert set(actual_remaining_occupations_labels) == set(test_case.expected_remaining_occupations)

        # AND the logs should not contain any errors or warnings (depending on the test case)
        assert_log_error_warnings(caplog=caplog,
                                  expect_errors_in_logs=test_case.expect_errors_in_logs,
                                  expect_warnings_in_logs=test_case.expect_warnings_in_logs)
