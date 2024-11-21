from datetime import datetime
from enum import Enum
from typing import Mapping, Optional

from pydantic import BaseModel

from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement


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

    sensitive_personal_data_requirement: SensitivePersonalDataRequirement
    """
    Sensitive Personal data requirement for the invitation, whether sensitive personal data required or not for now
    """

    @staticmethod
    def from_dict(_dict: Mapping[str, any]) -> "UserInvitation":
        """
        Create a new UserInvitation object from a dictionary
        :param _dict: Mapping[str, any]: The dictionary to create the UserInvitation object from
        :return: UserInvitation: The created UserInvitation object
        """

        return UserInvitation(
            id=str(_dict.get("_id")),
            invitation_code=_dict.get("invitation_code"),
            remaining_usage=_dict.get("remaining_usage"),
            allowed_usage=_dict.get("allowed_usage"),
            valid_from=_dict.get("valid_from"),
            valid_until=_dict.get("valid_until"),
            invitation_type=_dict.get("invitation_type"),
            # If the key is not found, default to NOT_REQUIRED
            # for legacy invitation codes
            sensitive_personal_data_requirement=_dict.get(
                "sensitive_personal_data_requirement",
                SensitivePersonalDataRequirement.NOT_REQUIRED
            )
        )

    class Config:
        """
        Pydantic configuration
        """

        extra = "forbid"
        use_enum_values = True


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
