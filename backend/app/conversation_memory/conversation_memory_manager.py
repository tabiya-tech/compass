from collections import defaultdict
from textwrap import dedent

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationHistoryDict, \
    ConversationContext, ConversationTurn, ConversationSummaryDict
from common_libs.llm.gemini import GeminiGenerativeLLM, LLMConfig


class ConversationMemoryManager:
    """
    Manages the conversation history
    """

    def __init__(self, unsummarized_window_size, to_be_summarized_window_size):
        self._all_history: ConversationHistoryDict = defaultdict(ConversationHistory)
        self._unsummarized_history: ConversationHistoryDict = defaultdict(ConversationHistory)
        self._to_be_summarized_history: ConversationHistoryDict = defaultdict(ConversationHistory)
        self._summary: ConversationSummaryDict = defaultdict(str)
        self._unsummarized_window_size = unsummarized_window_size
        self._to_be_summarized_window_size = to_be_summarized_window_size

        self._system_instructions = dedent("""\
            You are a summarization expert summarizing the conversation between multiple conversation partners.
            You will get
            - the summary: _SUMMARY_
            - the current conversation: _CURRENT_CONVERSATION_
            Your task is
            - to update the summary by incorporating new information from the current conversation.
            You will respond with the new updated summary in third person.
            Your response will be in a raw formatted non markdown text form no longer than 100 words.
            """)
        self._llm = GeminiGenerativeLLM(config=LLMConfig())

    async def reset(self, session_id: int) -> None:
        """
        Reset the conversation history for a session
        :param session_id: The session id
        """
        self._all_history[session_id].turns = []
        self._unsummarized_history[session_id].turns = []
        self._to_be_summarized_history[session_id].turns = []

    async def get_conversation_context(self, session_id: int) -> ConversationContext:
        """
        Get the conversation context for a session that has been summarized as needed and should be passed to an agent.
        :param session_id: The session id
        :return: The conversation context
        """
        return ConversationContext(
            history=ConversationHistory(
                turns=(self._to_be_summarized_history[session_id].turns + self._unsummarized_history[session_id].turns)
            ),
            summary=self._summary[session_id]
        )

    async def _summarize(self, session_id: int, history: ConversationHistory):
        """
            Update the conversation summary to include the given history input
            :param history: the new history to include in the summary
        """
        model_input = ConversationHistoryFormatter.format_for_summary_prompt(self._system_instructions,
                                                                             ConversationContext(history=history,
                                                                                                 summary=self._summary[
                                                                                                     session_id]))
        llm_response = await self._llm.generate_content_async(model_input)
        self._summary[session_id] = llm_response

    async def update_history(self, session_id: int, user_input: AgentInput, agent_output: AgentOutput) -> None:
        """
        Update the conversation history for a session by appending the user input and agent output to the history.
        Additionally, the history will be summarized if the to be summarized history window is full

        :param session_id: The session id
        :param user_input: The user input
        :param agent_output: The agent output
        """
        count = len(self._all_history[session_id].turns) + 1
        turn = ConversationTurn(index=count, input=user_input, output=agent_output)
        self._all_history[session_id].turns.append(turn)
        if len(self._unsummarized_history[session_id].turns) == self._unsummarized_window_size:
            self._to_be_summarized_history[session_id].turns.append(self._unsummarized_history[session_id].turns[0])
            self._unsummarized_history[session_id].turns.pop(0)

        self._unsummarized_history[session_id].turns.append(turn)

        # If the to_be_summarized_history window is full, we perform summarization
        if len(self._to_be_summarized_history[session_id].turns) == self._to_be_summarized_window_size:
            await self._summarize(session_id, self._to_be_summarized_history[session_id])
            self._to_be_summarized_history[session_id].turns = []
