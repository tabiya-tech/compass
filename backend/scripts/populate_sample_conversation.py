import asyncio
import logging
import argparse
import os
import uuid
import dotenv
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.agent.welcome_agent import WelcomeAgentState
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.agent_director.abstract_agent_director import AgentDirectorState, ConversationPhase
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState, ConversationPhase as ExplorePhase
from app.agent.explore_experiences_agent_director import ExperienceState, DiveInPhase
from app.agent.collect_experiences_agent import CollectExperiencesAgentState, CollectedData
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState, ConversationHistory, ConversationTurn
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.work_type import WorkType
from app.agent.experience.timeline import Timeline
from app.application_state import ApplicationState
from app.vector_search.esco_entities import SkillEntity

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def populate_sample_conversation(*, mongo_uri: str, database_name: str, _session_id: int, hot_run: bool = False):
    """
    Script to populate an existing conversation session with a sample completed conversation history.
    
    Args:
        mongo_uri: MongoDB connection URI (required)
        database_name: Name of the database to use (required)
        _session_id: Session ID to use (required)
        hot_run: If True, save the state to the database, otherwise just simulate (dry run)
    """
    try:
        # Validate session ID
        if _session_id is None:
            raise ValueError("Session ID is required. Please provide a session ID using the --session-id parameter.")

        logger.info(f"Starting sample conversation population {'(HOT RUN)' if hot_run else '(DRY RUN)'} for session ID: {_session_id}")

        # Connect to MongoDB (required for both hot run and dry run)
        if not mongo_uri or not database_name:
            raise ValueError("MongoDB URI and database name are required for both hot run and dry run modes")

        # Get application database using the provider
        client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
        db = client.get_database(database_name)
        state_store = DatabaseApplicationStateStore(db)

        # Counters for reporting
        total_states = 0
        processed_states = 0
        errored = 0

        # Check if session exists in the database
        try:
            existing_state = await state_store.get_state(_session_id)
            if not existing_state:
                errored += 1
                raise ValueError(f"Session ID {_session_id} does not exist in the database. Please create the session first.")
            logger.info(f"Found existing session with ID {_session_id}. Proceeding with population.")
        except Exception as err:
            logger.error(f"Error checking session existence: {str(err)}")
            raise

        # Create sample conversation history
        conversation_history = create_sample_conversation_history()

        # Create application state components
        agent_director_state = create_agent_director_state(_session_id)
        welcome_agent_state = create_welcome_agent_state(_session_id)
        explore_experiences_director_state = create_explore_experiences_director_state(_session_id)
        conversation_memory_manager_state = create_conversation_memory_manager_state(_session_id, conversation_history)
        collect_experience_state = create_collect_experience_state(_session_id)
        skills_explorer_agent_state = create_skills_explorer_agent_state(_session_id)

        # Create the application state
        application_state = ApplicationState(
            session_id=_session_id,
            agent_director_state=agent_director_state,
            welcome_agent_state=welcome_agent_state,
            explore_experiences_director_state=explore_experiences_director_state,
            conversation_memory_manager_state=conversation_memory_manager_state,
            collect_experience_state=collect_experience_state,
            skills_explorer_agent_state=skills_explorer_agent_state
        )

        total_states += 1

        # Print summary of the state
        logger.info(f"Sample conversation created for existing session ID: {_session_id}")
        logger.info(f"The conversation has {len(conversation_history.turns)} turns")
        logger.info(f"Agent Director State: Phase = {agent_director_state.current_phase}")
        logger.info(f"Explore Experiences Director State: Phase = {explore_experiences_director_state.conversation_phase}")
        logger.info(f"Number of experiences: {len(explore_experiences_director_state.experiences_state)}")

        # Count the number of experiences explored in the conversation
        experiences_explored = 0

        # Print details of each experience
        for i, (exp_uuid, exp_state) in enumerate(explore_experiences_director_state.experiences_state.items()):
            experience = exp_state.experience
            logger.info(f"Experience {i + 1}: {experience.experience_title}")
            logger.info(f"  Company: {experience.company}")
            logger.info(f"  Location: {experience.location}")
            logger.info(f"  Work Type: {experience.work_type}")
            logger.info(f"  Responsibilities:")
            for resp in experience.responsibilities.responsibilities:
                logger.info(f"    - {resp}")

            # Check if the experience has been processed and has top skills
            if exp_state.dive_in_phase == DiveInPhase.PROCESSED and len(experience.top_skills) > 0:
                experiences_explored += 1

        logger.info(f"Number of experiences fully explored with skills: {experiences_explored}")

        if hot_run:
            try:
                # Save the state to the database
                await state_store.save_state(application_state)
                processed_states += 1
                logger.info(f"Successfully populated sample conversation to database for session ID: {_session_id}")
            except Exception as err:
                errored += 1
                logger.error(f"Error saving state for session {_session_id}: {str(err)}")
                raise
        else:
            processed_states += 1
            action = "Would populate" if not hot_run else "Populated"
            logger.info(f"{action} state for session {_session_id}")
            logger.info("Sample conversation state created successfully (DRY RUN - not saved to database)")

        # Log summary
        logger.info(f"Sample conversation population {'completed' if hot_run else ''} simulated!")
        logger.info(f"Total states processed: {total_states}")
        logger.info(f"States updated: {processed_states}")
        logger.info(f"Errors: {errored}")
        logger.info(f"Successfully processed: {processed_states - errored}")

        return _session_id

    except Exception as err:
        logger.error(f"Sample conversation population failed: {err}", exc_info=True)
        raise


def create_agent_director_state(_session_id: int) -> AgentDirectorState:
    """Create a sample agent director state for a completed conversation."""
    return AgentDirectorState(
        session_id=_session_id,
        current_phase=ConversationPhase.ENDED,
        conversation_conducted_at=datetime.now(timezone.utc)
    )


def create_welcome_agent_state(_session_id: int) -> WelcomeAgentState:
    """Create a sample welcome agent state for a completed conversation."""
    return WelcomeAgentState(
        session_id=_session_id,
        is_first_encounter=False,
    )


def create_explore_experiences_director_state(_session_id: int) -> ExploreExperiencesAgentDirectorState:
    """Create a sample explore experiences director state for a completed conversation."""
    # Create sample experiences
    bakery_experience = ExperienceEntity(
        uuid=str(uuid.uuid4()),
        experience_title="Baker at Sweet Delights Bakery",
        company="Sweet Delights Bakery",
        location="Cape Town",
        work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        responsibilities=ResponsibilitiesData(
            responsibilities=[
                "Prepared a variety of breads, pastries, and desserts daily",
                "Collaborated with kitchen staff to fulfill special orders and catering requests",
                "Implemented quality control procedures to ensure consistency",
                "Trained and mentored junior bakers"
            ]
        ),
        timeline=Timeline(start="January 2019", end="December 2021"),
        esco_occupations=[],
        top_skills=[
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="bake confections",
                description="Prepare and bake various confectionery items following recipes and quality standards.",
                scopeNote="",
                altLabels=["bake sweets", "prepare confections", "make confectionery"],
                score=0.9,
                skillType="skill/competence"
            ),
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="prepare bakery products",
                description="Prepare various bakery products following recipes and quality standards.",
                scopeNote="",
                altLabels=["make bakery items", "create baked goods", "produce bakery products"],
                score=0.85,
                skillType="skill/competence"
            ),
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="work according to recipe",
                description="Follow recipes precisely to ensure consistent quality of food products.",
                scopeNote="",
                altLabels=["follow recipes", "adhere to recipes", "use recipes"],
                score=0.8,
                skillType="skill/competence"
            )
        ]
    )

    freelance_experience = ExperienceEntity(
        uuid=str(uuid.uuid4()),
        experience_title="Freelance Cake Designer",
        company="Self-employed",
        location="Johannesburg",
        work_type=WorkType.SELF_EMPLOYMENT,
        responsibilities=ResponsibilitiesData(
            responsibilities=[
                "Designed and created custom cakes for special events and weddings",
                "Managed client consultations and order timelines",
                "Implemented social media marketing to showcase portfolio",
                "Provided cake decorating workshops for small groups"
            ]
        ),
        timeline=Timeline(start="January 2022", end="Present"),
        esco_occupations=[],
        top_skills=[
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="cake decoration",
                description="Apply decorative elements and techniques to cakes for aesthetic and thematic purposes.",
                scopeNote="",
                altLabels=["decorate cakes", "cake decorating", "cake design"],
                score=0.95,
                skillType="skill/competence"
            ),
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="client management",
                description="Manage client relationships, expectations, and communications throughout a project.",
                scopeNote="",
                altLabels=["manage clients", "client relations", "customer management"],
                score=0.85,
                skillType="skill/competence"
            ),
            SkillEntity(
                id=str(ObjectId()),
                UUID=str(uuid.uuid4()),
                modelId=str(ObjectId()),
                preferredLabel="project planning",
                description="Plan and organize projects to meet deadlines and client requirements.",
                scopeNote="",
                altLabels=["plan projects", "organize projects", "project organization"],
                score=0.8,
                skillType="skill/competence"
            )
        ]
    )

    # Create experience states dictionary with ExperienceState objects
    experience_states = {bakery_experience.uuid: ExperienceState(
        dive_in_phase=DiveInPhase.PROCESSED,
        experience=bakery_experience
    ), freelance_experience.uuid: ExperienceState(
        dive_in_phase=DiveInPhase.PROCESSED,
        experience=freelance_experience
    )}

    return ExploreExperiencesAgentDirectorState(
        session_id=_session_id,
        experiences_state=experience_states,
        current_experience_uuid=None,  # No current experience as conversation is completed
        conversation_phase=ExplorePhase.DIVE_IN  # Conversation ended in DIVE_IN phase
    )


def create_collect_experience_state(_session_id: int) -> CollectExperiencesAgentState:
    """Create a sample collect experiences agent state for a completed conversation."""
    # Create sample collected data
    collected_data = [
        CollectedData(
            index=0,
            defined_at_turn_number=3,
            experience_title="Baker at Sweet Delights Bakery",
            company="Sweet Delights Bakery",
            location="Cape Town",
            start_date="January 2019",
            end_date="December 2021",
            paid_work=True,
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
        ),
        CollectedData(
            index=1,
            defined_at_turn_number=7,
            experience_title="Freelance Cake Designer",
            company="Self-employed",
            location="Johannesburg",
            start_date="January 2022",
            end_date="Present",
            paid_work=True,
            work_type=WorkType.SELF_EMPLOYMENT.name
        )
    ]

    return CollectExperiencesAgentState(
        session_id=_session_id,
        collected_data=collected_data,
        unexplored_types=[WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WorkType.UNSEEN_UNPAID],
        explored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        first_time_visit=False
    )


def create_skills_explorer_agent_state(_session_id: int) -> SkillsExplorerAgentState:
    """Create a sample skills explorer agent state for a completed conversation."""
    # Get experience UUIDs from the explore experiences director state
    explore_state = create_explore_experiences_director_state(_session_id)
    experience_uuids = list(explore_state.experiences_state.keys())

    return SkillsExplorerAgentState(
        session_id=_session_id,
        first_time_for_experience={uuid: False for _uuid in experience_uuids},
        experiences_explored=experience_uuids
    )


def create_conversation_memory_manager_state(_session_id: int, conversation_history: ConversationHistory) -> ConversationMemoryManagerState:
    """Create a sample conversation memory manager state for a completed conversation."""
    return ConversationMemoryManagerState(
        session_id=_session_id,
        all_history=conversation_history,
        unsummarized_history=ConversationHistory(),  # Empty as all history has been summarized
        to_be_summarized_history=ConversationHistory(),  # Empty as all history has been summarized
        summary="The user discussed their work experience as a Baker at Sweet Delights Bakery from 2019 to 2021, "
                "where they prepared various breads, pastries, and desserts. "
                "They also shared their experience as a Freelance Cake Designer since 2022, "
                "where they design custom cakes for special events and manage client relationships."
    )


def create_sample_conversation_history() -> ConversationHistory:
    """Create a sample conversation history for a completed conversation."""
    conversation_turns = [
        ConversationTurn(
            index=0,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="",  # Empty first user message
                sent_at=datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0),
                is_artificial=True
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Welcome! I'm Compass, your skills exploration guide. Are you ready to begin?",
                finished=False,
                agent_type=AgentType.WELCOME_AGENT,
                agent_response_time_in_sec=0.5,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=0, second=5, microsecond=0)
            )
        ),
        ConversationTurn(
            index=1,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="Yes, let's start",
                sent_at=datetime.now(timezone.utc).replace(minute=1, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Great, you can now start exploring your work experiences.",
                finished=False,
                agent_type=AgentType.WELCOME_AGENT,
                agent_response_time_in_sec=0.6,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=1, second=6, microsecond=0)
            )
        ),
        ConversationTurn(
            index=2,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="",  # Empty user message for the follow-up system message
                sent_at=datetime.now(timezone.utc).replace(minute=1, second=7, microsecond=0),
                is_artificial=True
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Okay, let's start by getting a general overview of your work experiences. "
                                 "This is just a quick snapshot to begin with - we'll dive deeper into each experience later.\n\n"
                                 "Have you ever worked for a company or someone else's business for money?",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.7,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=1, second=14, microsecond=0)
            )
        ),
        ConversationTurn(
            index=3,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="I was a baker at Sweet Delights Bakery in Cape Town. I started in January 2019 and stopped in December 2021. It was a paid job.",
                sent_at=datetime.now(timezone.utc).replace(minute=2, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Okay, so you were a baker at Sweet Delights Bakery in Cape Town. That's great!\n\n"
                                 "So, you started in January 2019 and worked until December 2021.\n\n"
                                 "Can you tell me, was this a paid job?",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.7,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=2, second=7, microsecond=0)
            )
        ),
        ConversationTurn(
            index=4,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="Yes",
                sent_at=datetime.now(timezone.utc).replace(minute=3, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Got it. So, you were a baker at Sweet Delights Bakery in Cape Town. "
                                 "You started in January 2019 and worked until December 2021. It was a paid job.\n\n"
                                 "Would you like to add or change anything about this experience before we move on?",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.8,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=3, second=8, microsecond=0)
            )
        ),
        ConversationTurn(
            index=5,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="Looks good",
                sent_at=datetime.now(timezone.utc).replace(minute=4, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Cool, do you have any other experiences working for a company or someone else's business for money?",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.6,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=4, second=6, microsecond=0)
            )
        ),
        ConversationTurn(
            index=6,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="I've been working as a freelance cake designer since January 2022 in Johannesburg.",
                sent_at=datetime.now(timezone.utc).replace(minute=5, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Okay, let's move on to a different kind of work experience.\n\n"
                                 "Can you tell me, have you ever run your own business or done any freelance or contract work?",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.9,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=5, second=9, microsecond=0)
            )
        ),
        ConversationTurn(
            index=7,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="Yes, as I mentioned, I'm a freelance cake designer. "
                        "I design and create custom cakes for special events and weddings, manage client consultations, "
                        "and run social media marketing for my business.",
                sent_at=datetime.now(timezone.utc).replace(minute=6, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Let's recap the information we have collected so far:\n\n"
                                 "• Baker (Waged Employment), 2019/01 - 2021/12, Sweet Delights Bakery, Cape Town\n"
                                 "• Freelance Cake Designer (Self-Employment), 2022/01 - Present, Self-employed, Johannesburg\n\n"
                                 "Is there anything you would like to add or change? If one of the experiences seems to be duplicated, "
                                 "you can ask me to remove it.",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=1.0,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=6, second=10, microsecond=0)
            )
        ),
        ConversationTurn(
            index=8,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="Looks good",
                sent_at=datetime.now(timezone.utc).replace(minute=7, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Thank you for sharing your experiences. Let's move on to the next step.",
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=0.5,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=7, second=5, microsecond=0)
            )
        ),
        ConversationTurn(
            index=9,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="",  # Empty user message for the follow-up system message
                sent_at=datetime.now(timezone.utc).replace(minute=7, second=6, microsecond=0),
                is_artificial=True
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="Okay, cool. So, we're going to talk about your experience working as a baker.\n\n"
                                 "I'm going to ask you some questions about your time working as a baker. "
                                 "Try to be as descriptive as possible in your answers. "
                                 "The more you tell me about your experience, the better we can understand it.\n\n"
                                 "So, tell me, what was a typical day like at work?",
                finished=False,
                agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                agent_response_time_in_sec=0.8,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=7, second=14, microsecond=0)
            )
        ),
        ConversationTurn(
            index=10,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="I prepared a variety of breads, pastries, and desserts daily. I also collaborated with kitchen staff, "
                        "implemented quality control procedures, and mentored junior bakers.",
                sent_at=datetime.now(timezone.utc).replace(minute=8, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="That's impressive! You've gained valuable skills in baking with bread and pastry making, "
                                 "as well as soft skills like collaboration and mentoring. "
                                 "I'd like to know more about your freelance cake design work. What kind of cakes do you specialize in?",
                finished=False,
                agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                agent_response_time_in_sec=1.0,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=8, second=10, microsecond=0)
            )
        ),
        ConversationTurn(
            index=11,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="I specialize in fondant work and sugar craft for most of my clients. "
                        "For client management, I have detailed consultations and make sure to set clear expectations about designs, "
                        "flavors, and delivery timelines.",
                sent_at=datetime.now(timezone.utc).replace(minute=9, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="After examining the information you provided, I identified the following skills:\n"
                                 "• bake confections\n"
                                 "• bake goods\n"
                                 "• prepare bakery products\n"
                                 "• work according to recipe\n"
                                 "• cook pastry products\n"
                                 "• cake decoration\n"
                                 "• client management\n"
                                 "• consultation skills\n"
                                 "• project planning\n"
                                 "• sugar craft techniques",
                finished=False,
                agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                agent_response_time_in_sec=1.2,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=9, second=12, microsecond=0)
            )
        ),
        ConversationTurn(
            index=12,
            input=AgentInput(
                message_id=str(ObjectId()),
                message="That looks good",
                sent_at=datetime.now(timezone.utc).replace(minute=10, second=0, microsecond=0)
            ),
            output=AgentOutput(
                message_id=str(ObjectId()),
                message_for_user="It was great exploring your skills with you! "
                                 "I've learned a lot about your experience as a baker and as a freelance cake designer. Goodbye!",
                finished=True,
                agent_type=AgentType.FAREWELL_AGENT,
                agent_response_time_in_sec=1.2,
                llm_stats=[],
                sent_at=datetime.now(timezone.utc).replace(minute=10, second=12, microsecond=0)
            )
        )
    ]

    return ConversationHistory(turns=conversation_turns)


def parse_args():
    parser = argparse.ArgumentParser(description='Populate an existing conversation session with a sample completed conversation history.')
    parser.add_argument('--session-id', type=int, required=True, help='Existing session ID to populate (required)')
    parser.add_argument('--hot-run', action='store_true', help='Run in "hot mode" and save to the database (default is dry run)')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Load environment variables for MongoDB connection (required for both hot run and dry run)
    env = dotenv.find_dotenv()
    dotenv.load_dotenv(env)
    _mongo_uri = os.getenv("POPULATE_CONVERSATION_MONGO_URI")
    if not _mongo_uri:
        raise ValueError("Missing required environment variable: POPULATE_CONVERSATION_MONGO_URI")
    _database_name = os.getenv("POPULATE_CONVERSATION_DB_NAME")
    if not _database_name:
        raise ValueError("Missing required environment variable: POPULATE_CONVERSATION_DB_NAME")

    try:
        session_id = asyncio.run(populate_sample_conversation(
            mongo_uri=_mongo_uri,
            database_name=_database_name,
            _session_id=args.session_id,
            hot_run=args.hot_run
        ))

        print(f"Sample conversation populated for existing session ID: {session_id}")
    except Exception as e:
        logger.error(f"Failed to populate sample conversation: {e}")
        print(f"Error: {e}")
        exit(1)
