import logging
from abc import ABC, abstractmethod

from app.career_path.repository import ICareerPathRepository


class ICareerPathService(ABC):
    """
    Interface for the Career Path Service.
    Allows to mock the service in tests.
    TODO: add method definitions as needed.
    """
    pass


class CareerPathService(ICareerPathService):
    """
    CareerPathService class is responsible for business logic related to career paths.
    """

    def __init__(self, repository: ICareerPathRepository):
        self._repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)
