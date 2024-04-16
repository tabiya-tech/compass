from typing import TypedDict
from textwrap import dedent


class ModelResponse(TypedDict):
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
    return the json that matches the _Response_Template_ schema  with the "finished" key in the set to true.
    """)


def get_json_response_instructions(examples: list[ModelResponse]) -> str:
    """
    Get the instructions so that the model can return a json. This can be added to the prompt.
    :param examples: A list of examples of responses for a few-shot learning task
    :return: A string with the instructions for the model to return a json.
    """
    template_parts = [dedent("""\
    Your response will be in text form of a valid, well-formed JSON, that matches the _Response_Template_  bellow.
    
    _Response_Template_:
        {
        "message":  "" # The message to the user in double quotes formatted as a json string 
        "finished": true | false # A boolean flag to signal that the  conversation is finished
        }
    """)]

    for i, example in enumerate(examples):
        part = dedent(f"""\
        Example responses {i + 1}:
            {{
            "message":  "{example["message"]}",
            "finished": {"true" if example["finished"] is True else "false"}
            }}
        """)
        template_parts.append(part)

    return "\n".join(template_parts)
