from typing import List

from pydantic.main import BaseModel


class OccupationEntity(BaseModel):
    """
    Represents an occupation entity.
    """
    id: str
    UUID: str
    preferredLabel: str
    code: str
    description: str
    altLabels: List[str]


class SkillEntity(BaseModel):
    """
    Represents a skill entity.
    """
    id: str
    UUID: str
    preferredLabel: str
    description: str
    altLabels: List[str]
    skillType: str
    relationType: str


class OccupationSkillEntity(BaseModel):
    """
    Represents an occupation and its associated skills.
    """
    occupation: OccupationEntity
    skills: List[SkillEntity]
