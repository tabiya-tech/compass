import logging
import time
from enum import Enum
from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentInput, AgentOutput, LLMStats
from app.agent.agent_types import AgentType
from app.agent.prompt_reponse_template import ModelResponse
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.tool.extract_experience_tool import ExtractExperienceTool
from app.agent.experience_state import ExperienceState
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

logger = logging.getLogger(__name__)

# Number of retries to get a JSON object from the model
_MAX_ATTEMPTS = 1


class ConversationPhase(Enum):
    """
    The agent keeps track of where we are in the conversation.
    The intended structure is that we have an "outer loop" where we orient ourselves on
    the potential occupations to be explored; and there is an "inner loop" where we
    dig deeper into each occupation on the radar.
    """
    INIT = 0  # we skip this phase for now (start with warmup)
    WARMUP = 1
    DIVE_IN = 2
    WRAPUP = 3


class ExperienceMetadata(BaseModel):
    """
    Store a part of the ExperiencesAgentState
    """

    # A short max 5-word description of how the user refer to an experience, e.g. "teacher", "working in the
    # garden", "looking after sick mother"
    experience_descr: str

    # for the agent, to know if a deepdive should be performed
    done_with_deep_dive: bool = False

    esco_entity: ExperienceState


class ExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent.
    """
    session_id: int

    """
    Experiences on the radar - under discussion with this user.
    These were mentioned by the user, and the Agent needs to understand them deeper.
    """
    experiences: dict = {}
    current_experience: str = None
    deep_dive_count: int = 0

    conversation_phase: ConversationPhase = ConversationPhase.WARMUP

    """
    Raw conversation history with this agent. (We should store this in the central state, but for now, we need to
    prevent the summarizer to summarize it so we store it here too. In the future we should find a more elegant way
    to isolate the conversation history specific to an agent.)
    """
    conversation_history: str = ""

    def __init__(self, session_id):
        super().__init__(session_id=session_id)


def _sanitized_experience_descr(experience_descr: str, experiences) -> str:
    # Ensure uniqueness or experience_descr in the experiences dict
    while experience_descr in experiences:
        experience_descr = experience_descr + "-x"
    return experience_descr.strip()


class ExperiencesExplorerAgent(SimpleLLMAgent):
    """
    Agent that explores the skills of the user and provides a response based on the task
    """

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

    async def _handle_warmup_phase(self, user_input: AgentInput, context: ConversationContext) -> str:
        s = self._state
        # Process the user's reply
        logger.debug("Phase1. The user said: %s", user_input.message)
        s.conversation_history += user_input.message + "\n"
        # Let the LLM drive the conversation, based on the system prompt
        model_response = await self._llm_conversation_reply(user_input, context)
        s.conversation_history += model_response.message + "\n"
        meta_msg = ""
        if model_response.finished:
            # Extract the data form the conversation
            experiences = await self._extract_experience_from_user_reply(s.conversation_history)
            for experience in experiences:
                experience_id = _sanitized_experience_descr(experience.job_title, s.experiences)
                s.experiences[experience_id] = ExperienceMetadata(
                    experience_descr=experience.job_title, done_with_deep_dive=False, esco_entity=experience)

            meta_msg = f"[META: ESCO Occupations identified: " \
                       f"{[e.esco_occupations[0].occupation.preferredLabel for e in experiences]}]"
            # Advance the conversation, go directly the WRAPUP
            # We skip the DIVE_IN, because it is needs more logic before it is worth connecting it to the conversation
            # flow (which will be added after the P1 Prototype).
            s.conversation_phase = ConversationPhase.WRAPUP

        return model_response.message + meta_msg

        # If the LLM says we are finished, move on to the next phase (update the state)

    def _handle_dive_in_phase(self, user_input_msg: str) -> str:
        # TODO: COM-237 Let the LLM handle this phase. The dive-in will be done by a separate agent.
        s = self._state
        if "no" not in user_input_msg.lower():
            # Process the reply and keep asking followups
            return "Thank you. Is there anything else want to add to this experience? Just say 'No' when you are done."

        # Mark this experience as: dive in = done
        old_exp: ExperienceMetadata = s.experiences[s.current_experience]
        old_exp.done_with_deep_dive = True
        s.deep_dive_count += 1
        # Continue with iterating the experiences (order is undefined, in this version)
        left_to_process = [k for (k, v) in s.experiences.items() if not v.done_with_deep_dive]
        if len(left_to_process) > 0:
            s.current_experience = left_to_process[0]
            exp: ExperienceMetadata = s.experiences[s.current_experience]
            # Advance the conversation: dive in again into the next experience
            s.conversation_phase = ConversationPhase.DIVE_IN
            return f"Let's move on to the other experience you mentioned (we already covered " \
                   f"{s.deep_dive_count} out of {len(s.experiences)}). You said you had an experience as a " \
                   f"{exp.experience_descr}. Tell me more about it. When did it happen?"
        else:
            # Advance the conversation: wrap up
            s.conversation_phase = ConversationPhase.WRAPUP
            return "We are done with exploring your skills. Any last remarks that you want to share with me?"

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if self._state is None:
            logger.critical("ExperiencesExplorerAgent: execute() called before state was initialized")
        s = self._state
        # Handle the conversation. Intended structure:
        # Phase1: chatting, to build up the initial picture of the occupations
        # Phase2: understand each occupation one by one
        # Phase3: wrap up and finish

        # Some logic will be implemented 'manually' and some is done through an LLM.
        # In future version of the logic, more and more logic will be handled by the LLM.
        finished = False
        reply_raw = ""

        # Phase1 - warmpup
        if s.conversation_phase == ConversationPhase.WARMUP:
            reply_raw = await self._handle_warmup_phase(user_input, context)

        # Phase2 - inner loop - outerloop
        elif s.conversation_phase == ConversationPhase.DIVE_IN:
            reply_raw = self._handle_dive_in_phase(user_input.message)

        # Phase3
        elif s.conversation_phase == ConversationPhase.WRAPUP:
            esco_occupations = await self._get_esco_preferred_labels(s)
            top_occupations = [e.esco_entity.esco_occupations[0].occupation.preferredLabel for e in
                               s.experiences.values()]
            reply_raw = "[META: Under development] I am still under development. In the future, I will share my " \
                        "summarized findings here. Bye! \n" \
                        f"[META: Top ESCO Occupations Identified: {'; '.join(top_occupations)}] \n" \
                        f"[META: All ESCO Occupations Identified: {'; '.join(esco_occupations)}]"
            finished = True

        # In this version the conversation structure is: 1. WARMUP, 2. INNER_LOOP/OUTER_LOOP back and forth. In the
        # future we wish to skip or reduce the WARMUP phase and dive in as to the details of the experience as soon
        # as we got it from the user.
        # TODO: COM-264 redesign the conversation structure - reducing/eliminating the
        #  WARMUP phase (P1)

        # Send the prepared reply to the user
        # TODO: pass the LLM reasoning in case the answer was from an LLM
        return AgentOutput(message_for_user=reply_raw, finished=finished,
                           agent_type=self._agent_type,
                           reasoning="handwritten code",
                           agent_response_time_in_sec=0.1, llm_stats=[])

    async def _get_esco_preferred_labels(self, state: ExperiencesAgentState) -> set[str]:
        esco_occupations = set()
        for experience in state.experiences.values():
            for occupation_skills in experience.esco_entity.esco_occupations:
                esco_occupations.add(occupation_skills.occupation.preferredLabel)
        return esco_occupations

    def set_state(self, state: ExperiencesAgentState):
        """
        Set the state for this stateful agent. The state is owed centrally by the application state manager
        """
        self._state = state

    async def _extract_experience_from_user_reply(self, user_str: str) -> list[ExperienceState]:
        # Use the LLM to find out what was the experience the user is talking about
        return await self._extract_experience_tool.extract_experience_from_user_reply(user_str)

    def _create_llm_system_instructions(self) -> str:
        base_prompt = dedent("""" You work for an employment agency helping the user outline their previous 
        experiences and reframe them for the job market. You should be explicit in saying that past experience can 
        also reflect work in the unseen economy, such as care work for family and this should be included in your 
        investigation. You want to first get all past experiences, one by one, and investigate exclusively the date 
        and the place at which the position was held. Keep asking the user if they have more experience they would 
        like to talk about until they explicitly state that they don't. When the user has no more experiences to talk 
        about, send them to your colleague who will investigate relevant skills. Before doing that, ask if the user 
        would like to add anything else. Your message should be concise and professional, but also polite and 
        empathetic.""")

        return base_prompt

    # TODO: Figure out how to do dependency injection. This is a workaround for now.
    def __init__(self, similarity_search: SimilaritySearchService):
        system_instructions = self._create_llm_system_instructions()

        super().__init__(agent_type=AgentType.EXPERIENCES_EXPLORER_AGENT,
                         system_instructions=system_instructions)

        self._extract_experience_tool = ExtractExperienceTool(similarity_search, self.get_llm_config())

        self._state = None
