from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, RootModel

from app.matching.client import MatchingServiceClient
from app.matching.service import MatchingService
from app.matching.matching_types import SkillsVector, PreferenceVector, CompassMatchingResult, MatchingAlgorithmVersion, \
    MatchingRequest, CompassOpportunity


class MatchV2JobRecommendation(BaseModel):
    rank: int
    job_uuid: str
    opportunity_title: str = ""
    employer: Optional[str] = None
    location: Optional[str] = None
    URL: Optional[str] = None
    fusion_score: float
    bm25_norm_within_candidates: Optional[float] = None
    cos_norm_within_candidates: Optional[float] = None
    mean_best_cosine_raw: Optional[float] = None
    bm25_score_raw: Optional[float] = None
    matched_skills: List[str] = Field(default_factory=list)
    matched_skills_cosine: List[str] = Field(default_factory=list)


class _Response(BaseModel):
    user_id: str
    n_jobs_scored: int
    hybrid_recommendations: List[MatchV2JobRecommendation]
    hybrid_config_summary: Dict[str, Any] = Field(default_factory=dict)


class _ResponseList(RootModel[List[_Response]]):
    """The `/match_v2` endpoint returns a list with one entry per user in the request.

    We always send a single user, so the list has at most one element.
    """


def _to_compass_opportunity(rec: MatchV2JobRecommendation) -> CompassOpportunity:
    return CompassOpportunity(
        uuid=rec.job_uuid,
        rank=rec.rank,
        opportunity_title=rec.opportunity_title,
        url=rec.URL,
        employer=rec.employer,
        location=rec.location,
        final_score=rec.fusion_score,
        matched_skill_labels=list(rec.matched_skills),
        raw=rec.model_dump(),
    )


class MatchingServiceV2(MatchingService):
    def __init__(self, client: MatchingServiceClient):
        self._client = client

    @property
    def algorithm_version(self) -> MatchingAlgorithmVersion:
        return "v2"

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

        response = await self._client.process_request(_ResponseList, "/match_v2", request)
        if not response.root:
            return CompassMatchingResult(user_id=youth_id, algorithm_version="v2")

        first = response.root[0]
        metadata: Dict[str, Any] = {"n_jobs_scored": first.n_jobs_scored}
        if first.hybrid_config_summary:
            metadata["hybrid_config_summary"] = first.hybrid_config_summary

        return CompassMatchingResult(
            user_id=first.user_id or youth_id,
            algorithm_version="v2",
            opportunities=[_to_compass_opportunity(r) for r in first.hybrid_recommendations],
            metadata=metadata,
        )
