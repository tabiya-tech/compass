import logging

from enum import Enum
from textwrap import dedent
from pydantic import BaseModel

from app.agent.agent import SimpleLLMAgent
from app.agent.agent_types import AgentType, AgentInput, AgentOutput
from app.tool.extract_experience_tool import ExtractExperienceTool
from app.agent.prompt_reponse_template import ModelResponse, \
    get_json_response_instructions, \
    get_conversation_finish_instructions
from app.conversation_memory.conversation_memory_types import \
    ConversationContext

logger = logging.getLogger(__name__)


class ConversationPhase(Enum):
    """
    The agent keeps track of where we are in the conversation.
    The intended structure is that we have an "outer loop" where we orient ourselves on
    the potential occupations to be explored; and there is an "inner loop" wehere we
    dig deeper into each occupation on the radar.
    """
    INIT = 0
    WARMUP = 1
    DONE_WITH_WARMUP = 2
    DIVE_IN = 2
    WRAPUP = 3


class ExperienceMetadata(BaseModel):
    """
    Store a part of the ExperiencesAgentState
    """

    # A short max 5-word description of how the user refere to an experience, e.g. "teacher", "working in the garden", "looking after sick mother"
    experience_descr: str

    # for the agent, to know if a deepdive should be perfomed
    done_with_deep_dive = False


class ExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent.
    """
    session_id: int

    # Experiences on the radar - under discussion with this user.
    # These were mentioned by the user, and the Agent needs to understand them deeper.
    experiences = {}
    current_experience: str = None
    deep_dive_count: int = 0

    conversation_phase: ConversationPhase = ConversationPhase.INIT

    def __init__(self, session_id):
        super().__init__(session_id=session_id)

class ExperiencesExplorerAgent(SimpleLLMAgent):
    """
    Agent that explores the skills of the user and provides a response based on the task
    """

    def _handle_init_phase(self, user_input_msg: str) -> str:
        # Advance the conversation
        self._state.conversation_phase = ConversationPhase.WARMUP
        # In this version, we do a hardcoded reply (agnostic of the imput message)
        return \
            "[META: ExperinecesExplorerAgent active] In this session, we will explore your past livelihood experiences," \
            " e.g. formal work experiences other similar hassles that kept you busy in the last years. Tell me about your most recent work experience."

    def _handle_warmup_phase(self, user_input_msg: str) -> str:
        # Handle the WARMUP phase of the conversation.
        # Returns the reply to be sent to the user
        s = self._state
        # Process the user's reply
        logger.debug("Phase1. The user said: {msg}".format(msg=user_input_msg))
        # Use the LLM to find out what was the experience the user is talking about
        # (e.g. "baker" or "looking after sick family member")
        # In this version, we handle only one experience per user message
        # TODO: COM-262 handle multiple expereineces (P3)
        experinece_descr = await self._extract_experience_from_user_reply(user_input_msg)
        experience_id = self._sanitized_experience_descr(experinece_descr, s.experiences)

        s.current_experience = experience_id
        s.experiences[experience_id] = ExperienceMetadata(
            experience_descr=experinece_descr, done_with_deep_dive=False)
        # In this version we have the exit criteria of a fixed 3 experiences.
        # TODO: COM-263 handle a more dynamic exit criteria from the WARMUP phase (P1)
        if len(s.experiences) >= 3:
            # Start over in iterating the experiences (order is underfined, in this version)
            s.current_experience = list(s.experiences.keys())[0]
            exp: ExperienceMetadata = s.experiences[s.current_experience]
            # Advance the conversation
            s.conversation_phase = ConversationPhase.DIVE_IN
            return \
                    "Thank you for telling me about your experiences. I think I got the initial picture. " \
                    "Now let's understand them in more detail, one by one. " \
                    "You said you had an experience as a " + exp.experience_descr + ". Tell me more about it. When did it happen?"
        else:
            return "Great response, I will process that... Tell me about another relevant experience, which you had before this one"

    def _handle_dive_in_phase(self, user_input_msg: str) -> str:
        # TODO: COM-237 Let the LLM handle this phase. The dive-in will be done by a separate agent.
        s = self._state
        dive_in_done = False
        if user_input_msg != "No":
            # Process the reply and keep asking followups
            return "Thank you. Is there anything else want to add to this experience? Just say 'No' when you are done."
        else:
            dive_in_done = True

        if dive_in_done:
            # Mark this experience as: dive in = done
            old_exp: ExperienceMetadata = s.experiences[s.current_experience]
            old_exp.done_with_deep_dive = True
            s.deep_dive_count += 1
            # Continue with iterating the experiences (order is underfined, in this version)
            left_to_process = [k for (k, v) in s.experiences.items() if not v.done_with_deep_dive]
            if len(left_to_process) > 0:
                s.current_experience = left_to_process[0]
                exp: ExperienceMetadata = s.experiences[s.current_experience]
                # Advance the conversation: dive in again into the next eperience
                s.conversation_phase = ConversationPhase.DIVE_IN
                return "Let's move on to the other experinece you mentioned (we already covererd {a} out of {b}). ".format(a=s.deep_dive_count, b=len(s.experiences)) + \
                    "You said you had an experience as a " + exp.experience_descr + ". Tell me more about it. When did it happen?"
            else:
                # Advance the conversation: wrap up
                s.conversation_phase = ConversationPhase.WRAPUP
                return "We are done with exploring your skills. Any last remarks that you wnat to share with me?"
                s.conversation_phase = ConversationPhase.WRAPUP

    async def execute(self, user_input: AgentInput,
        context: ConversationContext) -> AgentOutput:
        if self._state is None:
            logger.critical("ExperiencesExplorerAgent: execute() called before state was initialized")
        s = self._state
        # Handle the conversation. Intended structure:
        # Phase1: chatting, to build up the initial picture of the occupations
        # Phase2: understand each occupation one by one
        # Phase3: wrap up and finish

        # Some of the logic will be implemented 'manually' and some is done through an LLM.
        # In future version of the logic, more and more logic will be handled by the LLM.
        use_llm_for_reply = False
        finished = False

        # Phase1 - first round
        if s.conversation_phase == ConversationPhase.INIT:
            reply_raw = self._handle_init_phase(user_input.message)

        # Phase1 - followup rounds, until we have a minimum 3 occupations on the radar.
        elif s.conversation_phase == ConversationPhase.WARMUP:
            reply_raw = self._handle_warmup_phase(user_input.message)

        # Phase2 - innerloop - outerloop
        elif s.conversation_phase == ConversationPhase.DIVE_IN:
            reply_raw = self._handle_dive_in_phase(user_input.message)

        # Phase3
        elif s.conversation_phase == ConversationPhase.WRAPUP:
            reply_raw = "[META: Under development] I am still under development. In the future, I will share my summarized findings here. Bye!"
            finished = True

        # In this version the conversation structure is: 1. WARMUP, 2. INNER_LOOP/OUTER_LOOP back and forth.
        # In the future we wish to skip or reduce the WARMUP phase and dive in as to the details of the experience as soon as we got it from the user.
        # TODO: COM-264 redesign the conversation structure - reducing/eliminating the WARMUP phase (P1)

        # Send the prepared reply to the user
        if use_llm_for_reply:
            # LLM-handled reply.
            return await super().execute(user_input, context)
        else:
            # Manual
            response = AgentOutput(message_for_user=reply_raw, finished=finished,
                                   agent_type=self._agent_type,
                                   reasoning="handwritten code",
                                   agent_response_time_in_sec=0.1, llm_stats=[])
            return response

    def set_state(self, state: ExperiencesAgentState):
        self._state = state

    def _sanitized_experience_descr(selfself, experience_descr: str, experiences) -> str:
        # Ensure uniqueness or experience_descr in the experiences dict
        while experience_descr in experiences:
            experience_descr = experience_descr + "-x"
        return  experience_descr

    async def _extract_experience_from_user_reply(self, user_str: str) -> str:
        # Use the LLM to find out what was the experience the user is talking about
        llm_response = await self._extract_experience_tool.extract_experience_from_user_reply(user_str)
        return llm_response

    def __init__(self):
        # Define the response part of the prompt with some example responses
        response_part = get_json_response_instructions([
            ModelResponse(
                reasoning="You have not yet shared skills from your previous 2 job experiences, "
                          "therefore I will set the finished flag to false, "
                          "and I will continue the exploration.",
                finished=False,
                message="Tell about the kind of jobs you had in the past.",
            ),
            ModelResponse(
                reasoning="You shared skills from your previous 2 job experiences, "
                          "therefore I will set the finished flag to true, "
                          "and I will end the counseling session.",
                finished=True,
                message="Great, the counseling session has finished.",
            ),
            ModelResponse(
                reasoning="You do not want to continue the conversation, "
                          "therefore I will set the finished flag to true, "
                          "and I will end the counseling session.",
                finished=True,
                message="Fine, we will end the counseling session.",
            ),
        ])
        finish_instructions = get_conversation_finish_instructions(dedent("""\
                  When I explicitly say that I want to finish the session, 
                  or I have shared skills from my previous 2 job experiences
              """))
        experience = "[EXPERIENCE]"

        system_instructions_template = dedent("""\
                  You are a job counselor. We have been introduced and we talked a bit about my past experience as: {experience}.
                  Your your is to ask me more details about this experience.
                  Your goal is to help me identify what skills I gained during my experience that would help me find a good job in the future.
                  In a friendly and encouraging tone ask me about the circumstances of my past experience including when it happened.
                  If you are unsure or I enter information that is not explicitly related my past esperience as {experience} say:
                  "Sorry, this seems to be irrelevant to our conversation abut "{experience}", let's focus on that for now."
                  Answer in no more than 100 words.
                  
                  {response_part}
                  
                  {finish_instructions}             
                  """)

        system_instructions = system_instructions_template.format(
            experience=experience,
            response_part=response_part,
            finish_instructions=finish_instructions)

        self.__logger = logging.getLogger(self.__class__.__name__)

        super().__init__(agent_type=AgentType.EXPERIENCES_EXPLORER_AGENT,
                         system_instructions=system_instructions)

        self._extract_experience_tool = ExtractExperienceTool(self.get_llm_config())