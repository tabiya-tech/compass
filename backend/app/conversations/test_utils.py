import logging

import pytest

from app.agent.agent_director.abstract_agent_director import AgentDirectorState, ConversationPhase
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.experience import WorkType, ExperienceEntity
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState, ExperienceState, \
    DiveInPhase
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.conversations.constants import BEGINNING_CONVERSATION_PERCENTAGE, FINISHED_CONVERSATION_PERCENTAGE, \
    COLLECT_EXPERIENCES_PERCENTAGE, DIVE_IN_EXPERIENCES_PERCENTAGE
from app.conversations.types import ConversationPhaseResponse, CurrentConversationPhaseResponse
from app.conversations.utils import get_current_conversation_phase_response
from app.countries import Country
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingConversationPhase
from common_libs.test_utilities import get_random_session_id

logger = logging.getLogger(__name__)

all_work_types = [
    WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
    WorkType.SELF_EMPLOYMENT,
    WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
    WorkType.UNSEEN_UNPAID
]


def _get_application_state(session_id: int) -> ApplicationState:
    return ApplicationState(
        session_id=session_id,
        agent_director_state=AgentDirectorState(session_id=session_id),
        explore_experiences_director_state=ExploreExperiencesAgentDirectorState(
            session_id=session_id,
            country_of_user=Country.UNSPECIFIED),
        conversation_memory_manager_state=ConversationMemoryManagerState(session_id=session_id),
        collect_experience_state=CollectExperiencesAgentState(
            session_id=session_id,
            country_of_user=Country.UNSPECIFIED),
        skills_explorer_agent_state=SkillsExplorerAgentState(
            session_id=session_id,
            country_of_user=Country.UNSPECIFIED)
    )


def _get_experience_entity() -> ExperienceEntity:
    return ExperienceEntity(
        experience_title="Foo",
    )


class TestConversationPhase:
    def test_new_conversation(self):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a brand-new application sate
        application_state = _get_application_state(given_session_id)

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the initial phase, and the percentage is zero.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.INTRO,
            percentage=BEGINNING_CONVERSATION_PERCENTAGE
        )

    def test_completed_conversation(self):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a completed conversation state
        application_state = _get_application_state(given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.ENDED

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the finished phase, and the percentage is 100.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.ENDED,
            percentage=FINISHED_CONVERSATION_PERCENTAGE
        )

    @pytest.mark.parametrize("explored_work_types, expected_percentage", [
        (0, COLLECT_EXPERIENCES_PERCENTAGE),
        (1, COLLECT_EXPERIENCES_PERCENTAGE + 9),  # (1/4) * (40 - 5)
        (2, COLLECT_EXPERIENCES_PERCENTAGE + 17),  # (2/4) * (40 - 5)
        (3, COLLECT_EXPERIENCES_PERCENTAGE + 26),  # (3/4) * (40 - 5)
        (4, DIVE_IN_EXPERIENCES_PERCENTAGE)
    ])
    def test_n_explored_work_types(self, explored_work_types: int, expected_percentage: int):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a collect experiences phase with n explored work types
        application_state = _get_application_state(given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        application_state.collect_experience_state.explored_types = all_work_types[:explored_work_types]

        # GUARD the unexplored work types are the rest of the work types.
        application_state.collect_experience_state.unexplored_types = [
            item for item in all_work_types if item not in application_state.collect_experience_state.explored_types
        ]

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the collect experiences phase, and changed based on the explored work types.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.COLLECT_EXPERIENCES,
            percentage=expected_percentage
        )

    def test_diving_in_phase(self):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND we are in dive in phase with zero explored experiences.
        application_state = _get_application_state(given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        application_state.explore_experiences_director_state.conversation_phase = CounselingConversationPhase.DIVE_IN
        application_state.collect_experience_state.explored_types = []

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the collect experiences phase, and the percentage is 0.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.DIVE_IN,
            percentage=DIVE_IN_EXPERIENCES_PERCENTAGE
        )

    @pytest.mark.parametrize("explored, total, expected_percentage", [
        (0, 10, DIVE_IN_EXPERIENCES_PERCENTAGE),
        (1, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 6),  # (1/10) * (100 - 40)
        (3, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 18),  # (3/10) * (100 - 40)
        (5, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 30),  # (5/10) * (100 - 40)
        (7, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 42),  # (7/10) * (100 - 40)
        (10, 10, FINISHED_CONVERSATION_PERCENTAGE)
    ])
    def test_n_explored_experiences(self, explored: int, total: int, expected_percentage: int):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND n experiences are already explored
        given_experiences_state = dict()
        for i in range(explored):
            given_experiences_state[f"explored_experience_{i}"] = ExperienceState(
                dive_in_phase=DiveInPhase.PROCESSED,
                experience=_get_experience_entity()
            )

        # AND (total - explored) experiences are unexplored
        for i in range(total - explored):
            given_experiences_state[f"not_explored_experience_{i}"] = ExperienceState(
                dive_in_phase=DiveInPhase.NOT_STARTED,
                experience=_get_experience_entity()
            )

        # and we are in dive in phase with n explored and (10 - n) unexplored experiences.
        application_state = _get_application_state(given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        application_state.explore_experiences_director_state.conversation_phase = CounselingConversationPhase.DIVE_IN
        application_state.explore_experiences_director_state.experiences_state = given_experiences_state

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the collect experiences phase, and changed based on the explored work types.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.DIVE_IN,
            percentage=expected_percentage
        )
