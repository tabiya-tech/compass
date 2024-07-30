from datetime import datetime
from enum import Enum
from typing import Mapping, Optional

from pydantic import BaseModel


class InvitationType(Enum):
    AUTO_REGISTER = "AUTO_REGISTER"
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
    id: str
    """
    Invitation Object Id
    """

    code: str
    """
    Unique code for the invitation
    """

    remaining_usage: int = 0
    """
    The number of times the invitation has been used
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

    @staticmethod
    def from_dict(_dict: Mapping[str, any]):
        """
        Create a new UserInvitation object from a dictionary
        :param _dict: Mapping[str, any]: The dictionary to create the UserInvitation object from
        :return: UserInvitation: The created UserInvitation object
        """
        return UserInvitation(
            id=str(_dict.get("_id")),
            code=_dict.get("code"),
            remaining_usage=_dict.get("remaining_usage"),
            allowed_usage=_dict.get("allowed_usage"),
            valid_from=_dict.get("valid_from"),
            valid_until=_dict.get("valid_until"),
            invitation_type=_dict.get("invitation_type")
        )

    class Config:
        extra = "forbid"
        use_enum_values = True


class GetInvitationCodeStatusResponse(BaseModel):
    code: str
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

    class Config:
        extra = "forbid"
        use_enum_values = True
