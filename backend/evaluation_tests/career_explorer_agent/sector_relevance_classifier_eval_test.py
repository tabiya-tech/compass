"""
Evaluation tests for SectorRelevanceClassifier.
Asserts the LLM correctly classifies user input as PRIORITY_SECTOR or NON_PRIORITY_SECTOR.
"""

import logging
from dataclasses import dataclass

import pytest

from app.app_config import get_application_config, set_application_config
from app.career_explorer.config import CareerExplorerConfig
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from app.agent.career_explorer_agent.sector_relevance_classifier import (
    SectorRelevance,
    SectorRelevanceClassifier,
)

DEFAULT_SECTORS = [
    {"name": "Agriculture", "description": "Commercial farming", "file": "agriculture.md"},
    {"name": "Energy", "description": "Power generation", "file": "energy.md"},
    {"name": "Mining", "description": "Copper, gold", "file": "mining.md"},
    {"name": "Hospitality", "description": "Hotels, tourism", "file": "hospitality.md"},
    {"name": "Water", "description": "Treatment, supply", "file": "water.md"},
]


@dataclass
class ClassifierTestCase:
    name: str
    user_input: str
    expected_relevance: SectorRelevance
    expected_sector_name: str | None
    locale: Locale = Locale.EN_US


CLASSIFIER_TEST_CASES = [
    ClassifierTestCase("agriculture", "Tell me about Agriculture", SectorRelevance.PRIORITY_SECTOR, "Agriculture"),
    ClassifierTestCase("mining", "What roles are there in mining?", SectorRelevance.PRIORITY_SECTOR, "Mining"),
    ClassifierTestCase("energy_solar", "I want to know about solar careers", SectorRelevance.PRIORITY_SECTOR, "Energy"),
    ClassifierTestCase("water", "Careers in water treatment?", SectorRelevance.PRIORITY_SECTOR, "Water"),
    ClassifierTestCase("hospitality", "What about tourism jobs?", SectorRelevance.PRIORITY_SECTOR, "Hospitality"),
    ClassifierTestCase("aeronautical", "I want to talk about aeronautical engineering", SectorRelevance.NON_PRIORITY_SECTOR, "Aviation"),
    ClassifierTestCase("it_software", "What about software development careers?", SectorRelevance.NON_PRIORITY_SECTOR, "Tech/ICT"),
    ClassifierTestCase("healthcare", "Careers in nursing or healthcare?", SectorRelevance.NON_PRIORITY_SECTOR, "Healthcare"),
    ClassifierTestCase("general_career", "How do I find a job?", SectorRelevance.NON_PRIORITY_SECTOR, None),
    ClassifierTestCase("multi_agriculture_mining", "I'm interested in agriculture and mining", SectorRelevance.PRIORITY_SECTOR, "Agriculture"),
    # Portuguese (pt-MZ) cases — classifier must handle non-English input correctly
    ClassifierTestCase("pt_mining", "Quero saber sobre mineração", SectorRelevance.PRIORITY_SECTOR, "Mining", Locale.PT_MZ),
    ClassifierTestCase("pt_agriculture", "Fale-me sobre agricultura", SectorRelevance.PRIORITY_SECTOR, "Agriculture", Locale.PT_MZ),
    ClassifierTestCase("pt_energy_solar", "Quais são as carreiras em energia solar?", SectorRelevance.PRIORITY_SECTOR, "Energy", Locale.PT_MZ),
    ClassifierTestCase("pt_water", "Empregos no sector da água?", SectorRelevance.PRIORITY_SECTOR, "Water", Locale.PT_MZ),
    ClassifierTestCase("pt_hospitality", "O que posso fazer no turismo?", SectorRelevance.PRIORITY_SECTOR, "Hospitality", Locale.PT_MZ),
    ClassifierTestCase("pt_healthcare", "Como me torno enfermeiro?", SectorRelevance.NON_PRIORITY_SECTOR, "Healthcare", Locale.PT_MZ),
    ClassifierTestCase("pt_it", "Quero trabalhar como programador", SectorRelevance.NON_PRIORITY_SECTOR, "Tech/ICT", Locale.PT_MZ),
    ClassifierTestCase("pt_general", "Como encontro um emprego?", SectorRelevance.NON_PRIORITY_SECTOR, None, Locale.PT_MZ),
]


@pytest.fixture
def career_explorer_config_with_sectors(setup_multi_locale_app_config):
    config = get_application_config()
    updated = config.model_copy(
        update={"career_explorer_config": CareerExplorerConfig(sectors=DEFAULT_SECTORS, country="Zambia")}
    )
    set_application_config(updated)
    yield updated


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.parametrize("test_case", CLASSIFIER_TEST_CASES, ids=[tc.name for tc in CLASSIFIER_TEST_CASES])
async def test_sector_relevance_classifier(
    evals_setup,
    career_explorer_config_with_sectors,
    test_case: ClassifierTestCase,
):
    # GIVEN the i18n locale is set
    get_i18n_manager().set_locale(test_case.locale)

    # AND a conversation context with a welcome turn and the user's input
    given_context = FakeConversationContext()
    given_context.add_turn("", "Welcome! Which sector interests you?")
    given_context.add_turn(test_case.user_input, "")

    # WHEN the classifier is called with the user's input
    classifier = SectorRelevanceClassifier()
    actual_relevance, actual_sector_name, actual_is_priority, _reasoning, _, _all_sectors = await classifier.classify(
        user_input=test_case.user_input, context=given_context
    )

    # THEN the relevance matches the expected value
    assert actual_relevance == test_case.expected_relevance, (
        f"For '{test_case.user_input}' expected {test_case.expected_relevance.value} but got {actual_relevance.value}"
    )
    # AND the sector name matches the expected value
    if test_case.expected_sector_name is not None:
        assert actual_sector_name is not None, (
            f"For '{test_case.user_input}' expected sector_name '{test_case.expected_sector_name}' but got None"
        )
        assert test_case.expected_sector_name.lower() in actual_sector_name.lower(), (
            f"For '{test_case.user_input}' expected sector_name containing '{test_case.expected_sector_name}' but got '{actual_sector_name}'"
        )
    else:
        assert actual_sector_name is None, (
            f"For '{test_case.user_input}' expected sector_name to be None but got '{actual_sector_name}'"
        )
    # AND the is_priority flag matches the expected value
    expected_is_priority = test_case.expected_relevance == SectorRelevance.PRIORITY_SECTOR
    assert actual_is_priority == expected_is_priority, (
        f"For '{test_case.user_input}' expected is_priority={expected_is_priority} but got {actual_is_priority}"
    )
    logging.info("Classifier test %s: %s -> %s, sector=%s (correct)", test_case.name, test_case.user_input[:40], actual_relevance.value, actual_sector_name)


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
async def test_classifier_extracts_multiple_sectors(
    evals_setup,
    career_explorer_config_with_sectors,
):
    """The classifier should extract all mentioned sectors into all_sectors."""
    # GIVEN the i18n locale is set
    get_i18n_manager().set_locale(Locale.EN_US)

    # AND a conversation context with a multi-sector user input
    given_context = FakeConversationContext()
    given_context.add_turn("", "Welcome! Which sector interests you?")
    given_user_input = "I'm interested in agriculture and mining"
    given_context.add_turn(given_user_input, "")

    # WHEN the classifier is called
    classifier = SectorRelevanceClassifier()
    _relevance, _sector_name, _is_priority, _reasoning, _, actual_all_sectors = await classifier.classify(
        user_input=given_user_input, context=given_context
    )

    # THEN all_sectors contains at least 2 entries
    assert len(actual_all_sectors) >= 2, (
        f"Expected at least 2 sectors for multi-sector input, got {len(actual_all_sectors)}: {actual_all_sectors}"
    )
    # AND the sector names include Agriculture and Mining
    actual_sector_names = [s.sector_name.lower() for s in actual_all_sectors]
    assert any("agriculture" in name for name in actual_sector_names), (
        f"Expected 'Agriculture' in all_sectors but got: {actual_sector_names}"
    )
    assert any("mining" in name for name in actual_sector_names), (
        f"Expected 'Mining' in all_sectors but got: {actual_sector_names}"
    )
