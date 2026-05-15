from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedListMeta(BaseModel):
    limit: int
    next_cursor: Optional[str] = None
    has_more: bool
    total: Optional[int] = None


class PaginatedListResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: PaginatedListMeta


class Institution(BaseModel):
    id: str
    name: str
    active: bool = True
    students: Optional[int] = None
    active_7_days: Optional[int] = None
    skills_discovery_started_pct: Optional[float] = None
    skills_discovery_completed_pct: Optional[float] = None
    career_readiness_started_pct: Optional[float] = None
    career_readiness_completed_pct: Optional[float] = None
    career_explorer_started_pct: Optional[float] = None


class User(BaseModel):
    id: str
    name: Optional[str] = None
    institution: Optional[str] = None
    province: Optional[str] = None
    programme: Optional[str] = None
    year: Optional[str] = None
    gender: Optional[str] = None
    active: bool = True
    modules_explored: Optional[int] = None
    career_readiness_modules_explored: Optional[int] = None
    skills_interests_explored: Optional[int] = None
    skills_discovery_status: Optional[str] = None  # "not_started" | "in_progress" | "completed"
    career_explorer_messages_sent: Optional[int] = None
    last_login: Optional[str] = None
    last_active_module: Optional[str] = None


class AdoptionTrendPoint(BaseModel):
    date: str
    new_registrations: int
    daily_active_users: int


class AdoptionTrendsMeta(BaseModel):
    start_date: str
    end_date: str
    interval: str


class AdoptionTrendsResponse(BaseModel):
    data: list[AdoptionTrendPoint]
    meta: AdoptionTrendsMeta


class DashboardStats(BaseModel):
    institutions_active: int
    total_students: int
    active_students_7_days: int


class InstitutionFilterOptions(BaseModel):
    institution_names: list[str]
    provinces: list[str]
    sectors: list[str]
