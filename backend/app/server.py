import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from esco_search.esco_search_routes import add_esco_search_routes
from app.agent.agent_director import AgentDirector
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_manager import ConversationHistory, ConversationMemoryManager
from app.version.version_routes import add_version_routes
from app.sensitive_filter import sensitive_filter

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

agent_director = AgentDirector(ConversationMemoryManager())


class ConversationResponse(BaseModel):
    """
    The response model for the conversation endpoint.
    """
    last: AgentOutput
    conversation_history: ConversationHistory


@app.get(path="/conversation",
         description="""Temporary route used to interact with the conversation agent.""", )
async def welcome(user_input: str, clear_memory: bool = False, filter_pii: bool = True,
                   session_id: int = 1):
    try:
        if clear_memory:
            await agent_director.reset(session_id)
            return {"msg": f"Memory cleared for session {session_id}!"}
        if filter_pii:
            user_input = await sensitive_filter.obfuscate(user_input)

        agent_output = await agent_director.execute(session_id, AgentInput(message=user_input))
        history = await agent_director.get_conversation_history(session_id)
        response = ConversationResponse(last=agent_output, conversation_history=history)
        return response
    except Exception as e:  # pylint: disable=broad-except # this is the main entry point, so we need to catch all exceptions
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
