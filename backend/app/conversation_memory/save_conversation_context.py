import os
from datetime import datetime
from textwrap import dedent
from typing import TextIO

from app.agent.agent_types import LLMStats
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn, ConversationHistory

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
    :param title: A title for the Markdown document
    :param context: The conversation context
    :param file_path: The file path
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f"# {title}\n\n")
        f.write("## Conversation Summary\n\n")
        f.write(f"{format_for_markdown(context.summary)}\n\n")
        f.write("## Conversation Recent History\n\n")
        _markdown = format_conversation_history_to_markdown_table(history=context.history)
        f.write(_markdown)
        f.write("## Conversation All History\n\n")
        _markdown = format_conversation_history_to_markdown_table(history=context.all_history)
        f.write(_markdown)


def format_conversation_history_to_markdown_table(*, history: ConversationHistory) -> str:
    """
    Save the conversation history to a markdown file
    :param history: The conversation history
    :return: The markdown string
    """

    # Create markdown content
    markdown_lines = [
        dedent("""| turn | Compass | User |
                  |------|---------|------|""")]

    # Write conversation turns
    turn_count = 1
    for index, turn in enumerate(history.turns):
        if not turn.input.is_artificial and turn.input.message:
            markdown_lines.append(f"| {turn_count} "
                                  f"| "  # leave compass message empty
                                  f"| {format_for_markdown(turn.input.message)} "
                                  f"|")
            turn_count += 1

        markdown_lines.append(dedent(f"| {turn_count} "
                                     f"| {format_for_markdown(turn.output.message_for_user)} "
                                     f"| "  # leave user message empty
                                     "|"))

    return '\n'.join(markdown_lines) + '\n'


def _format_time_difference(first_timestamp: datetime, second_timestamp: datetime):
    """Get formatted duration, eg: 1 hour, 4 minutes and 2 seconds """
    duration = second_timestamp - first_timestamp
    return _format_duration(duration.total_seconds())


def _format_duration(duration_secs: float):
    """Get formatted duration, eg: 1 hour, 4 minutes and 2 seconds """
    hours, remainder = divmod(duration_secs, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if hours:
        parts.append(f"{int(hours)} hr{'s' if hours > 1 else ''}")
    if minutes:
        parts.append(f"{int(minutes)} min{'s' if minutes > 1 else ''}")
    if seconds:
        parts.append(f"{int(seconds)} sec{'s' if seconds > 1 else ''}")
    return ' and '.join(parts)


def _format_llm_stats(llm_stats: list[LLMStats]) -> str:
    """Get formatted LLM stats"""
    stats = []
    for i, stat in enumerate(llm_stats):
        stats.append(f"***LLM call stats {i + 1}:***<br/>")
        if stat.error != '':
            stats.append(f"* *Error*: {stat.error}<br/>")
        stats.append(f"* *Prompt Token Count*: {stat.prompt_token_count}<br/>")
        stats.append(f"* *Response Token Count*: {stat.response_token_count}<br/>")
        stats.append(f"* *Response Time (sec)*: {stat.response_time_in_sec}<br/>")
    return ''.join(stats)


def _write_turn(f: TextIO, turn: ConversationTurn):
    f.write(f"### Turn {turn.index}\n\n")
    f.write(f"**User**: {format_for_markdown(turn.input.message)}{MD_NEW_LINE}")
    f.write(f"**{turn.output.agent_type}**: {format_for_markdown(turn.output.message_for_user)}{MD_NEW_LINE}")
    f.write(f"**Finished**: {turn.output.finished}{MD_NEW_LINE}")
    # Besides the standard fields, we also want to write any additional fields
    # from subclasses of AgentOutput
    for key, value in turn.output.model_dump().items():
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
    return s.replace('\n', '<br/>')
