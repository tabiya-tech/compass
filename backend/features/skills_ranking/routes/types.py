from datetime import datetime

from pydantic import BaseModel, field_serializer, field_validator

from features.skills_ranking.service.types import SkillsRankingPhaseName, SkillsRankingScore, SkillRankingExperimentGroup, SkillsRankingPhase


class UpsertSkillsRankingRequest(BaseModel):
    """
    Upsert Skills Ranking Request — The request to upsert the skills ranking state.
    """
    phase: SkillsRankingPhaseName | None = None
    """
    The phase of the skills ranking process.
    """
    cancelled_after: str | None = None
    """
    Represents the proof_of_value spent by the user before they cancelled the skills ranking process.
    """
    succeeded_after: str | None = None
    """
    Represents the proof_of_value spent by the user after they succeeded in the skills ranking process.
    """
    puzzles_solved: int | None = None
    """
    The number of puzzles the user solved for the proof_of_value task.
    """
    correct_rotations: int | None = None
    """
    The number of characters the user rotated correctly for the proof_of_value task.
    """
    clicks_count: int | None = None
    """
    The number of clicks the user made during the proof_of_value task.
    """
    perceived_rank_percentile: float | None = None
    """
    The percentile rank the user thinks they have (0-100).
    """
    retyped_rank_percentile: float | None = None
    """
    The rank the user retyped to confirm they saw it correctly (0-100).
    """


class SkillsRankingStateResponse(BaseModel):
    """
    Skills Ranking State — The state of the skills ranking process.
    """

    session_id: int
    """
    session id - the session ranking will be made on
    """

    experiment_group: SkillRankingExperimentGroup
    """
    the group the user is assigned for each experiment branch
    """

    phase: list[SkillsRankingPhase]
    """
    The full phase history of the skills ranking process.
    """

    score: SkillsRankingScore
    """
    The score given to the user as compared to other job seekers and the job market.
    """

    cancelled_after: str | None = None
    """
    Represents the proof_of_value spent by the user before they cancelled the skills ranking process.
    Can be time in ms or a string indicating the proof_of_value type (e.g., "typed 4 characters").
    """

    succeeded_after: str | None = None
    """
    Represents the proof_of_value spent by the user after they succeeded in the skills ranking process.
    Can be time in ms or a string indicating the proof_of_value type (e.g., "typed 4 characters").
    """

    puzzles_solved: int | None = None
    """
    The number of puzzles the user solved for the proof_of_value task.
    """

    correct_rotations: int | None = None
    """
    The number of characters the user rotated correctly for the proof_of_value task.
    """

    clicks_count: int | None = None
    """
    The number of clicks the user made during the proof_of_value task.
    """

    perceived_rank_percentile: float | None = None
    """
    The percentile rank the user thinks they have (0-100)
    """

    retyped_rank_percentile: float | None = None
    """
    The rank the user retyped to confirm they saw it correctly (0-100)
    """

    started_at: datetime
    """
    The time the skills ranking process started, in ISO format, in UTC.
    """

    completed_at: datetime | None = None
    """
    The time the skills ranking process completed, in ISO format, in UTC.
    """

    # use a field serializer to serialize the experiment_group
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("experiment_group")
    def serialize_experiment_group(self, experiment_group: SkillRankingExperimentGroup, _info):
        return experiment_group.name

    # Deserialize the experiment_group from the enum name
    @field_validator("experiment_group", mode='before')
    def deserialize_experiment_group(cls, value: str | SkillRankingExperimentGroup) -> SkillRankingExperimentGroup:
        if isinstance(value, str):
            return SkillRankingExperimentGroup[value]
        return value
