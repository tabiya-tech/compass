from typing import List, Optional
import uuid

from pydantic.main import BaseModel

from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity


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

    contextual_title: Optional[str] = None
    """
    Title of the experience that is based on the experience title 
    and the additional context the user provided (e.g. "Fast Food Restaurant Staff")
    """

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

    mentioned_tasks_and_skills: List[str] = []
    """
    List of tasks and skills mentioned by the user while describing the experience
    It may contain duplicate entries as the user may mention the same task or skill multiple times
    """

    esco_occupations: List[OccupationSkillEntity] = []
    """
    List of esco occupations and their skills (from the esco model) that match the experience.
    It should not contain duplicates.
    """

    top_skills: List[SkillEntity] = []
    """
    List of skills identified as relevant to the experience.
    It should not contain duplicates.
    """

    def __init__(self, *,
                 experience_title: str,
                 company: Optional[str] = None,
                 location: Optional[str] = None,
                 timeline: Optional[Timeline] = None,
                 work_type: Optional[WorkType] = None):
        super().__init__(
            uuid=str(uuid.uuid4()),  # Generate a unique UUID for each instance
            experience_title=experience_title, company=company, location=location, timeline=timeline,
            work_type=work_type
        )
