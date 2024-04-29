from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions


class WelcomeAgent(SimpleLLMAgent):
    """
    Agent that welcomes the user and provides a response based on the task
    """

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Welcome! Are you ready to begin?", finished=False),
            ModelResponse(message="My name is Tabiya Compass.", finished=False),
            ModelResponse(message="Great, we will now begin with the exploration.", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(
            'When I say or indicate that am ready to start')

        system_instructions_template = dedent("""\
        You are a receptionist at a tabiya compass a skills exploration agency. 
        Your task is to welcome and forward me to the skills exploration session.
        Your task is finished, when I say that I am ready to start with the exploration session.
        Answer any questions I might have using the _ABOUT_ section below.
        If you are unsure and I ask questions that contain information that is not explicitly related to your task 
        and can't be found in the _ABOUT_ section, you will answer each time with a concise but different variation of:
        "Sorry, I don't know how to help with that. Shall we begin your skills exploration session?"            
        If I return to you after I have started the skills exploration session do not start over, 
        just answer only general questions I might have about the skills exploration process. 
        Be clear and concise in your responses do not break character and do not make things up.
        Answer in no more than 100 words.
   
        _ABOUT_:
            Your name is tabiya compass.
            You work via a simple conversation. 
            The exploration session will begin, once I am ready to start. 
            During that session I will be asked questions to explore and discover my skills.
            Once I have completed the session, I will be provided with a list of skills and a CV.
        
        {response_part}
        
        {finish_instructions}             
        """)
        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.WELCOME_AGENT,
                         system_instructions=system_instructions, )
