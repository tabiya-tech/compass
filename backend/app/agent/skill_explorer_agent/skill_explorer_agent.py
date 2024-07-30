from app.agent.agent import Agent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from ._conversation_llm import _ConversationLLM
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.conversation_memory.conversation_memory_types import ConversationContext
from ._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool


class SkillsExplorerAgent(Agent):
    """
    The main agent for the skill explorer.
    It converses with the user to get details about the experience and extract responsibilities from the user's input.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                         is_responsible_for_conversation_history=False)
        self.experience_entity: ExperienceEntity | None = None

    def set_experience(self, experience_entity: ExperienceEntity) -> None:
        self.experience_entity = experience_entity

    @staticmethod
    def _merge_responsibilities_data(experience: ExperienceEntity,
                                     new_responsibilities_data: ResponsibilitiesData):
        """
        Merge the new responsibilities data with the existing responsibilities data.
        """

        existing_responsibilities = experience.responsibilities
        responsibilities = list(set(existing_responsibilities.responsibilities + new_responsibilities_data.responsibilities))
        non_responsibilities = list(set(existing_responsibilities.non_responsibilities + new_responsibilities_data.non_responsibilities))
        other_peoples_responsibilities = list(
            set(existing_responsibilities.other_peoples_responsibilities + new_responsibilities_data.other_peoples_responsibilities))
        existing_responsibilities.responsibilities = responsibilities
        existing_responsibilities.non_responsibilities = non_responsibilities
        existing_responsibilities.other_peoples_responsibilities = other_peoples_responsibilities

    async def execute(self, user_input: AgentInput,
                      context: ConversationContext
                      ) -> AgentOutput:

        if self.experience_entity is None:
            raise ValueError("SkillsExplorerAgent: execute() called before the experience was set")

        responsibilities_llm_stats = []
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        else:
            # Extract the responsibilities data from the last user's input
            responsibilities_extraction_tool = _ResponsibilitiesExtractionTool(self.logger)
            responsibilities_output, responsibilities_llm_stats = \
                await responsibilities_extraction_tool.execute(user_input=user_input,
                                                               context=context)
            self.logger.debug("Experience data from our conversation until now to be merged to the data response: %s",
                              responsibilities_output)
            # Merge the extracted responsibilities data into the experience entity
            SkillsExplorerAgent._merge_responsibilities_data(self.experience_entity, responsibilities_output)

        # Converses with the user to get details about the experience
        conversion_llm = _ConversationLLM()
        conversation_llm_output = await conversion_llm.execute(user_input=user_input, context=context,
                                                               experience_title=self.experience_entity.experience_title,
                                                               work_type=self.experience_entity.work_type,
                                                               logger=self.logger)

        conversation_llm_output.llm_stats = responsibilities_llm_stats + conversation_llm_output.llm_stats
        return conversation_llm_output
