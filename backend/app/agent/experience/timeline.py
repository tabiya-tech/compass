from typing import Optional

from pydantic import BaseModel


class Timeline(BaseModel):
    """
    A class to represent the timeline of an experience.
    """

    start: Optional[str] = None
    """
    YYYY or MM-YYYY or DD-MM-YYYY or empty
    """

    end: Optional[str] = None
    """
    YYYY or MM-YYYY or DD-MM-YYYY or empty
    """
