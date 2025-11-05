import logging
from types import SimpleNamespace

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience.experience_entity import ResponsibilitiesData
from app.agent.skill_explorer_agent._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn


class CVResponsibilitiesExtractor:
    """
    Thin wrapper around the existing responsibilities extraction logic
    to support extracting responsibilities from CV text snippets.
    """

    def __init__(self, logger: logging.Logger | None, tool: _ResponsibilitiesExtractionTool):
        self._logger = logger or logging.getLogger(self.__class__.__name__)
        self._tool = tool
        # expose underlying llm for tests that want to mock it directly
        self._responsibilities_llm = self._tool._responsibilities_extraction_llm  # noqa: SLF001 (intentional for tests)

    async def extract_responsibilities(self, experience_text: str) -> ResponsibilitiesData:
        """Extract responsibilities given a single CV experience snippet."""
        # Build a minimal ConversationContext compatible with the tool
        context = ConversationContext(
            all_history=ConversationHistory(),
            history=ConversationHistory(),
            summary="",
        )
        user_input = AgentInput(message=experience_text, is_artificial=True)
        # provide a minimal agent output to construct a turn
        agent_output = AgentOutput(
            message_for_user="(cv responsibilities extraction)",
            finished=True,
            agent_type=None,
            agent_response_time_in_sec=0,
            llm_stats=[],
        )
        context.all_history.turns.append(ConversationTurn(index=0, input=user_input, output=agent_output))

        responsibilities, _stats = await self._tool.execute(user_input=user_input, context=context)
        return responsibilities

    def _create_cv_context(self, experience_text: str):
        """
        Create a light-weight context object for tests that mimics conversation context
        with attributes accessed in tests (current_turn_index, user_input, agent_output).
        """
        # Create a fake turn with user_input/agent_output attribute names as used in tests
        turn = SimpleNamespace(
            user_input=AgentInput(message=experience_text, is_artificial=True),
            agent_output=SimpleNamespace(agent_type="cv_extractor"),
        )
        history = SimpleNamespace(turns=[turn])
        fake_context = SimpleNamespace(all_history=history, current_turn_index=0)
        return fake_context


