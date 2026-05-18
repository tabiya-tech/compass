"""Response models for the job-demand analytics endpoint."""
from pydantic import BaseModel


class JobDemandEntry(BaseModel):
    """A single in-demand skill aggregated across job postings."""

    skill_label: str
    jobs_count: int

    class Config:
        """Pydantic config."""

        extra = "forbid"


class JobDemandStatsResponse(BaseModel):
    """Aggregated job-demand stats. ``total_jobs`` /
    ``jobs_with_linked_skills`` back the coverage caption."""

    total_jobs: int
    jobs_with_linked_skills: int
    top_skills_in_demand: list[JobDemandEntry]

    class Config:
        """Pydantic config."""

        extra = "forbid"
