"""
DB6 Youth Database Interface.

This module defines the interface contract for the youth profile database.
The actual implementation is provided by the database implementation layer.

The preference elicitation agent depends on this interface to:
- Read youth profiles (experiences, skills, preferences)
- Write preference vectors after elicitation

NOTE: This is an INTERFACE ONLY. Database implementation provides the concrete implementation.
"""

from app.database_contracts.db6_youth_database.db6_client import DB6Client, YouthProfile

__all__ = [
    "DB6Client",
    "YouthProfile"
]
