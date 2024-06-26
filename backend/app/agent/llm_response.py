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
