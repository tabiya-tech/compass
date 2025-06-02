from typing import List, Literal, Any

from pydantic import Field
from pydantic.main import BaseModel


class BaseEntity(BaseModel):
    """
    Represents an entity.
    """
    id: str
    # The modelId field was introduced later, so it may not exist in all documents
    # For the documents that don't have this field, we'll default to None,
    # Most likely, there will be no impact  for the conversation, however there is a slight chance that
    # conversations conducted before the introduction of this field may not be able to be retrieved or completed.
    # TODO: once all conversations have this field, we can remove this default value https://tabiya-tech.atlassian.net/browse/COM-477
    modelId: str = Field(default="")
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

    # TODO: remove it as it is not needed https://tabiya-tech.atlassian.net/browse/COM-476
    def __init__(self, **data: Any):
        super().__init__(**data)

    def __str__(self):
        return self.preferredLabel


class SkillEntity(BaseEntity):
    """
    Represents a skill entity.
    """
    skillType: Literal['skill/competence', 'knowledge', 'language', 'attitude', '']

    # TODO: remove it as it is not needed https://tabiya-tech.atlassian.net/browse/COM-476
    def __init__(self, **data: Any):
        super().__init__(**data)

    def __str__(self):
        return self.preferredLabel


class AssociatedSkillEntity(SkillEntity):
    """
    Represents a skill entity associated with an occupation.
    it can be either essential or optional. but also can be empty. when we have signaling values.
    for more info: check platform RelationType enum.
    """
    relationType: Literal['essential', 'optional', '']

    signallingValueLabel: Literal['', 'low', 'medium', 'high'] = ''  # default to empty string if not provided

    # TODO: remove it as it is not needed https://tabiya-tech.atlassian.net/browse/COM-476
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
