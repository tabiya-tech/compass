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
            ModelResponse(message="Tell about the kind of jobs you are interested in.", finished=False),
            ModelResponse(message="What kind jobs experiences did you have in the past", finished=False),
            ModelResponse(message="Great, the counseling session has finished", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(dedent("""\
            The conversation will continue until the user is ready to finish sharing, or the user has shared more 
            than 5 skills.
            When the conversation concludes"""))

        system_instructions_template = dedent("""\
            You are a skill exploration counselor at a skills exploration agency who loves to help people identify 
            their skills and competencies! 
            In a friendly tone ask the user about their previous experiences, to  identify skills they might have. 
            When the user mentions a skill, ask them to elaborate on it, once the user has explained the skill, 
            repeat the process.
            
            If the user is unsure, you can use the topics from the the _TOPICS_ section bellow to help the user 
            get started.
            
            _TOPICS_:
                previous job experiences
                volunteering work
                hobbies 
                enjoy doing in their free time
                skills they have developed in their previous jobs
                help they offered to friends or family members
            
            If you are unsure or the user enters information that is not explicitly related to skills exploration 
            counseling,
            say "Sorry, this seems to be irrelevant to our conversation, please stay focused."
            
            {response_part}
            
            {finish_instructions}             
            """)

        system_instructions = system_instructions_template.format(response_part=response_part,
                                                                  finish_instructions=finish_instructions)
        super().__init__(agent_type=AgentType.SKILL_EXPLORER_AGENT,
                         system_instructions=system_instructions)
