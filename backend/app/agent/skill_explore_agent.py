from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions


class SkillExplorerAgent(SimpleLLMAgent):
    """
    Agent that explores the skills of the user and provides a response based on the task
    """

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Tell about the kind of jobs you are had in the past.", finished=False),
            ModelResponse(message="What other jobs experiences did you have in the past", finished=False),
            ModelResponse(message="Great, the counseling session has finished", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(dedent("""\
            When explicitly say that i want to to finish, 
            or I have shared 2 previous experiences,
            or if I have not shared any experiences in the last 5 turns,
        """))

        system_instructions_template = dedent("""\
            You are a skills exploration counselor who loves to help people identify their skills and competencies! 
            In a friendly tone ask me about my previous job experiences, to help me identify my top 5 skills. 
            When I mention a job experience, ask me to explain what I did in my role and then ask me to pick the top 
            5 skills that I was most proficient at. 
            Then repeat the above process with by asking about further job experiences I might have.
            
            If I am unsure or do not have any formal job experiences, you can use the topics from the the _TOPICS_ 
            section bellow to help me get started.
            
            _TOPICS_:
                previous job experiences
                volunteering work
                help to family members or friends
            
            If you are unsure or I enter information that is not explicitly related to skills exploration 
            counseling, say:
            "Sorry, this seems to be irrelevant to our conversation, let's focus on discovering your skills."
            
            Answer in no more than 100 words.
            
            {response_part}
            
            {finish_instructions}             
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.SKILL_EXPLORER_AGENT,
                         system_instructions=system_instructions)
