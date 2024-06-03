import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_director import AgentDirector
from app.agent.welcome_agent import WelcomeAgent # for sandbox testing
from app.agent.experiences_explorer_agent import ExperiencesExplorerAgent # for sandbox testing
from app.conversation_memory.conversation_memory_manager import ConversationContext, ConversationMemoryManager
from app.sensitive_filter import sensitive_filter
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from app.version.version_routes import add_version_routes
from app.application_state import ApplicationStateManager, InMemoryApplicationStateStore
from esco_search.esco_search_routes import add_esco_search_routes

logger = logging.getLogger(__name__)

load_dotenv()
app = FastAPI()

origins = [
    "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

############################################
# Add version routes
############################################
add_version_routes(app)

############################################
# Add routes relevant for esco_search
############################################
skill_search_service = add_esco_search_routes(app)

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
conversation_memory_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
# TODO: Use the LLM AgentDirector instead the oldschool AgentDirector
# The oldschool AgentDirector is used temporarily during the early stages of Milestone1 (for enabling faster development of the agents)
agent_director = AgentDirector(conversation_memory_manager)


class ConversationResponse(BaseModel):
    """
    The response model for the conversation endpoint.
    """
    last: AgentOutput
    conversation_context: ConversationContext


@app.get(path="/conversation",
         description="""The main conversation route used to interact with the agent.""", )
async def conversation(user_input: str, clear_memory: bool = False, filter_pii: bool = True,
                       session_id: int = 1):
    """
    Endpoint for conducting the conversation with the agent.
    """
    try:
        if clear_memory:
            await application_state_manager.delete_state(session_id)
            return {"msg": f"Memory cleared for session {session_id}!"}
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the state of the agent director and the conversation memory manager
        state = await application_state_manager.get_state(session_id)
        agent_director.set_state(state.agent_director_state)
        agent_director.get_experiences_explorer_agent().set_state(state.experiences_explorer_state)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # Handle the user input
        agent_output = await agent_director.execute(AgentInput(message=user_input))
        context = await conversation_memory_manager.get_conversation_context()
        response = ConversationResponse(last=agent_output, conversation_context=context)

        # save the state, before responding to the user
        await application_state_manager.save_state(session_id, state)
        return response
    except Exception as e:  # pylint: disable=broad-except
        # this is the main entry point, so we need to catch all exceptions
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


@app.get(path="/conversation_sandbox",
         description="""Temporary route used to interact with the conversation agent.""", )
async def _test_conversation(user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                             session_id: int = 1, only_reply: bool = False):
    """
    As a developer, you can use this endpoint to test the conversation agent with any user input.
    You can adjust the front-end to use this endpoint for testing locally an agent in a configurable way.
    """
    try:
        if clear_memory:
            await application_state_manager.delete_state(session_id)
            return {"msg": f"Memory cleared for session {session_id}!"}
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        # set the state of the conversation memory manager
        state = await application_state_manager.get_state(session_id)
        conversation_memory_manager.set_state(state.conversation_memory_manager_state)

        # ##################### ADD YOUR AGENT HERE ######################
        # Initialize the agent you want to use for the evaluation
        agent = ExperiencesExplorerAgent()
        logger.debug("ExperinecesExplorerAgent initialized for sandbox testing")
        agent.set_state(state.experiences_explorer_state)
        # ################################################################

        # handle the user input
        context = await conversation_memory_manager.get_conversation_context()
        agent_output = await agent.execute(user_input=AgentInput(message=user_input), context=context)
        await conversation_memory_manager.update_history(AgentInput(message=user_input), agent_output)

        # get the context again after updating the history
        context = await conversation_memory_manager.get_conversation_context()
        response = ConversationResponse(last=agent_output, conversation_context=context)
        if only_reply:
            response = response.last.message_for_user

        # save the state, before responding to the user
        await application_state_manager.save_state(session_id, state)
        return response
    except Exception as e:  # pylint: disable=broad-except
        # this is the main entry point, so we need to catch all exceptions
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


@app.get(path="/conversation_context",
         description="""Temporary route used to get the conversation context of a user.""", )
async def get_conversation_context(session_id: int):
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
