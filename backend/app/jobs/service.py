import logging
from abc import ABC, abstractmethod

from app.jobs.repository import IJobRepository


class IJobService(ABC):
    """
    Interface for the Job Service.
    Allows to mock the service in tests.
    TODO: add method definitions as needed.
    """
    pass


class JobService(IJobService):
    """
    JobService class is responsible for business logic related to job credentials.
    """

    def __init__(self, repository: IJobRepository):
        self._repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)
