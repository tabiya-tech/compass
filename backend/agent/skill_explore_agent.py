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
from agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions

logger = logging.getLogger(__name__)


class SimpleSkillExplorerAgent(Agent):

    async def reset(self):
        """
        This agent does not have any state to reset
        """

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        print(user_input.message + " from SkillExplorerAgent")
        return AgentOutput(message_for_user="SkillExplorerAgent done", finished=True,
                           agent_type=AgentType.SKILL_EXPLORER_AGENT)


class SkillExplorerAgent(Agent):

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Tell about the kind of jobs you are interested in.", finished=False),
            ModelResponse(message="What kind jobs experiences did you have in the past", finished=False),
            ModelResponse(message="Great, the counseling session has finished", finished=True),
        ])
        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(f"""
            You are a very enthusiastic career consultant who loves to help people identify their skills and competencies! 
            In a friendly tone ask the user about their interests and possible skills they might have. 
            When the user mentions a skill, ask them to elaborate on it, once the user has explained the skill, 
            repeat the process with another skill.
            
            If the user is unsure, you can use the topics from the the _TOPICS_ section bellow to help the user get started.
            
            _TOPICS_:
                volunteering work
                hobbies 
                enjoy doing in their free time
                skills they have developed in their previous jobs
                help they offered to friends or family members
            
            If you are unsure or the user enters information that is not explicitly related to job counseling,
            say "Sorry, this seems to be irrelevant to our conversation, please stay focused.       
                
            {response_part}
                              
            {get_conversation_finish_instructions(
                "The conversation will continue until the user is ready to finish sharing,"
                "or the user has shared more than 5 skills."
                "When the conversation concludes")}
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
                               agent_type=AgentType.SKILL_EXPLORER_AGENT)
        return response

    def get_chain(self) -> LLMChain:
        return self._chain
