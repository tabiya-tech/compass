from enum import Enum
from typing import Optional, List

from pydantic import BaseModel


class WorkLocationType(str, Enum):
    REMOTE = "Remote"
    ONSITE = "OnSite"
    HYBRID = "Hybrid"


class ContractType(str, Enum):
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    GIG = "Gig"
    INTERNSHIP = "Internship"


class JobPreferences(BaseModel):
    """
    Job preferences for a user session.
    TODO: (preliminary types adjust this schema as needed)
    """

    session_id: int
    """
    Compass user session ID
    """

    preference_work_location_type: WorkLocationType
    """
    Remote, OnSite, Hybrid. (Critical filter)
    """

    preference_salary_min: float
    """
    The lowest base salary the worker will accept
    """

    preference_occupation_codes: List[str]
    """
    Which roles are they looking for? (May differ from history)
    """

    preference_contract_type: ContractType
    """
    Full-Time, Part-Time, Gig, Internship
    """

    preference_relocation: Optional[bool] = None
    """
    True/False: Willing to move?
    """

    preference_travel_percent: Optional[int] = None
    """
    Max % of travel willing to tolerate (0-100)
    """

    preference_shift_availability: Optional[str] = None
    """
    Day, Night, Weekends
    """

    task_content: Optional[str] = None
    """
    Routine, Mixed, Creative
    """

    physical_demand: Optional[str] = None
    """
    Light, Heavy
    """

    work_flexibility: Optional[str] = None
    """
    Fixed, Some flexibility, High flexibility
    """

    social_interaction: Optional[str] = None
    """
    Mostly working alone, Mostly working with others
    """

    career_growth: Optional[str] = None
    """
    Low, Medium, High
    """

    social_meaning: Optional[str] = None
    """
    Low, High
    """

    class Config:
        extra = "forbid"
        use_enum_values = True
