import os

from dotenv import load_dotenv
from fastapi import FastAPI
from langchain_community.chat_models import ChatVertexAI as DeprecatedChatVertexAI
from langchain_google_vertexai import ChatVertexAI
from langserve import add_routes

from esco_search.esco_search_routes import add_esco_search_routes

load_dotenv()
app = FastAPI()


############################################
# Add std routes
############################################
@app.get("/")
async def root():
    return {"Hello Tabiya"}


@app.get("/version")
async def version():
    return {"version": os.getenv("VERSION")}


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
add_esco_search_routes(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
