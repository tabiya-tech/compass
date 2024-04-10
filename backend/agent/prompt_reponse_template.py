from typing import TypedDict
from textwrap import dedent


class ModelResponse(TypedDict):
    message: str
    finished: bool


def get_conversation_finish_instructions(condition: str) -> str:
    return condition + ", " + dedent("""\
    return the json that matches the _Response_Template_ schema  with the "finished" key in the set to true.
    """)


def get_json_response_instructions(examples: list[ModelResponse]) -> str:
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
            "finished": {"true" if example["finished"] == True else "false"}
            }}
        """)
        template_parts.append(part)

    return "\n".join(template_parts)
