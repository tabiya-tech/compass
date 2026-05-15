"""Shared matching-service response types.

A `CompassMatchingResult` is produced by both the v1 (`/match`) and v2 (`/match_v2`)
matching-service implementations so that consumers (jobs route, recommender agent)
do not need to know which endpoint was called.

The v2 endpoint returns only hybrid job recommendations (no occupations, no skill
gaps), so `occupations` and `skill_gaps` are simply empty when the result was
produced by the v2 service.
"""

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

MatchingAlgorithmVersion = Literal["v1", "v2"]


class Skill(BaseModel):
    preferred_label: str = Field(serialization_alias="preferredLabel")
    origin_uuid: str = Field(serialization_alias="originUUID")
    proficiency: float


class SkillsVector(BaseModel):
    top_skills: list[Skill]


class PreferenceVector(BaseModel):
    earnings_per_month: float
    task_content: Optional[float] = 0.0
    physical_demand: float
    work_flexibility: Optional[float] = 0.0
    social_interaction: float
    career_growth: float
    social_meaning: Optional[float] = 0.0
    bws_scores: Optional[dict] = None
    top_10_bws: Optional[List[str]] = None


class MatchingRequest(BaseModel):
    user_id: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    skills_vector: SkillsVector = Field(default_factory=SkillsVector)
    skill_groups_origin_uuids: List[str] = Field(default_factory=list)
    preference_vector: PreferenceVector


    def to_json(self) -> dict:
        return self.model_dump(exclude_none=True, by_alias=True)


class CompassOccupation(BaseModel):
    """Career-path recommendation (v1 only — v2 does not return occupations)."""

    uuid: str
    origin_uuid: Optional[str] = None
    rank: int
    label: str
    description: Optional[str] = None
    is_eligible: bool = True
    final_score: Optional[float] = None
    justification: Optional[str] = None
    province: Optional[str] = None

    raw: dict[str, Any] = Field(default_factory=dict)
    """Full original payload from the matching service for fields not surfaced above."""

    model_config = {"extra": "allow"}


class CompassOpportunity(BaseModel):
    """Job opportunity recommendation.

    Both v1 and v2 produce this. v2 sources `final_score` from `fusion_score`
    and `uuid` from `job_uuid`; v1-only fields (`justification`, `description`,
    `contract_type`, `salary_text`) are left None when produced by v2.
    """

    uuid: str
    rank: int
    opportunity_title: str = ""
    url: Optional[str] = None
    employer: Optional[str] = None
    location: Optional[str] = None
    final_score: Optional[float] = None
    is_eligible: bool = True
    justification: Optional[str] = None
    description: Optional[str] = None
    contract_type: Optional[str] = None
    salary_text: Optional[str] = None
    matched_skill_labels: list[str] = Field(default_factory=list)

    raw: dict[str, Any] = Field(default_factory=dict)
    """Full original payload from the matching service for fields not surfaced above."""

    model_config = {"extra": "allow"}


class CompassSkillGap(BaseModel):
    """Skill gap (v1 only — v2 does not return skill gaps)."""

    skill_id: str
    skill_label: str
    proximity_score: Optional[float] = None
    job_unlock_count: Optional[int] = None
    combined_score: Optional[float] = None
    reasoning: Optional[str] = None

    model_config = {"extra": "allow"}


class CompassMatchingResult(BaseModel):
    """Unified matching-service output produced by both v1 and v2 implementations."""

    user_id: str
    algorithm_version: MatchingAlgorithmVersion
    occupations: list[CompassOccupation] = Field(default_factory=list)
    opportunities: list[CompassOpportunity] = Field(default_factory=list)
    skill_gaps: list[CompassSkillGap] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    """Algorithm-specific extras (e.g. v2's hybrid_config_summary, n_jobs_scored)."""

    model_config = {"extra": "allow"}
