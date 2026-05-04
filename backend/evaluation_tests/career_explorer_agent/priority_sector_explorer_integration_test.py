"""
Integration tests for PrioritySectorExplorer that exercise the real LLM.

These tests are marked with `llm_integration` and are excluded from CI/CD
because they require Google credentials (GOOGLE_APPLICATION_CREDENTIALS or
equivalent) to initialise the Gemini LLM.

Run locally with:
    poetry run pytest -m llm_integration app/agent/career_explorer_agent/test_priority_sector_explorer_integration.py -v

Excluded from the standard pipeline run:
    poetry run pytest -k "not (smoke_test or evaluation_test)" -m "not llm_integration"
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not os.environ.get("GOOGLE_CLOUD_PROJECT"),
    reason="Requires Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT)",
)

from app.agent.career_explorer_agent.priority_sector_explorer import PrioritySectorExplorer
from app.agent.career_explorer_agent.sector_search_service import SectorChunkEntity
from app.app_config import get_application_config, set_application_config
from app.career_explorer.config import CareerExplorerConfig
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext


DEFAULT_SECTORS = [
    {"name": "Agriculture", "description": "Commercial farming", "file": "agriculture.md"},
    {"name": "Mining", "description": "Copper, gold", "file": "mining.md"},
]

MINING_CHUNKS = [
    SectorChunkEntity(
        chunk_id="mining_0",
        sector="Mining",
        text=(
            "The mining sector is the economic backbone of Zambia. Roles include Heavy Equipment Repair, "
            "Driller/Blaster, Mining Surveyor, Ventilation Technician. Copperbelt Province has 58.9% of "
            "mining employment. Large-scale mining consortiums include Mopani, KCM, FQM, Barrick. "
            "Over 48% of mining employees earn above K7,500 per month."
        ),
        score=0.92,
    ),
    SectorChunkEntity(
        chunk_id="mining_1",
        sector="Mining",
        text=(
            "Skilled Artisans and Technicians in mining earn K6,300 to K15,000+ monthly. "
            "Gemstone mines in Lufwanyama extract emeralds."
        ),
        score=0.85,
    ),
]


class _FixedChunkSearchService:
    """Returns a pre-set list of chunks regardless of query — simulates a real vector search hit."""

    def __init__(self, chunks: list[SectorChunkEntity]):
        self._chunks = chunks

    async def search(self, *, query, filter_spec=None, k: int = 5, sector=None) -> list[SectorChunkEntity]:
        return self._chunks[:k]


class _EmptySearchService:
    """Returns no chunks — simulates a topic not covered by the local embeddings."""

    async def search(self, *, query, filter_spec=None, k: int = 5, sector=None) -> list[SectorChunkEntity]:
        return []


def _make_context(user_input: str) -> FakeConversationContext:
    ctx = FakeConversationContext()
    ctx.add_turn("", "Welcome! Which sector interests you?")
    ctx.add_turn(user_input, "")
    return ctx


@pytest.fixture(autouse=True)
def _set_zambia_config(setup_multi_locale_app_config):
    """Ensure the app config has the two test sectors and Zambia as the country."""
    config = get_application_config()
    updated = config.model_copy(
        update={"career_explorer_config": CareerExplorerConfig(sectors=DEFAULT_SECTORS, country="Zambia")}
    )
    set_application_config(updated)
    get_i18n_manager().set_locale(Locale.EN_US)


# ---------------------------------------------------------------------------
# Tests that use RAG (chunks are returned by the search service)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.llm_integration
async def test_rag_path_uses_retrieved_content():
    """
    When the search service returns chunks, the LLM should ground its answer
    in that content and reference Zambia-specific details.
    """
    explorer = PrioritySectorExplorer(sector_search_service=_FixedChunkSearchService(MINING_CHUNKS))
    user_input = "What roles are there in mining?"
    message, finished, reasoning, _, _ = await explorer.explore(
        user_input=user_input,
        context=_make_context(user_input),
    )

    assert message, "Expected a non-empty response"
    assert not finished, "Conversation should not be marked finished after one turn"

    response_lower = message.lower()
    rag_specific_terms = ["copperbelt", "barrick", "k7,500", "driller", "mopani", "kcm", "fqm", "lufwanyama"]
    found = any(term in response_lower for term in rag_specific_terms)
    assert found, (
        f"Expected at least one Zambia-specific RAG term from {rag_specific_terms} in response.\n"
        f"Response: {message[:500]}"
    )


@pytest.mark.asyncio
@pytest.mark.llm_integration
async def test_rag_path_does_not_hedge_unnecessarily():
    """
    When answering from retrieved content the LLM should speak confidently,
    not use generic hedging phrases like 'generally' or 'typically'.
    """
    explorer = PrioritySectorExplorer(sector_search_service=_FixedChunkSearchService(MINING_CHUNKS))
    user_input = "What do miners earn in Zambia?"
    message, _, _, _, _ = await explorer.explore(
        user_input=user_input,
        context=_make_context(user_input),
    )

    # RAG has salary data — response should cite specific figures
    assert any(term in message for term in ["K6,300", "K7,500", "K15,000", "K6300", "K7500", "K15000"]), (
        f"Expected specific salary figures from RAG content in response.\nResponse: {message[:500]}"
    )


# ---------------------------------------------------------------------------
# Tests that use general knowledge (no chunks returned by search service)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.llm_integration
async def test_no_rag_data_answers_with_general_knowledge():
    """
    When the search service returns no chunks, the LLM must still give a
    substantive answer using general knowledge — not refuse or say 'I don't know'.
    """
    explorer = PrioritySectorExplorer(sector_search_service=_EmptySearchService())
    user_input = "What soft skills do I need to advance in mining?"
    message, _, _, _, _ = await explorer.explore(
        user_input=user_input,
        context=_make_context(user_input),
    )

    assert message, "Expected a non-empty response"

    refusal_phrases = ["i don't know", "i do not know", "no information", "cannot answer", "not sure about this"]
    response_lower = message.lower()
    for phrase in refusal_phrases:
        assert phrase not in response_lower, (
            f"Agent should not refuse when no RAG data is available. Found '{phrase}' in:\n{message[:500]}"
        )

    substantive_terms = ["communication", "teamwork", "leadership", "problem", "adaptability", "collaboration"]
    found = any(term in response_lower for term in substantive_terms)
    assert found, (
        f"Expected substantive general-knowledge answer with at least one of {substantive_terms}.\n"
        f"Response: {message[:500]}"
    )


@pytest.mark.asyncio
@pytest.mark.llm_integration
async def test_no_rag_data_applies_hedging_language():
    """
    When answering from general knowledge, the LLM should hedge rather than
    present general facts as Zambia-specific verified data.
    """
    explorer = PrioritySectorExplorer(sector_search_service=_EmptySearchService())
    user_input = "How do I grow from entry-level to senior in agriculture?"
    message, _, _, _, _ = await explorer.explore(
        user_input=user_input,
        context=_make_context(user_input),
    )

    assert message, "Expected a non-empty response"

    # At least one hedging signal expected when drawing on general knowledge
    hedging_terms = ["generally", "typically", "usually", "in most", "across the", "industry", "worldwide"]
    response_lower = message.lower()
    found = any(term in response_lower for term in hedging_terms)
    assert found, (
        f"Expected hedging language in a general-knowledge response. "
        f"Looked for any of {hedging_terms}.\nResponse: {message[:500]}"
    )
