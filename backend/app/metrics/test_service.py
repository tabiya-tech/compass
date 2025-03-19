from typing import Awaitable
import pytest
import bson

from datetime import datetime

from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.constants import EventType
from app.metrics.types import CompassMetricEvent, UserAccountCreatedEvent, MessageCreatedEvent, ConversationPhaseEvent, FeedbackScoreUpdatedEvent, MessageReactionCreatedEvent

from app.metrics.service import CompassMetricService


def get_base_event(event_type: EventType):
    return CompassMetricEvent(
        event_type=event_type,
        event_type_name=event_type.name,
        environment_name="test",
        version="1.0.0",
        timestamp=datetime.now(),
        anonymized_user_id="123",
    )

@pytest.fixture(scope="function")
async def get_metrics_service(in_memory_application_database) -> CompassMetricService:
    application_db = await in_memory_application_database
    return CompassMetricService(db=application_db)

def _assert_base_event_matches(event: dict, expected: CompassMetricEvent):
    assert event["event_type"] == expected.event_type
    assert event["event_type_name"] == expected.event_type_name
    assert event["environment_name"] == expected.environment_name
    assert event["version"] == expected.version
    assert event["timestamp"] == expected.timestamp
    assert event["anonymized_user_id"] == expected.anonymized_user_id


class TestRecordEvent:
    @pytest.mark.asyncio
    async def test_record_user_account_created_event_success(self, get_metrics_service: Awaitable[CompassMetricService]):
        # GIVEN a user account created event
        given_event = UserAccountCreatedEvent(
            **get_base_event(event_type=EventType.USER_ACCOUNT_CREATED).model_dump()
        )

        # WHEN the event is recorded
        service = await get_metrics_service
        # Guard: ensure no events in the database
        assert await service.collection.count_documents({}) == 0
        result = await service.record_event([given_event])

        # THEN the event is recorded in the database
        assert await service.collection.count_documents({}) == 1
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the event data matches what we expect
        actual_stored_event = await service.collection.find_one({"_id": bson.ObjectId(result.id)})
        _assert_base_event_matches(actual_stored_event, given_event)

    @pytest.mark.asyncio
    async def test_record_message_created_event_success(self, get_metrics_service: Awaitable[CompassMetricService]):
        # GIVEN a message created event
        base_event_data = get_base_event(event_type=EventType.MESSAGE_CREATED).model_dump()
        base_event_data.update({
            "message_id": "test_message_id",
            "anonymized_session_id": "test_session"
        })
        given_event = MessageCreatedEvent(**base_event_data)

        # WHEN the event is recorded
        service = await get_metrics_service
        # Guard: ensure no events in the database
        assert await service.collection.count_documents({}) == 0
        result = await service.record_event([given_event])

        # THEN the event is recorded in the database
        assert await service.collection.count_documents({}) == 1
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the event data matches what we expect
        actual_stored_event = await service.collection.find_one({"_id": bson.ObjectId(result.id)})
        _assert_base_event_matches(actual_stored_event, given_event)
        # AND specific fields are present
        assert actual_stored_event["message_id"] == "test_message_id"
        assert actual_stored_event["anonymized_session_id"] == "test_session"

    @pytest.mark.asyncio
    async def test_record_conversation_phase_event_success(self, get_metrics_service: Awaitable[CompassMetricService]):
        # GIVEN a conversation phase event
        base_event_data = get_base_event(event_type=EventType.CONVERSATION_PHASE).model_dump()
        base_event_data.update({
            "phase": "INTRO",
            "anonymized_session_id": "test_session"
        })
        given_event = ConversationPhaseEvent(**base_event_data)

        # WHEN the event is recorded
        service = await get_metrics_service
        # Guard: ensure no events in the database
        assert await service.collection.count_documents({}) == 0
        result = await service.record_event([given_event])

        # THEN the event is recorded in the database
        assert await service.collection.count_documents({}) == 1
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the event data matches what we expect
        actual_stored_event = await service.collection.find_one({"_id": bson.ObjectId(result.id)})
        _assert_base_event_matches(actual_stored_event, given_event)
        # AND specific fields are present
        assert actual_stored_event["phase"] == "INTRO"
        assert actual_stored_event["anonymized_session_id"] == "test_session"

    @pytest.mark.asyncio
    async def test_record_feedback_score_updated_event_success(self, get_metrics_service: Awaitable[CompassMetricService]):
        # GIVEN a feedback score updated event
        base_event_data = get_base_event(event_type=EventType.FEEDBACK_SCORE_UPDATED).model_dump()
        base_event_data.update({
            "type": "NPS",
            "value": 8,
            "anonymized_session_id": "test_session"
        })
        given_event = FeedbackScoreUpdatedEvent(**base_event_data)

        # WHEN the event is recorded
        service = await get_metrics_service
        # Guard: ensure no events in the database
        assert await service.collection.count_documents({}) == 0
        result = await service.record_event([given_event])

        # THEN the event is recorded in the database
        assert await service.collection.count_documents({}) == 1
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the event data matches what we expect
        actual_stored_event = await service.collection.find_one({"_id": bson.ObjectId(result.id)})
        _assert_base_event_matches(actual_stored_event, given_event)
        # AND specific fields are present
        assert actual_stored_event["type"] == "NPS"
        assert actual_stored_event["value"] == 8
        assert actual_stored_event["anonymized_session_id"] == "test_session"

    @pytest.mark.asyncio
    async def test_record_message_reaction_created_event_success(self, get_metrics_service: Awaitable[CompassMetricService]):
        # GIVEN a message reaction created event
        base_event_data = get_base_event(event_type=EventType.MESSAGE_REACTION_CREATED).model_dump()
        base_event_data.update({
            "message_id": "test_message_id",
            "kind": ReactionKind.LIKED,
            "reasons": [
                DislikeReason.BIASED
            ],
            "anonymized_session_id": "test_session"
        })
        given_event = MessageReactionCreatedEvent(**base_event_data)

        # WHEN the event is recorded
        service = await get_metrics_service
        # Guard: ensure no events in the database
        assert await service.collection.count_documents({}) == 0
        result = await service.record_event([given_event])

        # THEN the event is recorded in the database
        assert await service.collection.count_documents({}) == 1
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the event data matches what we expect
        actual_stored_event = await service.collection.find_one({"_id": bson.ObjectId(result.id)})
        _assert_base_event_matches(actual_stored_event, given_event)
        # AND specific fields are present
        assert actual_stored_event["message_id"] == "test_message_id"
        assert actual_stored_event["kind"] == "LIKE"
        assert actual_stored_event["reasons"] == []
        assert actual_stored_event["anonymized_session_id"] == "test_session"
        