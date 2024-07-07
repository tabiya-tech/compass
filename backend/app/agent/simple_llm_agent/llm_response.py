from pydantic import BaseModel


class ModelResponse(BaseModel):
    """
    A model for a response of LLMs.
    The oder of the properties is important.
    Order the output components strategically to improve model predictions:
    1. Reasoning: Place this first, as it sets the context for the response.
    2. Finished Flag: Follow with the finished flag, which depends on the reasoning.
    3. Message: Conclude with the message, which relies on the reasoning and the finished flag.
    """
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""
    finished: bool
    """Flag indicating whether the LLM has finished its task"""
    message: str
    """Message for the user that the LLM produces"""

    class Config:
        # Do not allow extra fields as the model response should be strictly defined
        # When the LLM generates a response, it should adhere to the schema strictly
        # The response should not contain additional fields that are not defined in the schema
        # to ensure that the model instructions on-par with the schema
        # Custom agents can define their own schemas and instructions
        extra = "forbid"
