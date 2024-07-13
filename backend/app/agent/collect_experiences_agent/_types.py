from typing import Optional

from pydantic import BaseModel


class CollectedData(BaseModel):
    """
    A model for the collected data of the CollectExperiencesAgent.
    The data collected during the conversation and store in the agents state.
    """
    index: int
    experience_title: Optional[str] = ""
    company: Optional[str] = ""
    location: Optional[str] = ""
    start_date_calculated: Optional[str] = ""
    end_date_calculated: Optional[str] = ""
    work_type: Optional[str] = ""

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"
