import json

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent._conversation_llm import _ConversationLLM
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext


class CollectExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """
    session_id: int

    collected_data: list[CollectedData] = []
    """
    The data collected during the conversation.
    """

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"

    def __init__(self, session_id):
        super().__init__(
            session_id=session_id,
            collected_data=[]
        )


class CollectExperiencesAgent(Agent):
    """
    This agent drives the conversation to build up the initial picture of the previous work experiences of the user.
    This agent is stateless, and it does not link to ESCO.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=False)
        self._experiences: list[ExperienceEntity] = []
        self._state: CollectExperiencesAgentState | None = None

    def set_state(self, state: CollectExperiencesAgentState):
        """
        Set the state of the agent.
        This method should be called before the agent' execute() method is called.
        """
        self._state = state

    async def execute(self, user_input: AgentInput,
                      context: ConversationContext) -> AgentOutput:

        if self._state is None:
            raise ValueError("CollectExperiencesAgent: execute() called before state was initialized")

        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"

        collected_data = self._state.collected_data
        json_data = json.dumps([_data.dict() for _data in collected_data], indent=2)

        data_extraction_llm = _DataExtractionLLM(self.logger)

        data_extraction_llm_output, data_extraction_llm_stats = await data_extraction_llm.execute(user_input=user_input,
                                                                                                  context=context,
                                                                                                  collected_experience_data=json_data)
        self.logger.debug("Experience data from our conversation until now to be merged to the data response: %s",
                          data_extraction_llm_output)

        collected_data.clear()  # Overwrite the old with the new data, as it is difficult to merge them
        if data_extraction_llm_output and data_extraction_llm_output.collected_experiences_data:
            index = 0
            for elem in data_extraction_llm_output.collected_experiences_data:
                new_item = CollectedData(
                    index=index,
                    experience_title=elem.experience_title,
                    company=elem.company,
                    location=elem.location,
                    start_date_calculated=elem.start_date_calculated,
                    end_date_calculated=elem.end_date_calculated,
                    work_type=elem.work_type
                )
                # Sometimes the LLM may add an empty experience, so we skip it
                if collect_experience_is_empty(new_item):
                    self.logger.debug("Experience data is empty: %s", new_item)
                    continue
                # Sometimes the LLM may add duplicates, so we remove them
                if any(compare_collected_data(new_item, existing_item) for existing_item in collected_data):
                    self.logger.warning("Duplicate experience data detected: %s", new_item)
                    continue
                collected_data.append(new_item)
                index += 1

        conversion_llm = _ConversationLLM()
        json_data = json.dumps([_data.dict() for _data in collected_data], indent=2)
        conversation_llm_output = await conversion_llm.execute(user_input=user_input, context=context,
                                                               collected_experience_data=json_data, logger=self.logger)
        if conversation_llm_output.finished:
            for elem in collected_data:
                self.logger.debug("Experience data collected: %s", elem)
                try:
                    entity = ExperienceEntity(
                        experience_title=elem.experience_title,
                        company=elem.company,
                        location=elem.location,
                        timeline=Timeline(start=elem.start_date_calculated, end=elem.end_date_calculated),
                        work_type=CollectExperiencesAgent._get_work_type(elem.work_type)
                    )
                    self._experiences.append(entity)
                except Exception as e:  # pylint: disable=broad-except
                    self.logger.warning("Could not parse experience entity from: %s. Error: %s", elem, e)

        conversation_llm_output.llm_stats = data_extraction_llm_stats + conversation_llm_output.llm_stats
        return conversation_llm_output

    def get_experiences(self) -> list[ExperienceEntity]:
        """
        Get the experiences extracted by the agent.
        This method should be called after the agent has finished its task, otherwise,
        the list will be empty or incomplete.
        :return:
        """
        return self._experiences

    @staticmethod
    def _get_work_type(key: str | None) -> WorkType | None:
        if key in WorkType.__members__:
            return WorkType[key]

        return None


def collect_experience_is_empty(experience: CollectedData):
    return all([experience.experience_title == "" or experience.experience_title is None,
                experience.start_date_calculated == "" or experience.start_date_calculated is None,
                experience.end_date_calculated == "" or experience.end_date_calculated is None,
                experience.company == "" or experience.company is None,
                experience.location == "" or experience.location is None,
                ])


def compare_collected_data(item1: CollectedData, item2: CollectedData):
    return (item1.experience_title == item2.experience_title and
            item1.work_type == item2.work_type and
            item1.start_date_calculated == item2.start_date_calculated and
            item1.end_date_calculated == item2.end_date_calculated and
            item1.company == item2.company and
            item1.location == item2.location)
