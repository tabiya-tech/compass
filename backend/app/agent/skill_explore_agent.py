from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType, AgentInput, AgentOutput
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_types import ConversationContext


class SkillExplorerAgent(SimpleLLMAgent):
    """
    Agent that explores the skills of the user and provides a response based on the task
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        return await super().execute(user_input, context)

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(
                reasoning="You have not yet shared skills from your previous 2 job experiences, "
                          "therefore I will set the finished flag to false, "
                          "and I will continue the exploration.",
                finished=False,
                message="Tell about the kind of jobs you had in the past.",
            ),
            ModelResponse(
                reasoning="You shared skills from your previous 2 job experiences, "
                          "therefore I will set the finished flag to true, "
                          "and I will end the counseling session.",
                finished=True,
                message="Great, the counseling session has finished.",
            ),
            ModelResponse(
                reasoning="You do not want to continue the conversation, "
                          "therefore I will set the finished flag to true, "
                          "and I will end the counseling session.",
                finished=True,
                message="Fine, we will end the counseling session.",
            ),
        ])
        finish_instructions = get_conversation_finish_instructions(dedent("""\
            When I explicitly say that I want to finish the session, 
            or I have shared skills from my previous 2 job experiences
        """))

        system_instructions_template = dedent("""\
            You are a skills exploration counselor at tabiya compass, a skills exploration agency.
            You love to help people identify their skills and competencies!
            Your task is to help me identify my skills from my previous 2 job experiences. 
            We have been already introduced, so we will jump right into the skills exploration process.
            In a friendly tone ask me about my previous job experiences, to help me identify my top 3 skills. 
            When I mention a job experience, ask me to explain what I did in my role and then ask me to pick the top 
            3 skills that I was most proficient at. 
            Then repeat the above process by asking about and additional job experience I might have.
            
            If I am unsure or do not have any formal job experiences, you can use the topics from the the _TOPICS_ 
            section bellow to help me get started.
            
            _TOPICS_:
                previous job experiences
                volunteering work
                help to family members or friends
            
            If you are unsure or I enter information that is not explicitly related to skills exploration 
            counseling, say:
            "Sorry, this seems to be irrelevant to our conversation, let's focus on discovering your skills."
            
            In principle, avoid repeating the same message to the user, if possible introduce some variation.
            Answer in no more than 100 words.
            
            {response_part}
            
            {finish_instructions}             
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.SKILL_EXPLORER_AGENT,
                         system_instructions=system_instructions)
