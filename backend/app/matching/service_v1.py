from typing import Optional, List
from pydantic import BaseModel, Field, RootModel

from app.matching.client import MatchingServiceClient
from app.matching.service import MatchingService
from app.matching.matching_types import SkillsVector, PreferenceVector, CompassMatchingResult, MatchingAlgorithmVersion, \
    MatchingRequest, CompassOccupation, CompassOpportunity, CompassSkillGap


class PHatComponents(BaseModel):
    gate: float = 0.0
    essential_fit: float = 0.0
    recruiter_readiness: float = 0.0
    market_opportunity: float = 0.0


class OptionalSkillMatch(BaseModel):
    skill_id: str
    skill_label: Optional[str] = None


class SkillComponents(BaseModel):
    loc: float
    ess: float
    opt: float
    grp: float


class SkillGroupMatch(BaseModel):
    skill_group_id: str
    skill_group_label: Optional[str] = None


class MatchedSkill(BaseModel):
    job_skill_id: str
    job_skill_label: Optional[str] = None
    best_user_skill_id: Optional[str] = None
    best_user_skill_label: Optional[str] = None
    similarity: float
    meets_threshold: bool


class MatchedSkills(BaseModel):
    essential_skill_matches: List[MatchedSkill] = Field(default_factory=list)
    optional_exact_matches: List[OptionalSkillMatch] = Field(default_factory=list)
    skill_group_matches: List[SkillGroupMatch] = Field(default_factory=list)


class MatchedSkills(BaseModel):
    essential_skill_matches: List[MatchedSkill] = Field(default_factory=list)
    optional_exact_matches: List[OptionalSkillMatch] = Field(default_factory=list)
    skill_group_matches: List[SkillGroupMatch] = Field(default_factory=list)


class MatchedWorkActivity(BaseModel):
    wa_code: str
    wa_label: Optional[str] = None
    user_bws: float
    wa_importance: float
    wa_level: float
    norm_importance: float
    norm_level: float
    wa_contribution: float


class ScoreBreakdown(BaseModel):
    # --- Multiplicative (paper-aligned) fields ---
    u_hat: Optional[float] = None
    p_hat: Optional[float] = None
    p_hat_components: Optional[PHatComponents] = None
    # --- Legacy additive fields ---
    total_skill_utility: Optional[float] = None
    skill_components: Optional[SkillComponents] = None
    skill_diagnostics: Optional[SkillComponents] = None
    skill_penalty_applied: Optional[float] = None
    preference_score: Optional[float] = None
    preference_score_legacy: Optional[float] = None
    demand_score: Optional[float] = None
    demand_label: Optional[str] = None


class MatchedPreference(BaseModel):
    attribute: str
    job_value: Optional[str] = None
    job_value_label: Optional[str] = None
    user_weight: float
    beta: float
    encoded_value: float
    contribution: float
    matched: bool


class WorkActivityBWS(BaseModel):
    wa_score_sum: float = 0.0
    details: List[MatchedWorkActivity] = Field(default_factory=list)


class OccupationRecommendation(BaseModel):
    uuid: str
    originUuid: Optional[str] = None
    rank: int
    occupation_label: str
    province: Optional[str] = None
    is_eligible: bool
    justification: str
    occupation_description: Optional[str] = None
    final_score: float
    score_breakdown: ScoreBreakdown
    matched_skills: MatchedSkills
    matched_preferences: List[MatchedPreference] = Field(default_factory=list)
    matched_work_activities: Optional[WorkActivityBWS] = None


class OpportunityRecommendation(BaseModel):
    uuid: str
    URL: Optional[str] = None
    rank: int
    opportunity_title: str
    opportunity_isco_occupation_group: Optional[str] = None
    opportunity_isco_occupation_group_id: Optional[str] = None
    location: Optional[str] = None
    employer: Optional[str] = None
    employment_type: Optional[str] = None
    salary_text: Optional[str] = None
    required_education: Optional[str] = None
    required_experience: Optional[str] = None
    closing_date: Optional[str] = None
    is_eligible: bool
    justification: str
    opportunity_description: Optional[str] = None
    contract_type: Optional[str] = None
    final_score: float
    score_breakdown: ScoreBreakdown
    matched_skills: MatchedSkills
    matched_preferences: List[MatchedPreference] = Field(default_factory=list)
    matched_work_activities: Optional[WorkActivityBWS] = None


class SkillGapRecommendation(BaseModel):
    skill_id: str
    skill_label: str
    proximity_score: float
    job_unlock_count: int
    combined_score: float
    reasoning: str


class _Response(BaseModel):
    user_id: str
    occupation_recommendations: List[OccupationRecommendation] = Field(default_factory=list)
    opportunity_recommendations: List[OpportunityRecommendation] = Field(default_factory=list)
    skill_gap_recommendations: List[SkillGapRecommendation] = Field(default_factory=list)


class _ResponseList(RootModel[List[_Response]]):
    """The `/match` endpoint returns a list with one entry per user in the request.

    We always send a single user, so the list has at most one element.
    """


def _to_compass_occupation(occ: OccupationRecommendation) -> CompassOccupation:
    return CompassOccupation(
        uuid=occ.uuid,
        origin_uuid=occ.originUuid,
        rank=occ.rank,
        label=occ.occupation_label,
        description=occ.occupation_description,
        is_eligible=occ.is_eligible,
        final_score=occ.final_score,
        justification=occ.justification,
        province=occ.province,
        raw=occ.model_dump(),
    )


def _to_compass_opportunity(opp: OpportunityRecommendation) -> CompassOpportunity:
    matched_labels = [
        m.job_skill_label
        for m in opp.matched_skills.essential_skill_matches
        if m.job_skill_label
    ]
    return CompassOpportunity(
        uuid=opp.uuid,
        rank=opp.rank,
        opportunity_title=opp.opportunity_title,
        url=opp.URL,
        employer=opp.employer,
        location=opp.location,
        final_score=opp.final_score,
        is_eligible=opp.is_eligible,
        justification=opp.justification,
        description=opp.opportunity_description,
        contract_type=opp.contract_type,
        salary_text=opp.salary_text,
        matched_skill_labels=matched_labels,
        raw=opp.model_dump(),
    )


def _to_compass_skill_gap(gap: SkillGapRecommendation) -> CompassSkillGap:
    return CompassSkillGap(
        skill_id=gap.skill_id,
        skill_label=gap.skill_label,
        proximity_score=gap.proximity_score,
        job_unlock_count=gap.job_unlock_count,
        combined_score=gap.combined_score,
        reasoning=gap.reasoning,
    )


class MatchingServiceV1(MatchingService):
    def __init__(self, client: MatchingServiceClient):
        self._client = client

    @property
    def algorithm_version(self) -> MatchingAlgorithmVersion:
        return "v1"

    async def generate_recommendations(self,
                                       youth_id: str,
                                       city: Optional[str],
                                       province: Optional[str],
                                       skills_vector: SkillsVector,
                                       preference_vector: PreferenceVector) -> CompassMatchingResult:
        request = MatchingRequest(
            user_id=youth_id,
            city=city or "",
            province=province or "",
            skills_vector=skills_vector,
            preference_vector=preference_vector,
        )

        response = await self._client.process_request(_ResponseList, "/match", request)
        if not response.root:
            return CompassMatchingResult(user_id=youth_id, algorithm_version="v1")

        first = response.root[0]
        return CompassMatchingResult(
            user_id=first.user_id or youth_id,
            algorithm_version="v1",
            occupations=[_to_compass_occupation(o) for o in first.occupation_recommendations],
            opportunities=[_to_compass_opportunity(o) for o in first.opportunity_recommendations],
            skill_gaps=[_to_compass_skill_gap(g) for g in first.skill_gap_recommendations],
        )
