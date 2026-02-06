from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional, List

from pydantic import BaseModel, Field, field_validator, field_serializer


class WorkLocationType(str, Enum):
    REMOTE = "Remote"
    ONSITE = "OnSite"
    HYBRID = "Hybrid"


class ContractType(str, Enum):
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    GIG = "Gig"
    INTERNSHIP = "Internship"


class JobPreferences(BaseModel):
    """
    Job preferences for a user session from Epic 2 preference elicitation.

    Stores BOTH:
    1. Soft preferences (importance scores from Bayesian vignette modeling)
    2. Hard constraints (explicit requirements, optional)

    This schema is aligned with Epic 2's PreferenceVector output.
    """

    session_id: int
    """Compass user session ID"""

    # ========== SOFT PREFERENCES (from Bayesian preference elicitation) ==========
    # These are RELATIVE importance scores (0.0-1.0) learned from vignettes

    financial_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values financial compensation (salary, benefits, bonuses)"""

    work_environment_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values work environment (remote, commute, physical conditions, autonomy)"""

    career_advancement_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values career growth (learning, skill development, promotion paths)"""

    work_life_balance_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values work-life balance (hours, flexibility, family time)"""

    job_security_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values job security (stability, contract type, risk tolerance)"""

    task_preference_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values specific task types (routine, cognitive, manual, social, creative)"""

    social_impact_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """How much user values social impact (helping others, community, purpose-driven work)"""

    # ========== QUALITY METADATA ==========

    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    """
    Overall confidence in preference estimates (0-1).
    Hybrid: 70% uncertainty-based + 30% vignette-count based
    Higher = more reliable preferences
    """

    n_vignettes_completed: int = Field(default=0, ge=0)
    """Number of vignettes completed during elicitation"""

    per_dimension_uncertainty: dict[str, float] = Field(default_factory=dict)
    """
    Uncertainty (variance) for each dimension from Bayesian posterior.
    Lower values = more certain about that dimension
    """

    # ========== BAYESIAN METADATA (for advanced algorithms) ==========

    posterior_mean: list[float] = Field(default_factory=lambda: [0.0] * 7)
    """Raw Bayesian posterior mean vector (7 dimensions, unconstrained scale)"""

    posterior_covariance_diagonal: list[float] = Field(default_factory=lambda: [1.0] * 7)
    """Diagonal of posterior covariance matrix (variances per dimension)"""

    fim_determinant: Optional[float] = None
    """Fisher Information Matrix determinant (measure of total information gain)"""

    # ========== QUALITATIVE INSIGHTS (LLM-extracted) ==========

    decision_patterns: dict[str, Any] = Field(default_factory=dict)
    """
    Patterns in how user makes decisions (extracted from reasoning).
    Examples: "mentions_family_frequently", "uses_financial_language", "career_growth_focused"
    """

    tradeoff_willingness: dict[str, bool] = Field(default_factory=dict)
    """
    Explicit tradeoffs user is willing/unwilling to make.
    Examples: "will_sacrifice_salary_for_flexibility", "will_not_compromise_work_life_balance"
    """

    values_signals: dict[str, bool] = Field(default_factory=dict)
    """
    Deep values expressed in user's reasoning (beyond job attributes).
    Examples: "altruistic", "purpose_driven", "family_provider", "autonomy_seeking"
    """

    consistency_indicators: dict[str, float] = Field(default_factory=dict)
    """
    Consistency in user's responses (0-1 scale).
    Examples: "response_consistency", "conviction_strength", "preference_stability"
    """

    extracted_constraints: dict[str, Any] = Field(default_factory=dict)
    """
    Hard constraints mentioned explicitly (not inferred from vignette values).
    Examples: "must_work_remotely", "cannot_work_weekends", "needs_job_in_nairobi"
    NOTE: Only added if user EXPLICITLY states them, NOT inferred from choices
    """

    # ========== HARD CONSTRAINTS (optional, for future filtering) ==========
    # These are ABSOLUTE requirements, not learned from vignettes

    concrete_salary_min: Optional[float] = None
    """The lowest base salary the worker will accept (explicit requirement)"""

    concrete_work_location_type: Optional[WorkLocationType] = None
    """Remote, OnSite, Hybrid (explicit requirement)"""

    concrete_occupation_codes: Optional[List[str]] = None
    """Which roles are they looking for? (explicit requirement)"""

    concrete_contract_type: Optional[ContractType] = None
    """Full-Time, Part-Time, Gig, Internship (explicit requirement)"""

    concrete_relocation: Optional[bool] = None
    """True/False: Willing to move? (explicit requirement)"""

    concrete_travel_percent: Optional[int] = None
    """Max % of travel willing to tolerate 0-100 (explicit requirement)"""

    # ========== TIMESTAMPS ==========

    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """Timestamp of last update to preference data"""

    class Config:
        extra = "forbid"
        use_enum_values = True

    # Serialize the last_updated datetime to ensure it's stored as UTC
    @field_serializer("last_updated")
    def serialize_last_updated(self, last_updated: datetime) -> str:
        return last_updated.isoformat()

    # Deserialize the last_updated datetime and ensure it's interpreted as UTC
    @field_validator("last_updated", mode='before')
    def deserialize_last_updated(cls, value: str | datetime) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
