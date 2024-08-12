from typing import List, Literal, Protocol, Any

from pydantic.main import BaseModel


class BaseEntity(BaseModel):
    """
    Represents an entity.
    """
    id: str
    UUID: str
    preferredLabel: str
    altLabels: List[str]
    description: str
    score: float


class OccupationEntity(BaseEntity):
    """
    Represents an occupation entity.
    """
    code: str

    def __init__(self, **data: Any):
        super().__init__(**data)

    def __str__(self):
        return self.preferredLabel


class SkillEntity(BaseEntity):
    """
    Represents a skill entity.
    """
    skillType: Literal['skill/competence', 'knowledge', 'language', 'attitude', '']

    def __init__(self, **data: Any):
        super().__init__(**data)

    def __str__(self):
        return self.preferredLabel


class AssociatedSkillEntity(SkillEntity):
    """
    Represents a skill entity associated with an occupation.
    """
    relationType: Literal['essential', 'optional']

    def __init__(self, **data: Any):
        super().__init__(**data)

    def __str__(self):
        return self.preferredLabel


class OccupationSkillEntity(BaseModel):
    """
    Represents an occupation and its associated skills.
    """
    occupation: OccupationEntity
    associated_skills: List[AssociatedSkillEntity]
