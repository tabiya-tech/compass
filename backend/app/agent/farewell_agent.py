import logging
from textwrap import dedent

from langchain_google_vertexai import ChatVertexAI

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.extract_json import extract_json, ExtractJSONError
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions
from app.conversation_memory.conversation_memory_manager import ConversationHistory
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter

logger = logging.getLogger(__name__)


class SimpleFarewellAgent(Agent):
    """
    Simple agent that provides a simple response, should be used for testing purposes only
    """

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        print(user_input.message + " from FarewellAgent")
        return AgentOutput(message_for_user="FarewellAgent done", finished=True, agent_type=AgentType.FAREWELL_AGENT)


class FarewellAgent(Agent):
    """
    Agent that farewells the user and provides a response based on the task
    """

    def __init__(self):
        self._agent_type = AgentType.FAREWELL_AGENT
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Have a nice day", finished=True),
            ModelResponse(message="YOLO!", finished=True),
        ])

        self._prompt = dedent(f"""\
            You are a {self._agent_type.value} at a skills exploration agency.
            Your task is to say goodbye to the user and end the conversation.
            """) + '\n' + response_part + '\n' + dedent("""\
            Farewell the user with a warm goodbye.
            """)
        self._chain = ChatVertexAI(model_name="gemini-pro")

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        model_input = self._prompt + "\n" + ConversationHistoryFormatter.format_for_prompt(
            history) + "\nUser: " + user_input.message
        conversation = await self._chain.ainvoke(model_input)
        try:
            last: ModelResponse = extract_json(conversation.content, ModelResponse)
        except ExtractJSONError:
            logger.warning("Error extracting JSON from conversation content '%s'", conversation.content, exc_info=True)
            last = ModelResponse(message=str(conversation.content), finished=False)

        response = AgentOutput(message_for_user=last.message,
                               finished=last.finished,
                               agent_type=AgentType.FAREWELL_AGENT)
        return response
