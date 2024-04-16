from collections import defaultdict
from typing import TypeAlias

from app.agent.agent_types import AgentInput, AgentOutput

ConversationHistory: TypeAlias = list[tuple[AgentInput, AgentOutput]]

ConversationSummary: TypeAlias = list[str]
ConversationContext: TypeAlias = tuple[ConversationHistory, ConversationSummary]
ConversationSummaryDict: TypeAlias = dict[int, list[str]]
ConversationContextDict: TypeAlias = dict[
    int, tuple[ConversationHistory, ConversationSummary]]
ConversationHistoryDict: TypeAlias = dict[int, ConversationHistory]


class ConversationMemoryManager:
    """
    Manages the conversation history
    """

    def __init__(self):
        self._all_history: ConversationHistoryDict = defaultdict(list)
        self._recent_history: ConversationHistoryDict = defaultdict(list)
        # move const outside of class
        self._N = 3

    async def reset(self, session_id: int) -> None:
        """
        Reset the conversation history for a session
        :param session_id: The session id
        """
        self._all_history[session_id] = []
        self._recent_history[session_id] = []


    async def get_conversation_history(self, session_id: int) -> ConversationHistory:
        """
        Get the conversation history for a session that has been summarized as needed and should be passed to an agent.
        :param session_id: The session id
        :return: The conversation history
        """
        return self._all_history[session_id]

    async def summarize(self, history: ConversationHistory):
        # WIP
        pass

    async def update_history(self, session_id: int, user_input: AgentInput, agent_output: AgentOutput) -> None:
        """
        Update the conversation history for a session by appending the user input and agent output to the history.
        Additionally the history will be summarized if the to be summarized history window is full

        :param session_id: The session id
        :param user_input: The user input
        :param agent_output: The agent output
        """
        self._all_history[session_id].append((user_input, agent_output))
        self._recent_history[session_id].append((user_input, agent_output))

        # WIP if the window is full, we summarize and delete the recent history
        if len(self._recent_history[session_id]) > self._N:
            await self.summarize(self._recent_history[session_id])
            self._recent_history[session_id] = []
