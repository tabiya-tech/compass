import os
import shutil
import tempfile

import pytest

from app.agent.agent_director.abstract_agent_director import AgentDirectorState, ConversationPhase
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.store.json_application_state_store import JSONApplicationStateStore


@pytest.fixture
def temp_json_dir():
    """Create a temporary directory for JSON files"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Clean up after test
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)


@pytest.fixture
def mock_application_state():
    """Create a mock ApplicationState for testing"""
    session_id = 123

    # Create mock states
    agent_director_state = AgentDirectorState(session_id=session_id)
    explore_experiences_director_state = ExploreExperiencesAgentDirectorState(session_id=session_id)
    conversation_memory_manager_state = ConversationMemoryManagerState(session_id=session_id)
    collect_experience_state = CollectExperiencesAgentState(session_id=session_id)
    skills_explorer_agent_state = SkillsExplorerAgentState(session_id=session_id)

    # Create and return the ApplicationState
    return ApplicationState(
        session_id=session_id,
        agent_director_state=agent_director_state,
        explore_experiences_director_state=explore_experiences_director_state,
        conversation_memory_manager_state=conversation_memory_manager_state,
        collect_experience_state=collect_experience_state,
        skills_explorer_agent_state=skills_explorer_agent_state
    )


@pytest.mark.asyncio
async def test_json_store_initialization(temp_json_dir):
    """Test that the JSON store initializes correctly"""
    # GIVEN a temporary directory
    # WHEN creating a JSONApplicationStateStore
    JSONApplicationStateStore(temp_json_dir)

    # THEN the directory should exist
    assert os.path.exists(temp_json_dir)
    # AND it should be empty initially
    assert len(os.listdir(temp_json_dir)) == 0


@pytest.mark.asyncio
async def test_json_store_save_and_get_state(temp_json_dir, mock_application_state):
    """Test saving and retrieving a state from the JSON store"""
    # GIVEN a JSON store and a mock application state
    store = JSONApplicationStateStore(temp_json_dir)

    # WHEN saving the state
    await store.save_state(mock_application_state)

    # THEN a file should exist for this session
    expected_file = os.path.join(temp_json_dir, str(mock_application_state.session_id), "state.json")
    assert os.path.exists(expected_file)

    # AND the state should be retrievable
    retrieved_state = await store.get_state(mock_application_state.session_id)
    assert retrieved_state is not None
    assert retrieved_state.session_id == mock_application_state.session_id


@pytest.mark.asyncio
async def test_json_store_get_nonexistent_state(temp_json_dir):
    """Test retrieving a nonexistent state from the JSON store"""
    # GIVEN a JSON store
    store = JSONApplicationStateStore(temp_json_dir)

    # WHEN trying to get a nonexistent state
    state = await store.get_state(999)

    # THEN the result should be None
    assert state is None


@pytest.mark.asyncio
async def test_json_store_update_existing_state(temp_json_dir, mock_application_state):
    """Test updating an existing state in the JSON store"""
    # GIVEN a JSON store with an existing state
    store = JSONApplicationStateStore(temp_json_dir)
    await store.save_state(mock_application_state)

    # WHEN updating the state
    modified_state = ApplicationState(
        session_id=mock_application_state.session_id,
        agent_director_state=AgentDirectorState(
            session_id=mock_application_state.session_id,
            current_phase=ConversationPhase.COUNSELING
        ),
        explore_experiences_director_state=mock_application_state.explore_experiences_director_state,
        conversation_memory_manager_state=mock_application_state.conversation_memory_manager_state,
        collect_experience_state=mock_application_state.collect_experience_state,
        skills_explorer_agent_state=mock_application_state.skills_explorer_agent_state
    )
    await store.save_state(modified_state)

    # THEN the updated state should be retrievable
    retrieved_state = await store.get_state(mock_application_state.session_id)
    assert retrieved_state is not None
    assert retrieved_state.agent_director_state.current_phase == ConversationPhase.COUNSELING


@pytest.mark.asyncio
async def test_json_store_get_all_session_ids(temp_json_dir, mock_application_state):
    """Test getting all session IDs from the JSON store"""
    # GIVEN a JSON store with multiple states
    store = JSONApplicationStateStore(temp_json_dir)

    # Create and save multiple states
    state1 = mock_application_state
    state2 = ApplicationState(
        session_id=456,
        agent_director_state=AgentDirectorState(session_id=456),
        explore_experiences_director_state=ExploreExperiencesAgentDirectorState(session_id=456),
        conversation_memory_manager_state=ConversationMemoryManagerState(session_id=456),
        collect_experience_state=CollectExperiencesAgentState(session_id=456),
        skills_explorer_agent_state=SkillsExplorerAgentState(session_id=456)
    )

    await store.save_state(state1)
    await store.save_state(state2)

    # WHEN getting all session IDs
    session_ids = []
    async for session_id in store.get_all_session_ids():
        session_ids.append(session_id)

    # THEN all session IDs should be returned
    assert len(session_ids) == 2
    assert state1.session_id in session_ids
    assert state2.session_id in session_ids


@pytest.mark.asyncio
async def test_json_store_ensure_directory_exists():
    """Test that the JSON store creates the directory if it doesn't exist"""
    # GIVEN a non-existent directory path
    with tempfile.TemporaryDirectory() as temp_dir:
        store_dir = os.path.join(temp_dir, "nonexistent")

        # WHEN creating a JSON store
        JSONApplicationStateStore(store_dir)

        # THEN the directory should be created
        assert os.path.exists(store_dir)
        assert os.path.isdir(store_dir)


@pytest.mark.asyncio
async def test_json_store_delete_state(temp_json_dir, mock_application_state):
    """Test deleting a state from the JSON store"""
    # GIVEN a JSON store with an existing state
    store = JSONApplicationStateStore(temp_json_dir)
    await store.save_state(mock_application_state)

    # WHEN deleting the state
    result = await store.delete_state(mock_application_state.session_id)

    # THEN the deletion should be successful
    assert result is True

    # AND the file should no longer exist
    expected_file = os.path.join(temp_json_dir, f"{mock_application_state.session_id}.json")
    assert not os.path.exists(expected_file)

    # AND the state should no longer be retrievable
    retrieved_state = await store.get_state(mock_application_state.session_id)
    assert retrieved_state is None
