from datetime import timezone, datetime
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationContext
from app.conversations.types import ConversationMessage, ConversationMessageSender, MessageReaction
from app.conversations.reactions.types import Reaction


def _convert_to_message_reaction(reaction: Reaction | None) -> MessageReaction | None:
    """
    Converts a Reaction to a MessageReaction.

    :param reaction: Optional[Reaction] - the reaction to convert
    :return: Optional[MessageReaction] - the converted reaction
    """
    if reaction is None:
        return None

    return MessageReaction.from_reaction(reaction)


async def filter_conversation_history(history: 'ConversationHistory', reactions_for_session: list[Reaction]) -> list[
    ConversationMessage]:
    """
    Filter the conversation history to only include the messages that were sent by the user and the Compass.
    :param history: ConversationHistory - the conversation history
    :param reactions_for_session: Optional[List[Reaction]] - list of reactions for the session
    :return: List[ConversationMessage]
    """
    messages = []
    for turn in history.turns:
        # remove artificial messages
        if not turn.input.is_artificial:
            messages.append(ConversationMessage(
                message_id=turn.input.message_id,
                message=turn.input.message,
                sent_at=turn.input.sent_at.astimezone(timezone.utc).isoformat(),
                sender=ConversationMessageSender.USER
            ))

        # Get reaction for a compass message if it exists (user messages can't have reactions)
        compass_reaction: Reaction | None = None
        # Find and remove the reaction from the list once it's assigned to a message
        for i, reaction in enumerate(reactions_for_session):
            if turn.output.message_id == reaction.message_id:
                compass_reaction = reaction
                reactions_for_session.pop(i)
                break
        messages.append(ConversationMessage(
            message_id=turn.output.message_id,
            message=turn.output.message_for_user,
            sent_at=turn.output.sent_at.astimezone(timezone.utc).isoformat(),
            sender=ConversationMessageSender.COMPASS,
            reaction=_convert_to_message_reaction(compass_reaction)
        ))
    return messages


async def get_messages_from_conversation_manager(context: 'ConversationContext', from_index: int) -> list[
    ConversationMessage]:
    """
    Construct the response to the user from the conversation context.
    :param context:
    :param from_index:
    :return List[ConversationMessage]
    """
    # concatenate the message to the user into a single string
    # to produce a coherent conversation flow with all the messages that have been added to the history
    # during this conversation turn with the user
    _hist = context.all_history
    _last = _hist.turns[-1]

    messages = []
    for turn in context.all_history.turns[from_index:]:
        turn.output.sent_at = datetime.now(timezone.utc)
        messages.append(ConversationMessage(
            message_id=turn.output.message_id,
            message=turn.output.message_for_user,
            sent_at=turn.output.sent_at.astimezone(timezone.utc).isoformat(),
            sender=ConversationMessageSender.COMPASS,
        ))
    return messages


def get_total_explored_experiences(state: ApplicationState) -> int:
    experiences_explored = 0

    for exp in state.explore_experiences_director_state.experiences_state.values():
        # Check if the experience has been processed and has top skills
        if exp.dive_in_phase == DiveInPhase.PROCESSED and exp.experience and len(exp.experience.top_skills) > 0:
            experiences_explored += 1

    return experiences_explored
