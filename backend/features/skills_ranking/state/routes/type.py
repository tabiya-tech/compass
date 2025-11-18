from pydantic import BaseModel

from features.skills_ranking.state.services.type import (
    ApplicationWillingness,
    SkillsRankingPhaseName,
    SkillsRankingScore,
    SkillsRankingPhase,
    ProcessMetadata,
    UserResponses,
)


class MetadataUpdate(BaseModel):
    cancelled_after: str | None = None
    succeeded_after: str | None = None
    puzzles_solved: int | None = None
    correct_rotations: int | None = None
    clicks_count: int | None = None


class UserResponsesUpdate(BaseModel):
    prior_belief_percentile: float | None = None
    prior_belief_for_skill_percentile: float | None = None
    perceived_rank_percentile: float | None = None
    perceived_rank_for_skill_percentile: float | None = None
    application_willingness: ApplicationWillingness | None = None
    application_24h: int | None = None
    opportunity_skill_requirement_percentile: float | None = None


class UpsertSkillsRankingRequest(BaseModel):
    phase: SkillsRankingPhaseName | None = None
    metadata: MetadataUpdate | None = None
    user_responses: UserResponsesUpdate | None = None


class SkillsRankingStateResponse(BaseModel):
    phase: list[SkillsRankingPhase]
    metadata: ProcessMetadata
    score: SkillsRankingScore
    user_responses: UserResponses
