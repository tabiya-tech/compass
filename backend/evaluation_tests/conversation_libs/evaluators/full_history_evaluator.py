import textwrap

from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
)
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig
from common_libs.text_formatters import extract_json
from evaluation_tests.conversation_libs.evaluators.evaluator import (
    Evaluator,
    EvaluationResult,
)
from evaluation_tests.conversation_libs.utils import (
    _add_turn_to_context,
    _unwrap_all_history,
)


class FullHistoryEvaluator(Evaluator):
    def __init__(self, evaluation_prompt):
        self.evaluation_prompt = evaluation_prompt
        self.llm = GeminiGenerativeLLM(
            config=LLMConfig(
                model_name="gemini-1.5-pro-preview-0409",
                response_mime_type="application/json",
            )
        )

    async def evaluate(
        self, user_input: str, context: ConversationContext, agent_output: str
    ) -> EvaluationResult:
        _add_turn_to_context(
            user_input, agent_output.message_for_user, context
        )
        history_to_string = _unwrap_all_history(context)
        focus_evaluation_prompt = textwrap.dedent(
            f"""{self.evaluation_prompt}
                <Conversation Data>:
                {history_to_string}
                </Conversation Data>
            """
        )

        result = await self.llm.generate_content(focus_evaluation_prompt)
        parsed_result = extract_json.extract_json(
            result.text, EvaluationResult
        )
        return parsed_result
