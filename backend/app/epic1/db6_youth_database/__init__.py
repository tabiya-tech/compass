"""
DB6 Youth Database Interface.

This module defines the interface contract for Epic 1's Youth Database (DB6).
The actual implementation will be provided by the Epic 1 contractor.

Epic 2 (Preference Elicitation Agent) depends on this interface to:
- Read youth profiles (experiences, skills, preferences)
- Write preference vectors after elicitation

NOTE: This is an INTERFACE ONLY. Epic 1 contractor will provide the implementation.
"""

from app.epic1.db6_youth_database.db6_client import DB6Client, YouthProfile

__all__ = [
    "DB6Client",
    "YouthProfile"
]
