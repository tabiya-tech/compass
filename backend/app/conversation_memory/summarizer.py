from textwrap import dedent
import logging

from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter


class Summarizer:

    def __init__(self):

        self._summarize_system_instructions = dedent("""\
            You are a summarization expert summarizing the conversation between multiple conversation partners.
            You will get
            - the current summary: _SUMMARY_
            - the current conversation: _CURRENT_CONVERSATION_
            Your task is
            - to update the current summary by incorporating new information from the current conversation.
            The new summary should be formulated from my perspective.
            "I" in the summary will refer to me "the user". Example: "I told you ..."
            "You" in the summary will refer to you "the model". Example: "You asked me ..."
            The summary should be concise and capture the essence of the conversation, not the details.
            You will respond with the new updated summary text
            Do not include the '_SUMMARY_' tag in the response.
            Your response will be in a raw formatted non markdown text 
            It should be no longer than 100 words.
            """)
        self._llm = GeminiGenerativeLLM(config=LLMConfig())
        self._logger = logging.getLogger(self.__class__.__name__)

    async def summarize(self, context: ConversationContext) -> str:
        model_input = ConversationHistoryFormatter.format_for_summary_prompt(
                system_instructions=self._summarize_system_instructions,
                current_summary=context.summary,
                add_to_summary=context.history.turns)

        self._logger.debug("Summarizing conversation: %s", model_input)
        # TODO(Zohar): include the LLM stats in the summary
        llm_response = await self._llm.generate_content(model_input)
        return llm_response.text
