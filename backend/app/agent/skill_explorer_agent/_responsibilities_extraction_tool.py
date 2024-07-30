import logging

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.experience.experience_entity import ResponsibilitiesData
from ._responsibilities_extraction_llm import _ResponsibilitiesExtractionLLM
from ._sentence_decomposition_llm import _SentenceDecompositionLLM
from app.conversation_memory.conversation_memory_types import ConversationContext


class _ResponsibilitiesExtractionTool:
    def __init__(self, logger: logging.Logger):
        self._sentence_decomposition_llm = _SentenceDecompositionLLM(logger)
        self._responsibilities_extraction_llm = _ResponsibilitiesExtractionLLM(logger)
        self.logger = logger

    async def execute(self, *, user_input: AgentInput, context: ConversationContext) \
            -> tuple[ResponsibilitiesData, list[LLMStats]]:
        """
        Extracts responsibilities from the user's input and the conversation history
        and classifies them into responsibilities, non-responsibilities and other people's responsibilities.

        Uses the sentence decomposition LLM to decompose complex sentences from the user's input and the conversation history into sub-sentences,
        and passes the decomposed sentences to the responsibilities extraction LLM to extract and classify responsibilities.
        """
        last_user_input = user_input.message.strip()  # Remove leading and trailing whitespaces
        sentence_decomposition_output, sentence_decomposition_stats = await self._sentence_decomposition_llm.execute(
            last_user_input=last_user_input, context=context)
        self.logger.debug("Sentence decomposition output: %s", sentence_decomposition_output.dict())
        resolved_pronouns = "\n".join(sentence_decomposition_output.resolved_pronouns)
        responsibilities_extraction_output, responsibilities_extraction_stats = \
            await self._responsibilities_extraction_llm.execute(
                last_user_input=resolved_pronouns, context=context)
        llm_stats = sentence_decomposition_stats + responsibilities_extraction_stats
        return ResponsibilitiesData(
            responsibilities=responsibilities_extraction_output.responsibilities,
            non_responsibilities=responsibilities_extraction_output.non_responsibilities,
            other_peoples_responsibilities=responsibilities_extraction_output.other_peoples_responsibilities
        ), llm_stats
