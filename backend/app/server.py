import logging
import os

from datetime import datetime, timezone
from typing import List, Annotated

from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_types import AgentInput
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationStateManager
from app.constants.errors import HTTPErrorResponse
from app.invitations import add_user_invitations_routes
from app.server_dependencies.application_state_dependencies import get_application_state_manager
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.sensitive_filter import sensitive_filter
from app.chat.chat_types import ConversationResponse, ConversationInput
from app.chat.chat_utils import filter_conversation_history, get_messages_from_conversation_manager
from app.server_dependencies.agent_director_dependencies import get_agent_director
from app.server_dependencies.conversation_manager_dependencies import get_conversation_memory_manager
from app.version.version_routes import add_version_routes

from contextlib import asynccontextmanager

from app.users import add_users_routes
from app.poc import add_poc_routes

from app.types import Experience, Skill
from app.users.repositories import UserPreferenceRepository

# ContextVar to hold the session ID
from app.context_vars import session_id_ctx_var, user_id_ctx_var

logger = logging.getLogger(__name__)

load_dotenv()


# Configure lifespan events for the FastAPI application
# eg: for startup we need to initialize the database connection and create the indexes
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup logic
    logger.info("Starting up...")
    db = await CompassDBProvider.get_application_db()
    await CompassDBProvider.initialize_application_mongo_db(db, logger)
    yield
    # Shutdown logic
    logger.info("Shutting down...")


# Retrieve the backend URL from the environment variables,
# and set the server URL to the backend URL, so that Swagger UI can correctly call the backend paths
app = FastAPI(
    # redirect_slashes is set False to prevent FastAPI from redirecting when a trailing slash is added.
    redirect_slashes=False,
    servers=[
        {
            "url": os.getenv("BACKEND_URL") or "/",
            "description": "The backend server"
        }],
    lifespan=lifespan
)


# Setup CORS policy
# Keep the backend, frontend urls and the environment as separate env variables as a failsafe measure,
# as we want to be certain that both the backend, frontend urls are set correctly,
# especially in non dev or local environments.

if not os.getenv("FRONTEND_URL"):
    raise ValueError("Mandatory FRONTEND_URL env variable is not set! Please set it to the frontend URL as it is "
                     "required to set the CORS policy correctly.")
logger.info(f"Frontend URL: {os.getenv('FRONTEND_URL')}")

if not os.getenv("BACKEND_URL"):
    raise ValueError("Mandatory BACKEND_URL env variable is not set! Please set it to the backend URL as it is "
                     "required to set the CORS policy correctly for the api documentation /docs.")
logger.info(f"Backend URL: {os.getenv('BACKEND_URL')}")

origins = [
    os.getenv("FRONTEND_URL"),
    os.getenv("BACKEND_URL") + "/docs",
]

target_env = os.getenv("TARGET_ENVIRONMENT")
logger.info(f"Target environment: {target_env}")

if target_env == "dev" or target_env == "local":
    logger.info(f"Setting CORS to allow all origins for the {target_env} environment.")
    origins.append("*")

enable_sentry = os.getenv("ENABLE_SENTRY")
if not enable_sentry:
    raise ValueError("Mandatory ENABLE_SENTRY env variable is not set! Please set it to the either True or False")
logger.info(f"ENABLE_SENTRY: {os.getenv('ENABLE_SENTRY')}")

origins = list(set(origins))  # remove duplicates
logger.info(f"Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Check mandatory environment variables and raise an early exception if they are not set
if not os.getenv('TAXONOMY_MONGODB_URI'):
    raise ValueError("Mandatory TAXONOMY_MONGODB_URI env variable is not set!")
if not os.getenv("TAXONOMY_DATABASE_NAME"):
    raise ValueError("Mandatory TAXONOMY_DATABASE_NAME environment variable is not set")
if not os.getenv('APPLICATION_MONGODB_URI'):
    raise ValueError("Mandatory APPLICATION_MONGODB_URI env variable is not set!")
if not os.getenv("APPLICATION_DATABASE_NAME"):
    raise ValueError("Mandatory APPLICATION_DATABASE_NAME environment variable is not set")
if not os.getenv('TAXONOMY_MODEL_ID'):
    raise ValueError("Mandatory TAXONOMY_MODEL_ID env variable is not set!")

############################################
# Initiate the Authentication Module for the FastAPI app
############################################
auth = Authentication()

############################################
# Add version routes
############################################
add_version_routes(app)

############################################
# Add routes relevant for the conversation agent
############################################

NO_PERMISSION_FOR_SESSION = "User does not have permission to access this session"


@app.post(path="/conversation",
          status_code=201,
          response_model=ConversationResponse,
          responses={400: {"model": HTTPErrorResponse}, 403: {"model": HTTPErrorResponse}, 413: {"model": HTTPErrorResponse},
                     500: {"model": HTTPErrorResponse}},
          description="""The main conversation route used to interact with the agent.""")
async def conversation(request: Request, body: ConversationInput, clear_memory: bool = False, filter_pii: bool = False,
                       conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       agent_director: LLMAgentDirector = Depends(get_agent_director),
                       user_info: UserInfo = Depends(auth.get_user_info()),
                       application_state_manager: ApplicationStateManager = Depends(get_application_state_manager),
                       application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
                       ):
    """
    Endpoint for conducting the conversation with the agent.
    """
    session_id = body.session_id
    user_input = body.user_input

    # set the session_id, user_id in the context variable
    # so that it can be accessed by the logger
    # and downstream functions
    session_id_ctx_var.set(body.session_id)
    user_id_ctx_var.set(user_info.user_id)

    # check that the user making the request has the session_id in their user preferences
    user_preference_repository = UserPreferenceRepository(application_db)
    current_user_preferences = await user_preference_repository.get_user_preference_by_user_id(user_info.user_id)
    if current_user_preferences is None or session_id not in current_user_preferences.sessions:
        raise HTTPException(status_code=403, detail=NO_PERMISSION_FOR_SESSION)

    # Do not allow user input that is too long,
    # as a basic measure to prevent abuse.
    if len(user_input) > 1000:
        raise HTTPException(status_code=413, detail="Too long user input")

    try:
        if clear_memory:
            await application_state_manager.delete_state(session_id)
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the sent_at for the user input
        user_input = AgentInput(message=user_input, sent_at=datetime.now(timezone.utc))

        # set the state of the agent director, the conversation memory manager and all the agents
        state = await application_state_manager.get_state(session_id)

        # Check if the conversation has ended
        if state.agent_director_state.current_phase == ConversationPhase.ENDED:
            raise HTTPException(status_code=400, detail="The conversation has ended.")

        agent_director.set_state(state.agent_director_state)
        agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
        agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            state.collect_experience_state)
        agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(state.skills_explorer_agent_state)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        context = await conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)
        await agent_director.execute(user_input=user_input)
        # get the context again after updating the history
        context = await conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)
        # get the date when the conversation was conducted
        state.agent_director_state.conversation_conducted_at = datetime.now(timezone.utc)
        # Count for number of experiences explored in the conversation
        experiences_explored = 0

        for exp in state.explore_experiences_director_state.experiences_state.values():
            # Check if the experience has been processed and has top skills
            if exp.dive_in_phase == DiveInPhase.PROCESSED and len(exp.experience.top_skills) > 0:
                experiences_explored += 1

        # save the state, before responding to the user
        await application_state_manager.save_state(state)
        return ConversationResponse(
            messages=response,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=experiences_explored
        )
    except Exception as e:  # pylint: disable=broad-except
        logger.exception(
            "Error for request: %s %s?%s with session id: %s : %s",
            request.method,
            request.url.path,
            request.query_params,
            session_id,
            e
        )
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


@app.get(path="/conversation/history",
         response_model=ConversationResponse,
         responses={400: {"model": HTTPErrorResponse}, 403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
         description="""Endpoint for retrieving the conversation history.""")
async def get_conversation_history(
        session_id: Annotated[int, Query(description="The session id for the conversation history.")],
        conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
        user_info: UserInfo = Depends(auth.get_user_info()),
        application_state_manager: ApplicationStateManager = Depends(get_application_state_manager),
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
):
    """
    Endpoint for retrieving the conversation history.
    """

    # set the session_id, user_id in the context variable
    # so that it can be accessed by the logger
    # and downstream functions
    session_id_ctx_var.set(session_id)
    user_id_ctx_var.set(user_info.user_id)

    # check that the user making the request has the session_id in their user preferences
    user_preference_repository = UserPreferenceRepository(application_db)
    current_user_preferences = await user_preference_repository.get_user_preference_by_user_id(user_info.user_id)
    if current_user_preferences is None or session_id not in current_user_preferences.sessions:
        raise HTTPException(status_code=403, detail=NO_PERMISSION_FOR_SESSION)

    try:
        state = await application_state_manager.get_state(session_id)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context = await conversation_memory_manager.get_conversation_context()
        messages = filter_conversation_history(context.all_history)

        # Count the number of experiences explored in the conversation
        experiences_explored = 0

        for exp in state.explore_experiences_director_state.experiences_state.values():
            # Check if the experience has been processed and has top skills
            if exp.dive_in_phase == DiveInPhase.PROCESSED and len(exp.experience.top_skills) > 0:
                experiences_explored += 1

        return ConversationResponse(
            messages=messages,
            conversation_completed=state.agent_director_state.current_phase == ConversationPhase.ENDED,
            conversation_conducted_at=state.agent_director_state.conversation_conducted_at,
            experiences_explored=experiences_explored
        )
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


@app.get(path="/conversation/experiences",
         response_model=List[Experience],
         responses={400: {"model": HTTPErrorResponse}, 403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
         description="""Endpoint for retrieving the experiences of a user.""")
async def get_experiences(session_id: int, user_info: UserInfo = Depends(auth.get_user_info()),
                          application_state_manager: ApplicationStateManager = Depends(get_application_state_manager),
                          application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
                          ) -> List[Experience]:
    """
    Endpoint for retrieving the experiences of a user.
    """
    # Check that the user making the request has the session_id in their user preferences
    user_preference_repository = UserPreferenceRepository(application_db)
    current_user_preferences = await user_preference_repository.get_user_preference_by_user_id(user_info.user_id)

    if current_user_preferences is None or session_id not in current_user_preferences.sessions:
        raise HTTPException(status_code=403, detail=NO_PERMISSION_FOR_SESSION)

    # set the session_id, user_id in the context variable
    # so that it can be accessed by the logger
    # and downstream functions
    session_id_ctx_var.set(session_id)
    user_id_ctx_var.set(user_info.user_id)

    # Get the experiences from the application state
    state = await application_state_manager.get_state(session_id)

    experiences: list[Experience] = []

    for uuid in state.explore_experiences_director_state.experiences_state:
        """
        UUID is the key for the experiences_state dictionary in the explore_experiences_director_state.
        """
        experience_details: ExperienceEntity = state.explore_experiences_director_state.experiences_state[uuid].experience
        """
        experience_details is the value for the UUID key in the experiences_state dictionary.
        """
        top_skills = []
        """
        Top skills for the experience.
        """

        for skill in experience_details.top_skills:
            """
            Construct the Skill object for each skill in the top_skills list.
            """
            top_skills.append(Skill(
                UUID=skill.UUID,
                preferredLabel=skill.preferredLabel,
                description=skill.description,
                altLabels=skill.altLabels
            ))

        experiences.append(Experience(
            UUID=experience_details.uuid,
            experience_title=experience_details.experience_title,
            company=experience_details.company,
            location=experience_details.location,
            start_date=experience_details.timeline.start,
            end_date=experience_details.timeline.end,
            work_type=experience_details.work_type,
            top_skills=top_skills
        ))

    return experiences


############################################
# Add routes relevant for the user management
############################################
add_users_routes(app, auth)

############################################
# Add the user invitations routes
############################################
add_user_invitations_routes(app)

############################################
# Add POC chat routes
############################################
add_poc_routes(app, auth)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
