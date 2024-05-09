import os
from typing import TextIO

from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn


def save_conversation_context_to_json(*, context: ConversationContext, file_path: str) -> None:
    """
    Save the conversation context to a json file
    :param context: The conversation context
    :param file_path: The file path
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(context.json(indent=4))


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
        f.write(f"{context.summary}\n\n")
        f.write("## Conversation Recent History\n\n")
        for turn in context.history.turns:
            _write_turn(f, turn)
        f.write("## Conversation All History\n\n")
        for turn in context.all_history.turns:
            _write_turn(f, turn)


def _write_turn(f: TextIO, turn: ConversationTurn):
    f.write(f"### Turn {turn.index}\n\n")
    f.write(f"**User**: {turn.input.message}\\\n")
    f.write(f"**{turn.output.agent_type.value}**: {turn.output.message_for_user}\\\n")
    f.write(f"**Finished**: {turn.output.finished}\n")
    f.write("\n\n")
