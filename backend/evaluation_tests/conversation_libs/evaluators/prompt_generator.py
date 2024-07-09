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
            
            case EvaluationType.FOCUS:
                return textwrap.dedent("""
                            Did the EVALUATED_AGENT lose focus on the topic of the conversation and on its
                            task of investigating the experiences and skill of the user? Did the EVALUATED_AGENT give into
                            a topic of conversation that is different from the experience and skill investigation?
                        """)

            case EvaluationType.SUMMARY_CONSISTENCY:
                return textwrap.dedent("""
                Evaluation Criteria:
                Consistency - the factual alignment between the new summary and the current summary and conversation. 
                A factually consistent new summary contains only statements that are entailed by the current summary and conversation.
                new summaries that contained hallucinated facts are penalized.
                
                Evaluation Steps:

                1. Read the current summary and conversation carefully and identify the main facts and details they present.
                2. Read the new summary and compare it to the current summary and conversation. Check if the new summary contains any factual errors that are not supported by the current summary and conversation.
                3. Assign a score for consistency from of 1 to 5, where 1 is the lowest and 5 is the highest based on the Evaluation Criteria.
                """)

            case EvaluationType.SUMMARY_RELEVANCE:
                return textwrap.dedent("""
                Evaluation Criteria:
                Relevance - selection of important content from the current summary and conversation.
                The new summary should include only important information from the current summary and conversation.
                new summaries which contained redundancies and excess information are penalized.
                
                Evaluation Steps:

                1. Read the summary and the current summary and conversation carefully.
                2. Compare the new summary to the current summary and conversation and identify the main points of the current summary and conversation.
                3. Assess how well the new summary covers the main points of the current summary and conversation, and how much irrelevant or redundant information it contains.
                4. Assign a relevance score from of 1 to 5, where 1 is the lowest and 5 is the highest based on the Evaluation Criteria.
                """)
            case _:
                raise NotImplementedError()

    @staticmethod
    def _get_example_response(criteria: EvaluationType):
        match criteria:
            case EvaluationType.CONCISENESS:
                return textwrap.dedent("""
                            The conversation is somewhat concise, but the EVALUATED_AGENT repeats instructions, 
                    and the SIMULATED_USER could ask more focused questions.
                        """)
            
            case EvaluationType.FOCUS:
                return textwrap.dedent("""
                            The conversation is somewhat focused, but the EVALUATED_AGENT allows the user to drift off at times.
                        """)

            case EvaluationType.SUMMARY_CONSISTENCY:
                return textwrap.dedent("""
               The summary is somewhat consistent, but there are some facts that do not exist on the current conversation.
                """)

            case EvaluationType.SUMMARY_RELEVANCE:
                return textwrap.dedent("""
                The summary is somewhat relevant to the current conversation.
                """)
            case _:
                raise NotImplementedError()

    @staticmethod
    def generate_prompt(conversation: str, criteria: EvaluationType) -> str:
        """
        Generates the prompt to be used in the evaluators.
        """
        criteria_string = PromptGenerator._get_criteria_string(criteria)
        example_response = PromptGenerator._get_example_response(criteria)
        if criteria_string is None or example_response is None:
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
                "score": 50,
                "reason": "{example_response}"
            }}
    
            Conversation Data:
            [BEGIN DATA]
            [Conversation]: {conversation}
            [END DATA] 
        """)

        return template

    @staticmethod
    def generate_summary_prompt(conversation: str, current_summary: str, new_summary: str,
            criteria: EvaluationType) -> str:
        """
        Generates the prompt to be used in the summary evaluators.
        """
        criteria_string = PromptGenerator._get_criteria_string(criteria)
        example_response = PromptGenerator._get_example_response(criteria)
        if criteria_string is None or example_response is None:
            raise ValueError("Invalid criteria value")

        template = textwrap.dedent(f"""
            You are assessing a summary that was created from the original conversation. 
            {criteria_string}
                    
            Respond only using a valid JSON format as follows:
            
            {{
                "score": 0, 
                "reason": ""
            }}
            
            Example Response:
            
            {{
                "score": 3,
                "reason": "{example_response}"
            }}
    
            [BEGIN DATA]
            [Current Summary]: {current_summary}
            [Current Conversation]: {conversation}
            [New Summary]: {new_summary}
            [END DATA] 
        """)

        return template
