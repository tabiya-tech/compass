import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections


class ICareerPathRepository(ABC):
    """
    Interface for the Career Path Repository.
    Allows to mock the repository in tests.
    TODO: add methods as needed
    """


class CareerPathRepository(ICareerPathRepository):
    """
    CareerPathRepository class is responsible for managing career path records in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.CAREER_PATH)
        self._logger = logging.getLogger(self.__class__.__name__)
