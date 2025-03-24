from abc import ABC, abstractmethod
import logging

from pymongo import InsertOne, UpdateOne

from app.metrics.types import AbstractCompassMetricEvent
from app.metrics.constants import EventType
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
            if event.event_type == EventType.FEEDBACK_PROVIDED:
                #  There can only be one feedback provided event per session, if one already exists we should update it
                commands.append(UpdateOne(
                    {"anonymized_session_id": {"$eq": event.anonymized_session_id},
                     "anonymized_user_id": {"$eq": event.anonymized_user_id},
                     "event_type": {"$eq": EventType.FEEDBACK_PROVIDED.value}},
                    {"$set": self._to_db_doc(event)},
                    upsert=True
                ))
            else:
                commands.append(InsertOne(self._to_db_doc(event)))
        return await self.collection.bulk_write(commands)
