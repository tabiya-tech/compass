from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType, AgentInput, AgentOutput
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_types import ConversationContext


class QnaAgent(SimpleLLMAgent):
    """An agent used to answer questions from the user."""

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Example response. Your answer to the user's question.",
                          finished=True,
                          reasoning="Reasoning for the response"),
        ])

        system_instructions_template = dedent("""Your task is to answer general questions that the user asks. 
        Answer any questions the user might have using the _ABOUT_ section below. Focus only on the last question 
        asked. If you are unsure and the user asks questions that contain information that is not explicitly related 
        to your task and can't be found in the _ABOUT_ section, you will answer each time with a concise but 
        different variation of: "Sorry, I don't know how to help you with that." Be clear and concise in your 
        responses do not break character and do not make things up. Answer in no more than 100 words.
   
        _ABOUT_:
            Your name is tabiya compass.
            You are a tool that helps users explore their skills and generate a CV.
            You work via a simple conversation. 
            The exploration session will begin, once the user is ready to start. 
            The data will be used to improve the ability to answer questions and generate text. It will be stored 
            securely and anonymized when possible.
            During that session the user will be asked questions to explore and discover your skills.
            Once you have completed the session, the user will be provided with a list of skills and a CV.
        
        {response_part}
        
        {finish_instructions}
        """)
        system_instructions = system_instructions_template.format(
            response_part=response_part,
            finish_instructions=get_conversation_finish_instructions("When you have answered the user's question,"))

        super().__init__(agent_type=AgentType.QNA_AGENT,
                         system_instructions=system_instructions)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        result = await super().execute(user_input, context)
        result.finished = True  # Force finished to be true.
        return result
