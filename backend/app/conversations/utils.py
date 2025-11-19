from datetime import timezone, datetime
from logging import Logger
from typing import Optional

from app.agent.explore_experiences_agent_director import DiveInPhase
from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingConversationPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationContext
from app.conversations.types import ConversationMessage, ConversationMessageSender, MessageReaction, \
    ConversationPhaseResponse, CurrentConversationPhaseResponse
from app.conversations.reactions.types import Reaction
from app.conversations.constants import BEGINNING_CONVERSATION_PERCENTAGE, FINISHED_CONVERSATION_PERCENTAGE, \
    DIVE_IN_EXPERIENCES_PERCENTAGE, COLLECT_EXPERIENCES_PERCENTAGE


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
    Filter the conversation history to only include the messages that were sent by the user and the Brujula.
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

        # Get reaction for a brujula message if it exists (user messages can't have reactions)
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


def get_total_explored_experiences(state: ApplicationState, with_skills: Optional[bool] = True) -> int:
    """
    Get the total number of experiences explored in the current conversation.

    :param state: ApplicationState the application state.
    :param with_skills: bool - if True, only count experiences with top skills.
    :return:
    """

    experiences_explored = 0

    for exp in state.explore_experiences_director_state.experiences_state.values():
        # Check if the experience has been processed and has top skills.
        if exp.dive_in_phase == DiveInPhase.PROCESSED and (
                not with_skills or exp.experience and len(exp.experience.top_skills) > 0):
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
    current_phase_percentage: float = BEGINNING_CONVERSATION_PERCENTAGE
    current: int | None = None
    total: int | None = None

    current_conversation_phase = state.agent_director_state.current_phase
    if current_conversation_phase == ConversationPhase.INTRO:
        ##############################
        #   1 Introduction phase.
        ##############################
        current_phase = CurrentConversationPhaseResponse.INTRO
        current_phase_percentage = BEGINNING_CONVERSATION_PERCENTAGE
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

            # The percentage of the collect experience will be calculated based on the work types explored.
            # The formula is the number of explored work types divided by the total number of work types to explore,
            # and then scope it to the collect experiences progress percentage.
            explored_work_types = len(state.collect_experience_state.explored_types)
            unexplored_work_types = len(state.collect_experience_state.unexplored_types)
            total_work_types_to_explore = explored_work_types + unexplored_work_types
            if total_work_types_to_explore == 0:
                # If no work types to explore, we set the percentage to 0.
                current_phase_percentage = 0
            else:
                collect_experiences_gap = DIVE_IN_EXPERIENCES_PERCENTAGE - COLLECT_EXPERIENCES_PERCENTAGE
                current_phase_percentage = (explored_work_types / total_work_types_to_explore) * collect_experiences_gap

            # Round to the nearest integer and add the introduction phase percentage.
            current_phase_percentage = round(current_phase_percentage + COLLECT_EXPERIENCES_PERCENTAGE)

            # set the current work type number to the number of work types explored.
            total = total_work_types_to_explore
            current = explored_work_types + 1

            if current > total_work_types_to_explore:
                # If the current work type number is greater than the total work types to explore, set it to total.
                current = total_work_types_to_explore

        elif counseling_phase == CounselingConversationPhase.DIVE_IN:
            ##############################
            #    2.2 Diving into experiences phase, for each discovered experience.
            ##############################
            current_phase = CurrentConversationPhaseResponse.DIVE_IN

            # The percentage of the dive in experience will be calculated based on the total number of experiences
            # explored divided by the total number of experiences to explore, and then scope it to the dive in
            # experiences progress percentage.
            total_experiences_to_explore = len(state.explore_experiences_director_state.experiences_state.keys())
            total_explored_experiences = 0
            if total_experiences_to_explore == 0:
                # If no experiences to explore, we set the percentage to 0.
                current_phase_percentage = 0
            else:
                total_explored_experiences = get_total_explored_experiences(state, with_skills=False)
                dive_in_experiences_gap = FINISHED_CONVERSATION_PERCENTAGE - DIVE_IN_EXPERIENCES_PERCENTAGE
                current_phase_percentage = ((total_explored_experiences / total_experiences_to_explore)
                                            * dive_in_experiences_gap)

            # Round to the nearest integer and add the dive in phase percentage.
            current_phase_percentage = round(current_phase_percentage + DIVE_IN_EXPERIENCES_PERCENTAGE)

            # set the current experience number to the number of experiences explored.
            total = total_experiences_to_explore

            # add one because we start from 0, and 0 is not user-friendly.
            current = total_explored_experiences + 1
    elif current_conversation_phase in (ConversationPhase.ENDED, ConversationPhase.CHECKOUT):
        ##############################
        #    3. Farewell phase.
        ##############################
        current_phase = CurrentConversationPhaseResponse.ENDED
        current_phase_percentage = FINISHED_CONVERSATION_PERCENTAGE
    else:
        # If the phase is not recognized, we set it to UNKNOWN.
        logger.error(f"Unknown conversation phase: {current_conversation_phase}")
        current_phase = CurrentConversationPhaseResponse.UNKNOWN
        current_phase_percentage = BEGINNING_CONVERSATION_PERCENTAGE

    return ConversationPhaseResponse(
        percentage=current_phase_percentage,
        phase=current_phase,
        current=current,
        total=total
    )
