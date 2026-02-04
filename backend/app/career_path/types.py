from typing import List, Optional

from pydantic import BaseModel


class CareerPathStep(BaseModel):
    """
    A single step in a career path.
    # TODO: (preliminary types adjust this schema as needed)
    """

    id: str
    """
    Step identifier
    """

    label: str
    """
    Step label/name
    """

    uuid: Optional[str] = None
    """
    Step UUID
    """

    origin_uuid: Optional[str] = None
    """
    Step origin UUID
    """

    class Config:
        extra = "forbid"


class CareerPathData(BaseModel):
    """
    Career path data containing steps and full path.
    """

    steps: List[CareerPathStep]
    """
    List of steps in the career path
    """

    full_path: str
    """
    Full path as a string (e.g., "Sales promotion manager → Sales team lead → Sales strategy lead → CFO")
    """

    class Config:
        extra = "forbid"


class CareerPath(BaseModel):
    """
    Career path record.
    TODO: (preliminary types adjust this schema as needed)
    """

    id: str
    """
    Career path identifier
    """

    uuid: Optional[str] = None
    """
    Career path UUID
    """

    origin_uuid: Optional[str] = None
    """
    Career path origin UUID
    """

    preferred_label: str
    """
    Preferred label for the career path
    """

    career_path: CareerPathData
    """
    Career path data containing steps and full path
    """

    class Config:
        extra = "forbid"
