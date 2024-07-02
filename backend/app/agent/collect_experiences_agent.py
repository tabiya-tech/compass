# This package is still a stub. The agent is not yet implemented.
import logging
from textwrap import dedent

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience.experience_entity import ExperienceEntity
from app.tool.extract_experience_data import ExtractExperienceTool
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

logger = logging.getLogger(__name__)


def _create_llm_system_instructions() -> str:
    return dedent(""""You work for an employment agency helping users outline their previous experiences and reframe 
    them for the job market.
    **Be explicit**: Mention that past experience can include work in the unseen economy, such as caregiving for family,
    and encourage the user to share those experiences.
    Your task is finished when the user has no more experiences to share.
    
    **Gather details**: For each role, ask for the job title (or description), dates worked, and location.
    **Be thorough**: Continue asking about experiences until the user explicitly states they have no more to share.
    **Transition**: Once all experiences are gathered, inform the user that they'll be moving forward to discuss
    relevant skills. Before this, ask if the user would like to add anything else.
    **Tone**: Maintain a concise and professional tone, while being polite and empathetic.
    
    Your response must always be a JSON object with the following schema:
        - reasoning: A step by step explanation of how my message relates to your instructions,
                     why you set the finished flag to the specific value and why you chose the message.
                     In the form of "..., therefore I will set the finished flag to true|false, and I will ...",
                     in double quotes formatted as a json string.
        - finished: A boolean flag to signal that you have completed your task.
                    Set to true if you have finished your task, false otherwise.
        - message:  Your message to the user in double quotes formatted as a json string
        - data: list of dictionaries, one per experience containing
            {
                experience_name: name of the experience
                work_type: type of work, one of 'self-employed', 'unpaid', 'wage work'
                start_date: The start date in YYYY/MM/DD or YYYY/MM depending on what input I provided
                end_date: The end date in YYYY/MM//DD or YYYY/MM depending on what input I provided
                location: The location in which the job was performed.
            }

    """)


class CollectExperiencesAgent(SimpleLLMAgent[list[ExperienceEntity]]):
    """
    This agent drives the conversation to build up the initial picture of the previous work experiences of the user.
    This agent is stateless, and it does not link to ESCO.
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput[list[ExperienceEntity]]:
        output: AgentOutput = await super().execute(user_input, context)

        # TODO: We should not add new experience entities at every conversation turn, because we may still have partial
        #  information only
        if output.data:
            for elem in output.data:
                try:
                    entity = ExperienceEntity(experience_title=elem['experience_name'])
                    # TODO: extract the other fields too. Raise errors if it fails
                    self._experiences.append(entity)
                except Exception as e:
                    logger.debug("Could not parse experience entity from: %s. Error: %s", elem, e)

        if output.finished:
            # This is a fallback solution, but it works: we run a second LLM if the data was not extracted successfully
            if not output.data:
                # TODO: check if the summary is detailed enough for this to work and disable summarization if not
                self._experiences = await self._extract_experience_tool.extract_experience_data(context.summary)

        return output

    def get_experiences(self) -> list[ExperienceEntity]:
        return self._experiences

    def __init__(self):
        # The system instructions are passed to the llm, together with the common instructions wrt CoT
        system_instructions = _create_llm_system_instructions()

        self._extract_experience_tool = ExtractExperienceTool()
        self._experiences = []

        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         system_instructions=system_instructions)


