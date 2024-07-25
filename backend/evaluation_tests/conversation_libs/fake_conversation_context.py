import os

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn, ConversationHistory
from app.conversation_memory.save_conversation_context import save_conversation_context_to_json, save_conversation_context_to_markdown
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor


def save_conversation(context: ConversationContext, title: str, folder_path: str):
    """ Saves the conversation context to a json and markdown file."""
    save_conversation_context_to_json(context=context, file_path=os.path.join(folder_path, "conversation_context.json"))
    save_conversation_context_to_markdown(context=context, title=title,
                                          file_path=os.path.join(folder_path, "conversation_context.md"))


class FakeConversationContext(ConversationContext):
    """
    A fake conversation context that can be used in tests.
    """

    def __init__(self):
        """ Initializes the fake conversation context with empty history and summary. """
        super().__init__(all_history=ConversationHistory(turns=[]), history=ConversationHistory(turns=[]), summary="")

    def fill_conversation(self, conversation: list[ConversationRecord], summary: str):
        """ Fills the conversation history with the given conversation records. """
        agent_responses = [c for c in conversation if c.actor == Actor.EVALUATED_AGENT]
        user_responses = []
        # The format_history_for_agent_generative_prompt function assumes that the first message is from the user
        # so we need to make sure that's the case.
        if conversation[0].actor != Actor.SIMULATED_USER:
            user_responses = [ConversationRecord(message="", actor=Actor.SIMULATED_USER)]
        user_responses.extend([c for c in conversation if c.actor == Actor.SIMULATED_USER])
        for i in range(max(len(agent_responses), len(user_responses))):
            user_message = user_responses[i].message if i < len(user_responses) else ""
            agent_message = agent_responses[i].message if i < len(agent_responses) else ""
            self.all_history.turns.append(ConversationTurn(index=i, input=AgentInput(message=user_message),
                                                           output=AgentOutput(message_for_user=agent_message,
                                                                              finished=False,
                                                                              agent_response_time_in_sec=0,
                                                                              llm_stats=[])))
        self.summary = summary
        self.history.turns = self.all_history.turns[-5:]

    def add_turn(self, user_input: str, agent_response: str):
        """ Adds a turn to the conversation history."""
        self.all_history.turns.append(ConversationTurn(index=len(self.all_history.turns),
                                                       input=AgentInput(message=user_input),
                                                       output=AgentOutput(message_for_user=agent_response,
                                                                          finished=False,
                                                                          agent_response_time_in_sec=0,
                                                                          llm_stats=[])))
        self.history.turns = self.all_history.turns[-5:]

    def add_history(self, agent_input: AgentInput, agent_output: AgentOutput, summary: str = None):
        """ Adds a turn to the conversation history."""
        self.all_history.turns.append(ConversationTurn(index=len(self.all_history.turns), input=agent_input,
                                                       output=agent_output))
        self.history.turns = self.all_history.turns[-5:]
        if summary:
            self.summary = summary

    def set_summary(self, summary: str):
        self.summary = summary

    def save_conversation(self, title: str, folder_path: str):
        save_conversation(self, title, folder_path)
