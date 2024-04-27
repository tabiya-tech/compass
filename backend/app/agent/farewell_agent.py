from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions


class FarewellAgent(SimpleLLMAgent):
    """
    Agent that farewells the user and provides a response based on the task
    """

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Have a nice day", finished=True),
            ModelResponse(message="YOLO!", finished=True),
        ])

        system_instructions_template = dedent("""\
            You are a receptionist at a skills exploration agency.
            Your only task is to say goodbye and end the conversation.
            
            {response_part}
            
            Say farewell with a warm goodbye.
            """)

        system_instructions = system_instructions_template.format(response_part=response_part)
        super().__init__(agent_type=AgentType.FAREWELL_AGENT,
                         system_instructions=system_instructions)
