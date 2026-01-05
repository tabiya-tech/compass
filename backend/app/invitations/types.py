from datetime import datetime
from enum import Enum
from typing import Optional, Any

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


class ClaimSource(Enum):
    SECURE_LINK = "secure_link"
    INVITATION = "invitation"
    MANUAL = "manual"
    """
    Origin of the claim
    """


class InvitationCodeStatus(Enum):
    VALID = "VALID"
    """
    The invitation code was found and is valid
    """
    USED = "USED"
    """
    The code was already claimed
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


class SecureLinkCodeClaim(BaseModel):
    registration_code: str
    claimed_user_id: str
    claimed_at: datetime
    claim_source: ClaimSource
    report_token_hash: str | None = None
    invitation_code_template: str | None = None
    metadata: dict[str, Any] | None = None

    class Config:
        extra = "forbid"
        use_enum_values = True


class GetInvitationCodeStatusResponse(BaseModel):
    code: str
    """
    The code that was checked (registration_code or invitation_code)
    """

    status: InvitationCodeStatus
    """
    The status of the code
    """

    source: str | None = None
    """
    Source of the code: secure_link or invitation
    """

    invitation_type: Optional[InvitationType] = None
    """
    If an invitation is found, the type of the invitation
    """

    sensitive_personal_data_requirement: SensitivePersonalDataRequirement
    """
    The sensitive data requirement for the invitation (secure-link defaults to NOT_AVAILABLE)
    """

    class Config:
        extra = "forbid"
        use_enum_values = True
