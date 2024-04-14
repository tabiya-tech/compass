import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from langchain_community.chat_models import ChatVertexAI as DeprecatedChatVertexAI
from langchain_google_vertexai import ChatVertexAI
from langserve import add_routes
from pydantic import BaseModel
from esco_search.esco_search_routes import add_esco_search_routes
from agent.agent_director import AgentDirector
from agent.agent_types import AgentInput, AgentOutput, ConversationHistory
from app.version.version_routes import add_version_routes

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
# Add routes for the different chat models
############################################
# Route for Gemini Pro
add_routes(
    app,
    ChatVertexAI(model_name="gemini-pro", convert_system_message_to_human=True),
    path="/google/gemini-pro",
)

# Route for olden chat-bison
add_routes(
    app,
    DeprecatedChatVertexAI(),
    path="/google/chat-bison",
)
############################################
# Add routes relevant for esco_search
############################################
skill_search_service = add_esco_search_routes(app)

############################################
# Add routes relevant for the conversation agent
############################################

agent_director = AgentDirector()


class ConversationResponse(BaseModel):
    """
    The response model for the conversation endpoint.
    """
    last: AgentOutput
    conversation_history: ConversationHistory


@app.get(path="/conversation,",
         description="""Temporary route used to interact with the conversation agent.""", )
async def _welcome(user_input: str, clear_memory: bool = False):
    try:
        if clear_memory:
            await agent_director.reset()
            return {"msg": "Memory cleared!"}

        agent_output = await agent_director.run_task(AgentInput(message=user_input))
        history = await agent_director.get_conversation_history()
        response = ConversationResponse(last=agent_output, conversation_history=history)
        return response
    except Exception as e: # pylint: disable=broad-except # this is the main entry point, so we need to catch all exceptions
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
