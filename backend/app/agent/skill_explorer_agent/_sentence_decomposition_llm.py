import logging
from textwrap import dedent

from pydantic import BaseModel, Field

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema
from ...conversation_memory.conversation_formatter import ConversationHistoryFormatter
from ...i18n.translation_service import get_i18n_manager


class _SentenceDecompositionResponse(BaseModel):
    decomposed_and_dereferenced: list[str] = Field(default_factory=list, description=(
        "The reviewed and fixed sentences, one item for each sentence of the input."))
    """
    The decomposed and dereferenced sentences from the user's input.
    This is the final output of the second pass and what the SentenceDecompositionLLM returns to the caller.
    """


class _SentenceDecompositionFirstPassResponse(BaseModel):
    decomposed_sentences: list[str] = Field(default_factory=list, description=dedent("""
    The decomposed sentences from the user's input, one sub-sentence per item, see the '# 'decomposed_sentences' instructions'.
    This is used to help the model complete the task in steps as dereferencing the pronouns is too complex for the model to do in one step.
    """))

    pronouns_indexing: list[str] = Field(default_factory=list, description=dedent("""
    The unique pronouns from the user's input and their types, each item in the format: "pronoun -> pronoun type".
    See the '# 'pronouns_indexing' instructions'. This is a helper field, keep it brief and not repetitive.
    Helps the model to identify the pronouns and complete the task in steps.
    Each pronoun should appear only once in this list, even if it appears multiple times in the text.
    Keep this list concise - only include pronouns that need to be resolved.
    In some cases it is unclear if a word is a pronoun or not. For example:
    "He said that he will go to the store" - "that" is not a pronoun
    """))

    pronouns_antecedents: list[str] = Field(default_factory=list, description=dedent("""
    The unique pronouns from the user's input and their antecedents, each item in the format: "pronoun -> antecedent".
    See the '# 'pronouns_antecedents' instructions'. This is a helper field, keep it brief and not repetitive.
    This is used to help the model complete the task in steps.
    Each pronoun should appear only once in this list, even if it appears multiple times in the text.
    Keep this list concise - only include pronouns that need to be resolved.
    """))

    resolved_pronouns: list[str] = Field(default_factory=list, description=dedent("""
    The resolved pronouns from the user's input, one rephrased sentence per item, see the '# 'resolved_pronouns' instructions'.
    This is the final output of the first pass (the main output).
    The original sentences are decomposed into sub-sentences and the pronouns are resolved to their antecedents.
    However, models struggle to correctly frame the sentences in a natural way. This is due to the pronouns_antecedents 
    which condition the output to return expressions like "Ben helps Ben's" or "Ben uses Ben's hands".
    """))


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
                    "seed": 1,  # A fixed seed makes the decomposition reproducible
                    "max_output_tokens": 3000,  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                } | with_response_schema(_SentenceDecompositionFirstPassResponse)
            ))
        self._llm_caller_second_pass = LLMCaller[_SentenceDecompositionResponse](model_response_type=_SentenceDecompositionResponse)
        self.llm_second_pass = GeminiGenerativeLLM(
            system_instructions=_SentenceDecompositionLLM._create_second_pass_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "top_p": 0.0,
                    "seed": 1,  # A fixed seed makes the decomposition reproducible
                    "max_output_tokens": 3000,  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                } | with_response_schema(_SentenceDecompositionResponse)
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
        if not llm_first_pass_output:
            self.logger.warning("The LLM did not return any output for sentence decomposition first pass")
            return _SentenceDecompositionResponse(decomposed_and_dereferenced=[]), llm_first_pass_stats
        
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
            You are ({language_name}) language expert that decomposes complex sentences into sub-sentences.
                                                     
        # Do not interpret
            Do not infer the my responsibilities, skills, duties, tasks, actions, behaviour, activities, competencies, or knowledge based on your prior knowledge about the experience.
            Do not infer the experience and do not use that information in your task.
            Use only information that is present in <My Last Input> and <Conversation History>.
        # Scope
            Decompose ONLY the sentences of <My Last Input>.
            Use <Conversation History> solely to resolve what the pronouns and references in <My Last Input> refer to.
            Never output a sentence for something that is only said in <Conversation History> and is not stated in <My Last Input>.
        # Keep my wording
            Reuse my exact words, word order and tense. Do not use synonyms, do not reorder words, do not change the tense,
            and do not add or remove words. Keep adverbs and modifiers such as "sometimes", "very early in the morning" or "myself".
            The only changes you are allowed to make are:
                - split a sentence into standalone sub-sentences and drop the connectors that only linked them (e.g. "and", "but", "then", "also"),
                - repeat the subject when it was omitted (e.g. "I heat the ovens, clean the place" -> "I heat the ovens", "I clean the place"),
                - replace pronouns and references with what they refer to, adapting the verb agreement when needed
                  (e.g. "We do it" where "it" is shaping the dough -> "John and I shape the dough").
            For example: "I cook. I also wash the dishes and then sometimes I dry them myself" ->
                "I cook.", "I wash the dishes.", "Sometimes I dry the dishes myself."
            Start every sentence with a capital letter and end it with a period.
        # 'decomposed_sentences' instructions
            Extract and accurately identify and separate the main actions from their purpose or descriptive clauses and decompose complex sentences from the <My Last Input> into sub-sentences.
            
            Main Action Sub-Sentences: Convert each main action into a standalone sentence. Each sub-sentence contains exactly one main action:
            split the actions joined by "and", "but" or commas, and split the actions in relative clauses
            (e.g. "My aunt eats the cake that I baked" -> "My aunt eats the cake", "I baked the cake"),
            but not a relative clause about what someone needs, has or wants (e.g. "I buy the tools we need" stays one sentence).
            Keep a purpose or reason clause (e.g. "to ...", "so that ...", "because ...") and a time clause (e.g. "after ...", "when ...")
            in the same sub-sentence as the main action it directly belongs to, and only with that action
            (e.g. "My son eats the soup that I cooked after I came home" -> "My son eats the soup.", "I cooked the soup after I came home.").
            
            The sum of the sub-sentences should cover all the information in the original sentence and preserve the original meaning.
            Each piece of information must appear in exactly one sub-sentence: do not output both a sentence and its parts,
            and do not duplicate sub-sentences that are similar and do not convey new information. Be as concise as possible.
            The sub-sentence must incorporate parts of the <Conversation History>, so that the sub-sentence is standalone and can be understood
            without the need to refer back to the <Conversation History>.
            Include all information about the action, including the subject, verb, and object.
            Place each sub-sentence as a separate item in the 'decomposed_sentences' list.
        # 'pronouns_indexing' instructions
            Identify all unique pronouns in <My Last Input> and <Conversation History>.
            Include all possessive, reflexive, demonstrative, relative, interrogative, indefinite, reciprocal, and intensive pronouns.
            Exclude first person pronouns (I, me, my, mine etc.) and second person pronouns (you, your, yours etc.) that refer to me.
            First person plural pronouns (we, us, our, ours etc.) are not excluded when they refer to me together with other people.
            
            List each unique pronoun only once, even if it appears multiple times in the text.
            For each pronoun provide the pronoun type in the format: "pronoun -> pronoun type".
            Keep this list concise - only include pronouns that need to be resolved.
            If a word might be a pronoun but it is not clear, indicate that it is ambiguous.
        # 'pronouns_antecedents'  instructions  
            Identify all unique pronouns in <My Last Input> and <Conversation History> and determine their antecedents.
            Exclude first person pronouns (I, me, my, mine etc.) and second person pronouns (you, your, yours etc.) that refer to me.
            First person plural pronouns (we, us, our, ours etc.) are not excluded when they refer to me together with other people.
            List each unique pronoun only once, even if it appears multiple times in the text.
            For each pronoun, provide the antecedent in the format: "pronoun -> antecedent" and briefly explain the reasoning behind the choice of antecedent.
            Keep this list concise - only include pronouns that need to be resolved.
            If a pronoun does not have a clear antecedent, indicate that it is ambiguous.
            
        # 'resolved_pronouns' instructions
            Replace all pronouns (expect the ones that refer to the first person), in the 'decomposed_sentences' with the specific nouns or phrases they reference.
            Replace first person plural pronouns (we, us, our etc.) with the people they refer to, naming me as "I" (e.g. "we" -> "John and I") when they are known.
            The antecedent should not show up multiple times in the same sentence.
            Use <My Last Input> and <Conversation History> to determine the antecedent.            
            All information from the original sentence is preserved and covered.
            Place each rephrased sentence as a separate item in the 'resolved_pronouns' list.
        
        # Helper fields
            IMPORTANT: Do not repeat entries in pronouns_indexing or pronouns_antecedents. Each unique pronoun should appear only once in each list.
            These are helper fields to guide your reasoning - they should be brief and not repetitive.
        # Example
            conversation history: Ben makes the bread and sells it to the neighbours and gives me money for it.
            my last input: I help him do this.
            decomposed_sentences: ["I help him do this", "Ben makes the bread", "Ben sells it to the neighbours", "Ben gives me money for it"]
            pronouns_indexing: ["him -> third person pronoun", "it -> third person pronoun", "this -> demonstrative pronoun"]
            pronouns_antecedents: ["him -> Ben", "it -> the bread", "this -> the action of making and selling the bread"]
            resolved_pronouns: ["I help Ben", "Ben makes the bread", "I help Ben sell the bread", "Ben sells the bread to the neighbours", "Ben gives me money for helping him"]
        </System Instructions>
        """)

        language_name = get_i18n_manager().get_reporting_locale().label()
        return replace_placeholders_with_indent(system_instructions_template,
                                                language_name=language_name)

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
            You are ({language_name}) language expert that reviews sentences and fixes them.
            You will be given an input with a list of independent sentences.
            Your task is to review each sentence and fix only its grammatical errors, such as "I use I's hands" -> "I use my hands"
            or "Ben helps Ben's brother" -> "Ben helps his brother".
            If a sentence is grammatically correct, return it exactly as it is, character for character.
            Do not restyle or rephrase: do not use synonyms, do not reorder words, do not change the tense,
            and do not add or remove words such as adverbs (e.g. "also", "sometimes", "myself").
            Do not change the meaning of the sentence or add any new information.
            Do not change the grammatical person of the sentence. If a sentence uses first person ("I", "my", "me"), keep it in first person. Do not convert first-person sentences to third person ("The user", "he", "she", "they").
            Review each sentence independently.
            Every sentence must end with a period.
            Each sentence from the input must be reviewed and added to the output in the decomposed_and_dereferenced list, in the same order.
                       
        # Input Structure
            The input structure is a list of sentences:
            "sentences": list of sentences 
        </System Instructions>
        """)

        language_name = get_i18n_manager().get_reporting_locale().label()
        return replace_placeholders_with_indent(system_instructions_template,
                                                language_name=language_name)

    @staticmethod
    def _second_pass_prompt_template(sentences: list[str]) -> str:
        return "sentences: " + str(sentences) + "\n"


_TAGS_TO_FILTER = ["system instructions", "my last input", "conversation history"]
