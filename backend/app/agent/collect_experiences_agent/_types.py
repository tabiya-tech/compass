import uuid
from typing import Optional

from pydantic import BaseModel, Field


class CollectedData(BaseModel):
    """
    A model for the collected data of the CollectExperiencesAgent.
    The data is collected during the conversation and stored in the agent's state.

    The values are interpreted as follows:
    - None: The value was not provided because it was not explicitly asked.
    - "": The user was asked for the value, but the user did not provide it.
    - Some value: The user provided the value.
    """
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    defined_at_turn_number: Optional[int] = -1
    """
    The conversation turn index at which the experience was defined.
    This is used to link the experience to the conversation history and help the data extraction llm to connect the dots.
    To Be Clarified if it should be used when comparing experiences. 
    """
    experience_title: Optional[str]
    company: Optional[str]
    # location: Optional[str]
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
                (item1.company == item2.company or item1.company == "" or item2.company == "") 
                # and (item1.location == item2.location or item1.location == "" or item2.location == "")
                )

    @staticmethod
    def all_fields_empty(experience: 'CollectedData'):
        return all([experience.experience_title == "" or experience.experience_title is None,
                    experience.start_date == "" or experience.start_date is None,
                    experience.end_date == "" or experience.end_date is None,
                    experience.company == "" or experience.company is None,
                    # experience.location == "" or experience.location is None,
                    ])

    @staticmethod
    def is_incomplete(experience: 'CollectedData') -> bool:
        """
        Check if an experience is incomplete (has some but not all required fields).
        An experience is considered incomplete if it has a title but is missing other important details.
        """
        if CollectedData.all_fields_empty(experience):
            return False  # Completely empty, not incomplete
        
        # Has a title but missing other important fields
        has_title = experience.experience_title and experience.experience_title.strip() != ""
        missing_important_fields = (
            (experience.start_date is None or experience.start_date.strip() == "") or
            (experience.end_date is None or experience.end_date.strip() == "") or
            (experience.company is None or experience.company.strip() == "") 
            # or (experience.location is None or experience.location.strip() == "")
        )
        
        return has_title and missing_important_fields

    @staticmethod
    def get_missing_fields(experience: 'CollectedData') -> list[str]:
        """
        Get a list of missing fields for an incomplete experience.
        Empty strings ("") mean the user explicitly declined to provide information, so they are not considered missing.
        Only None values indicate missing information that hasn't been asked for yet.
        """
        missing_fields = []

        if experience.experience_title is None:
            missing_fields.append("experience_title")
        if experience.start_date is None:
            missing_fields.append("start_date")
        if experience.end_date is None:
            missing_fields.append("end_date")
        if experience.company is None:
            missing_fields.append("company")
        # if experience.location is None:
        #     missing_fields.append("location")
            
        return missing_fields
