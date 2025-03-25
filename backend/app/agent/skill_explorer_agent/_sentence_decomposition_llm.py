import logging
from textwrap import dedent

from pydantic import BaseModel, Field

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from ._common_llm_utils import format_history_for_prompt
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG


class _SentenceDecompositionResponse(BaseModel):
    decomposed_sentences: list[str] = Field(default_factory=list)
    """
    The decomposed sentences from the user's input.
    """

    resolved_pronouns: list[str] = Field(default_factory=list)
    """
    The resolved pronouns from the user's input.
    """


class _SentenceDecompositionLLM:
    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[_SentenceDecompositionResponse](model_response_type=_SentenceDecompositionResponse)
        self.llm = GeminiGenerativeLLM(
            system_instructions=_SentenceDecompositionLLM._create_extraction_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))
        self.logger = logger

    async def execute(self, *, last_user_input: str, context: ConversationContext) \
            -> tuple[_SentenceDecompositionResponse, list[LLMStats]]:
        """
        Sentence decomposition logic for the skill explorer agent.
        Decomposes complex sentences from the user's input and the conversation history into sub-sentences.
        Sub-sentences are standalone sentences that cover all the information in the original sentence and preserve the original meaning.
        """
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=self.llm,
                                                                llm_input=_SentenceDecompositionLLM._extraction_prompt_template(
                                                                    context=context, last_user_input=last_user_input),
                                                                logger=self.logger)
        self.logger.debug("LLM output: %s", llm_output.dict())
        return llm_output, llm_stats

    @staticmethod
    def _create_extraction_system_instructions() -> str:
        system_instructions_template = dedent("""\
        <System Instructions>
        # Role
            You are a language expert that decomposes complex sentences into sub-sentences.
       
        # Do not interpret
            Do not infer the user's responsibilities, skills, duties, tasks, actions, behaviour, activities, competencies, or knowledge based on your prior knowledge about the experience.
            Do not infer the experience and do not use that information in your task.
            Use only information that is present in <User's Last Input> and <Conversation History>.
        # 'decomposed_sentences' instructions
            Extract and accurately identify and separate the main action from its purpose or descriptive clauses and decompose complex sentences from the <User's Last Input> into sub-sentences.
            
            Main Action Sub-Sentence: Convert the main action into a standalone sentence.
            Purpose Action Sub-Sentence: Turn the purpose clause into a standalone sentence
            Further Detail or Requirement Sub-Sentence: Extract additional details or requirements into another standalone sentence
            
            The sum of the sub-sentences should cover all the information in the original sentence and preserve the original meaning.
            Do not duplicate sub-sentences that are similar and do not convey new information. Be as concise as possible.
            The sub-sentence must incorporate parts of the <Conversation History>, so that the sub-sentence is standalone and can be understood
            without the need to refer back to the <Conversation History>. Adjust phrasing as necessary to maintain clarity and coherence.
            
            Place each sub-sentence in a separate JSON string in the 'decomposed_sentences' list.
        # 'resolved_pronouns' instructions
            Replace all pronouns (expect the ones that refer to the user), in the 'decomposed_sentences' with what they point to.
            Review the <User's Last Input> and the <Conversation History> to identify the specific part they refer to and substitute the pronoun with the part.
            
            In the <User's Last Input> and the <Conversation History> you and I refer to the user and the model respectively depending on the context.
            In the output, 'I' should be used to refer to the user.
            
            Here is a list of pronouns to consider:
            - Personal Pronouns. Examples: I, you, he, she, it, we, they (subject); me, you, him, her, it, us, them (object)
            - Possessive Pronouns. Examples: mine, yours, his, hers, its, ours, theirs
            - Reflexive Pronouns. Examples: myself, yourself, himself, herself, itself, ourselves, yourselves, themselves
            - Demonstrative Pronouns. Examples: this, that, these, those
            - Relative Pronouns. Examples: who, whom, whose, which, that
            - Interrogative Pronouns. Examples: who, whom, whose, which, what
            - Indefinite Pronouns. Examples: anyone, anything, everybody, each, few, many, no one, several, some, etc.
            - Reciprocal Pronouns. Examples: each other, one another
            - Intensive Pronouns. Examples: myself, yourself, himself, herself, itself, ourselves, yourselves, themselves
            
            Rephrase each sentences to have correct structure and retain the original meaning and place each rephrased sentence in a separate JSON string in the 'resolved_pronouns' list.

        # JSON Output instructions
            Your response must always be a JSON object with the following schema:
            - 'decomposed_sentences': list of JSON strings
            - 'resolved_pronouns': list of JSON strings
        
        Your response must always be a JSON object with the schema above
        </System Instructions>
        """)

        return system_instructions_template

    @staticmethod
    def _extraction_prompt_template(context: ConversationContext, last_user_input: str) -> str:
        return dedent("""\
                <Conversation History>
                {conversation_history}
                </Conversation History>
                
                <User's Last Input>
                user: '{last_user_input}'
                </User's Last Input>
                """).format(conversation_history=format_history_for_prompt(context, _TAGS_TO_FILTER),
                            last_user_input=sanitize_input(last_user_input.strip(), _TAGS_TO_FILTER))


_TAGS_TO_FILTER = ["system instructions", "user's last input", "conversation history"]
