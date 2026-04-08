from pydantic import BaseModel


class ProgrammeSkill(BaseModel):
    """A single ESCO skill stored against a programme."""
    UUID: str
    originUUID: str
    preferredLabel: str
    altLabels: list[str]
    skillType: str
    modelId: str


class ProgrammeSkillsDocument(BaseModel):
    """The document stored in the programme_skills collection."""
    programme_name: str
    skills: list[ProgrammeSkill]


class ProgrammeSkillsResponse(BaseModel):
    """Response returned to the frontend — preferred labels only for now."""
    skills: list[str]
