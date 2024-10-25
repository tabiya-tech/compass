# There are 3 types of environments:
# - Development
# - Testing
# - Production
from enum import Enum


class EnvironmentTypes(Enum):
    """
    Environment Types
    """
    DEV = "dev"
    TEST = "test"
    PROD = "prod"

    def __str__(self):
        return self.value
