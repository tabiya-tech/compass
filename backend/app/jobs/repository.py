import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections


class IJobRepository(ABC):
    """
    Interface for the Job Repository.
    Allows to mock the repository in tests.
    # TODO: add methods as needed
    """


class JobRepository(IJobRepository):
    """
    JobRepository class is responsible for managing job credential records in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.JOBS)
        self._logger = logging.getLogger(self.__class__.__name__)
