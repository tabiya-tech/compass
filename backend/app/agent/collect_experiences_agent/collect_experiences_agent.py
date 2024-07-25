import json

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent._conversation_llm import _ConversationLLM, ConversationLLMAgentOutput
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

    unexplored_types: list[WorkType] = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT, WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
                                        WorkType.UNSEEN_UNPAID]
    """
    The types of work experiences that have not been explored yet.
    """

    explored_types: list[WorkType] = []
    """
    The questions asked by the conversational LLM.
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
        This method should be called before the agent's execute() method is called.
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
        # The data extraction LLM is responsible for extracting the experience data from the conversation
        data_extraction_llm = _DataExtractionLLM(self.logger)
        # TODO: the LLM can and will fail with an exception or even return None, we need to handle this
        last_referenced_experience_index, data_extraction_llm_stats = await data_extraction_llm.execute(user_input=user_input,
                                                                                                        context=context,
                                                                                                        collected_experience_data_so_far=collected_data)
        conversion_llm = _ConversationLLM()
        # TODO: Keep track of the last_referenced_experience_index and if it has changed it means that the user has
        # provided a new experience, we need to handle this as
        # a) if the user has not finished with the previous one we should ask them to complete it first
        # b) the model may have made a mistake interpreting the user input as we need to clarify
        conversation_llm_output: ConversationLLMAgentOutput
        exploring_type = self._state.unexplored_types[0] if len(self._state.unexplored_types) > 0 else None
        conversation_llm_output = await conversion_llm.execute(context=context,
                                                               user_input=user_input,
                                                               collected_data=collected_data,
                                                               last_referenced_experience_index=last_referenced_experience_index,
                                                               exploring_type=exploring_type,
                                                               unexplored_types=self._state.unexplored_types,
                                                               explored_types=self._state.explored_types,
                                                               logger=self.logger)

        if conversation_llm_output.finished and len(self._state.unexplored_types) == 0:
            # The conversation is completed when the LLM has finished and all work types have been explored
            for elem in collected_data:
                self.logger.debug("Experience data collected: %s", elem)
                try:
                    entity = ExperienceEntity(
                        experience_title=elem.experience_title,
                        company=elem.company,
                        location=elem.location,
                        timeline=Timeline(start=elem.start_date, end=elem.end_date),
                        work_type=WorkType.from_string_key(elem.work_type)
                    )
                    self._experiences.append(entity)
                except Exception as e:  # pylint: disable=broad-except
                    self.logger.warning("Could not parse experience entity from: %s. Error: %s", elem, e)
        elif conversation_llm_output.exploring_type_finished:
            #  The specific work type has been explored, so we remove it from the list
            #  and we set the conversation to continue
            explored_type = self._state.unexplored_types.pop(0)
            exploring_type = self._state.unexplored_types[0] if len(self._state.unexplored_types) > 0 else None
            self._state.explored_types.append(explored_type)
            self.logger.info("Explored work type: %s, remaining types: %s", explored_type, self._state.unexplored_types)
            transition_message: str
            if exploring_type is not None:
                transition_message = f"Ask me about experiences that include: {exploring_type.value}"
            else:
                transition_message = "Let's recap, and give me a chance to correct any mistakes."
            conversation_llm_output = await conversion_llm.execute(context=context,
                                                                   user_input=AgentInput(message=transition_message, is_artificial=True),
                                                                   collected_data=collected_data,
                                                                   last_referenced_experience_index=last_referenced_experience_index,
                                                                   exploring_type=exploring_type,
                                                                   unexplored_types=self._state.unexplored_types,
                                                                   explored_types=self._state.explored_types,
                                                                   logger=self.logger)

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
