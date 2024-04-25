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
            ModelResponse(message="The job counseling agency is called tabiya compass.", finished=False),
            ModelResponse(message="Great, we will now begin with the counseling session.", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(
            'When the user indicates that they are ready to start the counseling session, ' +
            'or when the user asks to start the counseling session, '
            'or when the user is ready to start.')

        system_instructions_template = dedent("""\
        You are a Receptionist at a skills exploration agency. 
        Your task is to :
           - welcome the user
           - introduce them to the exploration process
           - answer user questions about the exploration process 
           - forward the user to the exploration session
        Begin by welcoming the user with a warm welcome and introduce the process.
        Answer any questions they might have using the _ABOUT_ section below.
        Guide the user to start the exploration session.
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
        
        {response_part}
        
        {finish_instructions}             
        """)
        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.WELCOME_AGENT,
                         system_instructions=system_instructions)
