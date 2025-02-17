from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement


class InvitationType(Enum):
    LOGIN = "LOGIN"
    """
    This invitation type does not require the user to sign in/sign up.
    It instead signs in the user automatically/anonymously and allows the user to access the application.
    """
    REGISTER = "REGISTER"
    """
    This invitation type requires the user to sign up.
    """


class InvitationCodeStatus(Enum):
    VALID = "VALID"
    """
    The invitation code was found and is valid
    """
    INVALID = "INVALID"
    """
    The invitation code was not found or is invalid
    """


class UserInvitation(BaseModel):
    """
    A user invitation object, this class is only used in the backend, we don't expose this in the response,
    The reason is that we don't want to expose the id. and other internal fields like usage status.
    """

    invitation_code: str
    """
    Unique code for the invitation
    """

    remaining_usage: int
    """
    The number of times the invitation can still be used
    """

    allowed_usage: int
    """
    The total number of times the invitation can be used
    """

    valid_from: datetime
    """
    The date and time the invitation is valid from
    """

    valid_until: datetime
    """
    The date and time the invitation is valid until
    """

    invitation_type: InvitationType
    """
    The type of invitation
    """

    sensitive_personal_data_requirement: SensitivePersonalDataRequirement = SensitivePersonalDataRequirement.NOT_AVAILABLE
    """
    Sensitive Personal data requirement for the invitation, whether sensitive personal data required or not
    """

    class Config:
        # Do not allow extra fields
        extra = "forbid"


class GetInvitationCodeStatusResponse(BaseModel):
    invitation_code: str
    """
    The code of the invitation
    """

    status: InvitationCodeStatus
    """
    The status of the invitation code
    """

    invitation_type: Optional[InvitationType] = None
    """
    If the invitation is found, the type of the invitation
    """

    sensitive_personal_data_requirement: SensitivePersonalDataRequirement
    """
    The sensitive data requirement for the invitation
    """

    class Config:
        """
        Pydantic configuration
        """

        extra = "forbid"
        use_enum_values = True
