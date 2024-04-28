import textwrap

from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType


class PromptGenerator:
    """
    Generates the prompt used by the evaluators.
    """

    @staticmethod
    def _get_criteria_string(criteria: EvaluationType):
        match criteria:
            case EvaluationType.CONCISENESS:
                return textwrap.dedent("""
                            Could any of the responses made by EVALUATED_AGENT be expressed more concisely without 
                            losing meaning? Are there any phrases said by EVALUATED_AGENT that are repeated 
                            unnecessarily within this segment of the conversation? Are all the questions by 
                            EVALUATED_AGENT focused and easy to understand?
                        """)
            case EvaluationType.RELEVANCE:
                return textwrap.dedent(""" 
                            Are the responses made by EVALUATED_AGENT relevant and pertinent to the questions or 
                            prompts given by the human? Do the responses address the core of what was asked or 
                            discussed? Are there any irrelevant tangents or digressions made by EVALUATED_AGENT? 
                        """)
            case EvaluationType.CORRECTNESS:
                return textwrap.dedent(""" 
                            Are there any factual errors or incorrect statements made by EVALUATED_AGENT in their
                             responses? Do the responses demonstrate a solid understanding of the topic or domain
                            being discussed? Are there any instances where EVALUATED_AGENT provides information that 
                            contradicts established facts or knowledge? 
                        """)
            case EvaluationType.COHERENCE:
                return textwrap.dedent(""" 
                            Do the responses made by EVALUATED_AGENT follow a logical flow and progression? 
                            Are there any abrupt shifts or discontinuities in the line of thought or reasoning? 
                            Do the responses build upon each other in a coherent manner, or do they seem disconnected 
                            or disjointed? 
                        """)

            case _:
                raise NotImplementedError()

    @staticmethod
    def generate_prompt(conversation: str, criteria: EvaluationType) -> str:
        """
        Generates the prompt to be used in the evaluators.
        """
        criteria_string = PromptGenerator._get_criteria_string(criteria)
        if criteria_string is None:
            raise ValueError("Invalid criteria value")

        template = textwrap.dedent(f"""
            You are assessing a conversation between a human (SIMULATED_USER) and a job 
            counselor AI chatbot (EVALUATED_AGENT). {criteria_string}
            
            Rate it from 0 to 100, 0 being worst 100 being best.
                    
            Respond only using a valid JSON format as follows:
            
            {{
                "score": 0, 
                "reason": ""
            }}
            
            Example Response:
            
            {{
                "score":50,
                "reason": "The conversation is somewhat concise, but the EVALUATED_AGENT repeats instructions, 
                    and the SIMULATED_USER could ask more focused questions."
            }}
    
            Conversation Data:
            [BEGIN DATA]
            [Conversation]: {conversation}
            [END DATA] 
        """)

        return template
