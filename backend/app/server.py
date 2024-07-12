import base64
import logging
import os
from datetime import datetime
from typing import List, Annotated

from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer

from app.agent.agent_types import AgentInput
from app.agent.llm_agent_director import LLMAgentDirector
from app.application_state import ApplicationStateManager, InMemoryApplicationStateStore
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.sensitive_filter import sensitive_filter
from app.server_dependencies import get_conversation_memory_manager, initialize_mongo_db
from app.chat.chat_types import ConversationMessage
from app.chat.chat_utils import filter_conversation_history, get_messages_from_conversation_manager
from app.vector_search.occupation_search_routes import add_occupation_search_routes
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.skill_search_routes import add_skill_search_routes
from app.vector_search.vector_search_dependencies import get_occupation_skill_search_service
from app.version.version_routes import add_version_routes

from contextlib import asynccontextmanager

from app.users import add_users_routes

logger = logging.getLogger(__name__)

load_dotenv()


# Configure lifespan events for the FastAPI application
# eg: for startup we need to initialize the database connection and create the indexes
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup logic
    await initialize_mongo_db()
    yield
    # Shutdown logic
    logger.info("Shutting down...")


# Retrieve the backend URL from the environment variables,
# and set the server URL to the backend URL, so that Swagger UI can correctly call the backend paths
app = FastAPI(
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
if not os.getenv('MONGODB_URI'):
    raise ValueError("Mandatory MONGODB_URI env variable is not set!")
if not os.getenv("DATABASE_NAME"):
    raise ValueError("Mandatory DATABASE_NAME environment variable is not set")

############################################
# Security Definitions
############################################
# Used for adding the security definitions for OpenAPI docs
# auto_error=False means an error won't be thrown if the "Authorization: Bearer"
# header is missing. It should be set to True when the APIs will be used from
# the UI and the API Gateway is running in front of this service.
http_bearer = HTTPBearer(auto_error=False, scheme_name="JWT_auth")
firebase = HTTPBearer(scheme_name="firebase")
google = HTTPBearer(scheme_name="google")

############################################
# Add version routes
############################################
add_version_routes(app)

############################################
# Add routes relevant for esco search
############################################

add_occupation_search_routes(app)
add_skill_search_routes(app)

############################################
# Add routes relevant for pii filtering
############################################

sensitive_filter.add_filter_routes(app)

############################################
# Add routes relevant for the conversation agent
############################################

# Initialize the application state manager, conversation memory manager and the agent director
# Currently, using an in-memory store for the application state,
# but this can be replaced with a persistent store based on environment variables
# TODO: use the Fast api dependency injection pattern to inject them into the routes
application_state_manager = ApplicationStateManager(InMemoryApplicationStateStore())


def get_agent_director(conversation_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       similarity_search: SimilaritySearchService = Depends(
                           get_occupation_skill_search_service)) -> LLMAgentDirector:
    """ Get the agent manager instance."""
    return LLMAgentDirector(conversation_manager, similarity_search)


@app.get(path="/conversation",
         description="""The main conversation route used to interact with the agent.""")
async def conversation(request: Request, user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                       session_id: int = 1,
                       conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                       agent_director: LLMAgentDirector = Depends(get_agent_director),
                       authorization=Depends(http_bearer)):
    """
    Endpoint for conducting the conversation with the agent.
    """
    # Do not allow user input that is too long,
    # as a basic measure to prevent abuse.
    if len(user_input) > 1000:
        raise HTTPException(status_code=413, detail="Too long user input")

    try:
        if clear_memory:
            await application_state_manager.delete_state(session_id)
            return {"msg": f"Memory cleared for session {session_id}!"}
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the sent_at for the user input
        user_input = AgentInput(message=user_input, sent_at=datetime.now())

        # set the state of the agent director, the conversation memory manager and all the agents
        state = await application_state_manager.get_state(session_id)

        agent_director.set_state(state.agent_director_state)
        agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
        agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            state.collect_experience_state)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        context = await conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)
        await agent_director.execute(user_input=user_input)
        # get the context again after updating the history
        context = await conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)
        # save the state, before responding to the user
        await application_state_manager.save_state(session_id, state)
        return response
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
         response_model=List[ConversationMessage],
         description="""Endpoint for retrieving the conversation history.""")
async def get_conversation_history(
    session_id: Annotated[int, Query(description="The session id for the conversation history.")],
    conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
    authorization=Depends(http_bearer)
):
    """
    Endpoint for retrieving the conversation history.
    """
    try:
        state = await application_state_manager.get_state(session_id)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context = await conversation_memory_manager.get_conversation_context()
        return filter_conversation_history(context.all_history)
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail="Oops! something went wrong")


@app.get(path="/conversation_sandbox",
         description="""Temporary route used to interact with the conversation agent.""", )
async def _test_conversation(request: Request, user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                             session_id: int = 1, only_reply: bool = False,
                             similarity_search: SimilaritySearchService = Depends(get_occupation_skill_search_service),
                             conversation_memory_manager: ConversationMemoryManager = Depends(
                                 get_conversation_memory_manager),
                             authorization=Depends(http_bearer)):
    """
    As a developer, you can use this endpoint to test the conversation agent with any user input.
    You can adjust the front-end to use this endpoint for testing locally an agent in a configurable way.
    """
    # Do not allow user input that is too long,
    # as a basic measure to prevent abuse.
    if len(user_input) > 1000:
        raise HTTPException(status_code=413, detail="To long user input")

    try:
        if clear_memory:
            await application_state_manager.delete_state(session_id)
            return {"msg": f"Memory cleared for session {session_id}!"}
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the state of the conversation memory manager
        state = await application_state_manager.get_state(session_id)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # handle the user input
        context = await conversation_memory_manager.get_conversation_context()
        # get the current index in the conversation history, so that we can return only the new messages
        current_index = len(context.all_history.turns)

        from app.agent.agent import Agent
        agent: Agent
        # ##################### ADD YOUR AGENT HERE ######################
        # Initialize the agent you want to use for the evaluation
        # from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
        # agent = ExploreExperiencesAgentDirector(conversation_manager=conversation_memory_manager)
        # agent.set_state(state.explore_experiences_director_state)
        from app.agent.collect_experiences_agent import CollectExperiencesAgent
        agent = CollectExperiencesAgent()

        # ################################################################
        logger.debug("%s initialized for sandbox testing", agent.agent_type.value)

        agent_output = await agent.execute(user_input=AgentInput(message=user_input, sent_at=datetime.now()), context=context)
        if not agent.is_responsible_for_conversation_history():
            await conversation_memory_manager.update_history(AgentInput(message=user_input, sent_at=datetime.now()), agent_output)

        # get the context again after updating the history
        context = await conversation_memory_manager.get_conversation_context()
        response = await get_messages_from_conversation_manager(context, from_index=current_index)
        if only_reply:
            response = response.last.message_for_user

        # save the state, before responding to the user
        await application_state_manager.save_state(session_id, state)
        return response
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


@app.get(path="/conversation_context",
         description="""Temporary route used to get the conversation context of a user.""", )
async def get_conversation_context(
        session_id: int,
        conversation_memory_manager: ConversationMemoryManager = Depends(
            get_conversation_memory_manager), authorization=Depends(http_bearer)):
    """
    Get the conversation context of a user.
    """
    try:
        state = await application_state_manager.get_state(session_id)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)
        context = await conversation_memory_manager.get_conversation_context()
        return context
    except Exception as e:  # pylint: disable=broad-except
        # this is the main entry point, so we need to catch all exceptions
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


# Temporary REST API EP for returning the incoming authentication information
# from the request. This is for testing purposes until the UI supports auth
# and must be removed later.
@app.get(path="/authinfo",
         description="Returns the authentication info (JWT token claims)")
async def _get_auth_info(request: Request,
                         firebase_auth=Depends(firebase),
                         googl_auth=Depends(google)):
    auth_info_b64 = request.headers.get('x-apigateway-api-userinfo')
    # some python magic
    auth_info = base64.b64decode(auth_info_b64.encode() + b'==').decode()
    return JSONResponse(auth_info)


add_users_routes(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
