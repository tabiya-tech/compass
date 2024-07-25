import os
from typing import TextIO

from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn
from app.agent.agent_types import LLMStats

MD_NEW_LINE = "  \n"


def save_conversation_context_to_json(*, context: ConversationContext, file_path: str) -> None:
    """
    Save the conversation context to a json file
    :param context: The conversation context
    :param file_path: The file path
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(context.model_dump_json(indent=4))


def save_conversation_context_to_markdown(*, title: str, context: ConversationContext, file_path: str) -> None:
    """
    Save the conversation context to a markdown file
    :param title: A title for the markdown document
    :param context: The conversation context
    :param file_path: The file path
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f"# {title}\n\n")
        f.write("## Conversation Summary\n\n")
        f.write(f"{format_for_markdown(context.summary)}\n\n")
        f.write("## Conversation Recent History\n\n")
        for turn in context.history.turns:
            _write_turn(f, turn)
        f.write("## Conversation All History\n\n")
        for turn in context.all_history.turns:
            _write_turn(f, turn)


def _write_turn(f: TextIO, turn: ConversationTurn):
    f.write(f"### Turn {turn.index}\n\n")
    f.write(f"**User**: {format_for_markdown(turn.input.message)}{MD_NEW_LINE}")
    f.write(f"**{turn.output.agent_type}**: {format_for_markdown(turn.output.message_for_user)}{MD_NEW_LINE}")
    f.write(f"**Finished**: {turn.output.finished}{MD_NEW_LINE}")
    # Besides the standard fields, we also want to write any additional fields
    # from subclasses of AgentOutput
    for key, value in turn.output.dict().items():
        if key not in ["message_for_user", "finished", "agent_response_time_in_sec", "llm_stats"]:
            f.write(f"**{key}**: {value}{MD_NEW_LINE}")
    f.write(f"**Agent Response Time (sec)**: {turn.output.agent_response_time_in_sec}{MD_NEW_LINE}")
    for i, stats in enumerate(turn.output.llm_stats):
        _write_stats(f, stats, i)
    f.write("\n\n")


def _write_stats(f: TextIO, stats: LLMStats, index: int):
    f.write(f"***LLM call stats {index + 1}:***\n")
    if stats.error != '':
        f.write(f"* *Error*: {stats.error}\n")
    f.write(f"* *Prompt Token Count*: {stats.prompt_token_count}\n")
    f.write(f"* *Response Token Count*: {stats.response_token_count}\n")
    f.write(f"* *Response Time (sec)*: {stats.response_time_in_sec}\n")
    f.write("\n")


def format_for_markdown(s: str):
    # Replace single newlines with two spaces and a newline
    return s.replace('\n', MD_NEW_LINE)
