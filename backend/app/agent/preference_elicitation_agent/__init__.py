"""
Preference Elicitation Agent Package.

This package contains the implementation of the preference elicitation agent
that gathers user job preferences through conversational vignettes.
"""

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.types import (
    PreferenceVector,
    Vignette,
    VignetteOption,
    VignetteResponse,
    FinancialPreferences,
    WorkEnvironmentPreferences,
    JobSecurityPreferences,
    CareerAdvancementPreferences,
    WorkLifeBalancePreferences,
    TaskPreferences,
    SocialImpactPreferences
)
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.preference_extractor import (
    PreferenceExtractor,
    PreferenceExtractionResult
)

__all__ = [
    "PreferenceElicitationAgent",
    "PreferenceElicitationAgentState",
    "PreferenceVector",
    "Vignette",
    "VignetteOption",
    "VignetteResponse",
    "FinancialPreferences",
    "WorkEnvironmentPreferences",
    "JobSecurityPreferences",
    "CareerAdvancementPreferences",
    "WorkLifeBalancePreferences",
    "TaskPreferences",
    "SocialImpactPreferences",
    "VignetteEngine",
    "PreferenceExtractor",
    "PreferenceExtractionResult",
]
