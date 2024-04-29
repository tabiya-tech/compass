from textwrap import dedent

from pydantic import BaseModel


class ModelResponse(BaseModel):
    """
    A model for a response of LLMs.
    """
    message: str
    finished: bool


def get_conversation_finish_instructions(condition: str) -> str:
    """
    Get the instructions for finishing a conversation. This can be added to the prompt.
    :param condition: A text that describes the condition for finishing the conversation
    :return: A string with the instructions for finishing a conversation,
    including how to set the "finished" key in the response.
    """
    return condition + ", " + dedent("""\
    return a JSON object with the "finished" key in the set to true.
    
    Allways return a JSON object. Compare your response with the schema above.
    """)


def get_json_response_instructions(examples: list[ModelResponse]) -> str:
    """
    Get the instructions so that the model can return a json. This can be added to the prompt.
    :param examples: A list of examples of responses for a few-shot learning task
    :return: A string with the instructions for the model to return a json.
    """
    template_parts = [dedent("""\
    Your response must be a JSON object with the following schema:
        - message:  Your message to the user in double quotes formatted as a json string 
        - finished: A boolean flag to signal that you have completed your task. 
                    Set to true if you have finished your task, false otherwise.
    Example responses:
    """)]

    for i, example in enumerate(examples):
        part = f'{example.json()}'
        template_parts.append(part)

    return "\n".join(template_parts)
