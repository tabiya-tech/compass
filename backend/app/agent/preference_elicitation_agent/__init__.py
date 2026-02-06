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

# Youth database exports (optional dependency)
try:
    from app.database_contracts.db6_youth_database import DB6Client, YouthProfile
except ImportError:
    # Youth database not available - this is expected during development
    DB6Client = None
    YouthProfile = None

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
    # Youth database dependencies
    "DB6Client",
    "YouthProfile"
]
