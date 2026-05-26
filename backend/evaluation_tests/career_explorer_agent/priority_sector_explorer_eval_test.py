"""
Evaluation tests for PrioritySectorExplorer.
Asserts RAG-based responses contain expected content from sector documents.
"""

import logging
from dataclasses import dataclass

import pytest

from app.app_config import get_application_config, set_application_config
from app.career_explorer.config import CareerExplorerConfig
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from evaluation_tests.career_explorer_agent.career_explorer_agent_executors import MockSectorSearchService
from app.agent.career_explorer_agent.priority_sector_explorer import PrioritySectorExplorer

DEFAULT_SECTORS = [
    {"name": "Agriculture", "description": "Commercial farming", "file": "agriculture.md"},
    {"name": "Energy", "description": "Power generation", "file": "energy.md"},
    {"name": "Mining", "description": "Copper, gold", "file": "mining.md"},
    {"name": "Hospitality", "description": "Hotels, tourism", "file": "hospitality.md"},
    {"name": "Water", "description": "Treatment, supply", "file": "water.md"},
]


@dataclass
class PriorityExplorerTestCase:
    name: str
    user_input: str
    expected_phrases: list[str]
    locale: Locale = Locale.EN_US
    # Portuguese responses contain the same facts but translated — check for these instead
    expected_phrases_absent: list[str] | None = None


PRIORITY_EXPLORER_TEST_CASES = [
    PriorityExplorerTestCase(
        "agriculture",
        "Tell me about Agriculture",
        ["Agriculture", "irrigation", "Zambeef", "TEVET", "commercial", "aquaculture", "crop"],
    ),
    PriorityExplorerTestCase(
        "mining",
        "What roles are there in mining?",
        ["Mining", "Copperbelt", "Barrick", "Heavy Equipment", "gemstone", "K7,500", "Driller"],
    ),
    PriorityExplorerTestCase(
        "hospitality",
        "What are the hospitality sectors?",
        ["Hospitality", "tourism", "hotel", "restaurant", "bar", "lodge", "guesthouse"],
    ),
    PriorityExplorerTestCase(
        "water",
        "What are the water sectors?",
        ["Water", "treatment", "supply", "wastewater", "drainage", "river", "lake"],
    ),
    PriorityExplorerTestCase(
        "energy",
        "What are the energy sectors?",
        ["Energy", "power", "generation", "renewable", "fossil", "hydro", "solar"],
    ),
    PriorityExplorerTestCase(
        "non-priority-sector",
        "What are the non-priority sectors?",
        ["Non-priority", "sectors", "not", "covered", "by", "the", "priority", "sectors"],
    ),
    # Portuguese (pt-MZ) cases — verify RAG retrieval works and response is in Portuguese
    PriorityExplorerTestCase(
        "pt_mining",
        "Quais são as funções na mineração?",
        # Proper nouns / numbers pass through untranslated; Portuguese sector words confirm language
        ["Copperbelt", "Barrick", "K7,500", "mineração", "mineiro", "equipamento", "técnico", "geólogo", "perfurador"],
        locale=Locale.PT_MZ,
        # Response must NOT be in English — if these appear it means the locale was ignored
        expected_phrases_absent=["roles in mining", "Heavy Equipment Repair", "gemstone mines"],
    ),
    PriorityExplorerTestCase(
        "pt_agriculture",
        "Fale-me sobre agricultura",
        ["agricultura", "Zambeef", "TEVET", "irrigação", "aquicultura", "comercial", "cultivo"],
        locale=Locale.PT_MZ,
        expected_phrases_absent=["Tell me about", "crop health", "irrigation"],
    ),
    PriorityExplorerTestCase(
        "pt_energy",
        "Quais são as carreiras em energia solar?",
        ["energia", "solar", "renovável", "técnico", "electricista", "geração"],
        locale=Locale.PT_MZ,
        expected_phrases_absent=["solar technicians", "power generation"],
    ),
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
@pytest.mark.parametrize("test_case", PRIORITY_EXPLORER_TEST_CASES, ids=[tc.name for tc in PRIORITY_EXPLORER_TEST_CASES])
async def test_priority_sector_explorer_rag_content(
    evals_setup,
    career_explorer_config_with_sectors,
    test_case: PriorityExplorerTestCase,
):
    get_i18n_manager().set_locale(test_case.locale)

    context = FakeConversationContext()
    context.add_turn("", "Welcome! Which sector interests you?")
    context.add_turn(test_case.user_input, "")

    mock_search = MockSectorSearchService()
    explorer = PrioritySectorExplorer(sector_search_service=mock_search)

    message, _, _, _, _ = await explorer.explore(user_input=test_case.user_input, context=context)

    response_lower = message.lower()
    found = any(phrase.lower() in response_lower for phrase in test_case.expected_phrases)
    assert found, (
        f"Priority sector response should contain at least one of {test_case.expected_phrases} "
        f"but got: {message[:400]}..."
    )

    if test_case.expected_phrases_absent:
        for phrase in test_case.expected_phrases_absent:
            assert phrase.lower() not in response_lower, (
                f"Response should NOT contain '{phrase}' (locale={test_case.locale.value}) "
                f"but it did: {message[:400]}..."
            )

    logging.info("Priority explorer test %s: found expected content in response", test_case.name)
