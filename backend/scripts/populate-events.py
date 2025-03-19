import asyncio
import datetime
import random

import bson

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.db_dependencies import CompassDBProvider

VERSION = "main.sha"


def populate_user_account_created_events(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):
    """
    Populate the user account created events
    """

    for i in range(count):
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100001,
            "event_type_name": "USER_ACCOUNT_CREATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })


def populate_conversations_phase_events(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):

    for i in range(count):
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "event_type_name": "CONVERSATION_PHASE",
            "phase": "INTRO",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "phase": "INTRO",
            "event_type_name": "CONVERSATION_PHASE",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "phase": "INTRO",
            "event_type_name": "CONVERSATION_PHASE",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "phase": "COUNSELING",
            "event_type_name": "CONVERSATION_PHASE",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "phase": "COUNSELING",
            "event_type_name": "CONVERSATION_PHASE",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100002,
            "phase": "ENDED",
            "event_type_name": "CONVERSATION_PHASE",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i})
        })


def populate_provided_feedback(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):
    for i in range(count):
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100003,
            "event_type_name": "PROVIDED_FEEDBACK",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i})
        })


def populate_message_created(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):
    for i in range(count):
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100005,
            "event_type_name": "MESSAGE_CREATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "message_id": bson.ObjectId()
        })


def populate_message_flag(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):
    for i in range(count):
        populate_message_created(db, count, _date)
        populate_message_created(db, count, _date)
        populate_message_created(db, count,  _date)

        # like 1
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100006,
            "event_type_name": "MESSAGE_REACTION_CREATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "message_id": bson.ObjectId(),
            "kind": "LIKED"
        })

        # dislike one
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100006,
            "event_type_name": "MESSAGE_REACTION_CREATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "message_id": bson.ObjectId(),
            "kind": "DISLIKED",
            "reasons": ["foo"]
        })


def populate_feedback_score_updated(db: AsyncIOMotorDatabase, count: int, _date: datetime.datetime):

    for i in range(count):
        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100004,
            "event_type_name": "FEEDBACK_SCORE_UPDATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "type": "NPS",
            "value": random.choice([-1, 0, 1])
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100004,
            "event_type_name": "FEEDBACK_SCORE_UPDATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "type": "CSAT",
            "value": random.choice([0, 1])
        })

        db.get_collection("_temp_event_logs").insert_one({
            "environment_name": "dev",
            "version": VERSION,
            "event_type": 100004,
            "event_type_name": "FEEDBACK_SCORE_UPDATED",
            "timestamp": _date,
            "user_anonymized": bson.BSON.encode({'a': i}),
            "anonymized_session": bson.BSON.encode({'a': i}),
            "type": "CES",
            "value": random.choice([0, 1])
        })


async def main():
    connection = await CompassDBProvider.get_application_db()

    count = 10
    for j in range(1000):
        _date = datetime.datetime.now() - datetime.timedelta(days=j)

        populate_user_account_created_events(connection, count, _date)
        populate_conversations_phase_events(connection, count, _date)
        populate_provided_feedback(connection, count, _date)
        populate_message_created(connection, count, _date)
        populate_message_flag(connection, count, _date)
        populate_feedback_score_updated(connection, count, _date)


if __name__ == "__main__":
    asyncio.run(main())
