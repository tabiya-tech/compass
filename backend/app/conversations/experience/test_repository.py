import random
from uuid import uuid4

import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData, Timeline
from app.agent.experience.work_type import WorkType
from app.agent.explore_experiences_agent_director import DiveInPhase, ExperienceState
from app.conversations.experience.repository import ExperiencesRepository
from app.server_dependencies.database_collections import Collections
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity, OccupationEntity, AssociatedSkillEntity
from conftest import random_db_name


@pytest.fixture(scope='function')
def in_memory_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    """Fixture providing an in-memory MongoDB database for testing"""
    in_memory_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    return in_memory_db


@pytest.fixture(scope='function')
def experiences_repository(in_memory_db) -> ExperiencesRepository:
    """Fixture providing an ExperiencesRepository instance for testing"""
    return ExperiencesRepository(in_memory_db)


def generate_random_experience(index: int) -> ExperienceEntity:
    """Generate a random experience entity for testing"""
    return ExperienceEntity(
        uuid=str(uuid4()),
        experience_title=f"Experience {index}",
        company=f"Company {index}",
        timeline=Timeline(start=f"2020-01-{index % 12 + 1:02d}", end=f"2022-02-{index % 12 + 1:02d}"),
        work_type=random.choice(list(WorkType)),  # nosec B311 # random is used for testing purposes
        responsibilities=ResponsibilitiesData(
            responsibilities=[f"Responsibility {index}", f"Another task {index}"],
            non_responsibilities=[f"Not my job {index}"],
            other_peoples_responsibilities=[f"Someone else's work {index}"]
        ),
        questions_and_answers=[(f"Question {index}", f"Answer {index}")],
        summary=f"Summary for experience {index}",
        esco_occupations=[
            OccupationSkillEntity(
                occupation=OccupationEntity(
                    id=f"Occupation {index}",
                    UUID=str(uuid4()),
                    modelId=str(ObjectId()),
                    preferredLabel=f"preferred label {index}",
                    altLabels=[f"label {index}", f"label {index + 1}"],
                    description=f"Occupation description {index}",
                    scopeNote=f"Occupation Scope note {index}",
                    originUUID=str(uuid4()),
                    UUIDHistory=[str(uuid4())],
                    score=0.5 + (index % 5) * 0.1,
                    code=f"ESCO-{index}"
                ),
                associated_skills=[
                    AssociatedSkillEntity(
                        id=f"Skill {index}",
                        UUID=str(uuid4()),
                        modelId=str(ObjectId()),
                        preferredLabel=f"preferred label {index}",
                        altLabels=[f"label {index}", f"label {index + 1}"],
                        description=f"Skill description {index} ",
                        scopeNote=f"Skill Scope note {index}",
                        originUUID=str(uuid4()),
                        UUIDHistory=[str(uuid4())],
                        score=0.5,
                        skillType=random.choice(['skill/competence', 'knowledge', 'language', 'attitude', '']),  # nosec B311
                        relationType=random.choice(['essential', 'optional', '']),  # nosec B311
                        signallingValueLabel=random.choice(['high', 'medium', 'low', ''])  # nosec B311
                    )
                ]
            )
        ],
        top_skills=[
            SkillEntity(
                id=f"Skill {index}",
                UUID=str(uuid4()),
                modelId=str(ObjectId()),
                preferredLabel=f"preferred label {index}",
                altLabels=[f"label {index}", f"label {index + 1}"],
                description=f"Skill description {index} ",
                scopeNote=f"Skill Scope note {index}",
                originUUID=str(uuid4()),
                UUIDHistory=[str(uuid4())],
                score=0.5,
                skillType=random.choice(['skill/competence', 'knowledge', 'language', 'attitude', ''])  # nosec B311
            )
        ],
        remaining_skills=[
            SkillEntity(
                id=f"Remaining Skill {index}",
                UUID=str(uuid4()),
                modelId=str(ObjectId()),
                preferredLabel=f"Remaining preferred label {index}",
                altLabels=[f"Remaining label {index}", f"label {index + 1}"],
                description=f"Remaining Skill description {index} ",
                scopeNote=f"Remaining Skill Scope note {index}",
                originUUID=str(uuid4()),
                UUIDHistory=[str(uuid4())],
                score=0.5,
                skillType=random.choice(['skill/competence', 'knowledge', 'language', 'attitude', ''])  # nosec B311
            )
        ])


def generate_experience_states(count: int) -> dict[str, ExperienceState]:
    """Generate a dictionary of experience states for testing"""
    experience_states = {}
    for i in range(count):
        experience = generate_random_experience(i)
        experience_states[experience.uuid] = ExperienceState(
            dive_in_phase=random.choice(list(DiveInPhase)),  # nosec B311 # random is used for testing purposes
            experience=experience
        )
    return experience_states


class TestExperiencesRepository:
    """Test class for the ExperiencesRepository"""

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_single_session(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences for a single session ID"""
        # Arrange
        session_id = 12345
        experience_states = generate_experience_states(3)

        # Insert test data
        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {
                uuid: state.model_dump() for uuid, state in experience_states.items()
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([session_id])

        # Assert
        assert isinstance(results, dict)
        assert session_id in results
        assert len(results[session_id]) == 3

        # Verify that all experiences are present
        result_uuids = {exp.uuid for exp, _ in results[session_id]}
        expected_uuids = set(experience_states.keys())
        assert result_uuids == expected_uuids

        # Verify dive_in_phase is correctly parsed
        for experience, dive_in_phase in results[session_id]:
            original_state = experience_states[experience.uuid]
            assert dive_in_phase == original_state.dive_in_phase
            assert experience.experience_title == original_state.experience.experience_title

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_multiple_sessions(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences for multiple session IDs"""
        # Arrange
        session_ids = [100, 200, 300]
        all_states = {}

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)

        for session_id in session_ids:
            experience_states = generate_experience_states(2)
            all_states[session_id] = experience_states
            await collection.insert_one({
                "session_id": session_id,
                "experiences_state": {
                    uuid: state.model_dump() for uuid, state in experience_states.items()
                }
            })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids(session_ids)

        # Assert
        assert isinstance(results, dict)
        assert len(results) == 3

        for session_id in session_ids:
            assert session_id in results
            assert len(results[session_id]) == 2
            result_uuids = {exp.uuid for exp, _ in results[session_id]}
            expected_uuids = set(all_states[session_id].keys())
            assert result_uuids == expected_uuids

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_empty_list(
            self,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences with empty session_ids list"""
        # Act
        results = await experiences_repository.get_experiences_by_session_ids([])

        # Assert
        assert isinstance(results, dict)
        assert results == {}

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_nonexistent_session(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences for a session ID that doesn't exist"""
        # Arrange
        existing_session_id = 100
        nonexistent_session_id = 999

        experience_states = generate_experience_states(2)
        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": existing_session_id,
            "experiences_state": {
                uuid: state.model_dump() for uuid, state in experience_states.items()
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([nonexistent_session_id])

        # Assert
        assert isinstance(results, dict)
        assert nonexistent_session_id not in results

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_mixed_existing_nonexistent(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences with a mix of existing and non-existing session IDs"""
        # Arrange
        existing_session_id = 100
        nonexistent_session_id = 999

        experience_states = generate_experience_states(2)
        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": existing_session_id,
            "experiences_state": {
                uuid: state.model_dump() for uuid, state in experience_states.items()
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids(
            [nonexistent_session_id, existing_session_id]
        )

        # Assert
        assert isinstance(results, dict)
        assert nonexistent_session_id not in results
        assert existing_session_id in results
        assert len(results[existing_session_id]) == 2

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_preserves_order(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test that all session IDs are present in the returned dictionary"""
        # Arrange
        session_ids = [300, 100, 200]

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)

        for session_id in session_ids:
            experience_states = generate_experience_states(1)
            await collection.insert_one({
                "session_id": session_id,
                "experiences_state": {
                    uuid: state.model_dump() for uuid, state in experience_states.items()
                }
            })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids(session_ids)

        # Assert
        assert isinstance(results, dict)
        assert len(results) == 3
        # All session IDs should be present
        for session_id in session_ids:
            assert session_id in results
            assert len(results[session_id]) == 1

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_different_dive_in_phases(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test that experiences with different dive_in_phases are correctly parsed"""
        # Arrange
        session_id = 500

        # Create experiences with each DiveInPhase
        experiences_by_phase = {}
        for phase in DiveInPhase:
            experience = generate_random_experience(phase.value)
            experiences_by_phase[experience.uuid] = ExperienceState(
                dive_in_phase=phase,
                experience=experience
            )

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {
                uuid: state.model_dump() for uuid, state in experiences_by_phase.items()
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([session_id])

        # Assert
        assert isinstance(results, dict)
        assert session_id in results
        assert len(results[session_id]) == len(DiveInPhase)

        # Verify all phases are represented
        result_phases = {phase for _, phase in results[session_id]}
        expected_phases = set(DiveInPhase)
        assert result_phases == expected_phases

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_empty_experiences_state(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test getting experiences when experiences_state is empty"""
        # Arrange
        session_id = 600

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {}
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([session_id])

        # Assert
        assert isinstance(results, dict)
        assert session_id in results
        assert results[session_id] == []

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_verifies_all_experience_fields(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test that all fields of ExperienceEntity are correctly deserialized"""
        # Arrange
        session_id = 700
        experience = generate_random_experience(0)
        experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=experience
        )

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {
                experience.uuid: experience_state.model_dump()
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([session_id])

        # Assert
        assert isinstance(results, dict)
        assert session_id in results
        assert len(results[session_id]) == 1

        retrieved_exp, retrieved_phase = results[session_id][0]

        # Verify all fields
        assert retrieved_exp.uuid == experience.uuid
        assert retrieved_exp.experience_title == experience.experience_title
        assert retrieved_exp.company == experience.company
        assert retrieved_exp.timeline is not None
        assert experience.timeline is not None
        assert retrieved_exp.timeline.start == experience.timeline.start
        assert retrieved_exp.timeline.end == experience.timeline.end
        assert retrieved_exp.work_type == experience.work_type
        assert retrieved_exp.summary == experience.summary
        assert len(retrieved_exp.responsibilities.responsibilities) == len(experience.responsibilities.responsibilities)
        assert len(retrieved_exp.top_skills) == len(experience.top_skills)
        assert len(retrieved_exp.remaining_skills) == len(experience.remaining_skills)
        assert len(retrieved_exp.esco_occupations) == len(experience.esco_occupations)
        assert len(retrieved_exp.questions_and_answers) == len(experience.questions_and_answers)
        assert retrieved_phase == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_handles_partial_corruption(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test that partially corrupted data doesn't break the entire query"""
        # Arrange
        session_id = 800
        good_experience = generate_random_experience(0)
        good_state = ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=good_experience
        )

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {
                good_experience.uuid: good_state.model_dump(),
                "corrupt_uuid": {
                    "dive_in_phase": "INVALID_PHASE",  # Invalid phase
                    "experience": {}  # Missing required fields
                }
            }
        })

        # Act
        results = await experiences_repository.get_experiences_by_session_ids([session_id])

        # Assert - should return only the good experience, skip the corrupted one
        assert isinstance(results, dict)
        assert session_id in results
        assert len(results[session_id]) == 1
        assert results[session_id][0][0].uuid == good_experience.uuid

    @pytest.mark.asyncio
    async def test_get_experiences_by_session_ids_duplicate_session_ids(
            self,
            in_memory_db: AsyncIOMotorDatabase,
            experiences_repository: ExperiencesRepository
    ):
        """Test behavior when the same session_id appears multiple times in input"""
        # Arrange
        session_id = 900
        experience_states = generate_experience_states(2)

        collection = in_memory_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        await collection.insert_one({
            "session_id": session_id,
            "experiences_state": {
                uuid: state.model_dump() for uuid, state in experience_states.items()
            }
        })

        # Act - pass the same session_id twice
        results = await experiences_repository.get_experiences_by_session_ids([session_id, session_id])

        # Assert - dictionary should only have one entry for the session_id
        assert isinstance(results, dict)
        assert session_id in results
        assert len(results[session_id]) == 2
        # Verify the experiences are present
        assert {exp.uuid for exp, _ in results[session_id]} == set(experience_states.keys())
