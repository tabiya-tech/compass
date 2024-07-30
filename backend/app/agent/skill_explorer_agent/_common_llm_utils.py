from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext


def format_history_for_prompt(context: ConversationContext, tags_to_filter: list[str]) -> str:
    _output: str = ""
    if context.summary != "":
        _output += f"{ConversationHistoryFormatter.USER}: '{ConversationHistoryFormatter.SUMMARY_TITLE}\n{context.summary}'"

    for turn in context.history.turns:
        _output += (f"{ConversationHistoryFormatter.USER}: '{sanitize_input(turn.input.message, tags_to_filter)}'\n"
                    f"{ConversationHistoryFormatter.MODEL}: '{sanitize_input(turn.output.message_for_user, tags_to_filter)}'\n")
    return _output
