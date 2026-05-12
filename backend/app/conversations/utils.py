from datetime import timezone, datetime
from logging import Logger
from typing import Optional

from app.agent.explore_experiences_agent_director import DiveInPhase
from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.conversations.phase_state_machine import JourneyPhase
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingConversationPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationContext
from app.conversations.types import ConversationMessage, ConversationMessageSender, MessageReaction, \
    ConversationPhaseResponse, CurrentConversationPhaseResponse
from app.conversations.reactions.types import Reaction
from app.conversations.constants import (
    BEGINNING_CONVERSATION_PERCENTAGE,
    DIVE_IN_EXPERIENCES_PERCENTAGE,
    COLLECT_EXPERIENCES_PERCENTAGE,
    PREFERENCE_ELICITATION_PERCENTAGE,
    RECOMMENDATION_PERCENTAGE,
    FINISHED_CONVERSATION_PERCENTAGE,
)


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
        # Determine message_type from metadata interaction_type if present
        _output_metadata = turn.output.metadata if hasattr(turn.output, 'metadata') else None
        _message_type = "TEXT"
        if _output_metadata and _output_metadata.get("task_id") is not None and "alternatives" in _output_metadata:
            _message_type = "BWS_TASK"
        messages.append(ConversationMessage(
            message_id=turn.output.message_id,
            message=turn.output.message_for_user,
            sent_at=turn.output.sent_at.astimezone(timezone.utc).isoformat(),
            sender=ConversationMessageSender.COMPASS,
            reaction=_convert_to_message_reaction(compass_reaction),
            message_type=_message_type,
            metadata=_output_metadata,
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
        _output_metadata = turn.output.metadata if hasattr(turn.output, 'metadata') else None
        _message_type = "TEXT"
        if _output_metadata and _output_metadata.get("task_id") is not None and "alternatives" in _output_metadata:
            _message_type = "BWS_TASK"
        messages.append(ConversationMessage(
            message_id=turn.output.message_id,
            message=turn.output.message_for_user,
            sent_at=turn.output.sent_at.astimezone(timezone.utc).isoformat(),
            sender=ConversationMessageSender.COMPASS,
            message_type=_message_type,
            metadata=_output_metadata,
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
    sub_phase: str | None = None

    current_conversation_phase = state.agent_director_state.current_phase
    if current_conversation_phase == ConversationPhase.INTRO:
        ##############################
        #   1 Introduction phase.
        ##############################
        current_phase = CurrentConversationPhaseResponse.INTRO
        current_phase_percentage = BEGINNING_CONVERSATION_PERCENTAGE
    elif (current_conversation_phase == ConversationPhase.COUNSELING
          and state.agent_director_state.skip_to_phase is not None):
        skip_phase = state.agent_director_state.skip_to_phase
        if skip_phase in (JourneyPhase.RECOMMENDATION, JourneyPhase.MATCHING):
            current_phase = CurrentConversationPhaseResponse.RECOMMENDATION
            current_phase_percentage = RECOMMENDATION_PERCENTAGE
        else:
            current_phase = CurrentConversationPhaseResponse.PREFERENCE_ELICITATION
            current_phase_percentage = PREFERENCE_ELICITATION_PERCENTAGE
        current = None
        total = None
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

            # Check if preference elicitation has started
            pref_elicitation_phase = state.preference_elicitation_agent_state.conversation_phase
            pref_elicitation_active = pref_elicitation_phase not in ("INTRO", "COMPLETE")

            if pref_elicitation_active:
                ##############################
                #    2.3 Preference Elicitation phase
                ##############################
                current_phase = CurrentConversationPhaseResponse.PREFERENCE_ELICITATION
                sub_phase = pref_elicitation_phase

                # Percentage is computed by partitioning the band
                # [PREFERENCE_ELICITATION_PERCENTAGE .. RECOMMENDATION_PERCENTAGE]
                # (currently 70..85, 15 pp total) across the sub-phases. Each
                # sub-phase fills only its own band monotonically. This avoids:
                #   - jumping backward when transitioning to the next journey
                #     phase (old formula could reach 100% before RECOMMENDATION),
                #   - jumping when the BWS denominator switches on
                #     (old formula's total_indicators changed mid-phase),
                #   - over/under-counting FOLLOW_UP turns (they share the
                #     VIGNETTES band; vignette completion has already advanced
                #     the bar by the time FOLLOW_UP starts).
                _eq_end = 72   # EXPERIENCE_QUESTIONS ends
                _vig_end = 78  # VIGNETTES + FOLLOW_UP end
                _gate_end = 80  # GATE ends
                _bws_end = 84  # BWS ends
                _wrapup_end = RECOMMENDATION_PERCENTAGE  # 85 — meets the next phase
                _pref_state = state.preference_elicitation_agent_state

                if pref_elicitation_phase == "EXPERIENCE_QUESTIONS":
                    # Short, turn-count-driven sub-phase (~2-3 turns). Sit at
                    # the band's lower bound; advance happens when leaving.
                    current_phase_percentage = PREFERENCE_ELICITATION_PERCENTAGE

                elif pref_elicitation_phase in ("VIGNETTES", "FOLLOW_UP"):
                    # Up to AdaptiveConfig.max_vignettes (12) vignettes. The
                    # FOLLOW_UP turn shares this band: completed_vignettes was
                    # already incremented when the user answered the vignette
                    # (before the FOLLOW_UP transition), so the bar is correct
                    # for the turn — it just doesn't advance further during
                    # the follow-up itself.
                    _vig_total = 12
                    _ratio = min(1.0, len(_pref_state.completed_vignettes) / _vig_total)
                    current_phase_percentage = round(_eq_end + _ratio * (_vig_end - _eq_end))

                elif pref_elicitation_phase == "GATE":
                    # Exactly 3 clarifying interventions.
                    _ratio = min(1.0, _pref_state.gate_interventions_completed / 3)
                    current_phase_percentage = round(_vig_end + _ratio * (_gate_end - _vig_end))

                elif pref_elicitation_phase == "BWS":
                    # 12 deterministic BWS tasks.
                    _ratio = min(1.0, _pref_state.bws_tasks_completed / 12)
                    current_phase_percentage = round(_gate_end + _ratio * (_bws_end - _gate_end))

                elif pref_elicitation_phase == "WRAPUP":
                    # Final sub-phase — meet RECOMMENDATION at the top of the band.
                    current_phase_percentage = _wrapup_end

                else:
                    # Defensive fallback for unrecognised sub-phases.
                    current_phase_percentage = PREFERENCE_ELICITATION_PERCENTAGE

                # For display: BWS is the only sub-phase with a deterministic
                # total (12 occupation-ranking tasks). All other sub-phases end
                # adaptively (AdaptiveConfig min=4 / max=12, stopping criterion
                # driven by Fisher information), so we have no honest denominator
                # to show — leave current/total as None. The frontend uses
                # sub_phase to pick a sub-phase-specific label.
                if pref_elicitation_phase == "BWS":
                    total = 12  # Total BWS tasks
                    # BWS agent increments counter AFTER showing question, so don't add +1
                    # (counter is already "pre-incremented" to match the current task)
                    current = _pref_state.bws_tasks_completed
                    if current > total:
                        current = total
            else:
                ##############################
                #    2.2 Diving into experiences (before preference elicitation)
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
                    # Update gap to end at PREFERENCE_ELICITATION instead of FINISHED
                    dive_in_experiences_gap = PREFERENCE_ELICITATION_PERCENTAGE - DIVE_IN_EXPERIENCES_PERCENTAGE
                    current_phase_percentage = ((total_explored_experiences / total_experiences_to_explore)
                                                * dive_in_experiences_gap)

                # Round to the nearest integer and add the dive in phase percentage.
                current_phase_percentage = round(current_phase_percentage + DIVE_IN_EXPERIENCES_PERCENTAGE)

                # set the current experience number to the number of experiences explored.
                total = total_experiences_to_explore

                # add one because we start from 0, and 0 is not user-friendly.
                current = total_explored_experiences + 1

                # FIX: Cap current to not exceed total (prevents "2/1 experiences" bug)
                if current > total_experiences_to_explore:
                    current = total_experiences_to_explore
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
        total=total,
        sub_phase=sub_phase,
    )
