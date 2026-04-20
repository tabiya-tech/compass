from app.agent.agent_types import AgentInput, AgentOutput
from app.career_readiness.agent import CareerReadinessAgent
from app.career_readiness.module_loader import ModuleRegistry
from app.career_readiness.service import _merge_topic_status, _load_topic_status
from app.career_readiness.types import ConversationMode, TopicStatus, TopicStatusRecord
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
    ConversationTurn,
)
import logging


class CareerReadinessExecutor:
    """
    Executes the Career Readiness agent with a simple in-memory conversation history.
    """

    def __init__(self, module_id: str, mode: ConversationMode = ConversationMode.INSTRUCTION):
        registry = ModuleRegistry()
        module_config = registry.get_module(module_id)
        if module_config is None:
            raise ValueError(f"Module '{module_id}' not found in registry")
        self._module_topics: list[str] = module_config.topics or []
        self._agent = CareerReadinessAgent(
            module_title=module_config.title,
            module_content=module_config.content,
            topics=module_config.topics,
            mode=mode,
        )
        self._turns: list[ConversationTurn] = []
        # Authoritative topic_status maintained across turns (mirrors service layer)
        self._topic_status: list[TopicStatusRecord] = [
            TopicStatusRecord(topic_id=t, status=TopicStatus.NOT_COVERED, evidence="")
            for t in self._module_topics
        ]
        self._logger = logging.getLogger(CareerReadinessExecutor.__name__)

    def _build_context(self) -> ConversationContext:
        history = ConversationHistory(turns=list(self._turns))
        return ConversationContext(all_history=history, history=history, summary="")

    @property
    def topic_status(self) -> list[TopicStatusRecord]:
        return list(self._topic_status)

    @property
    def is_complete(self) -> bool:
        """True when all topics are covered — mirrors the server-side completion check."""
        return bool(self._module_topics) and all(
            r.status == TopicStatus.COVERED for r in self._topic_status
        )

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        context = self._build_context()
        result = await self._agent.execute(
            agent_input, context, current_topic_status=self._topic_status
        )
        # Merge monotonically, same as service._handle_instruction_mode_message
        self._topic_status = _merge_topic_status(
            self._topic_status,
            result.proposed_topic_status,
            logger=self._logger,
            conversation_id="eval",
        )
        turn = ConversationTurn(
            index=len(self._turns) + 1,
            input=agent_input,
            output=result.agent_output,
        )
        self._turns.append(turn)
        return result.agent_output


class CareerReadinessIsFinished:
    """
    Checks whether all module topics are covered.

    Uses the executor's server-side completion check rather than agent_output.finished,
    which is now always False (completion is determined by the service, not the agent).
    """

    def __init__(self, executor: CareerReadinessExecutor):
        self._executor = executor

    def __call__(self, agent_output: AgentOutput) -> bool:
        return self._executor.is_complete


class CareerReadinessGetConversationContextExecutor:
    """
    Returns the conversation context for the Career Readiness eval.
    """

    def __init__(self, executor: CareerReadinessExecutor):
        self._executor = executor

    async def __call__(self) -> ConversationContext:
        return self._executor._build_context()
