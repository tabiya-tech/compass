from textwrap import dedent

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationHistory, \
    ConversationContext, ConversationTurn, ConversationMemoryManagerState
from common_libs.llm.gemini import GeminiGenerativeLLM, LLMConfig


class ConversationMemoryManager:
    """
    Manages the conversation history
    """

    def __init__(self, unsummarized_window_size, to_be_summarized_window_size):
        self._state = None
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

    def set_state(self, state: ConversationMemoryManagerState):
        """
        Set the conversation memory manager state
        :param state: the manager state
        """
        self._state = state

    async def get_conversation_context(self) -> ConversationContext:
        """
        Get the conversation context for a session that has been summarized as needed and should be passed to an agent.
        :return: The conversation context
        """
        return ConversationContext(
            all_history=self._state.all_history,
            history=ConversationHistory(
                turns=(self._state.to_be_summarized_history.turns + self._state.unsummarized_history.turns)
            ),
            summary=self._state.summary
        )

    async def _summarize(self, history: ConversationHistory):
        """
            Update the conversation summary to include the given history input
            :param history: the new history to include in the summary
        """
        model_input = ConversationHistoryFormatter.format_for_summary_prompt(self._system_instructions,
                                                                             ConversationContext(
                                                                                 all_history=ConversationHistory(
                                                                                     turns=self._state.all_history.turns
                                                                                 ),
                                                                                 history=history,
                                                                                 summary=self._state.summary))
        llm_response = await self._llm.generate_content_async(model_input)
        self._state.summary = llm_response

    async def update_history(self, user_input: AgentInput, agent_output: AgentOutput) -> None:
        """
        Update the conversation history for a session by appending the user input and agent output to the history.
        Additionally, the history will be summarized if the to be summarized history window is full

        :param user_input: The user input
        :param agent_output: The agent output
        """
        count = len(self._state.all_history.turns) + 1
        turn = ConversationTurn(index=count, input=user_input, output=agent_output)
        self._state.all_history.turns.append(turn)
        if len(self._state.unsummarized_history.turns) == self._unsummarized_window_size:
            self._state.to_be_summarized_history.turns.append(self._state.unsummarized_history.turns[0])
            self._state.unsummarized_history.turns.pop(0)

        self._state.unsummarized_history.turns.append(turn)

        # If the to_be_summarized_history window is full, we perform summarization
        if len(self._state.to_be_summarized_history.turns) == self._to_be_summarized_window_size:
            await self._summarize(self._state.to_be_summarized_history)
            self._state.to_be_summarized_history.turns = []
