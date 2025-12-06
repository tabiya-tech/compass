"""
Data models for the Preference Elicitation Agent.

This module defines the core data structures used to represent user preferences,
vignettes, and related configuration for the preference elicitation process.
"""

from typing import Any, Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator, field_serializer


class FinancialPreferences(BaseModel):
    """
    User preferences related to financial compensation.

    Captures salary expectations, benefits valuation, and willingness
    to trade salary for other job attributes.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of financial compensation (0.0-1.0)"""

    minimum_acceptable_salary: Optional[int] = None
    """Minimum acceptable monthly salary in KES"""

    preferred_salary_range_min: Optional[int] = None
    """Preferred minimum monthly salary in KES"""

    preferred_salary_range_max: Optional[int] = None
    """Preferred maximum monthly salary in KES"""

    benefits_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of benefits (NHIF, NSSF, leave) vs cash salary"""

    bonus_commission_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Tolerance for variable income (commission/bonus-based pay)"""

    salary_trade_offs: dict[str, int] = Field(default_factory=dict)
    """Amount willing to trade for other factors, e.g., {"remote_work": 10000}"""

    class Config:
        extra = "forbid"


class WorkEnvironmentPreferences(BaseModel):
    """
    User preferences related to work environment and conditions.

    Includes physical environment, location, autonomy, and work arrangements.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of work environment (0.0-1.0)"""

    remote_work_preference: Literal["strongly_prefer", "prefer", "neutral", "prefer_office", "strongly_prefer_office"] = "neutral"
    """Preference for remote vs office work"""

    commute_tolerance_minutes: Optional[int] = None
    """Maximum acceptable commute time in minutes"""

    physical_demands_tolerance: Literal["high", "medium", "low"] = "medium"
    """Tolerance for physically demanding work"""

    work_hours_flexibility_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of flexible work hours"""

    autonomy_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of independence and autonomy in work"""

    supervision_preference: Literal["close", "moderate", "minimal"] = "moderate"
    """Preferred level of supervision"""

    team_size_preference: Optional[Literal["solo", "small", "medium", "large"]] = None
    """Preferred team size"""

    work_pace_preference: Literal["fast_paced", "moderate", "steady"] = "moderate"
    """Preferred work pace"""

    class Config:
        extra = "forbid"


class JobSecurityPreferences(BaseModel):
    """
    User preferences related to job security and stability.

    Captures risk tolerance, income stability needs, and employment type preferences.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of job security (0.0-1.0)"""

    income_stability_required: bool = True
    """Whether stable, predictable income is required"""

    contract_type_preference: Literal["permanent", "contract", "freelance", "no_preference"] = "no_preference"
    """Preferred employment contract type"""

    risk_tolerance: Literal["high", "medium", "low"] = "medium"
    """Tolerance for job/income uncertainty"""

    entrepreneurial_interest: float = Field(default=0.5, ge=0.0, le=1.0)
    """Interest in entrepreneurship/self-employment"""

    class Config:
        extra = "forbid"


class CareerAdvancementPreferences(BaseModel):
    """
    User preferences related to career growth and development.

    Includes learning opportunities, skill development, and promotion aspirations.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of career advancement (0.0-1.0)"""

    learning_opportunities_value: Literal["very_high", "high", "medium", "low"] = "medium"
    """Value placed on learning and training opportunities"""

    skill_development_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of developing new skills"""

    promotion_path_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of clear promotion/advancement path"""

    time_horizon: Literal["short_term", "medium_term", "long_term"] = "medium_term"
    """Career planning time horizon"""

    management_aspirations: bool = False
    """Interest in managing/supervising others"""

    class Config:
        extra = "forbid"


class WorkLifeBalancePreferences(BaseModel):
    """
    User preferences related to work-life balance.

    Captures tolerance for long hours, weekend work, and family time importance.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of work-life balance (0.0-1.0)"""

    max_acceptable_hours_per_week: Optional[int] = None
    """Maximum acceptable work hours per week"""

    weekend_work_tolerance: Literal["acceptable", "occasional_only", "unacceptable"] = "occasional_only"
    """Tolerance for working weekends"""

    evening_work_tolerance: Literal["acceptable", "occasional_only", "unacceptable"] = "occasional_only"
    """Tolerance for working evenings"""

    family_time_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of time with family"""

    personal_time_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of personal time and hobbies"""

    class Config:
        extra = "forbid"


class TaskPreferences(BaseModel):
    """
    User preferences related to types of tasks and work activities.

    Captures preferences for different task types based on cognitive,
    physical, and social dimensions.
    """
    routine_tasks_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Tolerance for repetitive, routine tasks"""

    cognitive_tasks_preference: float = Field(default=0.5, ge=0.0, le=1.0)
    """Preference for analytical, problem-solving tasks"""

    manual_tasks_preference: float = Field(default=0.5, ge=0.0, le=1.0)
    """Preference for hands-on, physical tasks"""

    social_tasks_preference: float = Field(default=0.5, ge=0.0, le=1.0)
    """Preference for tasks involving interaction with people"""

    creative_tasks_preference: float = Field(default=0.5, ge=0.0, le=1.0)
    """Preference for creative, innovative tasks"""

    detail_oriented_work_preference: float = Field(default=0.5, ge=0.0, le=1.0)
    """Preference for detail-oriented, precise work"""

    class Config:
        extra = "forbid"


class SocialImpactPreferences(BaseModel):
    """
    User preferences related to social impact and purpose.

    Captures importance of helping others, community contribution,
    and purpose-driven work.
    """
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Overall importance of social impact (0.0-1.0)"""

    helping_others_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of helping others through work"""

    community_contribution_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of contributing to community"""

    purpose_driven_work_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    """Importance of meaningful, purpose-driven work"""

    class Config:
        extra = "forbid"


class PreferenceVector(BaseModel):
    """
    Complete preference vector representing user's job/career preferences.

    This is the main output of the preference elicitation process,
    containing structured preferences across all dimensions.
    """
    financial: FinancialPreferences = Field(default_factory=FinancialPreferences)
    """Financial compensation preferences"""

    work_environment: WorkEnvironmentPreferences = Field(default_factory=WorkEnvironmentPreferences)
    """Work environment and conditions preferences"""

    job_security: JobSecurityPreferences = Field(default_factory=JobSecurityPreferences)
    """Job security and stability preferences"""

    career_advancement: CareerAdvancementPreferences = Field(default_factory=CareerAdvancementPreferences)
    """Career growth and development preferences"""

    work_life_balance: WorkLifeBalancePreferences = Field(default_factory=WorkLifeBalancePreferences)
    """Work-life balance preferences"""

    task_preferences: TaskPreferences = Field(default_factory=TaskPreferences)
    """Task type preferences"""

    social_impact: SocialImpactPreferences = Field(default_factory=SocialImpactPreferences)
    """Social impact and purpose preferences"""

    industry_preferences: list[str] = Field(default_factory=list)
    """Optional: Preferred industries (e.g., ["technology", "education"])"""

    occupation_preferences: list[str] = Field(default_factory=list)
    """Optional: Preferred occupation types"""

    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """Timestamp of last update to preference vector"""

    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    """Confidence score based on number of vignettes completed and consistency"""

    class Config:
        extra = "forbid"

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


class VignetteOption(BaseModel):
    """
    A single option within a vignette scenario.

    Represents one job/scenario choice with specific attributes.
    """
    option_id: str
    """Unique identifier for this option (e.g., "A", "B")"""

    title: str
    """Short title for the option (e.g., "Sales Manager at Tech Startup")"""

    description: str
    """Detailed description of the option"""

    attributes: dict[str, Any]
    """Structured attributes of this option (e.g., {"salary": 80000, "location": "remote"})"""

    class Config:
        extra = "forbid"


class Vignette(BaseModel):
    """
    A vignette scenario used for preference elicitation.

    Presents a realistic choice scenario to reveal user preferences.
    """
    vignette_id: str
    """Unique identifier for this vignette"""

    category: str
    """Category of preferences tested (e.g., "financial", "work_environment", "job_security")"""

    scenario_text: str
    """Introduction/setup text for the scenario"""

    options: list[VignetteOption]
    """List of options to choose from (typically 2-4)"""

    follow_up_questions: list[str] = Field(default_factory=list)
    """Optional follow-up probe questions"""

    targeted_dimensions: list[str] = Field(default_factory=list)
    """Specific preference dimensions this vignette targets"""

    difficulty_level: Literal["easy", "medium", "hard"] = "medium"
    """Difficulty of trade-off (easy = clear winner, hard = balanced options)"""

    class Config:
        extra = "forbid"


class VignetteResponse(BaseModel):
    """
    User's response to a vignette.

    Captures their choice, reasoning, and extracted preference signals.
    """
    vignette_id: str
    """ID of the vignette responded to"""

    chosen_option_id: str
    """ID of the option chosen (e.g., "A", "B")"""

    user_reasoning: str
    """User's explanation of their choice"""

    extracted_preferences: dict[str, Any]
    """Preference signals extracted from this response"""

    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    """Confidence in the extraction (based on clarity of response)"""

    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """When the response was given"""

    class Config:
        extra = "forbid"

    # Serialize the timestamp datetime to ensure it's stored as UTC
    @field_serializer("timestamp")
    def serialize_timestamp(self, timestamp: datetime) -> str:
        return timestamp.isoformat()

    # Deserialize the timestamp datetime and ensure it's interpreted as UTC
    @field_validator("timestamp", mode='before')
    def deserialize_timestamp(cls, value: str | datetime) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class UserContext(BaseModel):
    """
    User context extracted from experiences and profile.

    Used to personalize vignettes to be relevant to the user's background,
    industry, and career level.
    """
    current_role: Optional[str] = None
    """Current or most recent job role (e.g., "Software Developer", "Teacher")"""

    industry: Optional[str] = None
    """Industry/sector (e.g., "Technology", "Education", "Retail")"""

    experience_level: Literal["entry", "junior", "mid", "senior", "expert"] = "junior"
    """Career experience level"""

    key_experiences: list[str] = Field(default_factory=list)
    """Key past experiences or employers"""

    background_summary: Optional[str] = None
    """Brief summary of professional background"""

    class Config:
        extra = "forbid"


class VignetteTemplate(BaseModel):
    """
    Template for generating personalized vignettes.

    Defines the trade-off dimensions and constraints, but job-specific
    content is generated dynamically based on user context.
    """
    template_id: str
    """Unique identifier for this template"""

    category: str
    """Preference category (e.g., "financial", "work_environment")"""

    trade_off: dict[str, str]
    """Trade-off dimensions being tested (e.g., {"dimension_a": "job_security", "dimension_b": "flexibility"})"""

    option_a: dict[str, Any]
    """Template for option A with high/low dimensions and attributes"""

    option_b: dict[str, Any]
    """Template for option B with high/low dimensions and attributes"""

    follow_up_prompts: list[str] = Field(default_factory=list)
    """Templates for follow-up questions (may include placeholders)"""

    targeted_dimensions: list[str] = Field(default_factory=list)
    """Specific preference dimensions this template targets"""

    difficulty_level: Literal["easy", "medium", "hard"] = "medium"
    """Difficulty of trade-off"""

    class Config:
        extra = "forbid"


class PersonalizedVignette(BaseModel):
    """
    A vignette personalized to a specific user's context.

    Generated from a VignetteTemplate but with job-specific content
    tailored to the user's background.
    """
    template_id: str
    """ID of the template this was generated from"""

    vignette: Vignette
    """The actual personalized vignette"""

    generation_context: dict[str, Any] = Field(default_factory=dict)
    """Context used for generation (for debugging/logging)"""

    class Config:
        extra = "forbid"
