"""
Preference Elicitation Agent Package.

This package contains the implementation of the Preference Elicitation Agent
for Epic 2 of the Compass project.
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

# DB6 exports (Epic 1 dependency - optional)
try:
    from app.epic1.db6_youth_database import DB6Client, YouthProfile
except ImportError:
    # Epic 1 not available - this is expected during development
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
    # Epic 1 dependencies
    "DB6Client",
    "YouthProfile"
]
