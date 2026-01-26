from typing import Literal

Model = Literal[
    # gemini-1.5-flash is an auto update version the points to the most recent stable version
    # see https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versioning#auto-updated-version
    # "gemini-1.5-flash-001",
    # "gemini-2.0-flash-001",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]


class AgentsConfig:
    default_model: Model = "gemini-2.5-flash-lite"
    """
    The LLM model name to use by default.
    """

    fast_model: Model = "gemini-2.5-flash-lite"
    """
    The fast LLM model name to use.
    
    Expectations
    - Low reasoning
    - Fast in response time
    """

    deep_reasoning_model: Model = "gemini-2.5-flash"
    """
    The LLM model name to use for deep reasoning.
    
    Expectations
    - High reasoning
    - Slow in response time compared to the fast model
    """

    ultra_high_reasoning_model: Model = "gemini-2.5-pro"
