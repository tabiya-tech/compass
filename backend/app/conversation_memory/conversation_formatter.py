from app.conversation_memory.conversation_memory_manager import ConversationHistory


class ConversationHistoryFormatter:
    """
    A Formatter for conversation history
    """

    @staticmethod
    def format_for_prompt(history: ConversationHistory):
        """
        Format the conversation history in a suitable way to be appended to the prompt
        :param history: The conversation history to be formatted
        :return: A formatted string
        """
        return "Current conversation:\n" + "\n".join(
            [f"User: {agent_input.message}\n{agent_output.agent_type.value}: {agent_output.message_for_user}" for
             agent_input, agent_output in history])
