from vertexai.generative_models import Content, Part

from app.conversation_memory.conversation_memory_types import ConversationContext


class ConversationHistoryFormatter:
    """
    A Formatter for conversation history
    """
    SUMMARY_TITLE = "_SUMMARY_:\n"
    CONVERSATION_TITLE = "\n\n_CURRENT_CONVERSATION_:\n"
    USER = "user"
    MODEL = "model"

    @staticmethod
    def format_history_for_agent_generative_prompt(context: ConversationContext) -> list[Content]:
        """
        Format the conversation history in a suitable way to pass it an agent's chat prompt
        :param context: The conversation context to be formatted
        :return: A list of Content protos
        """
        contents: list[Content] = []

        # Handle Summary
        if context.summary != "":
            ConversationHistoryFormatter._append_part(contents, ConversationHistoryFormatter.USER,
                                                      ConversationHistoryFormatter.SUMMARY_TITLE + context.summary)
        # Handle Conversation History
        for turn in context.history.turns:
            ConversationHistoryFormatter._append_part(contents, ConversationHistoryFormatter.USER,
                                                      turn.input.message)
            ConversationHistoryFormatter._append_part(contents, ConversationHistoryFormatter.MODEL,
                                                      turn.output.message_for_user)
        return contents

    @staticmethod
    def format_for_agent_generative_prompt(context: ConversationContext,
                                           user_input: str) -> list[Content]:
        """
        Format the conversation history and the user input in a suitable way to pass as an
        input to the agent LLM
        :param context: The conversation context to be formatted
        :param user_input: The user input
        :return: A list of Content protos
        :raises: ValueError if the user_input is empty
        """
        if user_input == "":
            raise ValueError("User input cannot be empty")

        # First add the conversation history
        contents: list[Content] = ConversationHistoryFormatter.format_history_for_agent_generative_prompt(
            context=context)

        # Finally the user input
        ConversationHistoryFormatter._append_part(contents, ConversationHistoryFormatter.USER, user_input)

        return contents

    @staticmethod
    def _append_part(contents: list[Content], role: str, text: str):
        # Content list must be an alternating list of user and model parts
        # The first part is always a user part
        # If user or two model parts are adjacent, then gemini will throw an error

        # If the list is empty, we add the first part
        if len(contents) == 0:
            contents.append(Content(role=role, parts=[Part.from_text(text)]))
            return
        # If the list is not empty, we will check the last part's role
        # and decide whether to append the new part or create a new content
        last_content: Content = contents[-1]
        if last_content.role != role:
            # last part's role is different from the new part's role, so create a new content
            contents.append(Content(role=role, parts=[Part.from_text(text)]))
        else:
            # last part's role is the same as the new part's role, so append the new part's text to the last content
            new_text = last_content.parts[-1].text + "\n" + text
            contents.pop(-1)
            contents.append(Content(role=role, parts=[Part.from_text(new_text)]))

    @staticmethod
    def format_for_summary_prompt(system_instructions: str, context: ConversationContext) -> list[Content]:
        """
        Format the system_instructions and the conversation context in a suitable way to pass as an input to the summary
        LLM. For the summary LLM all the input is considered as a USER role.
        :param system_instructions: The system instructions for the summary LLM
        :param context: The conversation context to be formatted
        :return: A list of Content protos
        """
        text = system_instructions + ConversationHistoryFormatter.SUMMARY_TITLE + context.summary + \
               ConversationHistoryFormatter.CONVERSATION_TITLE + "\n".join(
            [f"User: {turn.input.message}\n{turn.output.agent_type}: {turn.output.message_for_user}" for turn
             in context.history.turns])

        return [Content.from_dict({'role': ConversationHistoryFormatter.USER, 'parts': [{'text': text}]})]
