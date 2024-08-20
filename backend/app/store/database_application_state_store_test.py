import logging.config
import os
import random
import re
from unittest.mock import patch
from uuid import uuid4

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.agent.agent_director.abstract_agent_director import AgentDirectorState, \
    ConversationPhase as AgentDirectorConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.collect_experiences_agent import CollectExperiencesAgentState, CollectedData
from app.agent.experience import ExperienceEntity, Timeline, WorkType
from app.agent.experience.experience_entity import ResponsibilitiesData
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState, \
    ConversationPhase as ExploreExperiencesConversationPhase, \
    ExperienceState, DiveInPhase
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState, ConversationHistory, \
    ConversationTurn
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.vector_search.esco_entities import SkillEntity
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

# Mute the logging of the httpx and httpcore
LOGGING_CONFIG = {
    "version": 1,
    'loggers': {
        'httpx': {
            'level': 'WARN',
        },
        'httpcore': {
            'level': 'WARN',
        },
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger()

# Get the branch name from the environment
branch_name = os.getenv('BRANCH_NAME', '')

# Replace any forbidden characters with an underscore '_'
sanitized_branch_name = re.sub(r'[ .$/\\\x00"]', '_', branch_name)

# Construct the test database name
TEST_DB_NAME = '__test_db__' + sanitized_branch_name
MONGO_URI = MongoDbSettings().mongodb_uri


async def save_application_state_and_assert_match(given_state_store: DatabaseApplicationStateStore, given_state: ApplicationState):
    """
    Save the state to the state store and assert that the state is saved successfully and matches the given state
    """
    # WHEN the given state is stored under the given_session_id
    # THEN the state is saved successfully
    await given_state_store.save_state(given_state)
    # AND WHEN the state is fetched back from the state store by the given_session_id
    fetched_state = await given_state_store.get_state(given_state.agent_director_state.session_id)
    # THEN the fetched state should match the given state
    assert fetched_state is not None
    assert fetched_state.model_dump() == given_state.model_dump()
    # AND each of the substates of the application state should match the corresponding substates of the given state
    assert fetched_state.agent_director_state.model_dump() == given_state.agent_director_state.model_dump()
    assert fetched_state.explore_experiences_director_state.model_dump() == given_state.explore_experiences_director_state.model_dump()
    assert fetched_state.conversation_memory_manager_state.model_dump() == given_state.conversation_memory_manager_state.model_dump()
    assert fetched_state.collect_experience_state.model_dump() == given_state.collect_experience_state.model_dump()
    assert fetched_state.skills_explorer_agent_state.model_dump() == given_state.skills_explorer_agent_state.model_dump()


def generate_default_application_state(session_id: int) -> ApplicationState:
    return ApplicationState(
        session_id=session_id,
        agent_director_state=AgentDirectorState(session_id=session_id),
        explore_experiences_director_state=ExploreExperiencesAgentDirectorState(session_id=session_id),
        conversation_memory_manager_state=ConversationMemoryManagerState(session_id=session_id),
        collect_experience_state=CollectExperiencesAgentState(session_id=session_id),
        skills_explorer_agent_state=SkillsExplorerAgentState(session_id=session_id)
    )


def update_agent_director_state(session_id: int, application_state: ApplicationState):
    # Set the agent director state to a new state with a different phase
    application_state.agent_director_state = AgentDirectorState(
        session_id=session_id,
        current_phase=AgentDirectorConversationPhase.CHECKOUT
    )
    return application_state


def generate_experience(index: int) -> ExperienceEntity:
    return ExperienceEntity(
        uuid=str(uuid4()),
        experience_title=f"Experience {index}",
        company="Company",
        location="Location",
        timeline=Timeline(start="2020-01-01", end="2021-01-01"),
        work_type=random.choice(list(WorkType)),  # nosec; Get a random WorkType
        responsibilities=ResponsibilitiesData(responsibilities=[f"Responsibility {index}"]),
        top_skills=[
            SkillEntity(
                id=f"Skill {index}",
                UUID=str(uuid4()),
                preferredLabel="skill",
                altLabels=["label1", "label2"],
                description=f"Skill {index} description",
                score=0.5,
                skillType='skill/competence',
            )
        ])


def generate_experience_state(experience_entity: ExperienceEntity) -> ExperienceState:
    return ExperienceState(
        dive_in_phase=random.choice(list(DiveInPhase)),  # nosec; Get a random DiveInPhase
        experience=experience_entity
    )


def update_explore_experiences_director_state(session_id: int, application_state: ApplicationState):
    # Generate a dictionary of 5 experiences with their UUID as the key
    generated_experiences = {
        experience_entity.uuid: generate_experience_state(experience_entity)
        for experience_entity in (generate_experience(i) for i in range(5))
    }

    given_conversation_phase = ExploreExperiencesConversationPhase.DIVE_IN
    given_current_experience_uuid = str(uuid4())

    application_state.explore_experiences_director_state = ExploreExperiencesAgentDirectorState(
        session_id=session_id,
        current_experience_uuid=given_current_experience_uuid,
        conversation_phase=given_conversation_phase,
        experiences_state=generated_experiences,
    )

    return application_state


def generate_history(index) -> ConversationHistory:
    return ConversationHistory(turns=[
        ConversationTurn(
            index=index,
            input=AgentInput(message=f"input {index}", is_artificial=index % 2 == 0),
            output=AgentOutput(
                               message_for_user=f"output {index}", finished=index % 2 == 1,
                               agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT,
                               agent_response_time_in_sec=0.5, llm_stats=[]
                               )
        )
    ])


def update_conversation_memory_manager_state(session_id: int, application_state: ApplicationState):
    # Set the conversation memory manager state to a new state with a different conversation history
    given_all_history = generate_history(5)
    given_summarized_history = generate_history(3)
    given_to_be_summarized_history = generate_history(2)
    given_summary = "summary"
    application_state.conversation_memory_manager_state = ConversationMemoryManagerState(
        session_id=session_id,
        all_history=given_all_history,
        unsummarized_history=given_summarized_history,
        to_be_summarized_history=given_to_be_summarized_history,
        summary=given_summary
    )
    return application_state


def generate_collected_data(index) -> CollectedData:
    return CollectedData(
        index=index,
        experience_title=f"Experience {index}",
        company="Company",
        location="Location",
        start_date="2020-01-01",
        end_date="2021-01-01",
        paid_work=True,
        work_type=random.choice(list(WorkType))  # nosec; Get a random WorkType
    )


def update_collect_experience_state(session_id: int, application_state: ApplicationState):
    # Set the collect experience state to a new state with a different conversation history
    given_collected_data = generate_collected_data(1)
    given_unexplored_types = [WorkType.SELF_EMPLOYMENT, WorkType.UNSEEN_UNPAID]
    given_explored_types = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT]
    given_first_time_visit = False
    application_state.collect_experience_state = CollectExperiencesAgentState(
        session_id=session_id,
        collected_data=[given_collected_data],
        unexplored_types=given_unexplored_types,
        explored_types=given_explored_types,
        first_time_visit=given_first_time_visit
    )
    return application_state


def update_skills_explorer_agent_state(session_id: int, application_state: ApplicationState):
    # Set the skills explorer agent state to a new state with a different conversation history
    given_first_time_for_experience = {str(uuid4()): True}
    given_experiences_explored = [str(uuid4())]
    application_state.skills_explorer_agent_state = SkillsExplorerAgentState(
        session_id=session_id,
        first_time_for_experience=given_first_time_for_experience,
        experiences_explored=given_experiences_explored
    )
    return application_state


@pytest.mark.asyncio
@pytest.mark.parametrize('given_state_callback', [
    lambda session_id, application_state: generate_default_application_state(session_id),
    update_agent_director_state,
    update_explore_experiences_director_state,
    update_conversation_memory_manager_state,
    update_collect_experience_state,
    update_skills_explorer_agent_state
], ids=[
    "initial_state",
    "updated_agent_director_state",
    "updated_explore_experiences_director_state",
    "updated_conversation_memory_manager_state",
    "updated_collect_experience_state",
    "updated_skills_explorer_agent_state"
])
async def test_database_application_state_store(given_state_callback):
    # Set up MongoDB client and database
    client = AsyncIOMotorClient(MONGO_URI)
    with patch('app.store.database_application_state_store.get_mongo_db') as mock:
        # mock get_mongo_db to return the test db
        mock.return_value = client[TEST_DB_NAME]

        # Set up state store
        state_store = DatabaseApplicationStateStore()

        try:
            # GIVEN an application state initialized with the given session_id
            given_session_id = 123
            given_initial_application_state = generate_default_application_state(given_session_id)
            given_application_state = given_state_callback(session_id=given_session_id, application_state=given_initial_application_state)
            # WHEN the application state is saved to the state store
            # THEN the application state is saved successfully
            # AND the saved state matches the given state
            await save_application_state_and_assert_match(state_store, given_application_state)
            # AND WHEN the state is deleted from the state store
            # THEN the state is deleted successfully
            await state_store.delete_state(given_session_id)
            # AND the state is not found in the state store
            fetched_state = await state_store.get_state(given_session_id)
            assert fetched_state is None

        finally:
            # Ensure cleanup of the test database regardless of the test outcome
            # To run the test locally, ensure that you have the permission to drop the database
            # await client.drop_database(TEST_DB_NAME) # TODO: Uncomment this line to drop the test database
            client.close()
