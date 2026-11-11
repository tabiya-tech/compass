from enum import StrEnum
from typing import Literal, Final

Model = Literal[
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview",
]


class ModelTier(StrEnum):
    """
    The capability tier an LLM call needs. The concrete model for each tier is resolved at call time
    from the LLM_DEFAULT_MODEL, LLM_REASONING_MODEL and LLM_DEEP_REASONING_MODEL environment variables,
    see `common_libs.llm.models_utils.resolve_model_name`.
    """

    DEFAULT = "default"
    """
    The model to use by default.
    Used by conversation-facing agents that need fast response times.

    Expectations
    - Low reasoning
    - Fast in response time
    """

    REASONING = "reasoning"
    """
    The model to use for tasks that need good reasoning, e.g. classifiers, routing and extraction.

    Expectations
    - High reasoning
    - Slow in response time compared to the default model
    """

    DEEP_REASONING = "deep_reasoning"
    """
    The model to use for tasks that need the strongest reasoning,
    for specific cases like evaluations that don't run at run time.
    """


GEMINI_DEFAULT_MODELS: Final[dict[ModelTier, Model]] = {
    ModelTier.DEFAULT: "gemini-3.5-flash-lite",
    ModelTier.REASONING: "gemini-3.8-flash",
    ModelTier.DEEP_REASONING: "gemini-3.1-pro-preview",
}
"""
The Gemini model used for each tier when the tier's environment variable is not set.

The Gemini 3.x models are only served from the Vertex AI `global` location, see `VERTEX_API_GEN_AI_REGION`.
They are the models the google-genai Interactions API supports; it rejects the Gemini 2.5 models.
"""
