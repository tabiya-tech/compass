from typing import Optional, Literal

from pydantic import BaseModel


class CompassTestCase(BaseModel):
    """
    The definition of the test cases to be run.
    """
    name: str
    """
    The name of the test case.
    """

    skip_force: Optional[Literal['skip', 'force']] = None
    """
    If set to 'skip', the test case will be skipped.
    If set to 'force', only this test case will be run.
    """

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"
