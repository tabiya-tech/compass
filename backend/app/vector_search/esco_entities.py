from typing import List, Literal

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
    score: float


class SkillEntity(BaseModel):
    """
    Represents a skill entity.
    """
    id: str
    UUID: str
    preferredLabel: str
    description: str
    altLabels: List[str]
    skillType: Literal['skill/competence', 'knowledge', 'language', 'attitude']
    score: float

    def __str__(self):
        return self.preferredLabel


class AssociatedSkillEntity(SkillEntity):
    """
    Represents a skill entity associated with an occupation.
    """
    relationType: Literal['essential', 'optional']

    def __str__(self):
        return self.preferredLabel


class OccupationSkillEntity(BaseModel):
    """
    Represents an occupation and its associated skills.
    """
    occupation: OccupationEntity
    associated_skills: List[AssociatedSkillEntity]
