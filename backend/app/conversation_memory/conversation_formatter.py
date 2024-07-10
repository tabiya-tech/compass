from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn
from common_libs.llm.models_utils import LLMInput, LLMTurn


class ConversationHistoryFormatter:
    """
    A Formatter for conversation history
    """
    SUMMARY_TITLE = "_SUMMARY_:\n"
    CONVERSATION_TITLE = "\n\n_CURRENT_CONVERSATION_:\n"
    USER = "user"
    MODEL = "model"

    @staticmethod
    def format_history_for_agent_generative_prompt(context: ConversationContext) -> LLMInput:
        """
        Format the conversation history in a suitable way to pass it an agent's chat prompt
        :param context: The conversation context to be formatted
        :return: A LLMInput object
        """
        llm_input = LLMInput(turns=[])

        # Handle Summary
        if context.summary != "":
            ConversationHistoryFormatter._append_part(llm_input, ConversationHistoryFormatter.USER,
                                                      ConversationHistoryFormatter.SUMMARY_TITLE + context.summary)
        # Handle Conversation History
        for turn in context.history.turns:
            ConversationHistoryFormatter._append_part(llm_input, ConversationHistoryFormatter.USER,
                                                      turn.input.message)
            ConversationHistoryFormatter._append_part(llm_input, ConversationHistoryFormatter.MODEL,
                                                      turn.output.message_for_user)
        return llm_input

    @staticmethod
    def format_for_agent_generative_prompt(*, model_response_instructions: str | None = None,
                                           context: ConversationContext,
                                           user_input: str) -> LLMInput:
        """
        Format the conversation history and the user input in a suitable way to pass as an
        input to the agent LLM that converses with the user.
        :param model_response_instructions: The instruction to the model to return a JSON object
        :param context: The conversation context to be formatted
        :param user_input: The user input
        :return: A LLMInput object
        :raises: ValueError if the user_input is empty
        """
        if user_input == "":
            raise ValueError("User input cannot be empty")

        # First add the conversation history
        llm_input: LLMInput = ConversationHistoryFormatter.format_history_for_agent_generative_prompt(
            context=context)

        # Finally the user input
        ConversationHistoryFormatter._append_part(llm_input, ConversationHistoryFormatter.USER, user_input)

        # Eventually, add instructions for the model to return a JSON object.
        # This reinforces that the model should respond with a JSON object.
        # Without these instructions, the model might respond with a non-JSON object,
        # as it tends to adapt to the conversation history and may overlook the JSON format requirements.
        if model_response_instructions:
            ConversationHistoryFormatter._append_part(llm_input, ConversationHistoryFormatter.USER,
                                                      "\n" + model_response_instructions)
        return llm_input

    @staticmethod
    def _append_part(llm_input: LLMInput, role: str, text: str):
        # Content list must be an alternating list of user and model parts
        # The first part is always a user part
        # If user or two model parts are adjacent, then gemini will throw an error

        # If the list is empty, we add the first part
        if len(llm_input.turns) == 0:
            llm_input.turns.append(LLMTurn(role=role, content=text))
            return
        # If the list is not empty, we will check the last part's role
        # and decide whether to append the new part or create a new content
        last_turn: LLMTurn = llm_input.turns[-1]
        if last_turn.role != role:
            # last part's role is different from the new part's role, so create a new content
            llm_input.turns.append(LLMTurn(role=role, content=text))
        else:
            # last part's role is the same as the new part's role, so append the new part's text to the last content
            new_text = last_turn.content + "\n" + text
            llm_input.turns.pop(-1)
            llm_input.turns.append(LLMTurn(role=role, content=new_text))

    @staticmethod
    def format_to_string(context: ConversationContext, user_message: str = "") -> str:
        """
        Format the conversation history as a string.
        """
        output = ""
        if context.summary != "":
            output += ConversationHistoryFormatter.USER + ":" + ConversationHistoryFormatter.SUMMARY_TITLE + " " + \
                      context.summary + "\n"
        output += "\n".join(
            [f"{ConversationHistoryFormatter.USER}: {turn.input.message}\n{ConversationHistoryFormatter.MODEL}: "
             f"{turn.output.message_for_user}" for turn in context.history.turns])
        if user_message != "":
            output += f"\n{ConversationHistoryFormatter.USER}: {user_message}"
        return output

    @staticmethod
    def format_for_summary_prompt(system_instructions: str, current_summary: str,
                                  add_to_summary: list[ConversationTurn]) -> LLMInput:
        """
        Format the system_instructions, the current summary and the turns to be incorporated in the new summary
        in a suitable way to pass as an input to the LLM that will generate the new summary.
        For the LLM all the input is considered as a USER role.
        :param system_instructions: The system instructions for the summary LLM
        :param current_summary: The current summary
        :param add_to_summary: The turns to be incorporated in the new summary
        :return: A LLMInput object
        """

        add_to_summary_text = "\n".join(
            [f"user: {turn.input.message}\nmodel: {turn.output.message_for_user}" for turn in add_to_summary])

        text = system_instructions + ConversationHistoryFormatter.SUMMARY_TITLE + current_summary + \
               ConversationHistoryFormatter.CONVERSATION_TITLE + add_to_summary_text

        return LLMInput(turns=[LLMTurn(role=ConversationHistoryFormatter.USER, content=text)])
