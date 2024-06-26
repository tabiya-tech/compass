from typing import Optional, List

from pydantic import BaseModel

from app.vector_search.esco_entities import OccupationSkillEntity, SkillEntity


class ExperienceState(BaseModel):
    """
    A class to represent a work experience (formal, informal or unseen economy).
    """

    # The job title as referred by the user (i.e. not necessarily the official ESCO occupation label)
    job_title: str
    # The occupation records in the ESCO db that we think are related to this experience
    esco_occupations: Optional[List[OccupationSkillEntity]] = []
    # TODO: Add more fields, especially the skills. Also decide whether we want skills to be directly connected to
    #  each occupation or not.
    top_skills: Optional[List[SkillEntity]] = []
