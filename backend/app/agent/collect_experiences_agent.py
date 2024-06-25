import logging
import time
from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentInput, AgentOutput, LLMStats
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.tool.extract_experience_tool import ExtractExperienceTool, ExperienceEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

logger = logging.getLogger(__name__)

# Number of retries to get a JSON object from the model
_MAX_ATTEMPTS = 1


class CollectExperiencesMetadata(BaseModel):
    """
    Store a part of the CollectExperiencesAgentState - one object for each experience
    """

    # A short max 5-word description of how the user refer to an experience, e.g. "teacher", "working in the
    # garden", "looking after sick mother"
    experience_descr: str

    # The ESCO entity best matching this experience
    esco_entity: ExperienceEntity


class CollectExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent.
    """

    # Experiences on the radar - under discussion with this user.
    experiences: dict[str, CollectExperiencesMetadata] = {}

    # Raw conversation history *with this agent*.
    conversation_history: str = ""


def _sanitized_experience_descr(experience_descr: str, experiences) -> str:
    # Ensure uniqueness or experience_descr in the experiences dict
    while experience_descr in experiences:
        experience_descr = experience_descr + "-x"
    return experience_descr.strip()


def _create_llm_system_instructions() -> str:
    return dedent("""" You work for an employment agency helping the user outline their previous 
    experiences and reframe them for the job market. You should be explicit in saying that past experience can 
    also reflect work in the unseen economy, such as care work for family and this should be included in your 
    investigation. You want to first get all past experiences, one by one, and investigate exclusively the date 
    and the place at which the position was held. Keep asking the user if they have more experience they would 
    like to talk about until they explicitly state that they don't. When the user has no more experiences to talk 
    about, send them to your colleague who will investigate relevant skills. Before doing that, ask if the user 
    would like to add anything else. Your message should be concise and professional, but also polite and 
    empathetic.""")


class CollectExperiencesAgent(SimpleLLMAgent):
    """
    This agent drives the conversation to build up the initial picture of the previous work experiences of the user
    """

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if self._state is None:
            logger.critical("CollectExperiencesAgent: execute() called before state was initialized")
        s = self._state

        agent_finished = False

        # Let the LLM drive the conversation, based on the system prompt
        s.conversation_history += user_input.message + "\n"
        model_response = await self._llm_conversation_reply(user_input, context)
        s.conversation_history += model_response.message + "\n"

        meta_msg = ""  # for debugging - empty, except at the last conversation turn
        if model_response.finished:
            # Populate the output of the agent (experiences)
            # Extract the data form the (agent-specific!!) conversation history
            experiences: list[ExperienceEntity] = await self._extract_experience_from_user_reply(s.conversation_history)
            for experience in experiences:
                experience_id = _sanitized_experience_descr(experience.job_title, s.experiences)
                s.experiences[experience_id] = CollectExperiencesMetadata(
                    experience_descr=experience.job_title, esco_entity=experience)

            occupations_summary = [
                e.esco_occupations[0].occupation.preferredLabel for e in experiences if len(e.esco_occupations) > 0]
            meta_msg = f"[META: ESCO Occupations identified: " \
                       f"{occupations_summary}]"
            agent_finished = True

        reply_raw = model_response.message + meta_msg

        # Send the prepared reply to the user
        # TODO: pass the LLM reasoning in case the answer was from an LLM
        return AgentOutput(message_for_user=reply_raw, finished=agent_finished,
                           agent_type=self._agent_type,
                           reasoning="handwritten code",
                           agent_response_time_in_sec=0.1, llm_stats=[])

    async def _llm_conversation_reply(self, user_input: AgentInput, context: ConversationContext) -> ModelResponse:
        agent_start_time = time.time()
        llm_stats_list: list[LLMStats] = []
        msg = user_input.message.strip()
        success = False
        attempt_count = 0
        model_response: ModelResponse | None = None
        while not success and attempt_count < _MAX_ATTEMPTS:
            attempt_count += 1
            llm_start_time = time.time()
            llm_response = await self._llm.generate_content(
                llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(context, msg)
            )
            llm_end_time = time.time()
            llm_stats = LLMStats(prompt_token_count=llm_response.prompt_token_count,
                                 response_token_count=llm_response.response_token_count,
                                 response_time_in_sec=round(llm_end_time - llm_start_time, 2))
            response_text = llm_response.text
            try:
                model_response = extract_json(response_text, ModelResponse)
                success = True
            except ExtractJSONError:
                log_message = (f"Attempt {attempt_count} failed to extract JSON "
                               f"from conversation content: '{response_text}")
                llm_stats.error = log_message
                if attempt_count == _MAX_ATTEMPTS:
                    # The agent failed to respond with a JSON object after the last attempt,
                    logger.error(log_message)
                    # And set the response to the model output and hope that the conversation can continue
                    model_response = ModelResponse(message=response_text, finished=False,
                                                   reasoning="Failed to respond with JSON")
                else:
                    logger.warning(log_message)
            # Any other exception should be caught and logged
            except Exception as e:  # pylint: disable=broad-except
                logger.error("An error occurred while requesting a response from the model: %s",
                             e, exc_info=True)
                llm_stats.error = str(e)
            finally:
                llm_stats_list.append(llm_stats)

        # If it was not possible to get a model response, set the response to a default message
        if model_response is None:
            model_response = ModelResponse(
                reasoning="Failed to get a response",
                message="[META: ExperiencesExplorerAgent LLM error] I am facing some difficulties right now, "
                        "could you please repeat what you said?",
                finished=True)

        logger.debug("Model input: %s", user_input.message)
        logger.debug("Model output: %s", model_response)
        agent_end_time = time.time()

        if model_response.finished:
            logger.debug("Model thinks we are finished.")

        return model_response

    async def _extract_experience_from_user_reply(self, user_str: str) -> list[ExperienceEntity]:
        # Use the LLM to find out what was the experience the user is talking about
        return await self._extract_experience_tool.extract_experience_from_user_reply(user_str)

    async def _handle_warmup_phase(self, user_input: AgentInput, context: ConversationContext) -> str:
        pass

    def set_state(self, state: CollectExperiencesAgentState):
        """
        Set the state for this stateful agent. The state is owed centrally by the application state manager
        """
        self._state = state

    # TODO: Figure out how to do dependency injection for similarity_search. This is a workaround for now.
    def __init__(self, similarity_search: SimilaritySearchService):
        system_instructions = _create_llm_system_instructions()

        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         system_instructions=system_instructions)

        self._extract_experience_tool = ExtractExperienceTool(similarity_search, self.get_llm_config())
        self._state: CollectExperiencesAgentState = None

