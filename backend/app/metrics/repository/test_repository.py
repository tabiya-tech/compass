import random
from typing import Awaitable, Dict, Any
from unittest.mock import AsyncMock

import pytest

from app.app_config import ApplicationConfig
from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.repository.repository import MetricsRepository
from app.metrics.types import ConversationPhaseLiteral, ConversationPhaseEvent, UserAccountCreatedEvent, \
    MessageReactionCreatedEvent, ConversationTurnEvent, \
    FeedbackProvidedEvent, FeedbackTypeLiteral, FeedbackRatingValueEvent, \
    CVFormatLiteral, CVDownloadedEvent, DeviceSpecificationEvent, UserLocationEvent, ExperienceDiscoveredEvent, \
    ExperienceExploredEvent, UIInteractionEvent, ExperienceChangedEvent, SkillChangedEvent
from common_libs.test_utilities import get_random_user_id, get_random_session_id, get_random_printable_string
from common_libs.time_utilities import mongo_date_to_datetime, truncate_microseconds, get_now


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


def get_conversation_turn_event(*, compass_count: int, user_count: int):
    return ConversationTurnEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        compass_message_count=compass_count,
        user_message_count=user_count,
    )


def get_conversation_phase_event(conversation_phase: ConversationPhaseLiteral):
    return ConversationPhaseEvent(
        phase=conversation_phase,
        user_id=get_random_user_id(),
        session_id=get_random_session_id()
    )


def get_experience_discovered_event(*, experience_count: int, work_type: str | None = None):
    work_type = work_type or get_random_printable_string(10)  # nosec B311 # random is used for testing purposes
    return ExperienceDiscoveredEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        experience_count=experience_count,
        experiences_by_work_type={work_type: experience_count}
    )


def get_experience_explored_event(*, experience_count: int):
    return ExperienceExploredEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        experience_count=experience_count,
        experiences_by_work_type={
            get_random_printable_string(10):
                random.randint(1, 100)  # nosec B311 # random is used for testing purposes
        }

    )


def get_feedback_rating_value_event(feedback_type: FeedbackTypeLiteral):
    return FeedbackRatingValueEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        feedback_type=feedback_type,
        value=random.choice([-1, 0, 1])  # nosec B311 # random value for feedback rating value
    )


def get_cv_downloaded_event(cv_format: CVFormatLiteral):
    return CVDownloadedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        cv_format=cv_format,
        timestamp=get_now().isoformat()
    )


def get_device_specification_event():
    return DeviceSpecificationEvent(
        user_id=get_random_user_id(),
        device_type=get_random_printable_string(10),
        os_type=get_random_printable_string(10),
        browser_type=get_random_printable_string(10),
        browser_version=get_random_printable_string(10),
        user_agent=get_random_printable_string(10),
        timestamp=get_now().isoformat()
    )


def get_user_location_event():
    return UserLocationEvent(
        user_id=get_random_user_id(),
        coordinates=(random.uniform(-90.0, 90.0), random.uniform(-180.0, 180.0)),  # nosec B311 # random coordinates
        timestamp=get_now().isoformat()
    )


def get_ui_interaction_event():
    return UIInteractionEvent(
        user_id=get_random_user_id(),
        element_id=get_random_printable_string(10),
        actions=[get_random_printable_string(10), get_random_printable_string(10)],
        timestamp=get_now().isoformat(),
        relevant_experiments={"exp1": "group1", "exp2": "group2"},
        details={"foo1": "bar1", "foo2": "bar2"}
    )


def get_experience_changed_event():
    action = random.choice(["EDITED", "DELETED", "RESTORED"])  # nosec B311
    edited_fields = [get_random_printable_string(8) for _ in range(2)] if action == "EDITED" else None

    return ExperienceChangedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        action=action,
        work_type=get_random_printable_string(10),
        edited_fields=edited_fields,
    )


def get_skill_changed_event():
    action = random.choice(["ADDED", "DELETED", "EDITED"])  # nosec B311
    uuids = [get_random_printable_string(8) for _ in range(3)]

    return SkillChangedEvent(
        user_id=get_random_user_id(),
        session_id=get_random_session_id(),
        uuids=uuids,
        action=action,
        work_type=get_random_printable_string(10)
    )


def _assert_metric_event_fields_match(given_event_dict: Dict[str, Any], actual_stored_event: Dict[str, Any]) -> None:
    # Remove MongoDB _id if present
    given_event_dict.pop("_id", None)

    for field, value in given_event_dict.items():
        if field == "timestamp":
            # Special case for timestamp which needs to be converted from MongoDB format
            assert truncate_microseconds(mongo_date_to_datetime(actual_stored_event[field])) == truncate_microseconds(
                value)
        elif field == "event_type":
            # Special case for event_type whose int value is stored in the database
            assert actual_stored_event[field] == value.value
        elif field == "user_id" or field == "session_id":
            # Special case for user_id and session_id since we delete them from the event
            pass
        else:
            assert actual_stored_event[field] == value


class TestRecordEvent:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_event_generator",
        [
            lambda: get_user_account_created_event(),
            lambda: get_conversation_phase_event("ENDED"),
            lambda: get_experience_discovered_event(experience_count=3),
            lambda: get_experience_explored_event(experience_count=5),
            lambda: get_feedback_provided_event(),
            lambda: get_feedback_rating_value_event("NPS"),
            lambda: get_conversation_turn_event(compass_count=1, user_count=2),
            lambda: get_message_reaction_created_event(),
            lambda: get_cv_downloaded_event("PDF"),
            lambda: get_device_specification_event(),
            lambda: get_ui_interaction_event(),
            lambda: get_experience_changed_event(),
            lambda: get_skill_changed_event(),
        ],
        ids=[
            "UserAccountCreatedEvent",
            "ConversationPhaseEvent",
            "ExperienceDiscoveredEvent",
            "ExperienceExploredEvent",
            "FeedbackProvidedEvent",
            "FeedbackRatingValueEvent",
            "ConversationTurnEvent",
            "MessageReactionCreatedEvent",
            "CVDownloadedEvent",
            "DeviceSpecificationEvent",
            "UIInteractionEvent",
            "ExperienceChangedEvent",
            "SkillChangedEvent",
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
        _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

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
            get_conversation_phase_event("DIVE_IN"),
            get_conversation_phase_event("COLLECT_EXPERIENCES"),
            get_feedback_provided_event(),
            get_feedback_rating_value_event("NPS"),
            get_feedback_rating_value_event("CSAT"),
            get_feedback_rating_value_event("CES"),
            get_conversation_turn_event(user_count=3, compass_count=7),
            get_message_reaction_created_event(),
            get_cv_downloaded_event("PDF"),
            get_cv_downloaded_event("DOCX"),
            get_device_specification_event(),
            get_ui_interaction_event(),
            get_experience_changed_event(),
            get_skill_changed_event()
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
            _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_event_generator",
        [
            lambda: get_user_account_created_event(),
            lambda: get_conversation_phase_event("ENDED"),
            lambda: get_experience_discovered_event(experience_count=3),
            lambda: get_feedback_rating_value_event("NPS"),
            lambda: get_feedback_provided_event(),
            lambda: get_conversation_turn_event(user_count=3, compass_count=7),
            lambda: get_message_reaction_created_event(),
            lambda: get_cv_downloaded_event("PDF"),
            lambda: get_device_specification_event(),
            lambda: get_ui_interaction_event(),
            lambda: get_experience_changed_event(),
            lambda: get_skill_changed_event(),
        ],
        ids=[
            "UserAccountCreatedEvent",
            "ConversationPhaseEvent",
            "ExperienceDiscoveredEvent",
            "FeedbackRatingValueEvent",
            "FeedbackProvidedEvent",
            "MessageCreatedEvent",
            "MessageReactionCreatedEvent",
            "CVDownloadedEvent",
            "DeviceSpecificationEvent",
            "UIInteractionEvent",
            "ExperienceChangedEvent",
            "SkillChangedEvent",
        ]
    )
    async def test_record_event_database_bulk_write_failure(
            self,
            get_metrics_repository: Awaitable[MetricsRepository],
            setup_application_config: ApplicationConfig,
            given_event_generator
    ):
        # GIVEN an event of a specific type
        repository = await get_metrics_repository
        given_event = given_event_generator()

        # AND the database will raise an exception
        repository.collection.bulk_write = AsyncMock(side_effect=Exception("Database error"))

        # WHEN the event is recorded
        # THEN the repository raises an exception
        with pytest.raises(Exception):
            await repository.record_event([given_event])

        # THEN the event is not recorded in the database
        assert await repository.collection.count_documents({}) == 0

    @pytest.mark.asyncio
    async def test_record_event_removes_user_id_and_session_id_for_all_event_types(
            self,
            get_metrics_repository: Awaitable[MetricsRepository],
            setup_application_config: ApplicationConfig,
            caplog: pytest.LogCaptureFixture
    ):
        # GIVEN one of each type of event
        given_events = [
            get_user_account_created_event(),
            get_conversation_phase_event("INTRO"),
            get_conversation_phase_event("COUNSELING"),
            get_conversation_phase_event("CHECKOUT"),
            get_conversation_phase_event("ENDED"),
            get_conversation_phase_event("DIVE_IN"),
            get_conversation_phase_event("COLLECT_EXPERIENCES"),
            get_feedback_provided_event(),
            get_feedback_rating_value_event("NPS"),
            get_feedback_rating_value_event("CSAT"),
            get_feedback_rating_value_event("CES"),
            get_conversation_turn_event(user_count=3, compass_count=7),
            get_message_reaction_created_event(),
            get_cv_downloaded_event("PDF"),
            get_cv_downloaded_event("DOCX"),
            get_device_specification_event(),
            get_user_location_event(),
            get_experience_discovered_event(experience_count=3),
            get_experience_explored_event(experience_count=3),
            get_ui_interaction_event(),
            get_experience_changed_event(),
            get_skill_changed_event(),
        ]
        repository = await get_metrics_repository

        # WHEN the events are recorded
        await repository.record_event(given_events)

        # THEN all events are recorded
        assert await repository.collection.count_documents({}) == len(given_events)

        # AND no stored event has user_id or session_id
        actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
        for stored_event in actual_stored_events:
            assert "user_id" not in stored_event
            assert "session_id" not in stored_event

        # AND warnings are logged for each event that had user_id or session_id
        warning_count = caplog.text.count("user_id field found in event during repository processing")
        assert warning_count > 0  # At least some events should have had user_id

    class TestUpsertedEvents:
        class TestFeedbackProvidedEvent:
            @pytest.mark.asyncio
            async def test_upsert_feedback_provided_event_success(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a feedback provided event
                given_event = get_feedback_provided_event()
                repository = await get_metrics_repository

                # WHEN the event is recorded
                await repository.record_event([given_event])

                # THEN the event is recorded in the database
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_event.model_dump(), actual_stored_event)

                # WHEN the event is recorded  for the same session and user
                given_second_event = get_feedback_provided_event()
                given_second_event.anonymized_user_id = given_event.anonymized_user_id
                given_second_event.anonymized_session_id = given_event.anonymized_session_id
                await repository.record_event([given_second_event])

                # guard: ensure the two events are not identical
                assert given_event.model_dump() != given_second_event.model_dump()

                # THEN the event is not recorded again
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_second_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_second_event.model_dump(), actual_second_stored_event)

            @pytest.mark.asyncio
            async def test_record_multiple_feedback_provided_event_for_different_users(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a list of feedback provided events for different users
                given_events = [
                    get_feedback_provided_event(),
                    get_feedback_provided_event()
                ]
                repository = await get_metrics_repository

                # WHEN the events are recorded
                await repository.record_event(given_events)

                # THEN the events are recorded in the database
                assert await repository.collection.count_documents({}) == len(given_events)

                # AND the event data matches what we expect
                actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
                for actual_stored_event, given_event in zip(actual_stored_events, given_events):
                    given_event_dict = given_event.model_dump()
                    _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

        class TestMessageReactionCreatedEvent:
            @pytest.mark.asyncio
            async def test_record_multiple_message_reaction_created_event_for_same_user(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a message reaction created event
                given_event = get_message_reaction_created_event()
                given_event.kind = ReactionKind.DISLIKED
                given_event.reasons = [DislikeReason.CONFUSING, DislikeReason.INAPPROPRIATE_TONE]
                repository = await get_metrics_repository

                # WHEN the event is recorded
                await repository.record_event([given_event])

                # THEN the event is recorded in the database
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_event.model_dump(), actual_stored_event)

                # WHEN the event is recorded for the same user
                given_second_event = get_message_reaction_created_event()
                given_second_event.anonymized_user_id = given_event.anonymized_user_id
                given_second_event.anonymized_session_id = given_event.anonymized_session_id
                given_second_event.message_id = given_event.message_id
                given_second_event.kind = ReactionKind.LIKED
                given_second_event.reasons = []

                # guard: ensure the two events are not identical
                assert given_event.model_dump() != given_second_event.model_dump()

                # WHEN we attempt to record the event again
                await repository.record_event([given_second_event])

                # THEN the event is updated rather than recorded again
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_second_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_second_event.model_dump(), actual_second_stored_event)

            @pytest.mark.asyncio
            async def test_record_multiple_message_reaction_created_event_for_different_users(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a list of message reaction created events for different users
                given_events = [
                    get_message_reaction_created_event(),
                    get_message_reaction_created_event()
                ]
                repository = await get_metrics_repository

                # WHEN the events are recorded
                await repository.record_event(given_events)

                # THEN the events are recorded in the database
                assert await repository.collection.count_documents({}) == len(given_events)

                # AND the event data matches what we expect
                actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
                for actual_stored_event, given_event in zip(actual_stored_events, given_events):
                    given_event_dict = given_event.model_dump()
                    _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

        class TestConversationTurnEvent:
            @pytest.mark.asyncio
            async def test_record_multiple_conversation_turn_events_for_same_user(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a conversation turn event
                given_event = get_conversation_turn_event(user_count=random.randint(1, 10),  # nosec B311 # random is used for testing purposes
                                                        compass_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes for user and compass count
                repository = await get_metrics_repository

                # WHEN the event is recorded
                await repository.record_event([given_event])

                # THEN the event is recorded in the database
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_event.model_dump(), actual_stored_event)
                # AND the turn count is 1
                assert actual_stored_event["turn_count"] == 1

                # WHEN the event is recorded again for the same user
                given_second_event = get_conversation_turn_event(user_count=random.randint(1, 10),  # nosec B311 # random is used for testing purposes
                                                                compass_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes for user and compass count
                given_second_event.anonymized_user_id = given_event.anonymized_user_id
                given_second_event.anonymized_session_id = given_event.anonymized_session_id

                # guard: ensure the two events are not identical
                assert given_event.model_dump() != given_second_event.model_dump()

                # WHEN we attempt to record the event again
                await repository.record_event([given_second_event])

                # THEN the event is updated rather than recorded again
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_second_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_second_event.model_dump(), actual_second_stored_event)
                # AND the turn count is incremented to 2
                assert actual_second_stored_event["turn_count"] == 2

            @pytest.mark.asyncio
            async def test_record_multiple_conversation_turn_event_for_different_users(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a list of message reaction created events for different users
                given_events = [
                    get_conversation_turn_event(user_count=random.randint(1, 10), compass_count=random.randint(1, 10)),  # nosec B311 # random is used for testing purposes for user and compass count
                    get_conversation_turn_event(user_count=random.randint(1, 10), compass_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes for user and compass count
                ]
                repository = await get_metrics_repository

                # WHEN the events are recorded
                await repository.record_event(given_events)

                # THEN the events are recorded in the database
                assert await repository.collection.count_documents({}) == len(given_events)

                # AND the event data matches what we expect
                actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
                for actual_stored_event, given_event in zip(actual_stored_events, given_events):
                    given_event_dict = given_event.model_dump()
                    _assert_metric_event_fields_match(given_event_dict, actual_stored_event)
                    # AND the turn count is 1 for each event
                    assert actual_stored_event["turn_count"] == 1

        class TestExperienceDiscoveredEvent:
            @pytest.mark.asyncio
            async def test_record_experience_discovered_events_for_same_user(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a experience discovered event with a specific work type
                work_type = "foo-type"
                initial_count = 3
                given_event = get_experience_discovered_event(
                    experience_count=initial_count,
                    work_type=work_type
                )
                repository = await get_metrics_repository

                # WHEN the event is recorded
                await repository.record_event([given_event])

                # THEN the event is recorded in the database
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_event.model_dump(), actual_stored_event)

                # WHEN we record another event for the same work type
                new_count = 2
                given_second_event = get_experience_discovered_event(
                experience_count=new_count,
                work_type=work_type
            )
                given_second_event.anonymized_user_id = given_event.anonymized_user_id
                given_second_event.anonymized_session_id = given_event.anonymized_session_id

                # guard: ensure the two events are not identical
                assert given_event.model_dump() != given_second_event.model_dump()

                # WHEN we attempt to record the event again
                await repository.record_event([given_second_event])

                # THEN the event is updated rather than recorded again
                assert await repository.collection.count_documents({}) == 1

                # AND the work type count is overridden with the new count
                actual_second_stored_event = await repository.collection.find_one({})
                assert actual_second_stored_event["experiences_by_work_type"][work_type] == new_count

                # AND all other fields match the second event
                _assert_metric_event_fields_match(given_second_event.model_dump(), actual_second_stored_event)

            @pytest.mark.asyncio
            async def test_record_multiple_experience_discovered_event_for_different_users(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a list of message reaction created events for different users
                given_events = [
                    get_experience_discovered_event(experience_count=random.randint(1, 10)),  # nosec B311 # random is used for testing purposes
                    get_experience_discovered_event(experience_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes
                ]
                repository = await get_metrics_repository

                # WHEN the events are recorded
                await repository.record_event(given_events)

                # THEN the events are recorded in the database
                assert await repository.collection.count_documents({}) == len(given_events)

                # AND the event data matches what we expect
                actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
                for actual_stored_event, given_event in zip(actual_stored_events, given_events):
                    given_event_dict = given_event.model_dump()
                    _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

        class TestExperienceExploredEvent:
            @pytest.mark.asyncio
            async def test_record_experience_explored_events_for_same_user(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a experience explored event
                given_event = get_experience_explored_event(experience_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes
                repository = await get_metrics_repository

                # WHEN the event is recorded
                await repository.record_event([given_event])

                # THEN the event is recorded in the database
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_event.model_dump(), actual_stored_event)

                # WHEN the event is recorded again for the same user
                given_second_event = get_experience_explored_event(experience_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes

                given_second_event.anonymized_user_id = given_event.anonymized_user_id
                given_second_event.anonymized_session_id = given_event.anonymized_session_id

                # guard: ensure the two events are not identical
                assert given_event.model_dump() != given_second_event.model_dump()

                # WHEN we attempt to record the event again
                await repository.record_event([given_second_event])

                # THEN the event is updated rather than recorded again
                assert await repository.collection.count_documents({}) == 1

                # AND the event data matches what we expect
                actual_second_stored_event = await repository.collection.find_one({})
                _assert_metric_event_fields_match(given_second_event.model_dump(), actual_second_stored_event)

            @pytest.mark.asyncio
            async def test_record_multiple_experience_explored_event_for_different_users(
                    self,
                    get_metrics_repository: Awaitable[MetricsRepository],
                    setup_application_config: ApplicationConfig
            ):
                # GIVEN a list of experience explored events for different users
                given_events = [
                    get_experience_explored_event(experience_count=random.randint(1, 10)),  # nosec B311 # random is used for testing purposes
                    get_experience_explored_event(experience_count=random.randint(1, 10))  # nosec B311 # random is used for testing purposes
                ]
                repository = await get_metrics_repository

                # WHEN the events are recorded
                await repository.record_event(given_events)

                # THEN the events are recorded in the database
                assert await repository.collection.count_documents({}) == len(given_events)

                # AND the event data matches what we expect
                actual_stored_events = await repository.collection.find({}).to_list(length=len(given_events))
                for actual_stored_event, given_event in zip(actual_stored_events, given_events):
                    given_event_dict = given_event.model_dump()
                    _assert_metric_event_fields_match(given_event_dict, actual_stored_event)

