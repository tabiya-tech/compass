from typing import Optional, Literal

from pydantic import BaseModel

from app.i18n.types import Locale


class CompassTestCase(BaseModel):
    """
    The definition of the test cases to be run.
    """
    name: str
    """
    The name of the test case.
    """

    locale: Locale = Locale.EN_US
    """
    The locale to be used for the test case.
    """

    skip_force: Optional[Literal['skip', 'force', '']] = None
    """
    If set to 'skip', the test case will be skipped.
    If set to 'force', only this test case will be run.
    """

    expect_errors_in_logs: bool = False
    """
    If set to True, the test case will expect errors in the logs.
    Can be used to conditionally assert errors in the logs.
    """

    expect_warnings_in_logs: bool = False
    """
    If set to True, the test case will expect warnings in the logs.
    Can be used to conditionally assert warnings in the logs.
    """


class Config:
    """
    Disallow extra fields in the model
    """
    extra = "forbid"
