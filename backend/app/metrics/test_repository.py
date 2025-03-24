import random
from typing import Awaitable, Dict, Any
import pytest

from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.types import ConversationPhaseLiteral, ConversationPhaseEvent, UserAccountCreatedEvent, MessageReactionCreatedEvent, MessageCreatedEvent, \
    FeedbackProvidedEvent, FeedbackTypeLiteral, FeedbackScoreEvent
from common_libs.test_utilities import get_random_user_id, get_random_session_id, get_random_printable_string
from common_libs.time_utilities import mongo_date_to_datetime, truncate_microseconds

from app.metrics.repository import MetricsRepository

from app.app_config import ApplicationConfig


@pytest.fixture(scope="function")
async def get_metrics_repository(in_memory_metrics_database) -> MetricsRepository:
    metrics_db = await in_memory_metrics_database
    return MetricsRepository(db=metrics_db)


def get_user_account_created_event():
    return UserAccountCreatedEvent(
        user_id=get_random_user_id(),
    )


def get_message_reaction_created_event():
    return MessageReactionCreatedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        message_id=get_random_printable_string(16),
        kind=ReactionKind.DISLIKED,
        reasons=[DislikeReason.CONFUSING, DislikeReason.INAPPROPRIATE_TONE]
    )


def get_feedback_provided_event():
    return FeedbackProvidedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id()
    )


def get_message_created_event():
    return MessageCreatedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id()
    )


def get_conversation_phase_event(conversation_phase: ConversationPhaseLiteral):
    return ConversationPhaseEvent(
        phase=conversation_phase,
        user_id=get_random_user_id(),
        session_id=get_random_session_id()
    )


def get_feedback_score_event(feedback_type: FeedbackTypeLiteral):
    return FeedbackScoreEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        feedback_type=feedback_type,
        value=random.choice([-1, 0, 1])  # nosec B311 # random value for feedback score
    )


def _assert_metric_event_matches(given_event_dict: Dict[str, Any], actual_stored_event: Dict[str, Any]) -> None:
    # Remove MongoDB _id if present
    given_event_dict.pop("_id", None)

    for field, value in given_event_dict.items():
        if field == "timestamp":
            # Special case for timestamp which needs to be converted from MongoDB format
            assert truncate_microseconds(mongo_date_to_datetime(actual_stored_event[field])) == truncate_microseconds(value)
        elif field == "event_type":
            # Special case for event_type whose int value is stored in the database
            assert actual_stored_event[field] == value.value
        else:
            assert actual_stored_event[field] == value


class TestRecordEvent:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_event_generator",
        [
            lambda: get_user_account_created_event(),
            lambda: get_conversation_phase_event("ENDED"),
            lambda: get_feedback_provided_event(),
            lambda: get_feedback_score_event("NPS"),
            lambda: get_message_created_event(),
            lambda: get_message_reaction_created_event()
        ],
        ids=[
            "UserAccountCreatedEvent",
            "ConversationPhaseEvent",
            "FeedbackProvidedEvent",
            "FeedbackScoreEvent",
            "MessageCreatedEvent",
            "MessageReactionCreatedEvent"
        ]
    )
    async def test_record_single_event_success(
            self,
            get_metrics_repository: Awaitable[MetricsRepository],
            given_event_generator,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an event of a specific type
        repository = await get_metrics_repository
        given_event = given_event_generator()

        # WHEN the event is recorded
        # Guard: ensure no events in the database
        assert await repository.collection.count_documents({}) == 0
        await repository.record_event([given_event])

        # THEN the event is recorded in the database
        assert await repository.collection.count_documents({}) == 1

        # AND the event data matches what we expect
        actual_stored_event = await repository.collection.find_one({})

        # Compare all fields from the original event
        # Remove the id field from the comparison since it's generated by MongoDB
        given_event_dict = given_event.model_dump()
        _assert_metric_event_matches(given_event_dict, actual_stored_event)

    @pytest.mark.asyncio
    async def test_record_mixed_event_success(
            self,
            get_metrics_repository: Awaitable[MetricsRepository],
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a list of mixed events
        given_events = [
            get_user_account_created_event(),
            get_conversation_phase_event("INTRO"),
            get_conversation_phase_event("COUNSELING"),
            get_conversation_phase_event("CHECKOUT"),
            get_conversation_phase_event("ENDED"),
            get_feedback_provided_event(),
            get_feedback_score_event("NPS"),
            get_feedback_score_event("CSAT"),
            get_feedback_score_event("CES"),
            get_message_created_event(),
            get_message_reaction_created_event()

        ]
        repository = await get_metrics_repository

        # Guard: ensure no events in the database   
        assert await repository.collection.count_documents({}) == 0

        # WHEN the events are recorded
        await repository.record_event(given_events)

        # THEN the events are recorded in the database
        assert await repository.collection.count_documents({}) == len(given_events)

        # AND the event data matches what we expect
        actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
        for actual_stored_event, given_event in zip(actual_stored_events, given_events):
            given_event_dict = given_event.model_dump()
            _assert_metric_event_matches(given_event_dict, actual_stored_event)
