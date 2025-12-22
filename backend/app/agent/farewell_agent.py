from textwrap import dedent

from app.agent.simple_llm_agent.simple_llm_agent import SimpleLLMAgent
from app.agent.agent_types import AgentType, AgentInput, AgentOutput
from app.agent.simple_llm_agent.prompt_response_template import get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER

class FarewellAgent(SimpleLLMAgent):
    """
    Agent that farewells the user and provides a response based on the task
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        return await super().execute(user_input, context)

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions()

        finish_instructions = get_conversation_finish_instructions(dedent("""Once you have completed your task"""))

        system_instructions_template = dedent("""\
            Your task is to thank me for participating in the skill exploration session, and say goodbye.
            Be friendly and farewell me with a positive and supportive message that captures the bigger picture of my working experiences from our conversation
           
            {language_style}
                                                          
           
            {language_style}
                                                          
            Do not summarize my skills
            Do not ask any questions.
            Do not make things up.
            Do not explore skills further. 
            Do not make any other suggestions.
            Do not answer any of my questions.
            Do not format or style your response.
            There aren't any follow-up steps.
            If I ask questions you are unsure, you will answer each time with a concise but different variation of:
                "Sorry, I don't know how to help you with that."
            Ensure the total response does not exceed 100 words.          
            
            {response_part}
            
            {finish_instructions}
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  language_style=STD_LANGUAGE_STYLE,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.FAREWELL_AGENT,
                         system_instructions=system_instructions)
