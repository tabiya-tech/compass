from pydantic import BaseModel, Field


class ModelResponse(BaseModel):
    """
    A model for a response of LLMs.
    It is the schema of the structured output of the LLM, the descriptions of the fields guide the LLM.
    The oder of the properties is important.
    Order the output components strategically to improve model predictions:
    1. Reasoning: Place this first, as it sets the context for the response.
    2. Finished Flag: Follow with the finished flag, which depends on the reasoning.
    3. Message: Conclude with the message, which relies on the reasoning and the finished flag.
    """
    reasoning: str = Field(description="A step by step explanation of how my message relates to your instructions, "
                                       "why you set the finished flag to the specific value and why you chose the message. "
                                       "In the form of \"..., therefore I will set the finished flag to true|false, and I will ...\".")
    """Chain of Thought reasoning behind the response of the LLM"""
    finished: bool = Field(description="Set to true if you have finished your task, false otherwise.")
    """Flag indicating whether the LLM has finished its task"""
    message: str = Field(description="Your message to the user.")
    """Message for the user that the LLM produces"""

    class Config:
        # Do not allow extra fields as the model response should be strictly defined
        # When the LLM generates a response, it should adhere to the schema strictly
        # The response should not contain additional fields that are not defined in the schema
        # to ensure that the model instructions on-par with the schema
        # Custom agents can define their own schemas and instructions
        extra = "forbid"
