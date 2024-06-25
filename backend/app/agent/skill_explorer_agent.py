from typing import List

from app.agent.agent import Agent
from app.agent.agent_types import AgentOutput, AgentInput, AgentType
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.agent.experience.experience_entity import ExperienceEntity
from app.vector_search.esco_entities import OccupationSkillEntity, SkillEntity


class SkillExplorerAgent(Agent):

    def __init__(self, experience_entity: ExperienceEntity):
        super().__init__(agent_type=AgentType.EXPLORE_SKILLS_AGENT, is_responsible_for_conversation_history=False)
        self.experience_entity = experience_entity
        self.TOP_COUNT = 10

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        self.experience_entity.esco_skills = self._get_skills(self.experience_entity.esco_occupations)
        return AgentOutput(finished=True, agent_type=self.agent_type, reasoning="Hardcoded result",
                           agent_response_time_in_sec=0.0, llm_stats=[], message_for_user="(silence)")

    def _get_skills(self, occupations: List[OccupationSkillEntity]) -> List[SkillEntity]:
        return [skill for skill_occupations in occupations for
                skill in skill_occupations.skills if skill.relationType == "essential"][0:self.TOP_COUNT]
