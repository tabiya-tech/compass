import logging
from textwrap import dedent

from langchain_google_vertexai import ChatVertexAI

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationHistory
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

logger = logging.getLogger(__name__)


class SimpleWelcomeAgent(Agent):
    """
    Simple agent that provides a simple response, should be used for testing purposes only
    """

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        print(user_input.message + " from WelcomeAgent")
        return AgentOutput(message_for_user="WelcomeAgent done", finished=True, agent_type=AgentType.WELCOME_AGENT)


class WelcomeAgent(Agent):
    """
    Agent that welcomes the user and provides a response based on the task
    """

    def __init__(self):
        self._agent_type = AgentType.WELCOME_AGENT
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Welcome! Are you ready to begin?", finished=False),
            ModelResponse(message="The job counseling agency is called tabiya compass.", finished=False),
            ModelResponse(message="Great, we will now begin with the counseling session.", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(
            'When the user indicates that they are ready to start the counseling session, ' +
            'or when the user asks to start the counseling session')

        self._prompt = dedent(f"""\
        You are a {self._agent_type.value} at a skills exploration agency. 
        Your task is to :
           - welcome the user
           - introduce them to the exploration process
           - answer user questions about the exploration process 
           - forward the use to the exploration session
        Begin by welcoming the user with a warm welcome and introduce the process.
        Answer any questions they might have using the _ABOUT_ section below.
        Guide the user to the start of the exploration session.
        If you are unsure and the question contains information that is not explicitly related to your task 
        and can't be found in the _ABOUT_ section, you will answer with 
        "Sorry, I don't know how to help with that."            
        If the user returns after they have started the exploration session do not start over, 
        just answer only general questions about the skills exploration process. 
        Be clear in your responses do not break character and do not make things up.
   
        _ABOUT_:
            The exploration process is called tabiya compass.
            This exploration process works via a simple conversation. 
            Once the user is welcomed and they are ready to start,
            the exploration session will begin. 
            During that session the user will be asked questions to help them explore and discover their skills.
            Once the user has completed the session, they will be provided with a list skills 
            explored during the session. 
        """) + '\n' + response_part + '\n' + dedent("""\
        """) + '\n' + finish_instructions
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
                               agent_type=AgentType.WELCOME_AGENT)
        return response
