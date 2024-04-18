import textwrap

from evaluation_result import EvaluationType


class PromptGenerator:

    @staticmethod
    def get_criteria_string(criteria: EvaluationType):
        match criteria:
            case EvaluationType.CONCISENESS:
                return f"""
                Your task is to evaluate how concise the responses are from both the SIMULATED_USER and the 
                EVALUATED_AGENT, focusing on the following aspects:
        
                - Response Length: Are the EVALUATED_AGENT responses reasonably concise and to-the-point, 
                or do they tend to be verbose or rambling? Do the human's messages convey their point concisely?
        
                - Extraneous Information: Do the EVALUATED_AGENT responses stay focused on directly addressing the 
                user's 
                question/concern, or do they include a lot of unnecessary preamble, repetition, or tangential 
                information?
        
                - Clarity: Despite being concise, are the key points still communicated clearly by both parties, 
                without critical details being omitted?
        
                - Appropriate Depth: While aiming for conciseness, do the responses still provide enough relevant 
                depth and 
                detail to adequately counsel the user on identifying required job skills?
        
                """
            case _:
                raise NotImplementedError()

    @staticmethod
    def generate_prompt(conversation: str, context: str, criteria: EvaluationType) -> str:

        print(criteria)
        criteria_string = PromptGenerator.get_criteria_string(criteria)
        if criteria_string is None:
            raise ValueError("Invalid criteria value")

        template = textwrap.dedent("""
                You are assessing a conversation between a human and a job counselor AI chatbot.
                {context}
                Your goal is to evaluate the conversation based on the specified criteria and generate a response
                as per the Response Type.  
                Here is the data:
                
                [BEGIN DATA]
                
                [Conversation]: 
                
                {conversation}
                
                
                [Criteria]: {criteria}
                
                
                [END DATA]

                {criteria_string}
                Please rate the overall {criteria} of the conversation as "score" on a scale between 0 to 100.

                Generate your reasoning as "reason" in a step by step manner to be sure that your conclusion is correct

                [Response Type]

                Generate the response in a valid, well-formed JSON format, that matches the _Response_Template_  below.

                _Response_Template_:
                {{  
                    "score":  "", # Based on the criteria of evaluation, between 0 to 100 
                    "reason": "" # String value that contains the reasoning for the conclusion
                }}

                Example Response: 

                {{
                    "score":  "50", 
                    "reason": "The conversation seems concise enough"
                }}
                
                Double check if the response is a valid json which only contains the key "score" and "reason"


                """)

        formatted_template = template.format(
            context=context,
            conversation=conversation,
            criteria=criteria.value,
            criteria_string=criteria_string
        )

        return formatted_template
