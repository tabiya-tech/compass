from abc import ABC, abstractmethod
import logging

from pymongo import InsertOne

from app.metrics.types import CompassMetricEvent
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.server_dependencies.database_collections import Collections
from common_libs.time_utilities import datetime_to_mongo_date
from app.app_config import get_application_config

class ICompassMetricRepository(ABC):
    @abstractmethod
    def record_event(self, event: list[CompassMetricEvent]):
        raise NotImplementedError()


class CompassMetricRepository(ICompassMetricRepository):
    def __init__(self, *, db: AsyncIOMotorDatabase):
        self.db = db
        self.logger = logging.getLogger(self.__class__.__name__)
        self.collection = db.get_collection(Collections.COMPASS_METRICS)

    @classmethod
    def _to_db_doc(cls, event: CompassMetricEvent) -> dict:
        event_dict = event.model_dump()
        event_dict["environment_name"] = get_application_config().environment_name
        event_dict["timestamp"] = datetime_to_mongo_date(event.timestamp)
        return event_dict


    async def record_event(self, events: list[CompassMetricEvent]):
        commands = []
        for event in events:
            commands.append(InsertOne(self._to_db_doc(event)))
        return await self.collection.bulk_write(commands)
