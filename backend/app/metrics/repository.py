from abc import ABC, abstractmethod
import logging

from pymongo import InsertOne

from app.metrics.types import AbstractCompassMetricEvent
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.server_dependencies.database_collections import Collections
from common_libs.time_utilities import datetime_to_mongo_date


class IMetricsRepository(ABC):
    @abstractmethod
    def record_event(self, event: list[AbstractCompassMetricEvent]):
        """
        Records a number of events in the repository.
        :param event: The event to record
        :return:
        """
        raise NotImplementedError()


class MetricsRepository(IMetricsRepository):
    def __init__(self, *, db: AsyncIOMotorDatabase):
        self.db = db
        self.logger = logging.getLogger(self.__class__.__name__)
        self.collection = db.get_collection(Collections.COMPASS_METRICS)

    @classmethod
    def _to_db_doc(cls, event: AbstractCompassMetricEvent) -> dict:
        event_dict = event.model_dump()
        event_dict["timestamp"] = datetime_to_mongo_date(event.timestamp)
        event_dict["event_type_name"] = event.event_type.name
        event_dict["event_type"] = event.event_type.value
        return event_dict

    async def record_event(self, events: list[AbstractCompassMetricEvent]):
        commands = []
        for event in events:
            commands.append(InsertOne(self._to_db_doc(event)))
        return await self.collection.bulk_write(commands)
