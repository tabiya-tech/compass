sfrom typing import Optional
from pydantic import BaseModel


class UserInstitutionAssignment(BaseModel):
    """Maps a whitelisted user (by email) to their pre-assigned institution."""

    email: str
    institution_name: str
    reg_no: Optional[str] = None


class PilotWhitelistEntry(BaseModel):
    """An institution that is part of the pilot — hidden from public search."""

    institution_name: str
    reg_no: Optional[str] = None