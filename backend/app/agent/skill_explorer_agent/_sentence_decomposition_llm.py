import logging
from textwrap import dedent

from pydantic import BaseModel, Field

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG
from ...conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE

class _SentenceDecompositionResponse(BaseModel):
    decomposed_and_dereferenced: list[str] = Field(default_factory=list)
    """
    The decomposed and dereferenced sentences from the user's input.
    This is the final output of the second pass and what the SentenceDecompositionLLM returns to the caller.
    """


class _SentenceDecompositionFirstPassResponse(BaseModel):
    decomposed_sentences: list[str] = Field(default_factory=list)
    """
    The decomposed sentences from the user's input.
    This is used to help the model complete the task in steps as dereferencing the pronouns is too complex for the model to do in one step.
    """

    pronouns_indexing: list[str] = Field(default_factory=list)
    """
    The pronouns from the user's input and their types.
    Helps the model to identify the pronouns and complete the task in steps.
    In some cases it is unclear if a word is a pronoun or not. For example:
    "He said that he will go to the store" - "that" is not a pronoun
    """

    pronouns_antecedents: list[str] = Field(default_factory=list)
    """
    The pronouns from the user's input and their antecedents.
    This is used to help the model complete the task in steps.
    """

    resolved_pronouns: list[str] = Field(default_factory=list)
    """
    The resolved pronouns from the user's input. This is the final output of the first pass.
    The original sentences are decomposed into sub-sentences and the pronouns are resolved to their antecedents.
    However, models struggle to correctly frame the sentences in a natural way. This is due to the pronouns_antecedents 
    which condition the output to return expressions like "Ben helps Ben's" or "Ben uses Ben's hands".
    """


class _SentenceDecompositionLLM:
    """
    This class is responsible for decomposing complex sentences from the user's input and the conversation history into sub-sentences.
    Sub-sentences are standalone sentences that cover all the information in the original sentence and preserve the original meaning.
    Additionally, it resolves pronouns in the sentences to their antecedents.
    For example,
    "Ben makes the bread and sells it to the neighbours and gives me money for it. I help him do this."
    should be decomposed into:
    "I help Ben", "Ben makes the bread", "I help Ben sell the bread", "Ben sells the bread to the neighbours", "Ben gives me money for helping him"

    The class uses two passes to achieve this:
    1. The first pass decomposes the sentences and resolves the pronouns to their antecedents.
    2. The second pass reviews the sentences and fixes them if necessary to ensure that they are grammatically correct, clear, concise and sound natural.
    This fixes expressions like "I use I's hands" to "I use my hands".
    """

    def __init__(self, logger: logging.Logger):
        self._llm_caller_first_pass = LLMCaller[_SentenceDecompositionFirstPassResponse](model_response_type=_SentenceDecompositionFirstPassResponse)
        self.llm_first_pass = GeminiGenerativeLLM(
            system_instructions=_SentenceDecompositionLLM._create_first_pass_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "top_p": 0.0,
                    "max_output_tokens": 3000  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))
        self._llm_caller_second_pass = LLMCaller[_SentenceDecompositionResponse](model_response_type=_SentenceDecompositionResponse)
        self.llm_second_pass = GeminiGenerativeLLM(
            system_instructions=_SentenceDecompositionLLM._create_second_pass_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "top_p": 0.0,
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
        # Run the first pass
        llm_first_pass_output, llm_first_pass_stats = await self._llm_caller_first_pass.call_llm(llm=self.llm_first_pass,
                                                                                                 llm_input=_SentenceDecompositionLLM._first_pass_prompt_template(
                                                                                                     context=context, last_user_input=last_user_input),
                                                                                                 logger=self.logger)
        self.logger.debug("LLM first pass output: %s", llm_first_pass_output.model_dump())
        # Run the seconds pass

        llm_second_pass_output, llm_second_pass_stats = await self._llm_caller_second_pass.call_llm(llm=self.llm_second_pass,
                                                                                                    llm_input=_SentenceDecompositionLLM._second_pass_prompt_template(
                                                                                                        sentences=llm_first_pass_output.resolved_pronouns
                                                                                                    ),
                                                                                                    logger=self.logger)

        if len(llm_first_pass_output.resolved_pronouns) != len(llm_second_pass_output.decomposed_and_dereferenced):
            self.logger.warning("The number of sentences in the first pass (%d) does not match the number of sentences in the second pass (%d)",
                                len(llm_first_pass_output.resolved_pronouns), len(llm_second_pass_output.decomposed_and_dereferenced))

        # Log the difference between the first and second pass possibly with different length
        self.logger.debug("LLM first pass output: %s Second pass output: %s", llm_first_pass_output.resolved_pronouns,
                          llm_second_pass_output.decomposed_and_dereferenced)

        self.logger.debug("LLM second pass output: %s", llm_second_pass_output.model_dump())
        return llm_second_pass_output, llm_first_pass_stats + llm_second_pass_stats

    @staticmethod
    def _create_first_pass_system_instructions() -> str:
        system_instructions_template = dedent("""\
        <System Instructions>
        # Role
            You are a language expert that decomposes complex sentences into sub-sentences.
       
        {language_style}
                                              
        # Do not interpret
            Do not infer the my responsibilities, skills, duties, tasks, actions, behaviour, activities, competencies, or knowledge based on your prior knowledge about the experience.
            Do not infer the experience and do not use that information in your task.
            Use only information that is present in <My Last Input> and <Conversation History>.
        # 'decomposed_sentences' instructions
            Extract and accurately identify and separate the main actions from their purpose or descriptive clauses and decompose complex sentences from the <My Last Input> into sub-sentences.
            
            Main Action Sub-Sentences: Convert the main action into a standalone sentences.
            Purpose Action Sub-Sentences: Turn the purpose clause into a standalone sentences.
            Further Detail or Requirement Sub-Sentences: Extract additional details or requirements into further standalone sentences.
            
            The sum of the sub-sentences should cover all the information in the original sentence and preserve the original meaning.
            Do not duplicate sub-sentences that are similar and do not convey new information. Be as concise as possible.
            The sub-sentence must incorporate parts of the <Conversation History>, so that the sub-sentence is standalone and can be understood
            without the need to refer back to the <Conversation History>. Adjust phrasing as necessary to maintain clarity and coherence.
            Include all information about the action, including the subject, verb, and object.
            Place each sub-sentence in a separate JSON string in the 'decomposed_sentences' list.
        # 'pronouns_indexing' instructions
            Identify all pronouns in <My Last Input> and <Conversation History>.
            Include all possessive  reflexive, demonstrative, relative, interrogative, indefinite, reciprocal, and intensive pronouns.
            Exclude first person pronouns (I, me, my, mine etc.) and second person pronouns (you, your, yours etc.) that refer to me.
            
            For each pronoun provide the pronoun type in the format: "pronoun -> pronoun type"   
            If a word might be a pronoun but it is not clear, indicate that it is ambiguous.
        # 'pronouns_antecedents'  instructions  
            Identify all pronouns in <My Last Input> and <Conversation History> and determine their antecedents.
            Exclude first person pronouns (I, me, my, mine etc.) and second person pronouns (you, your, yours etc.) that refer to me.
            For each pronoun, provide the antecedent in the format: "pronoun -> antecedent" and explain the reasoning behind the choice of antecedent.
            If a pronoun does not have a clear antecedent, indicate that it is ambiguous.
            
        # 'resolved_pronouns' instructions
            Replace all pronouns (expect the ones that refer to the first person), in the 'decomposed_sentences' with the specific nouns or phrases they reference.
            The antecedent should not show up multiple times in the same sentence.
            Use <My Last Input> and <Conversation History> to determine the antecedent.            
            All information from the original sentence is preserved and covered.
            Place each rephrased sentence in a separate JSON string in the 'resolved_pronouns' list.
        
        # JSON Output instructions
            Your response must always be a JSON object with the following schema:
            - 'decomposed_sentences': list of JSON strings
            - 'pronouns_indexing': list of JSON strings in the format: pronoun -> pronoun type
            - 'pronouns_antecedents': list of JSON strings in the format: pronoun -> antecedent
            - 'resolved_pronouns': list of JSON strings
            - 'final_output': list of JSON strings
        # Example
            conversation history: Ben makes the bread and sells it to the neighbours and gives me money for it.
            my last input: I help him do this.
            decomposed_sentences: ["I help him do this", "Ben makes the bread", "Ben sells it to the neighbours", "Ben gives me money for it"]
            pronouns_indexing: ["him -> third person pronoun", "it -> third person pronoun", "this -> demonstrative pronoun"]
            pronouns_antecedents: ["him -> Ben", "it -> helping", "it -> the bread", "this -> the action of making and selling the bread"]
            resolved_pronouns: ["I help Ben", "Ben makes the bread", "I help Ben sell the bread", "Ben sells the bread to the neighbours", "Ben gives I money for helping Ben"]
            final_output: ["I help Ben", "Ben makes the bread", "I help Ben sell the bread", "Ben sells the bread to the neighbours", "Ben gives me money for helping him"]
            
        Your response must always be a JSON object with the schema above
        </System Instructions>
        """)

        return system_instructions_template.format(language_style=STD_LANGUAGE_STYLE)

    @staticmethod
    def _first_pass_prompt_template(context: ConversationContext, last_user_input: str) -> str:
        return dedent("""\
                <Conversation History>
                {conversation_history}
                </Conversation History>
                
                <My Last Input>
                me: '{last_user_input}'
                </My Last Input>
                """).format(conversation_history=_SentenceDecompositionLLM.format_history_for_prompt(context, _TAGS_TO_FILTER),
                            last_user_input=sanitize_input(last_user_input.strip(), _TAGS_TO_FILTER))

    @staticmethod
    def format_history_for_prompt(context: ConversationContext, tags_to_filter: list[str]) -> str:
        _output: str = ""
        if context.summary != "":
            _output += f"me: '{ConversationHistoryFormatter.SUMMARY_TITLE}\n{context.summary}'"

        for turn in context.history.turns:
            _output += (f"me: '{sanitize_input(turn.input.message, tags_to_filter)}'\n"
                        f"you: '{sanitize_input(turn.output.message_for_user, tags_to_filter)}'\n")
        return _output.strip("\n")

    @staticmethod
    def _create_second_pass_system_instructions() -> str:
        system_instructions_template = dedent("""\
        <System Instructions>
        # Role
            You are a language expert that reviews sentences and fixes them.
            You will be given an input with a list of independent sentences.
            Your task is to review each sentence and fix it to ensure that it is grammatically correct, clear, concise and sounds natural.
            Pay attention to awkward phrasing, grammatical errors, and any other issues that may affect the clarity and readability of the sentence.
            Do not change the meaning of the sentence or add any new information.
            Both the input and the fixed sentence should be interpreted in a different way review independently. 
            Each sentence from the input must fixed and added to the output in the decomposed_and_dereferenced list.
        
        {language_style}
                                              
        # Input Structure
            The input structure is a list of sentences:
            "sentences": list of sentences 
        
        # JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
              "decomposed_and_dereferenced": list of JSON strings
            }
            
        Your response must always be a JSON object with the schema above
        </System Instructions>
        """)

        return system_instructions_template.format(language_style=STD_LANGUAGE_STYLE)

    @staticmethod
    def _second_pass_prompt_template(sentences: list[str]) -> str:
        return "sentences: " + str(sentences) + "\n"


_TAGS_TO_FILTER = ["system instructions", "my last input", "conversation history"]
