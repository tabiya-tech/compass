"""
MongoDB stores date-time values internally as UTC but returns them as date-time objects without a timezone.
Additionally, MongoDB does not support microseconds.
See https://www.mongodb.com/docs/manual/reference/method/Date/ for more information.

When storing a datetime object in MongoDB, if no timezone is provided, it is assumed to be in UTC.
Therefore, to avoid unexpected results, all date-times should be converted to UTC before storing them in MongoDB.

An alternative approach is to convert all date-times to ISO format and store them as strings in MongoDB.
However, this still requires converting date-times to UTC beforehand, as date-times without a timezone are assumed to be in UTC.

Storing date-times as strings in MongoDB also makes it harder to query the database based on date-time values.
It can even be problematic because comparisons will be done as strings rather than date-time objects.
If a query does not explicitly convert date-times to ISO format strings, the results may be incorrect.

For example, the query .find({"date": {"$gte": datetime.now()}}) will not return any results because the date-time object
is not converted to an ISO format string and will not match the stores date-time strings.

Additionally, Python's isoformat() does not use the Zulu time format (e.g., 2022-01-01T00:00:00Z),
which is commonly used in JavaScript and other languages.
This discrepancy can lead to unexpected results when converting date-time strings back into date-time objects using mongo's shell or other languages.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def get_now() -> datetime:
    """
    Get the current datetime in UTC with a timezone.
    Use this function instead of datetime.now() to ensure that the datetime has a timezone.
    """
    return datetime.now(timezone.utc)


def mongo_date_to_datetime(value: datetime) -> datetime | None:
    """
    Convert a mongo date to python datetype.
    Use this function when retrieving a datetime returned by MongoDB has a timezone.
    MongoDB stores date-times internally as UTC but returns them as date-time objects without a timezone.

    :param value: the datetime to convert, can be None if the value is not set
    :return: the datetime in UTC
    """
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc)


def datetime_to_mongo_date(value: datetime) -> datetime:
    """
    Mongodb stores date-time values internally as UTC and assumes that if the date-time does not have a timezone, it is in UTC.
    Use this function before storing a datetime to log a warning if the datetime does not have a timezone.
    :param value: a python datetime object in any timezone
    :return: the value without modification
    """
    if value.tzinfo is None:
        logger.warning("Converting a date without a timezone to UTC. This may lead to unexpected results. Assuming UTC.", stack_info=True, stacklevel=2)

    return value


def convert_python_datetime_to_mongo_datetime(value: datetime) -> datetime:
    """
    Convert a datetime to a datetime that aligns with MongoDB's datetime format (see https://www.mongodb.com/docs/manual/reference/method/Date/).
    Mongodb stores date-time values internally as UTC and assumes that if the date-time does not have a timezone, it assumes it is in UTC.
    It also does not support microseconds.
    Use this function to compare datetimes stored in MongoDB with python datetime objects.
    :param value: a python datetime object in any timezone
    :return: a datetime as it would be stored and returned by MongoDB (without microseconds and in UTC without a timezone).
    """
    _value = value
    if _value.tzinfo is not None:
        _value = _value.astimezone(tz=timezone.utc)

    return _value.replace(tzinfo=None).replace(microsecond=(value.microsecond // 1000 * 1000))


def truncate_microseconds(date: datetime) -> datetime:
    """
    Truncate the microseconds of a datetime to milliseconds.
    :param date:
    :return:
    """
    return date.replace(microsecond=(date.microsecond // 1000 * 1000))