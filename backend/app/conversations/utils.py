from datetime import timezone, datetime
from logging import Logger
from typing import cast
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingConversationPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationContext
from app.conversations.types import ConversationMessage, ConversationMessageSender, MessageReaction, \
    ConversationPhaseResponse, CurrentConversationPhaseResponse
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


def get_current_conversation_phase_response(state: ApplicationState, logger: Logger) -> ConversationPhaseResponse:
    """
    Get the current conversation phase.
    :param logger:
    :param state: ApplicationState the application state.
    :return:
    """
    current_phase: CurrentConversationPhaseResponse = CurrentConversationPhaseResponse.UNKNOWN
    current_phase_percentage: float = 0

    current_conversation_phase = state.agent_director_state.current_phase
    if current_conversation_phase == ConversationPhase.INTRO:
        ##############################
        #   1 Introduction phase.
        ##############################
        current_phase = CurrentConversationPhaseResponse.INTRO
        current_phase_percentage = 0
    elif current_conversation_phase == ConversationPhase.COUNSELING:
        ##############################
        #    2. Counseling phase.
        ##############################
        counseling_phase = state.explore_experiences_director_state.conversation_phase
        if counseling_phase == CounselingConversationPhase.COLLECT_EXPERIENCES:
            ##############################
            #    2.1 Collecting/Discovering experiences phase.
            ##############################
            current_phase = CurrentConversationPhaseResponse.COLLECT_EXPERIENCES
            current_phase_percentage = 5
        elif counseling_phase == CounselingConversationPhase.DIVE_IN:
            ##############################
            #    2.2 Diving into experiences phase, for each discovered experience.
            ##############################
            current_phase = CurrentConversationPhaseResponse.DIVE_IN
            current_phase_percentage = 30
    elif current_conversation_phase in (ConversationPhase.ENDED, ConversationPhase.CHECKOUT):
        ##############################
        #    3. Farewell phase.
        ##############################
        current_phase = CurrentConversationPhaseResponse.ENDED
        current_phase_percentage = 100
    else:
        # If the phase is not recognized, we set it to UNKNOWN.
        logger.error(f"Unknown conversation phase: {current_conversation_phase}")
        current_phase = CurrentConversationPhaseResponse.UNKNOWN
        current_phase_percentage = 0

    return ConversationPhaseResponse(
        percentage=current_phase_percentage,
        phase=current_phase
    )
