import logging
import os
from dotenv import load_dotenv
from fastapi import FastAPI
import json
from langchain_community.chat_models import ChatVertexAI as DeprecatedChatVertexAI
from langchain_google_vertexai import ChatVertexAI
from langserve import add_routes
from pydantic import BaseModel
from esco_search.esco_search_routes import add_esco_search_routes
from agent.agent_director import AgentDirector
from agent.agent_types import AgentInput, AgentOutput, ConversationHistory
from sensitive_filter.filter_sensitive_info import add_filter_routes

logger = logging.getLogger(__name__)

load_dotenv()
app = FastAPI()


############################################
# Add std routes
############################################
@app.get("/")
async def root():
    return {"msg": "Hello Tabiya"}


# Determine the absolute path of the directory where the current script resides
script_directory = os.path.dirname(os.path.abspath(__file__))

# Construct the absolute path to the JSON file, assuming it's in the same directory as the script
version_file_path = os.path.join(script_directory, 'version.json')

with open(version_file_path, 'r') as fp:
    version_info = json.load(fp)


@app.get("/version")
async def get_version():
    return {"version": version_info}


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
# Add routes relevant for pii filtering
############################################

add_filter_routes(app)

############################################
# Add routes relevant for the conversation agent
############################################

agent_director = AgentDirector()


class ConversationResponse(BaseModel):
    last: AgentOutput
    conversation_history: ConversationHistory


@app.get("/conversation")
async def welcome(user_input: str, clear_memory: bool = False):
    try:
        if clear_memory:
            await agent_director.reset()

        agent_output = await agent_director.run_task(AgentInput(message=user_input))
        history = await agent_director.get_conversation_history()
        response = ConversationResponse(last=agent_output, conversation_history=history)
        return response
    except Exception as e:
        logger.exception(e)
        return {"error": "oops! something went wrong!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
