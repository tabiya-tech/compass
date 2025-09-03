from typing import Mapping, Any

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.agent.agent import Agent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from ._conversation_llm import _ConversationLLM
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.conversation_memory.conversation_memory_types import ConversationContext
from ._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.countries import Country


class SkillsExplorerAgentState(BaseModel):
    """
    The state of the Skills Explorer Agent.
    """

    session_id: int
    """
    The session ID of the user.
    """

    country_of_user: Country = Field(default=Country.UNSPECIFIED)
    """
    The country of the user.
    """

    first_time_for_experience: dict[str, bool] = Field(default_factory=dict)
    """
    The key is the experience uuid and the value is a boolean that indicates 
    whether the user is entering the skills explorer for the first time for that experience.
    """

    experiences_explored: list[str] = Field(default_factory=list)
    """
    The list of experiences already explored with the user.
    """

    question_asked_until_now: list[str] = Field(default_factory=list)
    """
    Tracks questions asked during the conversation to help the model maintain context.

    This is needed because when many questions are asked, some may fall outside the
    unsummarized history window or may not be clearly included in the summary. If
    user responses dominate the summary, the questions may be underrepresented, causing
    the model to lose track and potentially repeat questions.
    
    By keeping a local record of asked questions and injecting it into the prompt, the
    model can better retain the conversation flow regardless of summarizer performance
    or history window size.
    """

    answers_provided: list[str] = Field(default_factory=list)
    """
    Tracks answers provided by the user during the conversation.
    
    This is useful for generating a more accurate summary of the user's experience, which can be used
    for the CV generation or other purposes.
    
    The array is on par with the question_asked_until_now array, meaning that the i-th answer corresponds to the i-th question.
    """

    class Config:
        extra = "forbid"

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        if isinstance(value, str):
            return Country[value]
        return value

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "SkillsExplorerAgentState":
        return SkillsExplorerAgentState(session_id=_doc["session_id"],
                                        # For backward compatibility with old documents that don't have the country_of_user field,
                                        # set it to UNSPECIFIED
                                        country_of_user=_doc.get("country_of_user", Country.UNSPECIFIED),
                                        first_time_for_experience=_doc["first_time_for_experience"],
                                        experiences_explored=_doc["experiences_explored"],
                                        # For backward compatibility with old documents that don't have the question_asked_until_now field,
                                        # set it to an empty list
                                        question_asked_until_now=_doc.get("question_asked_until_now", []),
                                        # For backward compatibility with old documents that don't have the answers_provided field,
                                        # set it to an empty list
                                        answers_provided=_doc.get("answers_provided", []))


class SkillsExplorerAgent(Agent):
    """
    The main agent for the skill explorer.
    It converses with the user to get details about the experience and extract responsibilities from the user's input.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.EXPLORE_SKILLS_AGENT,
                         is_responsible_for_conversation_history=False)
        self.experience_entity: ExperienceEntity | None = None
        self.state: SkillsExplorerAgentState | None = None

    def set_state(self, state: SkillsExplorerAgentState):
        self.state = state

    def set_experience(self, experience_entity: ExperienceEntity) -> None:
        self.experience_entity = experience_entity

    @staticmethod
    def _merge_responsibilities_data(experience: ExperienceEntity,
                                     new_responsibilities_data: ResponsibilitiesData):
        """
        Merge the new responsibilities data with the existing responsibilities data.
        """

        existing_responsibilities = experience.responsibilities
        responsibilities = list(
            set(existing_responsibilities.responsibilities + new_responsibilities_data.responsibilities))
        non_responsibilities = list(
            set(existing_responsibilities.non_responsibilities + new_responsibilities_data.non_responsibilities))
        other_peoples_responsibilities = list(
            set(existing_responsibilities.other_peoples_responsibilities + new_responsibilities_data.other_peoples_responsibilities))
        existing_responsibilities.responsibilities = responsibilities
        existing_responsibilities.non_responsibilities = non_responsibilities
        existing_responsibilities.other_peoples_responsibilities = other_peoples_responsibilities

    async def execute(self,
                      user_input: AgentInput,
                      context: ConversationContext
                      ) -> AgentOutput:

        if self.state is None:
            raise ValueError("SkillsExplorerAgent: execute() called before the state was set")

        if self.experience_entity is None:
            raise ValueError("SkillsExplorerAgent: execute() called before the experience was set")

        # update the state with the first time flag for the experience
        _first_time_for_experience = self.state.first_time_for_experience.get(self.experience_entity.uuid, True)
        if _first_time_for_experience:
            self.state.first_time_for_experience[self.experience_entity.uuid] = False
            self.state.question_asked_until_now = []  # Reset the questions asked until now for this experience
            self.state.answers_provided = []  # Reset the answers provided for this experience

        responsibilities_llm_stats = []
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        else:
            # Extract the responsibilities from the last user's input
            responsibilities_extraction_tool = _ResponsibilitiesExtractionTool(self.logger)
            responsibilities_output, responsibilities_llm_stats = \
                await responsibilities_extraction_tool.execute(user_input=user_input,
                                                               context=context)
            self.logger.debug("Experience data from our conversation until now to be merged to the data response: %s",
                              responsibilities_output)
            # Merge the extracted responsibilities data into the experience entity
            SkillsExplorerAgent._merge_responsibilities_data(self.experience_entity, responsibilities_output)

            # Update the state with the answers provided by the user
            # This input was the user's response to a previous question asked by the agent
            self.state.answers_provided.append(user_input.message.strip())

        # Converses with the user to get details about the experience

        conversion_llm = _ConversationLLM()
        conversation_llm_output = await conversion_llm.execute(experiences_explored=self.state.experiences_explored,
                                                               first_time_for_experience=_first_time_for_experience,
                                                               question_asked_until_now=self.state.question_asked_until_now,
                                                               user_input=user_input,
                                                               country_of_user=self.state.country_of_user,
                                                               context=context,
                                                               experience_title=self.experience_entity.experience_title,
                                                               work_type=self.experience_entity.work_type,
                                                               logger=self.logger)

        self.state.question_asked_until_now.append(conversation_llm_output.message_for_user)
        if conversation_llm_output.finished:
            # Once the conversation is finished, add the experience to the list of experiences explored
            title = getattr(self.experience_entity, 'experience_title', None)
            work_type = getattr(self.experience_entity, 'work_type', None)
            company = getattr(self.experience_entity, 'company', None)
            location = getattr(self.experience_entity, 'location', None)
            timeline = getattr(self.experience_entity, 'timeline', None)
            start_date = getattr(timeline, 'start', None) if timeline else None
            end_date = getattr(timeline, 'end', None) if timeline else None

            structured_summary = ExperienceEntity.get_structured_summary(
                experience_title=title,
                work_type=work_type,
                company=company,
                location=location,
                start_date=start_date,
                end_date=end_date
            )
            self.state.experiences_explored.append(structured_summary)

            # set the questions and answers
            # We expect that the number of questions asked is equal to the number of answers provided + 1
            # since the exploration starts with a question from the agent and ends with a question from the agent
            if len(self.state.question_asked_until_now) != len(self.state.answers_provided) + 1:
                self.logger.error(
                    "The number of questions asked (%d) does not match the number of answers provided (%d).",
                    len(self.state.question_asked_until_now), len(self.state.answers_provided))
                # If they don't match, we will just zip them, but this may lead to loss of information
            self.experience_entity.questions_and_answers = list(
                zip(self.state.question_asked_until_now, self.state.answers_provided))

        conversation_llm_output.llm_stats = responsibilities_llm_stats + conversation_llm_output.llm_stats
        return conversation_llm_output
