from datetime import timezone, datetime
from logging import Logger
from typing import cast

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_types import AgentInput
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationContext
from app.conversations.types import ConversationMessage, ConversationMessageSender, MessageReaction
from app.conversations.reactions.types import Reaction
from app.metrics.types import MessageCreatedEvent, ConversationPhaseLiteral


def _convert_to_message_reaction(reaction: Reaction | None) -> MessageReaction | None:
    """
    Converts a Reaction to a MessageReaction.

    :param reaction: Optional[Reaction] - the reaction to convert
    :return: Optional[MessageReaction] - the converted reaction
    """
    if reaction is None:
        return None

    return MessageReaction.from_reaction(reaction)


async def filter_conversation_history(history: 'ConversationHistory', reactions_for_session: list[Reaction]) -> list[ConversationMessage]:
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


async def get_messages_from_conversation_manager(context: 'ConversationContext', from_index: int) -> list[ConversationMessage]:
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


def get_messages_metric_events_to_record(
        user_id: str,
        session_id: int,
        user_input: AgentInput,
        response: list[ConversationMessage]) -> list[MessageCreatedEvent]:
    """
    Record the metric events related to the messages, Once a message is sent, we record the related events.
    :param user_input: AgentInput - the user input
    :param response: List[ConversationMessage] - the response messages
    :param user_id: str - the user id
    :param session_id: int - the session id
    """

    # We want to record both user messages and AI (Compass) Messages.

    # For recording the actual user message we do that only if the user input is available.
    # For the first message, user sends empty string, and we don't want to record it.
    events = []
    if user_input.message:
        events.append(
            MessageCreatedEvent(
                user_id=user_id,
                session_id=session_id,
                message_source="USER"
            )
        )

    # For AI messages, as they come from the response, before sending them to the user, we record them.
    for _ in response:
        events.append(
            MessageCreatedEvent(
                user_id=user_id,
                session_id=session_id,
                message_source="COMPASS"
            )
        )
    return events


def get_total_explored_experiences(state: ApplicationState) -> int:
    experiences_explored = 0

    for exp in state.explore_experiences_director_state.experiences_state.values():
        # Check if the experience has been processed and has top skills
        if exp.dive_in_phase == DiveInPhase.PROCESSED and exp.experience and len(exp.experience.top_skills) > 0:
            experiences_explored += 1

    return experiences_explored


def cast_conversation_phase_to_metrics_event_phase(phase: ConversationPhase, logger: Logger) -> ConversationPhaseLiteral:
    try:
        return cast(ConversationPhaseLiteral, phase.name)
    except ValueError:
        logger.error(f"Conversation phase does not match any of known conversation metrics event phases: {phase}")
        return "UNKNOWN"
