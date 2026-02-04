import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections


class IJobPreferencesRepository(ABC):
    """
    Interface for the Job Preferences Repository.
    Allows to mock the repository in tests.
    """


class JobPreferencesRepository(IJobPreferencesRepository):
    """
    JobPreferencesRepository class is responsible for managing job preferences in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.JOB_PREFERENCES)
        self._logger = logging.getLogger(self.__class__.__name__)
