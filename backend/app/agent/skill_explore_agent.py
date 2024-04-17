import logging
from textwrap import dedent

from langchain_google_vertexai import ChatVertexAI

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.extract_json import extract_json, ExtractJSONError
from app.agent.prompt_reponse_template import ModelResponse, get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_manager import ConversationHistory
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter

logger = logging.getLogger(__name__)


class SimpleSkillExplorerAgent(Agent):
    """
    Simple agent that provides a simple response, should be used for testing purposes only
    """

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        print(user_input.message + " from SkillExplorerAgent")
        return AgentOutput(message_for_user="SkillExplorerAgent done", finished=True,
                           agent_type=AgentType.SKILL_EXPLORER_AGENT)


class SkillExplorerAgent(Agent):
    """
    Agent that expores with with the the user and provides a response based on the task
    """

    def __init__(self):
        self._agent_type = AgentType.SKILL_EXPLORER_AGENT
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(message="Tell about the kind of jobs you are interested in.", finished=False),
            ModelResponse(message="What kind jobs experiences did you have in the past", finished=False),
            ModelResponse(message="Great, the counseling session has finished", finished=True),
        ])
        finish_instructions = get_conversation_finish_instructions(dedent("""\
            The conversation will continue until the user is ready to finish sharing, or the user has shared more than 5 skills.
            When the conversation concludes"""))

        self._prompt = dedent(f"""\
                You are a {self._agent_type.value} at a job counseling agency who loves to help people identify their skills and competencies! 
                In a friendly tone ask the user about their interests and possible skills they might have. 
                When the user mentions a skill, ask them to elaborate on it, once the user has explained the skill, 
                repeat the process with another skill.
                
                If the user is unsure, you can use the topics from the the _TOPICS_ section bellow to help the user get started.
                
                _TOPICS_:
                    volunteering work
                    hobbies 
                    enjoy doing in their free time
                    skills they have developed in their previous jobs
                    help they offered to friends or family members
                
                If you are unsure or the user enters information that is not explicitly related to job counseling,
                say "Sorry, this seems to be irrelevant to our conversation, please stay focused.
                """) + '\n' + response_part + '\n' + finish_instructions

        self._chain = ChatVertexAI(model_name="gemini-pro")

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        model_input = self._prompt + "\n" + ConversationHistoryFormatter.format_for_prompt(
            history) + "\nUser: " + user_input.message
        conversation = await self._chain.ainvoke(model_input)

        try:
            last: ModelResponse = extract_json(conversation.content, ModelResponse)
        except ExtractJSONError as e:
            logger.exception(e)
            last = ModelResponse(message=str(conversation.content), finished=False)

        response = AgentOutput(message_for_user=last.message,
                               finished=last.finished,
                               agent_type=AgentType.SKILL_EXPLORER_AGENT)
        return response
