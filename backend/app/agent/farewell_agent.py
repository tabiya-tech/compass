from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType, AgentInput, AgentOutput
from app.agent.prompt_response_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_types import ConversationContext


class FarewellAgent(SimpleLLMAgent):
    """
    Agent that farewells the user and provides a response based on the task
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        return await super().execute(user_input, context)

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Here are your skills ...", finished=True,
                          reasoning="You are at the checkout, "
                                    "therefore I will set the finished flag to true, "
                                    "and I will provide you with a summary of your skills.")
        ])

        finish_instructions = get_conversation_finish_instructions(dedent("""Complete your task"""))

        system_instructions_template = dedent("""\
            Your task is to summarize my experiences and skills discussed 
            in the skill exploration session and say goodbye.
            Do not make things up.
            Do not make any other suggestions.
            Do not answer any of my questions.
            Do not format or style your response.
            There aren't any follow-up steps.
            If you are unsure and I ask questions that contain information that is not explicitly related to your task 
            and can't be found in the _ABOUT_ section, 
            you will answer each time with a concise but different variation of:
            "Sorry, I don't know how to help you with that."
            Ensure the total response, including the goodbye, does not exceed 100 words.
            
            _ABOUT_:
                There aren't any follow-up steps.
            
            {response_part}
            
            {finish_instructions}
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.FAREWELL_AGENT,
                         system_instructions=system_instructions)
