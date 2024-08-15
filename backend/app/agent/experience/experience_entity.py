from typing import List, Optional, Any
import uuid as uuidObj

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity


class ResponsibilitiesData(BaseModel):
    """
    A model for the collected data of the Skill Explorer Agent.
    The data are collected during the conversation and stored in the agent's state.
    They represent the following type of entities:
        - responsibilities:
        - skills
        - duties
        - tasks
        - actions
        - behaviour
        - activities
        - competencies
        - knowledge
    """

    responsibilities: list[str] = Field(default_factory=list)
    """
    Everything the user considers as part of what they do for a given job.
    """

    non_responsibilities: list[str] = Field(default_factory=list)
    """
    Everything the user considers as not part of what they do for a given job.
    """

    other_peoples_responsibilities: list[str] = Field(default_factory=list)
    """
    Everything the user considers as part of what other people do for a given job.
    """

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class ExperienceEntity(BaseModel):
    """
    A class to represent the entities extracted from the conversation with the user,
    that can be used in downstream tasks.
    """

    uuid: str
    """
    Unique identifier for the experience that allows to distinguish between different experiences..
    """

    experience_title: str
    """
    Title of the experience as the user refers to it (e.g. "Crew Member")
    """

    # contextual_title: Optional[str] = None  # TODO: replace with the cluster_results from the ExperiencePipelineResponse
    # """
    # Title of the experience that is based on the experience title
    # and the additional context the user provided (e.g. "Fast Food Restaurant Staff")
    # """

    company: Optional[str] = None
    """
    Company name (e.g. "at McDonald's")
    """

    location: Optional[str] = None
    """
    Location of the experience (e.g. "Cape Town, South Africa")
    """

    timeline: Optional[Timeline] = None
    """
    Start and end date of the experience
    """

    work_type: Optional[WorkType] = None
    """
    Type of work (e.g. "waged-employee")
    """

    responsibilities: ResponsibilitiesData
    """
    List of responsibilities mentioned by the user while describing the experience
    It may contain duplicate entries as the user may mention the same task or skill multiple times
    """

    esco_occupations: List[OccupationSkillEntity]  # TODO: replace with the cluster_results from the ExperiencePipelineResponse
    """
    List of esco occupations and their skills (from the esco model) that match the experience.
    It should not contain duplicates.
    """

    top_skills: List[SkillEntity]
    """
    List of skills identified as relevant to the experience.
    It should not contain duplicates.
    """

    class Config:
        extra = "forbid"

    # use a field serializer to serialize the work_type
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("work_type")
    def serialize_work_type(self, work_type: WorkType, _info):
        return work_type.name

    # Deserialize the work_type from the enum name
    @field_validator("work_type", mode='before')
    def deserialize_work_type(cls, value: Any) -> WorkType:
        if isinstance(value, str):
            return WorkType[value]
        return value

    def __init__(self, *,
                 experience_title: str,
                 company: Optional[str] = None,
                 location: Optional[str] = None,
                 timeline: Optional[Timeline] = None,
                 work_type: Optional[WorkType] = None,
                 uuid: Optional[str] = None, #TODO check this
                 responsibilities: Optional[ResponsibilitiesData] = None,
                 esco_occupations: Optional[List[OccupationSkillEntity]] = None,
                 top_skills: Optional[List[SkillEntity]] = None
                 ):
        super().__init__(
            uuid=uuid if uuid is not None else str(uuidObj.uuid4()),  # Generate a unique UUID for each instance
            experience_title=experience_title,
            company=company,
            location=location,
            timeline=timeline,
            work_type=work_type,
            responsibilities=responsibilities if responsibilities is not None else ResponsibilitiesData(),
            esco_occupations=esco_occupations if esco_occupations is not None else [],
            top_skills=top_skills if top_skills is not None else []
        )

    @staticmethod
    def get_text_summary(*, experience_title: str,
                         location: Optional[str] = None,
                         work_type: Optional[str] = None,
                         start_date: Optional[str] = None,
                         end_date: Optional[str] = None,
                         company: Optional[str] = None) -> str:
        date_part: str
        if start_date is not None and start_date != "":
            date_part = f", {start_date}" + f" - {end_date}" if end_date is not None and end_date != "" else ""
        else:
            date_part = f", until {end_date}" if end_date is not None and end_date != "" else ""
        company_part = f", {company}" if company is not None and company != "" else ""
        location_part = f", {location}" if location is not None and location != "" else ""
        work_type_part = f" ({WorkType.work_type_short(WorkType.from_string_key(work_type))})" if work_type is not None and work_type != "" else ""
        return experience_title + work_type_part + date_part + company_part + location_part + "\n"
