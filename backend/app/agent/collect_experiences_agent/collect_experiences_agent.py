from typing import Optional, Mapping, Any

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_types import AgentType
from app.agent.collect_experiences_agent._conversation_llm import _ConversationLLM, ConversationLLMAgentOutput, \
    _get_experience_type
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.countries import Country


def _deserialize_work_types(value: list[str] | list[WorkType]) -> list[WorkType]:
    if isinstance(value, list):
        # If the value is a list, and the items in the list are strings, we convert the strings to the Enum
        # Otherwise, we return the value as is
        return [WorkType[x] if isinstance(x, str) else x for x in value]
    return value


class CollectExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """

    session_id: int
    """
    The session id of the conversation.
    """

    country_of_user: Country = Field(default=Country.UNSPECIFIED)
    """
    The country of the user.
    """

    collected_data: list[CollectedData] = Field(default_factory=list)
    """
    The data collected during the conversation.
    """

    unexplored_types: list[WorkType] = Field(default_factory=lambda: [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                                                                      WorkType.SELF_EMPLOYMENT,
                                                                      WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
                                                                      WorkType.UNSEEN_UNPAID])
    """
    The types of work experiences that have not been explored yet.
    """

    explored_types: list[WorkType] = Field(default_factory=list)
    """
    The questions asked by the conversational LLM.
    """

    first_time_visit: bool = True
    """
    Whether this is the first time the agent is visited during the conversation.
    """

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        if isinstance(value, str):
            return Country[value]
        return value

    # use a field serializer to serialize the explored_types
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("explored_types")
    def serialize_explored_types(self, explored_types: list[WorkType], _info):
        # We serialize the explored_types to a list of strings (the names of the Enum)
        return [x.name for x in explored_types]

    # Deserialize the explored_types from the enum name
    @field_validator("explored_types", mode='before')
    def deserialize_explored_types(cls, value: list[str] | list[WorkType]) -> list[WorkType]:
        return _deserialize_work_types(value)

    # use a field serializer to serialize the unexplored_types
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("unexplored_types")
    def serialize_unexplored_types(self, unexplored_types: list[WorkType], _info):
        # We serialize the unexplored_types to a list of strings (the names of the Enum)
        return [x.name for x in unexplored_types]

    # Deserialize the unexplored_types from the enum name
    @field_validator("unexplored_types", mode='before')
    def deserialize_unexplored_types(cls, value: list[str] | list[WorkType]) -> list[WorkType]:
        return _deserialize_work_types(value)

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "CollectExperiencesAgentState":
        return CollectExperiencesAgentState(session_id=_doc["session_id"],
                                            # For backward compatibility with old documents that don't have the country_of_user field, set it to UNSPECIFIED
                                            country_of_user=_doc.get("country_of_user", Country.UNSPECIFIED),
                                            collected_data=_doc["collected_data"],
                                            unexplored_types=_doc["unexplored_types"],
                                            explored_types=_doc["explored_types"],
                                            first_time_visit=_doc["first_time_visit"])


class CollectExperiencesAgent(Agent):
    """
    This agent converses with user and collects basic information about their work experiences.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=False)
        self._experiences: list[ExperienceEntity] = []
        self._state: Optional[CollectExperiencesAgentState] = None

    def set_state(self, state: CollectExperiencesAgentState):
        """
        Set the state of the agent.
        This method should be called before the agent's execute() method is called.
        """
        self._state = state

    async def execute(self, user_input: AgentInput,
                      context: ConversationContext) -> AgentOutput:

        if self._state is None:
            raise ValueError("CollectExperiencesAgent: execute() called before state was initialized")

        collected_data = self._state.collected_data
        last_referenced_experience_index = -1
        data_extraction_llm_stats = []
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        else:
            # The data extraction LLM is responsible for extracting the experience data from the conversation
            data_extraction_llm = _DataExtractionLLM(self.logger)
            # TODO: the LLM can and will fail with an exception or even return None, we need to handle this
            last_referenced_experience_index, data_extraction_llm_stats = await data_extraction_llm.execute(user_input=user_input,
                                                                                                            context=context,
                                                                                                            collected_experience_data_so_far=collected_data)
        conversion_llm = _ConversationLLM()
        # TODO: Keep track of the last_referenced_experience_index and if it has changed it means that the user has
        #   provided a new experience, we need to handle this as
        #   a) if the user has not finished with the previous one we should ask them to complete it first
        #   b) the model may have made a mistake interpreting the user input as we need to clarify
        exploring_type = self._state.unexplored_types[0] if len(self._state.unexplored_types) > 0 else None
        conversation_llm_output: ConversationLLMAgentOutput = await conversion_llm.execute(
            first_time_visit=self._state.first_time_visit,
            context=context,
            user_input=user_input,
            country_of_user=self._state.country_of_user,
            collected_data=collected_data,
            last_referenced_experience_index=last_referenced_experience_index,
            exploring_type=exploring_type,
            unexplored_types=self._state.unexplored_types,
            explored_types=self._state.explored_types,
            logger=self.logger)
        self._state.first_time_visit = False  # The first time visit is over
        if conversation_llm_output.exploring_type_finished and self._state.unexplored_types:
            # The specific work type has already been explored, so we remove it from the list
            # and allow the conversation to continue
            explored_type = self._state.unexplored_types.pop(0)
            exploring_type = self._state.unexplored_types[0] if len(self._state.unexplored_types) > 0 else None
            self._state.explored_types.append(explored_type)
            self.logger.info(
                "Explored work type: %s"
                "\n  - remaining types: %s"
                "\n  - discovered experiences so far: %s",
                explored_type,
                self._state.unexplored_types,
                self._state.collected_data
            )
            
            # Check if all types have been explored
            if len(self._state.unexplored_types) == 0:
                # All work types have been explored, mark as finished
                self.logger.info(
                    "All work types explored. CollectExperiencesAgent finishing."
                )
                conversation_llm_output.finished = True
            else:
                # More types to explore, continue with transition
                transition_message: str
                if exploring_type is not None:
                    transition_message = f"{user_input.message}\nAsk me about experiences that include: {_get_experience_type(exploring_type)}"
                else:
                    transition_message = f"{user_input.message}\nLet's recap, and give me a chance to correct any mistakes."
                conversation_llm_output = await conversion_llm.execute(first_time_visit=self._state.first_time_visit,
                                                                       context=context,
                                                                       user_input=AgentInput(message=transition_message, is_artificial=True),
                                                                       country_of_user=self._state.country_of_user,
                                                                       collected_data=collected_data,
                                                                       last_referenced_experience_index=last_referenced_experience_index,
                                                                       exploring_type=exploring_type,
                                                                       unexplored_types=self._state.unexplored_types,
                                                                       explored_types=self._state.explored_types,
                                                                       logger=self.logger)
        
        # Final check: if all types are explored, mark as finished
        if len(self._state.unexplored_types) == 0 and not conversation_llm_output.finished:
            self.logger.info(
                "All work types already explored. CollectExperiencesAgent finishing."
            )
            conversation_llm_output.finished = True

        conversation_llm_output.llm_stats = data_extraction_llm_stats + conversation_llm_output.llm_stats
        return conversation_llm_output

    def get_experiences(self) -> list[ExperienceEntity]:
        """
        Get the experiences extracted by the agent.
        If this method is called before the agent has finished its task, the list will be empty or incomplete.
        :return:
        """
        experiences = []
        # The conversation is completed when the LLM has finished and all work types have been explored
        for elem in self._state.collected_data:
            self.logger.debug("Experience data collected: %s", elem)
            try:
                entity = ExperienceEntity(
                    uuid=elem.uuid if elem.uuid else None,
                    experience_title=elem.experience_title if elem.experience_title else '',
                    company=elem.company,
                    location=elem.location,
                    timeline=Timeline(start=elem.start_date, end=elem.end_date),
                    work_type=WorkType.from_string_key(elem.work_type)
                )
                experiences.append(entity)
            except Exception as e:  # pylint: disable=broad-except
                self.logger.warning("Could not parse experience entity from: %s. Error: %s", elem, e)

        return experiences
