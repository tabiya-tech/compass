import logging
from abc import ABC, abstractmethod

from app.job_preferences.repository import IJobPreferencesRepository


class IJobPreferencesService(ABC):
    """
    Interface for the Job Preferences Service.
    Allows to mock the service in tests.
    """
    pass


class JobPreferencesService(IJobPreferencesService):
    """
    JobPreferencesService class is responsible for business logic related to job preferences.
    """

    def __init__(self, repository: IJobPreferencesRepository):
        self._repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)
