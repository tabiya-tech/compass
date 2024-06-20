import logging
from textwrap import dedent

from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG

logger = logging.getLogger(__name__)


class ExperienceIntroTool:
    """
    This tool creates the opening statement for the ExperiencesExplorerAgent.
    """

    def __init__(self, config: LLMConfig = LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)):
        self._system_instructions = dedent("""You are a job counselor. In sentence, tell me that you are about to
        engage in conversation with me to get to know my past work experiences covering from formal jobs,
        self employment as well as time spent in unseen economy (give an example here). Ask me: 'Are you
        ready?'""")
        self._llm = GeminiGenerativeLLM(system_instructions=self._system_instructions, config=config)

    async def create_intro_message(self) -> str:
        llm_response = await self._llm.generate_content(self._system_instructions)
        logger.debug("LLM-generated intro line: %s", llm_response.text)
        return llm_response.text
