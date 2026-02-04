from datetime import date
from typing import Optional

from pydantic import BaseModel


class Job(BaseModel):
    """
    A job credential/qualification record representing a user's educational or professional qualification.
    TODO: (preliminary types adjust this schema as needed)
    """

    session_id: int
    """
    Compass user session ID
    """

    person_identifier: str
    """
    Unique ID for the user (e.g., National ID hash or DID)
    """

    qualification_title: str
    """
    The name of the degree/cert (e.g., 'BSc Computer Science')
    """

    learning_outcome: str
    """
    Detailed text of what the user can do. Algorithms verify this against job skills
    """

    occupation_code: str
    """
    Standardized code for past roles (e.g., '2512' for Software Dev). Links to Demand side
    """

    issuer_name: str
    """
    Organization that issued the credential
    """

    date_issued: date
    """
    Date of qualification issuance
    """

    location_country: str
    """
    Country of residence for legal matching
    """

    credential_status: Optional[str] = None
    """
    'Active', 'Revoked', or 'Expired'
    """

    rich_skill_id: Optional[str] = None
    """
    Link to a Rich Skill Descriptor (RSD) definition
    """

    nqf_level: Optional[str] = None
    """
    National Qualifications Framework level (Comparison proxy)
    """

    verification_url: Optional[str] = None
    """
    Cryptographic link to verify the record on a blockchain/ledger
    """

    class Config:
        extra = "forbid"
