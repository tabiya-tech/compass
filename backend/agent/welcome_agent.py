import json
import logging
from textwrap import dedent

from langchain_google_vertexai import ChatVertexAI

from agent.agent_types import AgentInput, AgentOutput, Agent, AgentType, ConversationHistory, \
    ConversationHistoryFormatter
from agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions

logger = logging.getLogger(__name__)


class SimpleWelcomeAgent(Agent):

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        print(user_input.message + " from WelcomeAgent")
        return AgentOutput(message_for_user="WelcomeAgent done", finished=True, agent_type=AgentType.WELCOME_AGENT)


class WelcomeAgent(Agent):

    def __init__(self):
        self._agent_type = AgentType.WELCOME_AGENT
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Welcome! How can I assist you today?", finished=False),
            ModelResponse(message="The job counseling agency is called tabiya compass.", finished=False),
            ModelResponse(message="Great, we will now begin with the counseling session.", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(
            'Once the user is ready to start the counseling session')

        self._prompt = dedent(f"""\
        You are a {self._agent_type.value} at a job counseling agency. 
        Your task is to welcome the user and introduce them to the job counseling process. 
        For answering user questions, you can use the _Information_ section below.
        If you are unsure and the question contains information that is not explicitly related to your task 
        and can't be found in the _ABOUT_ section, you will answer with 
        "Sorry, I don't know how to help with that."            
        
        _ABOUT_:
            The job counseling agency is called tabiya compass.
            This counseling process works via a simple conversation. 
            Once the user is welcomed and they are ready to start,
            the counseling session will begin. 
            During that session the user will be asked questions to help them explore and discover their skills.
            Once the user has completed the session, they will be provided with a list skills 
            explored during the session. 
        """) + '\n' + response_part + '\n' + dedent("""\
        Welcome the user with a warm welcome, 
        then briefly introduce the process to the user and answer any question they might have.
        Gently guide the user to the start of the counseling session.
        """) + '\n' + finish_instructions
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
                               agent_type=AgentType.WELCOME_AGENT)
        return response

    def get_chain(self) -> ChatVertexAI:
        return self._chain
