import json
import logging

from langchain.chains.llm import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain_google_vertexai import ChatVertexAI

from agent.agent_types import AgentInput, AgentOutput, AgentType, Agent
from agent.prompt_reponse_template import ModelResponse, get_json_response_instructions

logger = logging.getLogger(__name__)


class SimpleFarewellAgent(Agent):

    async def reset(self):
        """
        This agent does not have any state to reset
        """

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        return AgentOutput(message_for_user="FarewellAgent done", finished=True, agent_type=AgentType.FAREWELL_AGENT)


class FarewellAgent(Agent):
    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Have a nice day", finished=True),
            ModelResponse(message="YOLO!", finished=True),
        ])

        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(f"""
            You are a checkout receptionist at a job counseling agency.
            Your task is to say goodbye to the user and end the conversation. 
                        
            {response_part}
            
            Farewell the user with a warm goodbye.
            
            """),
            MessagesPlaceholder(variable_name="chat_history"),
            HumanMessagePromptTemplate.from_template("{user_input}")
        ])
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

        llm = ChatVertexAI(model_name="gemini-pro", convert_system_message_to_human=True)
        self._chain = LLMChain(
            llm=llm,
            prompt=prompt,
            verbose=False,
            memory=memory
        )

    async def reset(self):
        self._chain.memory.clear()

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        conversation = await self._chain.ainvoke({"user_input": user_input.message})
        try:
            last: ModelResponse = json.loads(conversation["text"])
        except json.JSONDecodeError as e:
            logger.exception(e)
            last = {
                "message": conversation["text"],
                "finished": False
            }

        response = AgentOutput(message_for_user=last["message"],
                               finished=last["finished"],
                               agent_type=AgentType.FAREWELL_AGENT)
        return response

    def get_chain(self) -> LLMChain:
        return self._chain
