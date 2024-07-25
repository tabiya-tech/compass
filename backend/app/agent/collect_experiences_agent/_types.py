from typing import Optional

from pydantic import BaseModel

from app.agent.experience.work_type import WorkType


class CollectedData(BaseModel):
    """
    A model for the collected data of the CollectExperiencesAgent.
    The data collected during the conversation and store in the agents state.

    The values are to interpreted as follows:
    - None: The value was not provided because it was not explicitly asked.
    - "": The user was asked for the value, but the user did not provide it.
    - "value": The user provided the value.
    """
    index: int
    defined_at_turn_number: Optional[int] = -1
    """
    The conversation turn index at which the experience was defined.
    This is used to link the experience to the conversation history and help the data extraction llm to connect the dots.
    To Be Clarified if it should be used when comparing experiences. 
    """
    experience_title: Optional[str]
    company: Optional[str]
    location: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    paid_work: Optional[bool | str]
    work_type: Optional[str]

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"

    @staticmethod
    def compare_relaxed(item1: 'CollectedData', item2: 'CollectedData'):
        return (item1.experience_title == item2.experience_title and
                item1.work_type == item2.work_type and
                (item1.start_date == item2.start_date or item1.start_date == "" or item2.start_date == "") and
                (item1.end_date == item2.end_date or item1.end_date == "" or item2.end_date == "") and
                (item1.company == item2.company or item1.company == "" or item2.company == "") and
                (item1.location == item2.location or item1.location == "" or item2.location == ""))

    @staticmethod
    def all_fields_empty(experience: 'CollectedData'):
        return all([experience.experience_title == "" or experience.experience_title is None,
                    experience.start_date == "" or experience.start_date is None,
                    experience.end_date == "" or experience.end_date is None,
                    experience.company == "" or experience.company is None,
                    experience.location == "" or experience.location is None,
                    ])
