import logging

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import ConversationHistory, \
    ConversationContext, ConversationTurn, ConversationMemoryManagerState
from app.conversation_memory.summarizer import Summarizer


class ConversationMemoryManager:
    """
    Manages the conversation history
    """

    def __init__(self, unsummarized_window_size, to_be_summarized_window_size):
        self._state: ConversationMemoryManagerState | None = None
        self._unsummarized_window_size = unsummarized_window_size
        self._to_be_summarized_window_size = to_be_summarized_window_size
        self._summarizer = Summarizer()
        self._logger = logging.getLogger(self.__class__.__name__)

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

    async def _summarize(self):
        """
        Update the conversation summary to include the given history input
        """
        try:
            # Generate the new summary
            self._logger.debug("Summarizing conversation:")
            self._state.summary = await self._summarizer.summarize(ConversationContext(
                all_history=ConversationHistory(turns=[]),
                history=self._state.to_be_summarized_history,
                summary=self._state.summary))
            self._logger.debug("New Summarized conversation: %s", self._state.summary)
            # Clear the to be summarized history
            self._state.to_be_summarized_history.turns.clear()
        except Exception as e:
            self._logger.error("Error summarizing conversation: %s", e, exc_info=True)

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
            await self._summarize()
