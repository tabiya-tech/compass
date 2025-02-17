import logging
from typing import Awaitable
import pytest
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import common_libs.time_utilities as time_utils

given_date_utc = datetime.now(tz=timezone.utc)
given_date_get_now = time_utils.get_now()
given_date_now_non_tz = datetime.now()
given_date_now_local_tz = datetime.now().astimezone()
given_date_utc_plus2h = datetime.now().astimezone() + timedelta(hours=2)


class TestTimeUtils:
    """
    The test bellow demonstrates how to convert date-times to UTC before storing them in MongoDB,
    and how to assert that the date-times were stored correctly.
    """

    @pytest.mark.asyncio
    async def test_converted(self, in_memory_application_database: Awaitable[AsyncIOMotorDatabase], caplog):
        with caplog.at_level(logging.DEBUG):
            db = await in_memory_application_database
            collection = db.get_collection("test_time_utils")
            given_id_converted = ObjectId()
            await collection.insert_one({
                "_id": given_id_converted,
                "given_date_utc": time_utils.datetime_to_mongo_date(given_date_utc),
                "given_date_get_now": time_utils.datetime_to_mongo_date(given_date_get_now),
                "given_date_now_non_tz": time_utils.datetime_to_mongo_date(given_date_now_non_tz),
                "given_date_now_local_tz": time_utils.datetime_to_mongo_date(given_date_now_local_tz),
                "given_date_utc_plus2h": time_utils.datetime_to_mongo_date(given_date_utc_plus2h)
            })

            actual_converted = await collection.find_one({"_id": given_id_converted})
            assert actual_converted["given_date_utc"] == time_utils.convert_python_datetime_to_mongo_datetime(given_date_utc)

            assert actual_converted["given_date_get_now"] == time_utils.convert_python_datetime_to_mongo_datetime(given_date_get_now)
            assert actual_converted["given_date_now_non_tz"] == time_utils.convert_python_datetime_to_mongo_datetime(given_date_now_non_tz)
            assert actual_converted["given_date_now_local_tz"] == time_utils.convert_python_datetime_to_mongo_datetime(given_date_now_local_tz)
            assert actual_converted["given_date_utc_plus2h"] == time_utils.convert_python_datetime_to_mongo_datetime(given_date_utc_plus2h)

            # Check that a warning was logged
            # The warning is logged because the date-time is not in UTC
            # and there is only one warning logged
            assert caplog.text.count("Converting a date without a timezone to UTC. This may lead to unexpected results. Assuming UTC") == 1

    @pytest.mark.asyncio
    async def test_not_converted(self, in_memory_application_database: Awaitable[AsyncIOMotorDatabase]):
        db = await in_memory_application_database
        collection = db.get_collection("test_time_utils")
        given_id_not_converted = ObjectId()
        await collection.insert_one({
            "_id": given_id_not_converted,
            "given_date_utc": given_date_utc,
            "given_date_get_now": given_date_get_now,
            "given_date_now_non_tz": given_date_now_non_tz,
            "given_date_now_local_tz": given_date_now_local_tz,
            "given_date_utc_plus2h": given_date_utc_plus2h
        })

        actual_not_converted = await collection.find_one({"_id": given_id_not_converted})
        assert time_utils.mongo_date_to_datetime(actual_not_converted["given_date_utc"]) == time_utils.truncate_microseconds(given_date_utc)
        assert time_utils.mongo_date_to_datetime(actual_not_converted["given_date_get_now"]) == time_utils.truncate_microseconds(given_date_get_now)
        assert time_utils.mongo_date_to_datetime(actual_not_converted["given_date_now_non_tz"]) == time_utils.truncate_microseconds(
            given_date_now_non_tz.replace(tzinfo=timezone.utc))
        assert time_utils.mongo_date_to_datetime(actual_not_converted["given_date_now_local_tz"]) == time_utils.truncate_microseconds(given_date_now_local_tz)
        assert time_utils.mongo_date_to_datetime(actual_not_converted["given_date_utc_plus2h"]) == time_utils.truncate_microseconds(given_date_utc_plus2h)
