from abc import ABC, abstractmethod
import logging

from app.metrics.types import CompassMetricEvent
from motor.motor_asyncio import AsyncIOMotorClient
from app.server_dependencies.database_collections import Collections


class ICompassMetricService(ABC):
    @abstractmethod
    def record_event(self, event: list[CompassMetricEvent]):
        raise NotImplementedError()


class CompassMetricService(ICompassMetricService):
    def __init__(self, *, db: AsyncIOMotorClient):
        self.db = db
        self.logger = logging.getLogger(self.__class__.__name__)
        self.collection = db.get_collection(Collections.COMPASS_METRICS)

    def record_event(self, event: list[CompassMetricEvent]):
        raise NotImplementedError()
