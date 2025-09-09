"""
Tests for the metric type models.
"""
import random
from datetime import datetime, timezone

import pytest
import pytest_mock
from pydantic import ValidationError

from app.agent.experience import WorkType
from app.app_config import ApplicationConfig, set_application_config
from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.constants import EventType
from app.metrics.types import (
    AbstractCompassMetricEvent,
    AbstractUserAccountEvent,
    AbstractConversationEvent,
    ExperienceDiscoveredEvent,
    UserAccountCreatedEvent,
    ConversationPhaseEvent,
    ConversationTurnEvent,
    FeedbackProvidedEvent,
    FeedbackRatingValueEvent,
    MessageReactionCreatedEvent,
    ExperienceExploredEvent,
    UIInteractionEvent,
)
from common_libs.test_utilities import get_random_user_id, get_random_session_id, get_random_application_config, \
    get_random_printable_string


def assert_basic_event_fields_are_set(event: AbstractCompassMetricEvent, expected_event_type: EventType,
                                      application_config: ApplicationConfig, expected_timestamp: datetime):
    assert event.environment_name == application_config.environment_name
    assert event.version == application_config.version_info.to_version_string()
    assert event.event_type == expected_event_type
    assert event.timestamp == expected_timestamp


class TestAbstractClasses:
    @pytest.mark.parametrize("cls", [
        AbstractCompassMetricEvent,
        AbstractUserAccountEvent,
        AbstractConversationEvent,
    ])
    def test_abstract_class_cannot_be_instantiated(self, cls, setup_application_config: ApplicationConfig):
        # GIVEN Abstract Event class
        abstract_event_class = cls

        # WHEN instantiating the class
        # THEN it should raise a TypeError.
        # AND the error message should indicate that the class is an abstract class.
        with pytest.raises(TypeError, match=f"{cls.__name__} is an abstract class and cannot be instantiated directly"):
            abstract_event_class()


class TestDefaultValues:
    def test_optional_values_are_not_passed(self, mocker):
        # GIVEN a Sample foo event.
        class _FooEvent(AbstractCompassMetricEvent):
            pass

        # AND sample application config is created
        given_application_config = get_random_application_config()
        set_application_config(given_application_config)

        # AND get_now will return a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # AND a random event_type
        given_event_type = random.choice(list(EventType))  # nosec B311 # random is used for testing purposes

        # WHEN an instance is only created with the required fields.
        given_event = _FooEvent(
            event_type=given_event_type  # type: ignore
        )

        # THEN the default values should be taken from application config object
        assert given_event.environment_name == given_application_config.environment_name
        assert given_event.version == given_application_config.version_info.to_version_string()

        # AND given_event timestamp will be the fixed time
        assert given_event.timestamp == fixed_time

        # AND event_type should be set correctly
        assert given_event.event_type == given_event_type

    def test_optional_values_are_passed(self, mocker):
        # GIVEN a Sample foo event.
        class _FooEvent(AbstractCompassMetricEvent):
            pass

        # AND sample application config is created
        given_application_config = get_random_application_config()
        set_application_config(given_application_config)

        # AND get_now will return a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # AND a random event_type
        given_event_type = random.choice(list(EventType))  # nosec B311 # random is used for testing purposes

        # AND a random environment name
        given_environment_name = "random_environment_name"

        # AND a random version
        given_version = "given-random-version"
        # AND another random time
        given_timestamp = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)

        # WHEN an instance is created with all the fields.
        given_event = _FooEvent(event_type=given_event_type, environment_name=given_environment_name,  # type: ignore
                                version=given_version, timestamp=given_timestamp)  # type: ignore

        # THEN the default values should be taken from application config object
        assert given_event.environment_name == given_environment_name
        assert given_event.version == given_version

        # AND given event timestamp will be the fixed time
        assert given_event.timestamp == given_timestamp


class TestUserAccountCreatedEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a user id
        given_user_id = get_random_user_id()

        # WHEN creating an instance of the user account created event
        actual_event = UserAccountCreatedEvent(user_id=given_user_id)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(
            actual_event, EventType.USER_ACCOUNT_CREATED, setup_application_config, fixed_time)

        # AND the user_id should be present and anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.user_id == given_user_id
        assert actual_event.anonymized_user_id != given_user_id

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN a user id
        given_user_id = get_random_user_id()

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            UserAccountCreatedEvent(user_id=given_user_id, extra_field=given_extra_field)  # type:ignore


class TestConversationPhaseEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a conversation phase, session id and user id
        given_conversation_phase = "INTRO"
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # WHEN creating an instance of the event
        actual_event = ConversationPhaseEvent(phase=given_conversation_phase,  # type:ignore
                                              session_id=given_session_id,
                                              user_id=given_user_id)

        # THEN the basic event fields should be set
        assert_basic_event_fields_are_set(actual_event, EventType.CONVERSATION_PHASE, setup_application_config,
                                          fixed_time)

        # AND the conversation phase should be set correctly
        assert actual_event.phase == given_conversation_phase

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()
        given_conversation_phase = "INTRO"

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            ConversationPhaseEvent(phase=given_conversation_phase, session_id=given_session_id, user_id=given_user_id,
                                   extra_field=given_extra_field)  # type:ignore


class TestExperienceDiscoveredEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a session id and user id
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()
        # AND an experience count
        given_experience_count = random.randint(1, 10)  # nosec B311 # random is used for testing purposes
        # AND some work types discovered with their counts
        given_experiences_by_work_type = {
            work_type.name: random.randint(1, 5)  # nosec B311 # random is used for testing purposes
            for work_type in random.choices(list(WorkType), k=random.randint(1, len(WorkType)))  # nosec B311 # random is used for testing purposes
        }
        # WHEN creating an instance of the event
        actual_event = ExperienceDiscoveredEvent(session_id=given_session_id, user_id=given_user_id,
                                                 experience_count=given_experience_count,
                                                 experiences_by_work_type=given_experiences_by_work_type)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.EXPERIENCE_DISCOVERED, setup_application_config,
                                          fixed_time)

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

        # AND the experience count should be set correctly
        assert actual_event.experience_count == given_experience_count

        # AND the experience by work type should be set correctly
        assert actual_event.experiences_by_work_type == given_experiences_by_work_type

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()
        given_experience_count = random.randint(1, 10)  # nosec B311 # random is used for testing purposes

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            ExperienceDiscoveredEvent(session_id=given_session_id, user_id=given_user_id,
                                      experience_count=given_experience_count,
                                      extra_field=given_extra_field)  # type:ignore


class TestExperienceExploredEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a session id and user id
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()
        given_experience_count = random.randint(1, 10)  # nosec B311 # random is used for testing purposes
        given_experiences_by_work_type = {
            get_random_printable_string(10): random.randint(1, 100)}  # nosec B311 # random is used for testing purposes
        # WHEN creating an instance of the event
        actual_event = ExperienceExploredEvent(session_id=given_session_id, user_id=given_user_id,
                                               experience_count=given_experience_count,
                                               experiences_by_work_type=given_experiences_by_work_type)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.EXPERIENCE_EXPLORED, setup_application_config,
                                          fixed_time)

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

        # AND the experience count should be set correctly
        assert actual_event.experience_count == given_experience_count


class TestFeedbackProvidedEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a session id and user id
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # WHEN creating an instance of the event
        actual_event = FeedbackProvidedEvent(session_id=given_session_id, user_id=given_user_id)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.FEEDBACK_PROVIDED, setup_application_config,
                                          fixed_time)

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            FeedbackProvidedEvent(
                session_id=given_session_id,
                user_id=given_user_id,
                extra_field=given_extra_field)  # type:ignore


class TestFeedbackRatingValueEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback type, value and session id and user id
        given_feedback_type = random.choice(["NPS", "CSAT", "CES"])  # nosec B311 # random is used for testing purposes
        given_value = random.choice([-1, 0, 1])  # nosec B311 # random is used for testing purposes
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # WHEN creating an instance of the event
        actual_event = FeedbackRatingValueEvent(feedback_type=given_feedback_type, value=given_value,  # type:ignore
                                                session_id=given_session_id, user_id=given_user_id)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.FEEDBACK_RATING_VALUE, setup_application_config,
                                          fixed_time)

        # AND the feedback type should be set correctly
        assert actual_event.feedback_type == given_feedback_type

        # AND the value should be set correctly
        assert actual_event.value == given_value

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

    def test_invalid_feedback_type_raises_validation_error(self, setup_application_config: ApplicationConfig):
        # GIVEN an invalid feedback type
        given_invalid_feedback_type = "INVALID"

        # WHEN creating an instance of the event
        with pytest.raises(ValidationError, match="Input should be 'NPS', 'CSAT' or 'CES'"):
            FeedbackRatingValueEvent(
                feedback_type=given_invalid_feedback_type,  # type:ignore
                value=1,
                session_id=get_random_session_id(),
                user_id=get_random_user_id())

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()
        given_feedback_type = "NPS"
        given_value = 1

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            FeedbackRatingValueEvent(feedback_type=given_feedback_type, value=given_value, session_id=given_session_id,
                                     user_id=given_user_id, extra_field=given_extra_field)  # type:ignore


class TestConversationTurnEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a session id and user id
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # AND a random compass message count and user message count
        given_compass_message_count = random.randint(1, 10)  # nosec B311 # random is used for testing purposes
        given_user_message_count = random.randint(1, 10)  # nosec B311 # random is used for testing purposes

        # WHEN creating an instance of the event
        actual_event = ConversationTurnEvent(
            session_id=given_session_id, user_id=given_user_id,
            compass_message_count=given_compass_message_count,  # nosec B311 # random is used for testing purposes
            user_message_count=given_user_message_count,  # nosec B311 # random is used for testing purposes
        )

        # THEN the fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.CONVERSATION_TURN, setup_application_config,
                                          fixed_time)

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

        # AND the compass message count should match the given value
        assert actual_event.compass_message_count == given_compass_message_count
        # AND the user message count
        assert actual_event.user_message_count == given_user_message_count

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            ConversationTurnEvent(
                session_id=given_session_id,
                user_id=given_user_id,
                extra_field=given_extra_field)  # type:ignore


class TestMessageReactionCreatedEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                      mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a message id, a random reaction kind, reasons, session id and user id
        given_message_id = "message_1"
        given_reaction_kind = random.choice(list(ReactionKind))  # nosec B311 # random is used for testing purposes
        given_reasons = random.choices(list(DislikeReason), k=random.randint(1,
                                                                             len(DislikeReason)))  # nosec B311 # random is used for testing purposes
        given_session_id = get_random_session_id()
        given_user_id = get_random_user_id()

        # WHEN creating an instance of the event
        actual_event = MessageReactionCreatedEvent(message_id=given_message_id, kind=given_reaction_kind,
                                                   reasons=given_reasons, session_id=given_session_id,
                                                   user_id=given_user_id)

        # THEN the basic event fields should be set correctly
        assert_basic_event_fields_are_set(actual_event, EventType.MESSAGE_REACTION_CREATED, setup_application_config,
                                          fixed_time)

        # AND the message id should set correctly
        assert actual_event.message_id == given_message_id

        # AND the reaction kind should set correctly
        assert actual_event.kind == given_reaction_kind.name

        # AND the reasons should set correctly
        assert actual_event.reasons == [reason.name for reason in given_reasons]

        # AND the session id should be anonymized
        assert actual_event.anonymized_session_id is not None
        assert actual_event.anonymized_session_id != given_session_id

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_session_id = 123
        given_user_id = get_random_user_id()
        given_message_id = "message_1"
        given_reaction_kind = random.choice(list(ReactionKind))  # nosec B311 # random is used for testing purposes
        given_reasons = random.choices(list(DislikeReason), k=random.randint(1,
                                                                             len(DislikeReason)))  # nosec B311 # random is used for testing purposes

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed.
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            MessageReactionCreatedEvent(message_id=given_message_id, kind=given_reaction_kind, reasons=given_reasons,
                                        session_id=given_session_id, user_id=given_user_id,
                                        extra_field=given_extra_field)  # type:ignore


class TestUIInteractionEvent:
    def test_fields_are_set_correctly(self, setup_application_config: ApplicationConfig,
                                    mocker: pytest_mock.MockerFixture):
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN interaction ids, timestamp, user id and relevant experiments
        given_element_id = "cv_button"
        given_actions = ["foo", "bar"]
        given_timestamp = "2025-03-04T06:45:00+00:00"
        given_user_id = get_random_user_id()
        given_relevant_experiments = {"exp1": "group1", "exp2": "group2"}
        given_details = {"foo1": "bar1", "foo2": "bar2"}

        # WHEN creating an instance of the event
        actual_event = UIInteractionEvent(
            element_id=given_element_id,
            actions=given_actions,
            timestamp=given_timestamp,
            user_id=given_user_id,
            relevant_experiments=given_relevant_experiments,
            details=given_details
        )

        # THEN the basic event fields should be set
        assert_basic_event_fields_are_set(actual_event, EventType.UI_INTERACTION, setup_application_config, fixed_time)

        # AND the interaction ids should be set correctly
        assert actual_event.element_id == given_element_id
        assert actual_event.actions == given_actions

        # AND the timestamp should be set correctly
        assert actual_event.timestamp == datetime.fromisoformat(given_timestamp).astimezone(timezone.utc)

        # AND the user id should be anonymized
        assert actual_event.anonymized_user_id is not None
        assert actual_event.anonymized_user_id != given_user_id

        # AND the relevant experiments should be set correctly
        assert actual_event.relevant_experiments == given_relevant_experiments

        # AND the details should be set correctly
        assert actual_event.details == given_details

    def test_extra_fields_are_not_allowed(self, setup_application_config: ApplicationConfig):
        # GIVEN all required fields
        given_element_id = "cv_button"
        given_actions = ["foo", "bar"]
        given_timestamp = "2025-03-04T06:45:00+00:00"
        given_user_id = get_random_user_id()

        # AND an extra field
        given_extra_field = "extra_field"

        # WHEN creating an instance of the event
        # THEN it should raise a TypeError indicating that the extra field is not allowed
        with pytest.raises(TypeError, match="got an unexpected keyword argument 'extra_field'"):
            UIInteractionEvent(
                element_id=given_element_id,
                actions=given_actions,
                timestamp=given_timestamp,
                user_id=given_user_id,
                extra_field=given_extra_field  # type: ignore
            )
