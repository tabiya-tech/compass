from typing import Literal
from typing import cast

from pydantic import BaseModel

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.experience import WorkType
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState

# Internal literals for state tracking

_ConversationPhaseLiteral = Literal["NOT_STARTED", "INTRO", "COUNSELING", "CHECKOUT", "ENDED"]
_CounselingPhaseLiteral = Literal["NOT_STARTED", "COLLECT_EXPERIENCES", "DIVE_IN", "ENDED"]


class ApplicationStatesOfInterest(BaseModel):
    conversation_phase: _ConversationPhaseLiteral
    counseling_phase: _CounselingPhaseLiteral
    compass_message_count: int
    user_message_count: int
    experiences_explored_count: int
    experiences_discovered_count: int
    experiences_by_work_type: dict[str, int]
    experiences_explored_by_work_type: dict[str, int]

    @classmethod
    def from_state(cls, state: ApplicationState) -> "ApplicationStatesOfInterest":
        """Create an ApplicationStatesOfInterest instance from an ApplicationState"""
        return cls(
            conversation_phase=_get_conversation_phase(state),
            counseling_phase=_get_counseling_phase(state),
            compass_message_count=_get_compass_message_count(state),
            user_message_count=_get_user_message_count(state),
            experiences_explored_count=_get_experiences_explored_count(state),
            experiences_discovered_count=_get_experiences_discovered_count(state),
            experiences_by_work_type=_get_experience_by_work_type(state),
            experiences_explored_by_work_type=_get_experience_explored_by_work_type(state),
        )


def _get_conversation_phase(state: ApplicationState) -> _ConversationPhaseLiteral:
    """Get the current conversation phase, handling the special case of NOT_STARTED"""
    if state.agent_director_state.current_phase == ConversationPhase.INTRO and len(
            state.conversation_memory_manager_state.all_history.turns) == 0:
        return "NOT_STARTED"
    return cast(_ConversationPhaseLiteral, state.agent_director_state.current_phase.name)


def _get_counseling_phase(state: ApplicationState) -> _CounselingPhaseLiteral:
    """Get the current counseling phase, handling the special case of NOT_STARTED"""
    # If we're in counseling phase, we return the explore experiences director state conversation phase as it is
    # Otherwise, we return NOT_STARTED
    if state.agent_director_state.current_phase == ConversationPhase.INTRO:
        return "NOT_STARTED"
    elif state.agent_director_state.current_phase == ConversationPhase.COUNSELING:
        return cast(_CounselingPhaseLiteral, state.explore_experiences_director_state.conversation_phase.name)
    elif state.agent_director_state.current_phase == ConversationPhase.CHECKOUT or state.agent_director_state.current_phase == ConversationPhase.ENDED:
        return "ENDED"
    else:
        raise ValueError(
            f"Unexpected conversation phase: {state.agent_director_state.current_phase}"
        )


def _get_compass_message_count(state: ApplicationState) -> int:
    """Get the current number of brujula messages (outputs)"""
    return sum(1 for turn in state.conversation_memory_manager_state.all_history.turns
               if turn.output)


def _get_user_message_count(state: ApplicationState) -> int:
    """
    Get the current number of user messages (inputs), excluding artificial messages and empty messages,
    since the first user message is usually empty but not artificial (to start a conversation) and we don't want
    to count it.
    """
    return sum(1 for turn in state.conversation_memory_manager_state.all_history.turns
               if turn.input and not turn.input.is_artificial and turn.input.message.strip() != "")


def _get_experiences_explored_count(state: ApplicationState) -> int:
    """Get the current number of experiences explored"""
    experiences_explored = 0
    for exp in state.explore_experiences_director_state.experiences_state.values():
        # Check if the experience has been processed
        if exp.dive_in_phase == DiveInPhase.PROCESSED:
            experiences_explored += 1
    return experiences_explored


def _get_experiences_discovered_count(state: ApplicationState) -> int:
    """Get the current number of experiences discovered"""
    return len(state.explore_experiences_director_state.experiences_state)


def _get_experience_by_work_type(state: ApplicationState) -> dict[str, int]:
    """Get the current number of experiences discovered by work type"""
    experiences_discovered = {}
    for data in state.collect_experience_state.collected_data:
        # if the work type is not in the enum, we count it as unknown.
        if WorkType.from_string_key(data.work_type) is None:
            experiences_discovered["None"] = experiences_discovered.get("None", 0) + 1
        else:
            experiences_discovered[data.work_type] = experiences_discovered.get(data.work_type, 0) + 1

    return experiences_discovered


def _get_experience_explored_by_work_type(state: ApplicationState) -> dict[str, int]:
    """
    Get the current number of experiences explored by work type

    :returns: the current number of experiences explored grouped by work type.
    `
        {
            "{{ work type }}: "{{ number of explored experience for this work type }}"
        }
    `
    """

    experiences_explored = {}
    for exp in state.explore_experiences_director_state.experiences_state.values():
        # if it is not yet finished exploration phase, skip it.
        if exp.dive_in_phase != DiveInPhase.PROCESSED:
            continue

        # if the work type is not in the enum, we count it as None.
        if exp.experience.work_type is None:
            experiences_explored["None"] = experiences_explored.get("None", 0) + 1
        else:
            experiences_explored[exp.experience.work_type.name] = experiences_explored.get(
                exp.experience.work_type.name, 0) + 1

    return experiences_explored
