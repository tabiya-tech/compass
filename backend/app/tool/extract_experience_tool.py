import logging
from textwrap import dedent
from abc import ABC, abstractmethod

from common_libs.llm.chat_models import GeminiStatelessChatLLM
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG


logger = logging.getLogger(__name__)

class Tool(ABC):
    """
    An abstract class for an LLM tool.
    """


class ExtractExperienceTool(Tool):
    """
    This tool takes a user input text and uses an LLM to decide what past experience is the user talking about.
    The experience can be a formal work experience (e.g. baker) or an informal experience (e.g. cooking for the family).

    The tool returns the answer in form of a 1-5 word string.
    Some agents will use this answer in their interaction with the user.

    In this version, the tool does not ground itself in the ESCO database, but in future versions it might.
    """
    def __init__(self, config: LLMConfig = LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)):
        # system instructions for the identifying the past work experience
        self._system_instructions = dedent("""\
                    Identify in the following text, in a few words (min 1 word, ideally 2 words, max 5 words), what work experience in the person talking about.
                    If the person is not talking about a work experience but they are talking about an informal occupation or time spent to develop a skill
                    (e.g. working in my garden, studying, looking after my sick mother"), then identify that.
                    If you think the person is not talking about any work experience, then say a single worr: "NOT_WORK_EXPERIENCE".
                    
                    Reply in one line text, in English.
              """)
        self._llm = GeminiGenerativeLLM(system_instructions=self._system_instructions, config=config)

    async def extract_experience_from_user_reply(self, user_str: str) -> str:
        # Use the LLM to find out what was the experience the user is talking about
        llm_response = await self._llm.generate_content(user_str)
        logger.debug("LLM said: {rsp} for user input {inp}".format(rsp=llm_response.text, inp=user_str))
        response_text = llm_response.text
        if response_text == "NOT_WORK_EXPERIENCE":
            return None
        else:
            return llm_response.text