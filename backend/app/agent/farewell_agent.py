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

        finish_instructions = get_conversation_finish_instructions(dedent("""Once you have completed your task"""))

        system_instructions_template = dedent("""\
            Your task is to summarize my experiences and skills discovered 
            in the skill exploration session between me and others agents and say goodbye.
            Do not ask any questions.
            Do not make things up.
            Do not explore skills further. 
            Do not make any other suggestions.
            Do not answer any of my questions.
            Do not format or style your response.
            There aren't any follow-up steps.
            If i ask questions you are unsure, you will answer each time with a concise but different variation of:
            "Sorry, I don't know how to help you with that."
            Ensure the total response, including the goodbye, does not exceed 100 words.          
            
            {response_part}
            
            {finish_instructions}
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.FAREWELL_AGENT,
                         system_instructions=system_instructions)
