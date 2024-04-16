from collections import defaultdict
from typing import List, Tuple, TypeAlias, Dict

from app.agent.agent_types import AgentInput, AgentOutput, ConversationHistory

ConversationSummary: TypeAlias = List[str]
ConversationContext: TypeAlias = Tuple[ConversationHistory, ConversationSummary]
ConversationSummaryDict: TypeAlias = Dict[int, List[str]]
ConversationContextDict: TypeAlias = Dict[
    int, Tuple[ConversationHistory, ConversationSummary]]
ConversationHistoryDict: TypeAlias = Dict[int, ConversationHistory]


class ConversationManager:

    def __init__(self):
        self._all_history: ConversationHistoryDict = defaultdict(list)
        self._recent_history: ConversationHistoryDict = defaultdict(list)
        # move const outside of class
        self._N = 3

    async def reset(self, session_id: int):
        self._all_history[session_id] = []
        self._recent_history[session_id] = []

    async def get_conversation_history(self,
        session_id: int) -> ConversationHistory:
        return self._all_history[session_id]

    async def summarize(self, history: ConversationHistory):
        # WIP
        pass

    async def update_history(self, session_id: int, user_input: AgentInput,
        agent_output: AgentOutput):
        self._all_history[session_id].append((user_input, agent_output))
        self._recent_history[session_id].append((user_input, agent_output))

        # WIP if the window is full, we summarize and delete the recent history
        if len(self._recent_history[session_id]) > self._N:
            await self.summarize(self._recent_history[session_id])
            self._recent_history[session_id] = []
