from typing import Optional, Generic, TypeVar

from pydantic import BaseModel

P = TypeVar('P')


class ModelResponse(BaseModel, Generic[P]):
    """
    A model for a response of LLMs.
    The oder of the properties is important.
    Order the output components strategically to improve model predictions:
    1. Reasoning: Place this first, as it sets the context for the response.
    2. Finished Flag: Follow with the finished flag, which depends on the reasoning.
    3. Message: Conclude with the message, which relies on the reasoning and the finished flag.
    4. Data: Optionally additional data that the LLM may generate
    This ordering leverages semantic dependencies to enhance accuracy in prediction.
    """
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""
    finished: bool
    """Flag indicating whether the LLM has finished its task"""
    message: str
    """Message for the user that the LLM produces"""
    data: Optional[P] = None
    """Additional data that the LLM may generate"""

class InferOccupationModelResponse(BaseModel, Generic[P]):
    """
    Model for the response of LLM for the InferOccupationAgent.
    """
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""
    needs_more_info: bool
    """A boolean flag to signal the need of more information from the user."""
    response: str
    """String request of more information to the user."""
    finished: bool
    """Flag indicating whether the LLM has finished its task"""
    correct_occupation: str
    """a string containing the correct occupation among the options if finished is set to True. Empty string otherwise."""