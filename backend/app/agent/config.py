from typing import Literal, final, Final

Model = Literal[
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview",
]


@final
class AgentsConfig:
    default_model: Final[Model] = "gemini-3.5-flash-lite"
    """
    The LLM model name to use by default.
    """

    fast_model: Final[Model] = "gemini-3.5-flash-lite"
    """
    The fast LLM model name to use.

    Expectations
    - Low reasoning
    - Fast in response time
    """

    deep_reasoning_model: Final[Model] = "gemini-3.8-flash"
    """
    The LLM model name to use for deep reasoning.

    Expectations
    - High reasoning
    - Slow in response time compared to the fast model
    """

    ultra_high_reasoning_model: Final[Model] = "gemini-3.1-pro-preview"
    """
    Ultra high reasoning models to be used.
    for specific cases like evaluations that don't run at run time.

    The Gemini 3.x models are only served from the Vertex AI `global` location, see `VERTEX_API_GEN_AI_REGION`.
    They are the models the google-genai Interactions API supports; it rejects the Gemini 2.5 models.
    """
