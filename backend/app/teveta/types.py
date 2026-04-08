from typing import Optional
from pydantic import BaseModel


class CriticalSkill(BaseModel):
    sector: str
    subsector: Optional[str] = None
    occupation: str
    zqf: Optional[str] = None
    duration: Optional[str] = None
    qualification: Optional[str] = None
    urgency: Optional[str] = None
    matched_programmes: list[str] = []


class Programme(BaseModel):
    name: str
    qualification: Optional[str] = None
    zqf: Optional[str] = None
    domain: Optional[str] = None


class PriorityCurriculum(BaseModel):
    sector: str
    general_area: Optional[str] = None
    occupation: str
    status: Optional[str] = None
    ranking: Optional[str] = None
    comment: Optional[str] = None


class SectorData(BaseModel):
    sector: str
    institution_count: int
    programme_count: int
    critical_skills: list[CriticalSkill]
    programmes: list[Programme]
    priority_curriculum: list[PriorityCurriculum]
