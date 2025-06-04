import uuid
from pydantic import BaseModel, Field, field_serializer
from typing import List, Optional
from app.agent.experience.work_type import WorkType


class NewSessionResponse(BaseModel):
    """
    The response to a new session request
    """
    session_id: int
    """The session id for the new session"""

    class Config:
        extra = "forbid"


class Skill(BaseModel):
    """
    A skill
    """
    UUID: str = Field(default_factory=lambda: str(uuid.uuid4()))
    """The UUID of the skill"""
    preferredLabel: str
    """The preferred label of the skill"""
    description: str
    """The description of the skill"""
    altLabels: List[str]
    """Alternative labels of the skill"""

    class Config:
        extra = "forbid"


class Experience(BaseModel):
    """
    A simplified version of ExperienceEntity for a response
    """
    UUID: str = Field(default_factory=lambda: str(uuid.uuid4()))
    """The UUID of the experience"""

    experience_title: str
    """The title of the experience"""

    start_date: Optional[str] = None
    """The start date of the experience"""

    end_date: Optional[str] = None
    """The end date of the experience"""

    company: Optional[str] = None
    """The company of the experience"""

    location: Optional[str] = None
    """The location of the experience"""

    work_type: Optional[WorkType] = None
    """The work type of the experience"""

    top_skills: List[Skill] = Field(default_factory=list)
    """The top skills of the experience"""

    summary: Optional[str] = None
    """A summary of the experience"""

    @field_serializer("work_type")
    def serialize_group(self, work_type: WorkType, _info):
        # If work_type is None, return None to avoid serialization error
        if work_type is None:
            return None

        return work_type.name

    class Config:
        extra = "forbid"
