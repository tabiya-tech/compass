"""
Tests for the Preference Elicitation Agent.

This module contains unit tests for the preference elicitation agent
components including vignette engine, preference extractor, and agent logic.
"""

import pytest
from unittest.mock import Mock, AsyncMock

from app.agent.preference_elicitation_agent.types import (
    PreferenceVector,
    Vignette,
    VignetteOption,
    VignetteResponse,
    FinancialPreferences
)
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.preference_extractor import PreferenceExtractor
from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.experience.experience_entity import ExperienceEntity


class TestPreferenceVector:
    """Tests for PreferenceVector data model."""

    def test_preference_vector_creation(self):
        """Test creating a default preference vector."""
        pv = PreferenceVector()
        assert pv.financial.importance == 0.5
        assert pv.job_security.importance == 0.5
        assert pv.confidence_score == 0.0

    def test_preference_vector_with_custom_values(self):
        """Test creating preference vector with custom values."""
        financial = FinancialPreferences(
            importance=0.8,
            minimum_acceptable_salary=50000
        )
        pv = PreferenceVector(financial=financial)
        assert pv.financial.importance == 0.8
        assert pv.financial.minimum_acceptable_salary == 50000


class TestVignetteEngine:
    """Tests for VignetteEngine."""

    @pytest.fixture
    def vignette_engine(self):
        """Create a vignette engine for testing basic functionality."""
        # Use static vignettes for unit tests
        return VignetteEngine(use_personalization=False)

    def test_vignette_engine_loads_vignettes(self, vignette_engine):
        """Test that vignette engine loads vignettes from config."""
        assert vignette_engine.get_total_vignettes_count() > 0

    def test_get_vignette_by_id(self, vignette_engine):
        """Test retrieving a vignette by ID."""
        vignette = vignette_engine.get_vignette_by_id("financial_001")
        assert vignette is not None
        assert vignette.vignette_id == "financial_001"
        assert vignette.category == "financial"

    def test_get_vignettes_by_category(self, vignette_engine):
        """Test retrieving vignettes by category."""
        financial_vignettes = vignette_engine.get_vignettes_by_category("financial")
        assert len(financial_vignettes) > 0
        assert all(v.category == "financial" for v in financial_vignettes)

    @pytest.mark.asyncio
    async def test_select_next_vignette(self, vignette_engine):
        """Test selecting next vignette based on state."""
        state = PreferenceElicitationAgentState(session_id=1)
        vignette = await vignette_engine.select_next_vignette(state)

        assert vignette is not None
        assert vignette.vignette_id not in state.completed_vignettes

    @pytest.mark.asyncio
    async def test_select_next_vignette_avoids_completed(self, vignette_engine):
        """Test that next vignette selection avoids already completed ones."""
        state = PreferenceElicitationAgentState(
            session_id=1,
            completed_vignettes=["financial_001"]
        )
        vignette = await vignette_engine.select_next_vignette(state)

        if vignette:  # May be None if all vignettes completed
            assert vignette.vignette_id != "financial_001"

    def test_get_category_counts(self, vignette_engine):
        """Test getting vignette counts by category."""
        counts = vignette_engine.get_category_counts()
        assert isinstance(counts, dict)
        assert len(counts) > 0


class TestPreferenceElicitationAgentState:
    """Tests for PreferenceElicitationAgentState."""

    def test_state_creation(self):
        """Test creating a new agent state."""
        state = PreferenceElicitationAgentState(session_id=123)
        assert state.session_id == 123
        assert state.conversation_phase == "INTRO"
        assert len(state.completed_vignettes) == 0
        assert state.conversation_turn_count == 0

    def test_can_complete_initial_state(self):
        """Test that initial state cannot complete."""
        state = PreferenceElicitationAgentState(session_id=1)
        assert not state.can_complete()

    def test_can_complete_after_minimum_vignettes(self):
        """Test completion after minimum vignettes and category coverage."""
        state = PreferenceElicitationAgentState(
            session_id=1,
            completed_vignettes=["v1", "v2", "v3", "v4", "v5"],
            categories_covered=["financial", "work_environment", "job_security",
                              "career_advancement", "work_life_balance", "task_preferences"]  # All 6 categories
        )
        state.preference_vector.confidence_score = 0.5
        assert state.can_complete()

    def test_add_vignette_response(self):
        """Test adding a vignette response."""
        state = PreferenceElicitationAgentState(session_id=1)
        response = VignetteResponse(
            vignette_id="v1",
            chosen_option_id="A",
            user_reasoning="I prefer stability",
            extracted_preferences={"job_security": 0.8},
            confidence=0.7
        )

        state.add_vignette_response(response)

        assert len(state.vignette_responses) == 1
        assert "v1" in state.completed_vignettes
        assert state.current_vignette_id is None

    def test_mark_category_covered(self):
        """Test marking a category as covered."""
        state = PreferenceElicitationAgentState(session_id=1)
        initial_to_explore = len(state.categories_to_explore)

        state.mark_category_covered("financial")

        assert "financial" in state.categories_covered
        assert "financial" not in state.categories_to_explore
        assert len(state.categories_to_explore) == initial_to_explore - 1

    def test_get_next_category_to_explore(self):
        """Test getting next category to explore."""
        state = PreferenceElicitationAgentState(session_id=1)
        next_category = state.get_next_category_to_explore()

        assert next_category in state.categories_to_explore

    def test_increment_turn_count(self):
        """Test incrementing turn count."""
        state = PreferenceElicitationAgentState(session_id=1)
        assert state.conversation_turn_count == 0

        state.increment_turn_count()
        assert state.conversation_turn_count == 1

        state.increment_turn_count()
        assert state.conversation_turn_count == 2


class TestPreferenceExtractor:
    """Tests for PreferenceExtractor."""

    @pytest.fixture
    def preference_extractor(self):
        """Create a preference extractor for testing."""
        return PreferenceExtractor()

    def test_update_preference_vector(self, preference_extractor):
        """Test updating preference vector with extraction result."""
        from app.agent.preference_elicitation_agent.preference_extractor import PreferenceExtractionResult

        pv = PreferenceVector()
        extraction_result = PreferenceExtractionResult(
            reasoning="User values stability",
            chosen_option_id="A",
            stated_reasons=["job security"],
            inferred_preferences={
                "job_security.importance": 0.8,
                "financial.importance": 0.6
            },
            confidence=0.75
        )

        updated_pv = preference_extractor.update_preference_vector(pv, extraction_result)

        # Confidence should be updated
        assert updated_pv.confidence_score > 0.0


# Integration tests would go here
class TestPreferenceElicitationAgentIntegration:
    """Integration tests for the full agent."""

    @pytest.fixture
    def agent(self):
        """Create agent instance for testing."""
        # This would require more setup including mock LLMs
        # For now, just test instantiation
        agent = PreferenceElicitationAgent()
        return agent

    def test_agent_instantiation(self, agent):
        """Test that agent can be instantiated."""
        assert agent is not None
        assert agent.agent_type.value == "PreferenceElicitationAgent"

    # TODO: Add more integration tests:
    # - Test full conversation flow
    # - Test state persistence
    # - Test error handling
    # - Test phase transitions
    # - Test preference extraction pipeline


# DB6 Integration Tests
class TestDB6Integration:
    """Tests for DB6 Youth Database integration."""

    @pytest.fixture
    def mock_db6_client(self):
        """Create a mock DB6 client for testing."""
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        return StubDB6Client()

    @pytest.fixture
    def sample_experiences(self):
        """Create sample experiences for testing."""
        from app.agent.experience import WorkType, Timeline
        return [
            ExperienceEntity(
                uuid="exp-1",
                experience_title="Software Developer",
                company="TechCorp",
                location="Nairobi",
                timeline=Timeline(start="2020", end="2022"),
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            ),
            ExperienceEntity(
                uuid="exp-2",
                experience_title="Freelance Designer",
                company="Self",
                location="Mombasa",
                timeline=Timeline(start="2022", end="2023"),
                work_type=WorkType.SELF_EMPLOYMENT
            )
        ]

    @pytest.fixture
    def sample_youth_profile(self, sample_experiences):
        """Create a sample youth profile for testing."""
        from app.epic1.db6_youth_database.db6_client import YouthProfile
        return YouthProfile(
            youth_id="youth-123",
            past_experiences=sample_experiences
        )


@pytest.mark.asyncio
class TestDB6ClientStub:
    """Tests for StubDB6Client implementation."""

    async def test_save_and_get_youth_profile(self):
        """Test saving and retrieving a youth profile."""
        # GIVEN a stub DB6 client
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        client = StubDB6Client()

        # AND a youth profile
        given_profile = YouthProfile(
            youth_id="youth-123",
            demographics={"age": 25, "location": "Nairobi"}
        )

        # WHEN saving the profile
        await client.save_youth_profile(given_profile)

        # THEN the profile should be retrievable
        actual_profile = await client.get_youth_profile("youth-123")
        assert actual_profile is not None
        assert actual_profile.youth_id == "youth-123"
        assert actual_profile.demographics["age"] == 25

    async def test_get_nonexistent_profile(self):
        """Test getting a profile that doesn't exist."""
        # GIVEN a stub DB6 client
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        client = StubDB6Client()

        # WHEN getting a non-existent profile
        actual_profile = await client.get_youth_profile("nonexistent")

        # THEN None should be returned
        assert actual_profile is None

    async def test_update_existing_profile(self):
        """Test updating an existing youth profile."""
        # GIVEN a stub DB6 client with an existing profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        from app.agent.preference_elicitation_agent.types import PreferenceVector
        client = StubDB6Client()

        given_profile = YouthProfile(youth_id="youth-123")
        await client.save_youth_profile(given_profile)

        # WHEN updating the profile with preferences
        profile = await client.get_youth_profile("youth-123")
        profile.preference_vector = PreferenceVector()
        profile.preference_vector.financial.importance = 0.8
        await client.save_youth_profile(profile)

        # THEN the updated profile should be retrievable
        actual_profile = await client.get_youth_profile("youth-123")
        assert actual_profile.preference_vector is not None
        assert actual_profile.preference_vector.financial.importance == 0.8

    async def test_delete_youth_profile(self):
        """Test deleting a youth profile."""
        # GIVEN a stub DB6 client with an existing profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        client = StubDB6Client()

        given_profile = YouthProfile(youth_id="youth-123")
        await client.save_youth_profile(given_profile)

        # WHEN deleting the profile
        deleted = await client.delete_youth_profile("youth-123")

        # THEN it should be deleted
        assert deleted is True
        actual_profile = await client.get_youth_profile("youth-123")
        assert actual_profile is None

    async def test_delete_nonexistent_profile(self):
        """Test deleting a profile that doesn't exist."""
        # GIVEN a stub DB6 client
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        client = StubDB6Client()

        # WHEN deleting a non-existent profile
        deleted = await client.delete_youth_profile("nonexistent")

        # THEN False should be returned
        assert deleted is False


@pytest.mark.asyncio
class TestAgentDB6Integration:
    """Tests for agent integration with DB6."""

    async def test_get_experiences_from_snapshot_when_db6_disabled(self):
        """Test that agent uses snapshot when DB6 is disabled."""
        # GIVEN an agent with DB6 client
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        from app.agent.experience import WorkType
        client = StubDB6Client()
        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with snapshot but DB6 disabled
        sample_experiences = [
            ExperienceEntity(
                uuid="exp-1",
                experience_title="Developer",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=sample_experiences,
            use_db6_for_fresh_data=False  # Disabled
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN snapshot should be returned
        assert experiences == sample_experiences
        assert len(experiences) == 1
        assert experiences[0].experience_title == "Developer"

    async def test_get_experiences_from_db6_when_enabled(self):
        """Test that agent fetches from DB6 when enabled."""
        # GIVEN an agent with DB6 client containing a profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        from app.agent.experience import WorkType
        client = StubDB6Client()

        db6_experiences = [
            ExperienceEntity(
                uuid="exp-db6",
                experience_title="DB6 Experience",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        profile = YouthProfile(
            youth_id="123",
            past_experiences=db6_experiences
        )
        await client.save_youth_profile(profile)

        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with DB6 enabled
        snapshot_experiences = [
            ExperienceEntity(
                uuid="exp-snapshot",
                experience_title="Snapshot Experience",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=snapshot_experiences,
            use_db6_for_fresh_data=True  # Enabled
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN DB6 experiences should be returned (not snapshot)
        assert experiences == db6_experiences
        assert len(experiences) == 1
        assert experiences[0].experience_title == "DB6 Experience"

    async def test_fallback_to_snapshot_when_db6_empty(self):
        """Test fallback to snapshot when DB6 has no experiences."""
        # GIVEN an agent with DB6 client containing empty profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        from app.agent.experience import WorkType
        client = StubDB6Client()

        profile = YouthProfile(
            youth_id="123",
            past_experiences=[]  # Empty
        )
        await client.save_youth_profile(profile)

        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with snapshot and DB6 enabled
        snapshot_experiences = [
            ExperienceEntity(
                uuid="exp-snapshot",
                experience_title="Snapshot Experience",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=snapshot_experiences,
            use_db6_for_fresh_data=True
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN snapshot should be returned (DB6 fallback)
        assert experiences == snapshot_experiences
        assert len(experiences) == 1

    async def test_fallback_to_snapshot_when_db6_profile_not_found(self):
        """Test fallback to snapshot when DB6 profile doesn't exist."""
        # GIVEN an agent with DB6 client but no profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        from app.agent.experience import WorkType
        client = StubDB6Client()
        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with snapshot and DB6 enabled
        snapshot_experiences = [
            ExperienceEntity(
                uuid="exp-snapshot",
                experience_title="Snapshot Experience",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        state = PreferenceElicitationAgentState(
            session_id=999,  # No profile for this ID
            initial_experiences_snapshot=snapshot_experiences,
            use_db6_for_fresh_data=True
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN snapshot should be returned
        assert experiences == snapshot_experiences

    async def test_fallback_to_snapshot_on_db6_error(self):
        """Test graceful fallback when DB6 throws error."""
        # GIVEN an agent with failing DB6 client
        from app.epic1.db6_youth_database.db6_client import DB6Client
        from app.agent.experience import WorkType

        class FailingDB6Client(DB6Client):
            async def get_youth_profile(self, youth_id):
                raise Exception("Database connection failed")

            async def save_youth_profile(self, profile):
                pass

            async def delete_youth_profile(self, youth_id):
                return False

        client = FailingDB6Client()
        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with snapshot and DB6 enabled
        snapshot_experiences = [
            ExperienceEntity(
                uuid="exp-snapshot",
                experience_title="Snapshot Experience",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=snapshot_experiences,
            use_db6_for_fresh_data=True
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN snapshot should be returned (graceful degradation)
        assert experiences == snapshot_experiences

    async def test_return_none_when_no_experiences_available(self):
        """Test returning None when no experiences available anywhere."""
        # GIVEN an agent without DB6 client
        agent = PreferenceElicitationAgent()

        # AND state with no snapshot
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=None,
            use_db6_for_fresh_data=False
        )
        agent.set_state(state)

        # WHEN getting experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN None should be returned
        assert experiences is None

    async def test_save_preference_vector_to_db6(self):
        """Test saving preference vector to DB6."""
        # GIVEN an agent with DB6 client
        from app.epic1.db6_youth_database.db6_client import StubDB6Client
        client = StubDB6Client()
        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with completed preferences
        state = PreferenceElicitationAgentState(session_id=123)
        state.preference_vector.financial.importance = 0.9
        state.preference_vector.confidence_score = 0.8
        state.completed_vignettes = ["v1", "v2", "v3"]
        state.categories_covered = ["financial", "work_environment"]
        agent.set_state(state)

        # WHEN saving to DB6
        await agent._save_preference_vector_to_db6()

        # THEN the profile should be saved
        profile = await client.get_youth_profile("123")
        assert profile is not None
        assert profile.preference_vector is not None
        assert profile.preference_vector.financial.importance == 0.9
        assert profile.preference_vector.confidence_score == 0.8

        # AND interaction history should be added
        assert len(profile.interaction_history) == 1
        history = profile.interaction_history[0]
        assert history["agent"] == "PreferenceElicitationAgent"
        assert history["action"] == "preference_elicitation_completed"
        assert history["vignettes_completed"] == 3
        assert history["confidence_score"] == 0.8
        assert history["categories_covered"] == ["financial", "work_environment"]

    async def test_save_preference_vector_updates_existing_profile(self):
        """Test that saving preferences updates existing profile."""
        # GIVEN an agent with DB6 client containing existing profile
        from app.epic1.db6_youth_database.db6_client import StubDB6Client, YouthProfile
        client = StubDB6Client()

        existing_profile = YouthProfile(
            youth_id="123",
            demographics={"age": 25}
        )
        await client.save_youth_profile(existing_profile)

        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with preferences
        state = PreferenceElicitationAgentState(session_id=123)
        state.preference_vector.financial.importance = 0.7
        agent.set_state(state)

        # WHEN saving preferences
        await agent._save_preference_vector_to_db6()

        # THEN the profile should be updated (not replaced)
        profile = await client.get_youth_profile("123")
        assert profile.demographics["age"] == 25  # Preserved
        assert profile.preference_vector.financial.importance == 0.7  # Added

    async def test_save_preference_vector_without_db6_client(self):
        """Test saving preferences when DB6 client not available."""
        # GIVEN an agent without DB6 client
        agent = PreferenceElicitationAgent()

        # AND state with preferences
        state = PreferenceElicitationAgentState(session_id=123)
        state.preference_vector.financial.importance = 0.8
        agent.set_state(state)

        # WHEN saving to DB6
        # THEN no error should be raised (graceful handling)
        await agent._save_preference_vector_to_db6()
        # Test passes if no exception

    async def test_save_preference_vector_handles_db6_error(self):
        """Test that DB6 save errors don't crash the agent."""
        # GIVEN an agent with failing DB6 client
        from app.epic1.db6_youth_database.db6_client import DB6Client

        class FailingSaveDB6Client(DB6Client):
            async def get_youth_profile(self, youth_id):
                return None

            async def save_youth_profile(self, profile):
                raise Exception("Database save failed")

            async def delete_youth_profile(self, youth_id):
                return False

        client = FailingSaveDB6Client()
        agent = PreferenceElicitationAgent(db6_client=client)

        # AND state with preferences
        state = PreferenceElicitationAgentState(session_id=123)
        state.preference_vector.financial.importance = 0.8
        agent.set_state(state)

        # WHEN saving to DB6
        # THEN no error should be raised (graceful error handling)
        await agent._save_preference_vector_to_db6()
        # Test passes if no exception


class TestStateDB6Fields:
    """Tests for DB6-related state fields."""

    def test_state_creation_with_db6_fields(self):
        """Test creating state with DB6 fields."""
        # GIVEN sample experiences
        from app.agent.experience import WorkType
        experiences = [
            ExperienceEntity(
                uuid="exp-1",
                experience_title="Developer",
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]

        # WHEN creating state with DB6 fields
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=experiences,
            use_db6_for_fresh_data=True
        )

        # THEN fields should be set correctly
        assert state.session_id == 123
        assert state.initial_experiences_snapshot == experiences
        assert state.use_db6_for_fresh_data is True

    def test_state_defaults_for_db6_fields(self):
        """Test default values for DB6 fields."""
        # WHEN creating state without DB6 fields
        state = PreferenceElicitationAgentState(session_id=123)

        # THEN defaults should be set
        assert state.initial_experiences_snapshot is None
        assert state.use_db6_for_fresh_data is False

    def test_state_from_document_with_db6_fields(self):
        """Test deserializing state with DB6 fields from MongoDB."""
        # GIVEN a MongoDB document with DB6 fields (using only required fields)
        doc = {
            "session_id": 123,
            "initial_experiences_snapshot": [
                {
                    "uuid": "exp-1",
                    "experience_title": "Developer",
                    "work_type": "FORMAL_SECTOR_WAGED_EMPLOYMENT"
                }
            ],
            "use_db6_for_fresh_data": True
        }

        # WHEN deserializing
        state = PreferenceElicitationAgentState.from_document(doc)

        # THEN DB6 fields should be deserialized correctly
        assert state.session_id == 123
        assert len(state.initial_experiences_snapshot) == 1
        assert state.initial_experiences_snapshot[0].experience_title == "Developer"
        assert state.use_db6_for_fresh_data is True

    def test_state_from_document_without_db6_fields(self):
        """Test deserializing state without DB6 fields (backwards compatibility)."""
        # GIVEN a MongoDB document without DB6 fields
        doc = {
            "session_id": 123
        }

        # WHEN deserializing
        state = PreferenceElicitationAgentState.from_document(doc)

        # THEN defaults should be used
        assert state.session_id == 123
        assert state.initial_experiences_snapshot is None
        assert state.use_db6_for_fresh_data is False


class TestExperienceIntegration:
    """Tests for integration with existing Compass experiences."""

    @pytest.fixture
    def mock_experiences(self):
        """Create mock experiences simulating Epic 4 CollectExperiencesAgent output."""
        from app.agent.experience.timeline import Timeline
        from app.agent.experience.work_type import WorkType
        from app.agent.experience.experience_entity import ResponsibilitiesData

        return [
            ExperienceEntity(
                experience_title="Crew Member",
                company="McDonald's",
                location="Nairobi, Kenya",
                timeline=Timeline(
                    start="2022-06",
                    end="2023-12"
                ),
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                responsibilities=ResponsibilitiesData(
                    responsibilities=["Taking orders", "Operating cash register"]
                ),
                summary="Worked as crew member",
                esco_occupations=[],
                questions_and_answers=[],
                top_skills=[],
                remaining_skills=[]
            ),
            ExperienceEntity(
                experience_title="Sales Assistant",
                company="Tumaini Store",
                location="Mombasa, Kenya",
                timeline=Timeline(
                    start="2021-03",
                    end="2022-05"
                ),
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                responsibilities=ResponsibilitiesData(
                    responsibilities=["Customer service", "Inventory management"]
                ),
                summary="Sales assistant in retail",
                esco_occupations=[],
                questions_and_answers=[],
                top_skills=[],
                remaining_skills=[]
            )
        ]

    @pytest.mark.asyncio
    async def test_agent_accesses_experiences_from_snapshot(self, mock_experiences):
        """Test that agent can access experiences from initial snapshot."""
        # GIVEN a preference agent state with experiences snapshot
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=mock_experiences,
            use_db6_for_fresh_data=False  # Use snapshot only
        )

        agent = PreferenceElicitationAgent(
            vignettes_config_path=None,
            db6_client=None
        )
        agent.set_state(state)

        # WHEN agent accesses experiences for questions
        experiences = await agent._get_experiences_for_questions()

        # THEN it should return the snapshot experiences
        assert experiences is not None
        assert len(experiences) == 2
        assert experiences[0].experience_title == "Crew Member"
        assert experiences[1].experience_title == "Sales Assistant"

    @pytest.mark.asyncio
    async def test_agent_gracefully_handles_no_experiences(self):
        """Test that agent handles missing experiences gracefully."""
        # GIVEN a preference agent state without experiences
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=None,
            use_db6_for_fresh_data=False
        )

        agent = PreferenceElicitationAgent(
            vignettes_config_path=None,
            db6_client=None
        )
        agent.set_state(state)

        # WHEN agent tries to access experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN it should return None (will use generic questions)
        assert experiences is None

    @pytest.mark.asyncio
    async def test_agent_falls_back_to_snapshot_when_db6_fails(self, mock_experiences):
        """Test that agent falls back to snapshot if DB6 is unavailable."""
        # GIVEN a preference agent with snapshot and DB6 enabled but client is None
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=mock_experiences,
            use_db6_for_fresh_data=True  # DB6 enabled but client is None
        )

        agent = PreferenceElicitationAgent(
            vignettes_config_path=None,
            db6_client=None  # DB6 not available
        )
        agent.set_state(state)

        # WHEN agent tries to access experiences
        experiences = await agent._get_experiences_for_questions()

        # THEN it should fall back to snapshot
        assert experiences is not None
        assert len(experiences) == 2
        assert experiences == mock_experiences

    def test_experience_snapshot_populated_in_application_state(self, mock_experiences):
        """Test that experiences snapshot is properly populated in ApplicationState."""
        # GIVEN an ApplicationState with explored experiences
        from app.application_state import ApplicationState
        from app.countries import Country

        state = ApplicationState.new_state(
            session_id=12345,
            country_of_user=Country.KENYA
        )

        # Populate explored experiences (simulating Epic 4)
        state.explore_experiences_director_state.explored_experiences = mock_experiences

        # WHEN we populate the preference agent snapshot
        state.preference_elicitation_agent_state.initial_experiences_snapshot = [
            exp for exp in state.explore_experiences_director_state.explored_experiences
        ]

        # THEN both should reference the same experiences
        assert len(state.preference_elicitation_agent_state.initial_experiences_snapshot) == 2
        assert state.preference_elicitation_agent_state.initial_experiences_snapshot == mock_experiences
        # Verify they're the same object references (no duplication)
        assert (id(state.preference_elicitation_agent_state.initial_experiences_snapshot[0]) ==
                id(state.explore_experiences_director_state.explored_experiences[0]))


@pytest.mark.asyncio
class TestPersonalizedVignettes:
    """Tests for personalized vignette generation."""

    @pytest.fixture
    def sample_experiences(self):
        """Create sample experiences for context extraction."""
        from app.agent.experience.timeline import Timeline
        from app.agent.experience.work_type import WorkType

        return [
            ExperienceEntity(
                experience_title="Software Developer",
                company="TechCorp Kenya",
                location="Nairobi",
                timeline=Timeline(start="2022-01", end="2024-11"),
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
            )
        ]

    async def test_user_context_extraction(self, sample_experiences):
        """Test extracting user context from experiences."""
        from app.agent.preference_elicitation_agent.user_context_extractor import UserContextExtractor
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        extractor = UserContextExtractor(llm=llm)

        context = await extractor.extract_context(sample_experiences)

        # User context should be extracted
        assert context is not None
        assert context.current_role is not None
        assert context.industry is not None

    async def test_user_context_extraction_with_no_experiences(self):
        """Test context extraction with no experiences returns default."""
        from app.agent.preference_elicitation_agent.user_context_extractor import UserContextExtractor
        from app.agent.preference_elicitation_agent.types import UserContext
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        extractor = UserContextExtractor(llm=llm)

        context = await extractor.extract_context(None)

        # Should return default context
        assert context is not None
        assert isinstance(context, UserContext)

    async def test_personalized_vignette_generation(self):
        """Test generating a personalized vignette."""
        from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer
        from app.agent.preference_elicitation_agent.types import UserContext
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        personalizer = VignettePersonalizer(llm=llm)

        # Get a template
        templates = personalizer.get_templates_by_category("financial")
        assert len(templates) > 0

        template = templates[0]

        # Create user context
        user_context = UserContext(
            current_role="Software Developer",
            industry="Technology",
            experience_level="mid"
        )

        # Generate personalized vignette
        personalized = await personalizer.personalize_vignette(
            template=template,
            user_context=user_context,
            previous_vignettes=[]
        )

        # Vignette should be generated
        assert personalized is not None
        assert personalized.vignette is not None
        assert len(personalized.vignette.options) == 2
        assert personalized.vignette.scenario_text != ""

    async def test_vignette_engine_with_personalization(self):
        """Test vignette engine using personalization."""
        from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
        from app.agent.preference_elicitation_agent.types import UserContext
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        engine = VignetteEngine(llm=llm, use_personalization=True)

        state = PreferenceElicitationAgentState(session_id=1)
        user_context = UserContext(
            current_role="Teacher",
            industry="Education",
            experience_level="junior"
        )

        # Select personalized vignette
        vignette = await engine.select_next_vignette(state, user_context=user_context)

        # Vignette should be personalized
        assert vignette is not None
        assert vignette.category == "financial"  # First category
        assert len(vignette.options) == 2

    async def test_vignette_engine_backward_compatibility(self):
        """Test vignette engine with static vignettes (backward compatibility)."""
        from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine

        # Create engine without personalization
        engine = VignetteEngine(use_personalization=False)

        state = PreferenceElicitationAgentState(session_id=1)

        # Select static vignette (no user context needed)
        vignette = await engine.select_next_vignette(state)

        # Should work with static vignettes
        assert vignette is not None

    async def test_agent_extracts_context_on_init(self, sample_experiences):
        """Test that agent extracts user context during intro phase."""
        from app.epic1.db6_youth_database.db6_client import StubDB6Client

        # Create agent with personalization enabled (default)
        agent = PreferenceElicitationAgent(
            db6_client=StubDB6Client(),
            use_personalized_vignettes=True
        )

        # Create state with experiences
        state = PreferenceElicitationAgentState(
            session_id=123,
            initial_experiences_snapshot=sample_experiences
        )
        agent.set_state(state)

        # Extract context (called during intro phase)
        await agent._extract_user_context()

        # Context should be extracted
        assert agent._user_context is not None
        assert agent._user_context.current_role is not None


class TestVignetteTemplates:
    """Tests for vignette template structure."""

    def test_template_loading(self):
        """Test loading vignette templates."""
        from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        personalizer = VignettePersonalizer(llm=llm)

        # Templates should be loaded
        assert personalizer.get_total_templates_count() > 0

    def test_template_has_required_fields(self):
        """Test that templates have required fields."""
        from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        personalizer = VignettePersonalizer(llm=llm)

        templates = personalizer.get_templates_by_category("financial")
        assert len(templates) > 0

        template = templates[0]

        # Check required fields
        assert template.template_id is not None
        assert template.category == "financial"
        assert template.trade_off is not None
        assert "dimension_a" in template.trade_off
        assert "dimension_b" in template.trade_off
        assert template.option_a is not None
        assert template.option_b is not None
        assert "high_dimensions" in template.option_a
        assert "low_dimensions" in template.option_a
        assert "salary_range" in template.option_a

    def test_get_templates_by_category(self):
        """Test getting templates by category."""
        from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer
        from common_libs.llm.generative_models import GeminiGenerativeLLM
        from common_libs.llm.models_utils import LLMConfig

        llm = GeminiGenerativeLLM(config=LLMConfig())
        personalizer = VignettePersonalizer(llm=llm)

        # Get templates for different categories
        financial_templates = personalizer.get_templates_by_category("financial")
        work_env_templates = personalizer.get_templates_by_category("work_environment")

        assert len(financial_templates) > 0
        assert all(t.category == "financial" for t in financial_templates)

        assert len(work_env_templates) > 0
        assert all(t.category == "work_environment" for t in work_env_templates)
