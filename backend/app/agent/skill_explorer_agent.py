import logging
from typing import List, Dict

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_types import AgentOutput, AgentInput, AgentType
from app.agent.llm_caller import LLMCaller
from app.agent.llm_response import ModelResponse
from app.agent.prompt_response_template import get_json_response_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.agent.experience.experience_entity import ExperienceEntity
from app.vector_search.esco_entities import OccupationSkillEntity, SkillEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM


class TopSkills(BaseModel):
    skills: List[str]


SYSTEM_INSTRUCTIONS = """
You are an AI assistant working for an employment agency. Your primary goal is to identify the top 10 most relevant 
skills a job seeker possesses based on the experience being discussed. Focus on one experience.

Instructions:

Analyze Conversation: Carefully review the information provided by the user about their work history, projects, 
and accomplishments.

Extract Skills: Identify specific skills demonstrated by the user's experiences. Prioritize transferable skills 
applicable across various roles.

Seek Clarification (If Needed): If the context is unclear or you need more information to differentiate between 
skills, ask the user direct and concise questions. Do not repeat questions.

Refine and Prioritize: Narrow down your list to the 10 most impactful and relevant skills. If after questions the 
user does not provide more skills, use your best judgement.

Finished: The conversation is finished if the user has no more information to provide or if you have identified all the 
skills the user demonstrated.

Example Questions for Clarification:
"What have you done in your [job/experience]?"
"In your experience with [software/tool mentioned], what specific tasks did you perform that demonstrate your 
proficiency?"
Additional Considerations:

Tone: Write like you would to a young person over text messaging app. Keep it simple and engaging.
"""

SKILL_PARSER_SYSTEM_INSTRUCTIONS = """
  Based on the prior conversation return a JSON object containing a list of string representing the top 10 skills 
  that the user possesses. A full set of skills you can chose from is set under SKILLS.
  
  Your response must always bea a JSON object with the following schema:
    - skills:  A list of strings representing the top 10 skills that the user possesses.


    Example: {"skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"]}
"""


class SkillExplorerAgent(Agent):

    def __init__(self, experience_entity: ExperienceEntity):
        super().__init__(agent_type=AgentType.EXPLORE_SKILLS_AGENT, is_responsible_for_conversation_history=False)
        self.experience_entity = experience_entity
        self.TOP_COUNT = 10

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        essential_skills = self._get_essential_skills(self.experience_state.esco_occupations)
        response_part = get_json_response_instructions(examples=[
            ModelResponse(reasoning="Example reason.",
                          finished=False,
                          message="Example response. Your answer to the user's question.",
                          ),
        ])
        formatted_skills = "SKILLS:" + "; ".join([str(skill[1]) for skill in essential_skills.items()])
        system_instructions = SYSTEM_INSTRUCTIONS + "\n" + formatted_skills + "\n" + response_part
        convo_llm = GeminiGenerativeLLM(
            system_instructions=system_instructions)
        llm_input = "\nThe conversation so far:" + ConversationHistoryFormatter.format_to_string(context,
                                                                                                 user_input.message
                                                                                                 )
        convo_output = await LLMCaller.call_llm(
            llm=convo_llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                context, user_input.message), logger=logging.Logger(name="xyz"),
            model_response_type=ModelResponse)
        skill_llm = GeminiGenerativeLLM(
            system_instructions=SKILL_PARSER_SYSTEM_INSTRUCTIONS + "\n" + formatted_skills)
        top_skills = await LLMCaller.call_llm(llm=skill_llm, llm_input=llm_input, logger=logging.Logger(name="xyz"),
                                              model_response_type=TopSkills)
        self.experience_entity.top_skills = []
        for skill in top_skills[0].skills:
            self.experience_entity.top_skills.append(essential_skills[skill])
        return AgentOutput(finished=convo_output[0].finished, agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                           reasoning=convo_output[0].reasoning,
                           agent_response_time_in_sec=0.0, llm_stats=convo_output[1],
                           message_for_user=convo_output[0].message)

    def _get_essential_skills(self, occupations: List[OccupationSkillEntity]) -> Dict[str, SkillEntity]:
        return dict([(skill.preferredLabel, skill) for skill_occupations in occupations for
                     skill in skill_occupations.skills if skill.relationType == "essential"])
