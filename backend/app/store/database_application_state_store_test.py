import logging.config
import random
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.agent.agent_director.abstract_agent_director import ConversationPhase as AgentDirectorConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMStats
from app.agent.collect_experiences_agent import CollectedData
from app.agent.experience import ExperienceEntity, Timeline, WorkType
from app.agent.experience.experience_entity import ResponsibilitiesData
from app.agent.experience.upgrade_experience import get_editable_experience
from app.agent.explore_experiences_agent_director import ConversationPhase as ExploreExperiencesConversationPhase, \
    ExperienceState, DiveInPhase
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationHistory, ConversationTurn
from app.countries import Country
from app.server_dependencies.database_collections import Collections
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.users.generate_session_id import generate_new_session_id
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity, OccupationEntity, AssociatedSkillEntity
from common_libs.test_utilities.guard_caplog import guard_caplog
from conftest import random_db_name

logger = logging.getLogger()


@pytest.fixture(scope='function')
def in_memory_db(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    in_memory_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    return in_memory_db


@pytest.fixture(scope='function')
def database_application_state_store(in_memory_db) -> DatabaseApplicationStateStore:
    return DatabaseApplicationStateStore(in_memory_db)


def update_welcome_agent_state(application_state: ApplicationState):
    application_state.welcome_agent_state.is_first_encounter = random.choice([True, False])  # nosec B311 # random is used for testing purposes
    application_state.welcome_agent_state.country_of_user = random.choice(list(Country)) # nosec B311 # random is used for testing purposes
    application_state.welcome_agent_state.user_started_discovery = random.choice([True, False])  # nosec B311 # random is used for testing purposes


def update_agent_director_state(application_state: ApplicationState):
    application_state.agent_director_state.current_phase = random.choice(
        list(AgentDirectorConversationPhase))  # nosec B311 # random is used for testing purposes
    application_state.agent_director_state.conversation_conducted_at = datetime.now(timezone.utc)


def generate_random_experience(index: int) -> ExperienceEntity:
    return ExperienceEntity(
        uuid=str(uuid4()),
        experience_title=f"Experience {index}",
        company=f"Company {index}",
        location=f"Location {index}",
        timeline=Timeline(start=f"2020-01-{index}", end=f"2022-02-{index}"),
        work_type=random.choice(list(WorkType)),  # nosec B311 # random is used for testing purposes
        responsibilities=ResponsibilitiesData(responsibilities=[f"Responsibility {index}"]),
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
                    score=0.5,
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
                        score=0.5,
                        skillType=random.choice(['skill/competence', 'knowledge', 'language', 'attitude', '']),  # nosec B311 # random is used for testing purposes
                        relationType=random.choice(['essential', 'optional', '']),  # nosec B311 # random is used for testing purposes
                        signallingValueLabel=random.choice(['high', 'medium', 'low', ''])  # nosec B311 # random is used for testing purposes
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
                score=0.5,
                skillType=random.choice(['skill/competence', 'knowledge', 'language', 'attitude', ''])  # nosec B311 # random is used for testing purposes
            )
        ])


def generate_experience_states(count: int) -> dict[str, ExperienceState]:
    _experience_states = {}
    for i in range(count):
        experience = generate_random_experience(i)

        _experience_states[experience.uuid] = ExperienceState(
            dive_in_phase=random.choice(list(DiveInPhase)),  # nosec B311 # random is used for testing purposes
            experience=experience
        )

    return _experience_states


def update_explore_experiences_director_state(application_state: ApplicationState):
    application_state.explore_experiences_director_state.current_experience_uuid = str(uuid4())
    application_state.explore_experiences_director_state.conversation_phase = random.choice(
        list(ExploreExperiencesConversationPhase))  # nosec B311 # random is used for testing purposes
    experience_states = generate_experience_states(5)
    application_state.explore_experiences_director_state.experiences_state = experience_states
    # Set explored_experiences as subset where dive_in_phase == PROCESSED
    processed_experiences = [
        get_editable_experience(state.experience)
        for state in experience_states.values()
        if state.dive_in_phase == DiveInPhase.PROCESSED
    ]
    application_state.explore_experiences_director_state.explored_experiences = processed_experiences


def generate_history(index) -> ConversationHistory:
    return ConversationHistory(turns=[
        ConversationTurn(
            index=index,
            input=AgentInput(message=f"input {index}", is_artificial=index % 2 == 0),
            output=AgentOutput(
                message_for_user=f"output {index}", finished=index % 2 == 1,
                agent_type=random.choice(list(AgentType)),  # nosec B311 # random is used for testing purposes
                agent_response_time_in_sec=0.5, llm_stats=[
                    LLMStats(
                        error=f"error {index}",
                        prompt_token_count=100 * index,
                        response_token_count=200 * index,
                        response_time_in_sec=0.5 * index
                    )
                ]
            )
        )
    ])


def update_conversation_memory_manager_state(application_state: ApplicationState):
    # Set the conversation memory manager state to a new state with a different conversation history
    application_state.conversation_memory_manager_state.all_history = generate_history(5)
    application_state.conversation_memory_manager_state.unsummarized_history = generate_history(3)
    application_state.conversation_memory_manager_state.to_be_summarized_history = generate_history(2)
    application_state.conversation_memory_manager_state.summary = " ".join([f"summary {i}" for i in range(10)])


def generate_collected_data(index) -> CollectedData:
    return CollectedData(
        index=index,
        uuid=str(uuid4()),
        defined_at_turn_number=index,
        experience_title=f"Experience {index}",
        company="Company",
        location="Location",
        start_date="2020-01-01",
        end_date="2021-01-01",
        paid_work=True,
        work_type=random.choice(list(WorkType))  # nosec B311 # random is used for testing purposes
    )


def update_collect_experience_state(application_state: ApplicationState):
    # Set the collect experience state to a new state with a different conversation history
    application_state.collect_experience_state.collected_data = [generate_collected_data(i) for i in range(5)]
    application_state.collect_experience_state.unexplored_types = [WorkType.SELF_EMPLOYMENT, WorkType.UNSEEN_UNPAID]
    application_state.collect_experience_state.explored_types = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT]
    application_state.collect_experience_state.first_time_visit = random.choice([True, False])  # nosec B311 # random is used for testing purposes


def update_skills_explorer_agent_state(application_state: ApplicationState):
    # Set the skill explorer agent state to a new state with a different conversation history
    application_state.skills_explorer_agent_state.first_time_for_experience = {
        str(uuid4()): random.choice([True, False])}  # nosec B311 # random is used for testing purposes
    application_state.skills_explorer_agent_state.experiences_explored = [str(uuid4()) for _ in range(5)]
    application_state.skills_explorer_agent_state.country_of_user=random.choice(list(Country))  # nosec B311 # random is used for testing purposes
    application_state.skills_explorer_agent_state.question_asked_until_now = ["Question 1", "Question 2", "Question 3"]
    application_state.skills_explorer_agent_state.answers_provided= ["Answer 1", "Answer 2", "Answer 3"]


def get_test_application_state(given_session_id: int) -> ApplicationState:
    # Create a state with unique data
    state = ApplicationState.new_state(session_id=given_session_id)
    # Update all state components to have unique data
    update_agent_director_state(state)
    update_welcome_agent_state(state)
    update_explore_experiences_director_state(state)
    update_conversation_memory_manager_state(state)
    update_collect_experience_state(state)
    update_skills_explorer_agent_state(state)
    return state


class TestDatabaseApplicationStateStore:
    """
    Test class for the DatabaseApplicationStateStore.
    """

    @pytest.mark.asyncio
    @pytest.mark.parametrize('update_state_callback', [
        update_agent_director_state,
        update_welcome_agent_state,
        update_explore_experiences_director_state,
        update_conversation_memory_manager_state,
        update_collect_experience_state,
        update_skills_explorer_agent_state
    ], ids=[
        "updated_agent_director_state",
        "updated_welcome_agent_state",
        "updated_explore_experiences_director_state",
        "updated_conversation_memory_manager_state",
        "updated_collect_experience_state",
        "updated_skills_explorer_agent_state"
    ])
    async def test_database_application_state_roundtrip(self, update_state_callback, database_application_state_store):
        # (1) Initialize state in Memory-> (2) Save state in DB -> (3) Read state from DB ->
        # (4) Update state In Memory-> (5) Save state in DB -> (6) Read state from DB

        # (1) Initial state
        # GIVEN some initial application state
        given_state_id = generate_new_session_id()
        given_initial_application_state = ApplicationState.new_state(session_id=given_state_id)
        given_initial_application_state_model_dump = given_initial_application_state.model_dump()
        # (2) Save state from step (1) in DB
        # WHEN that initial state is saved in the database, the state is saved successfully
        await database_application_state_store.save_state(given_initial_application_state)

        # (3) Read state from DB
        # AND WHEN the state is read back from the database
        actual_fetched_state = await database_application_state_store.get_state(given_state_id)
        # make sure we make model dump to get a snapshot of the state, as the state object is mutable
        actual_fetched_state_model_dump = actual_fetched_state.model_dump()
        # THEN the state from step (3) is the same as the initial state from step (1)
        assert given_initial_application_state_model_dump == actual_fetched_state_model_dump

        # (4) Update the state from step (3) in memory
        # AND WHEN the newly retrieved state is updated in memory,
        # update is updating the state object in memory
        update_state_callback(application_state=actual_fetched_state)
        # make sure we make model dump to get a snapshot of the state, as the state object is mutable
        updated_actual_fetched_state_model_dump = actual_fetched_state.model_dump()
        # (5) Save the state updated in step (4) in the DB
        # AND saved again in the database, the state is saved successfully
        await database_application_state_store.save_state(actual_fetched_state)

        # (6) Read state from DB
        # AND WHEN the state read from the database
        newly_actual_fetched_state = await database_application_state_store.get_state(given_state_id)
        # THEN the state from (6) is the same as the one updated in memory in step (4)
        assert updated_actual_fetched_state_model_dump == newly_actual_fetched_state.model_dump()

    @pytest.mark.asyncio
    async def test_init_state(self, database_application_state_store):
        # GIVEN a session_id that does not exist in the database
        given_session_id = 1234
        # WHEN the Default is called
        given_actual = await database_application_state_store.get_state(given_session_id)
        # THEN the returned state is None
        assert given_actual is None

    @pytest.mark.asyncio
    async def test_get_state_for_all_sessions(self, database_application_state_store):
        # GIVEN multiple application states saved in the database
        given_session_ids = [generate_new_session_id() for _ in range(3)]
        given_states = []

        for session_id in given_session_ids:
            # Create a state with unique data
            state = ApplicationState.new_state(session_id=session_id)
            # Update all state components to have unique data
            update_agent_director_state(state)
            update_welcome_agent_state(state)
            update_explore_experiences_director_state(state)
            update_conversation_memory_manager_state(state)
            update_collect_experience_state(state)
            update_skills_explorer_agent_state(state)

            given_states.append(state)
            # Save the state
            await database_application_state_store.save_state(state)

        # WHEN get_state_for_all_sessions is called
        actual_state_ids = []
        async for state_id in database_application_state_store.get_all_session_ids():
            actual_state_ids.append(state_id)

        # THEN all saved states are retrieved
        assert len(actual_state_ids) == len(given_states)

        # AND each retrieved state matches its corresponding saved state
        # Sort both lists by session_id to ensure a consistent comparison
        given_session_ids.sort()
        actual_state_ids.sort()

        assert given_session_ids == actual_state_ids

    @pytest.mark.asyncio
    async def test_delete_state(self, database_application_state_store):
        # GIVEN a session_id that exists in the database
        given_session_id = generate_new_session_id()
        # Create a state with unique data
        state = get_test_application_state(given_session_id)

        # Save the state
        await database_application_state_store.save_state(state)

        # WHEN delete_state is called
        await database_application_state_store.delete_state(given_session_id)

        # THEN the state is deleted from the database
        actual_fetched_state = await database_application_state_store.get_state(given_session_id)
        assert actual_fetched_state is None

    @pytest.mark.asyncio
    @pytest.mark.parametrize("collection_name", [
        Collections.AGENT_DIRECTOR_STATE,
        Collections.WELCOME_AGENT_STATE,
        Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE,
        Collections.CONVERSATION_MEMORY_MANAGER_STATE,
        Collections.COLLECT_EXPERIENCE_STATE,
        Collections.SKILLS_EXPLORER_AGENT_STATE
    ], ids=[
        "agent_director_state",
        "welcome_agent_state",
        "explore_experiences_agent_director_state",
        "conversation_memory_manager_state",
        "collect_experience_state",
        "skills_explorer_agent_state"
    ])
    async def test_missing_partial_state(self, in_memory_db: AsyncIOMotorDatabase, database_application_state_store: DatabaseApplicationStateStore,
                                         collection_name: str,
                                         caplog: pytest.LogCaptureFixture):
        with caplog.at_level(logging.WARNING):
            guard_caplog(database_application_state_store._logger, caplog)

            # GIVEN a session_id that exists in the database
            given_session_id = generate_new_session_id()
            # Create a state with unique data
            state = get_test_application_state(given_session_id)
            # Save the state
            await database_application_state_store.save_state(state)

            # AND a state is missing for the given particular collection
            # Delete the state for the given collection
            await in_memory_db.get_collection(collection_name).delete_one({"session_id": given_session_id})

            # WHEN getting the state for that session_id
            actual_fetched_state = await database_application_state_store.get_state(given_session_id)

            # THEN the returned state is None
            assert actual_fetched_state is None

            # AND an error is logged
            assert len(caplog.records) == 1
            assert caplog.records[0].levelname == "ERROR"
            assert caplog.records[
                       0].message == f"Missing application state part(s) for session ID {given_session_id}. Missing part(s): ['{collection_name}']"
