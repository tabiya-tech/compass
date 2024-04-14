import json
import logging
from textwrap import dedent

from langchain_google_vertexai import ChatVertexAI

from agent.agent_types import AgentInput, AgentOutput, Agent, AgentType, ConversationHistory, \
    ConversationHistoryFormatter
from agent.prompt_reponse_template import ModelResponse, get_json_response_instructions

logger = logging.getLogger(__name__)


class SimpleFarewellAgent(Agent):

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        print(user_input.message + " from FarewellAgent")
        return AgentOutput(message_for_user="FarewellAgent done", finished=True, agent_type=AgentType.FAREWELL_AGENT)


class FarewellAgent(Agent):
    def __init__(self):
        self._agent_type = AgentType.FAREWELL_AGENT
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Have a nice day", finished=True),
            ModelResponse(message="YOLO!", finished=True),
        ])

        self._prompt = dedent(f"""\
            You are a {self._agent_type.value} at a job counseling agency.
            Your task is to say goodbye to the user and end the conversation.
            """)+ '\n' + response_part + '\n' + dedent("""\
            Farewell the user with a warm goodbye.
            """)
        self._chain = ChatVertexAI(model_name="gemini-pro")

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        model_input = self._prompt + "\n" + ConversationHistoryFormatter.format_for_prompt(
            history) + "\nUser: " + user_input.message
        conversation = await self._chain.ainvoke(model_input)
        try:
            last: ModelResponse = json.loads(conversation.content)
        except json.JSONDecodeError as e:
            logger.exception(e)
            last = {
                "message": str(conversation.content),
                "finished": False
            }

        response = AgentOutput(message_for_user=last["message"],
                               finished=last["finished"],
                               agent_type=AgentType.FAREWELL_AGENT)
        return response
