"""
Tests for the feedback service
"""
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
import pytest_mock

from app.app_config import ApplicationConfig
from app.conversations.feedback.repository import IUserFeedbackRepository
from app.conversations.feedback.services.errors import (
    InvalidQuestionError,
    InvalidOptionError, QuestionsFileError
)
from app.conversations.feedback.services.service import UserFeedbackService
from app.conversations.feedback.services.service import questions_cache
from app.conversations.feedback.services.types import Feedback, FeedbackItem, Version, Answer, NewFeedbackSpec, \
    NewFeedbackItemSpec, NewFeedbackVersionSpec, SimplifiedAnswer
from app.metrics.constants import EventType
from app.metrics.services.service import IMetricsService
from app.metrics.types import FeedbackProvidedEvent, FeedbackRatingValueEvent
from app.users.sessions import generate_new_session_id
from common_libs.test_utilities import get_random_user_id, get_random_printable_string, get_random_session_id

given_feedback_specs_json_file = Path(__file__).parent / "given_feedback_specs-en.json"
given_feedback_item_specs_json = json.loads(given_feedback_specs_json_file.read_text())

expected_feedback_specs_json_file = Path(__file__).parent / "expected_feedback_specs-en.json"
expected_feedback_specs_json = json.loads(expected_feedback_specs_json_file.read_text())

actual_questions_json_file = Path(__file__).parent / "questions-en.json"
actual_questions_json = json.loads(actual_questions_json_file.read_text())


def _get_random_answer(question: dict) -> Answer:
    available_options: dict | None = question.get("options", None)
    if available_options:
        random_key = random.choice(list(available_options.keys()))  # nosec B311 # random is used for testing purposes
        random_value = available_options.get(random_key, None)
        if random_value is None:
            raise ValueError(f"Invalid option key: {random_key} for question: {question}")
        return Answer(
            selected_options={random_key: random_value}
        )
    return Answer(
        selected_options={},
        rating_numeric=random.randint(1, 5),  # nosec B311 # random is used for testing purposes
        rating_boolean=random.choice([True, False]),  # nosec B311 # random is used for testing purposes
        comment=get_random_printable_string(10)
    )


def _def_feedback() -> Feedback:
    random_question_id = random.choice(
        list(actual_questions_json.keys()))  # nosec B311 # random is used for testing purposes
    random_question: dict[str, Any] = actual_questions_json[random_question_id]

    return Feedback(
        id=str(uuid4()),
        session_id=generate_new_session_id(),
        user_id=get_random_user_id(),
        version=Version(frontend=get_random_printable_string(4), backend=get_random_printable_string(4)),
        feedback_items=[FeedbackItem(
            question_id=random_question_id,
            question_text=random_question["question_text"],
            description=random_question["description"],
            answer=_get_random_answer(random_question)
        )],
        created_at=datetime.now()
    )


@pytest.fixture(scope='function')
def _mock_feedback_repository() -> IUserFeedbackRepository:
    class MockedFeedbackRepository(IUserFeedbackRepository):
        async def upsert_feedback(self, feedback: Feedback) -> Feedback:
            raise NotImplementedError()

        async def get_feedback_by_session_id(self, session_id: int) -> Feedback | None:
            raise NotImplementedError()

        async def get_all_feedback_for_user(self, user_id: str) -> dict[int, Feedback]:
            raise NotImplementedError()

    return MockedFeedbackRepository()


@pytest.fixture
def _mock_metrics_service() -> IMetricsService:
    """
    Returns a mock metrics service
    """

    class MockedMetricsService(IMetricsService):
        async def bulk_record_events(self, event):
            raise NotImplementedError()

    return MockedMetricsService()


class TestUpsertFeedback:
    @pytest.mark.asyncio
    async def test_upsert_feedback_update(self, _mock_feedback_repository: IUserFeedbackRepository,
                                          _mock_metrics_service: IMetricsService,
                                          mocker: pytest_mock.MockerFixture,
                                          setup_application_config: ApplicationConfig):
        # GIVEN a feedback specs to upsert
        given_user_id = get_random_user_id()
        given_session_id = get_random_session_id()
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[NewFeedbackItemSpec(**item) for item in given_feedback_item_specs_json],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND the repository will update the feedback successfully
        given_returned_feedback = _def_feedback()
        _mock_feedback_repository.upsert_feedback = AsyncMock(return_value=given_returned_feedback)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.bulk_record_events = AsyncMock()

        # AND datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # AND the backend version is set in the application config
        given_backend_version = setup_application_config.version_info.to_version_string()

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        actual_feedback = await service.upsert_user_feedback(given_user_id,
                                                             given_session_id,
                                                             given_feedback_specs)

        expected_feedback = Feedback(
            id=None,
            session_id=given_session_id,
            user_id=given_user_id,
            version=Version(frontend=given_feedback_specs.version.frontend, backend=given_backend_version),
            feedback_items=[FeedbackItem(**item) for item in expected_feedback_specs_json]
        )

        # THEN the repository's upsert_feedback method was called with the expected feedback
        _mock_feedback_repository.upsert_feedback.assert_called_once_with(expected_feedback)
        # AND the actual feedback returned by the method is whatever the repository returned
        assert actual_feedback == given_returned_feedback

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_question(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                    _mock_metrics_service: IMetricsService):
        # GIVEN a feedback object with an invalid question ID
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id="invalid_question",
                    simplified_answer=SimplifiedAnswer(rating_numeric=5),
                )
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND no existing feedback for the session
        _mock_feedback_repository.get_feedback_by_session_id = AsyncMock(return_value=None)

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )

        # THEN an InvalidQuestionError should be raised
        with pytest.raises(InvalidQuestionError) as error_info:
            await service.upsert_user_feedback(get_random_user_id(),
                                               get_random_session_id(),
                                               given_feedback_specs)

        # AND the error should contain the invalid question ID
        assert "invalid_question" in str(error_info.value)

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_option(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                  _mock_metrics_service: IMetricsService):
        # GIVEN a feedback object with an invalid option
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[NewFeedbackItemSpec(**item) for item in given_feedback_item_specs_json],
            version=NewFeedbackVersionSpec(frontend="foo")
        )
        given_feedback_specs.feedback_items_specs[0].simplified_answer.selected_options_keys = ["invalid_options_key"]

        # AND no existing feedback for the session
        _mock_feedback_repository.get_feedback_by_session_id = AsyncMock(return_value=None)

        # WHEN the upsert_feedback method is called
        # THEN an InvalidOptionError should be raised
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        with pytest.raises(InvalidOptionError) as error_info:
            await service.upsert_user_feedback(get_random_user_id(),
                                               get_random_session_id(),
                                               given_feedback_specs)

        # AND the error should contain both the invalid option and question ID
        assert "invalid_option" in str(error_info.value)
        assert "interaction_ease" in str(error_info.value)

    @pytest.mark.asyncio
    async def test_upsert_feedback_nonexistent_questions_file(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                              _mock_metrics_service: IMetricsService):
        # GIVEN a feedback object
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id="nonexistent_question",
                    simplified_answer=SimplifiedAnswer(rating_numeric=5),
                )
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND no existing feedback for the session
        _mock_feedback_repository.get_feedback_by_session_id = AsyncMock(return_value=None)

        # AND the questions cache is empty
        questions_cache.clear()

        # AND loading questions fails with a file not found error
        with patch('app.conversations.feedback.services.service.load_questions',
                   side_effect=QuestionsFileError("Questions file not found")):
            # WHEN the upsert_feedback method is called
            # THEN a QuestionsFileError should be raised
            service = UserFeedbackService(
                user_feedback_repository=_mock_feedback_repository,
                metrics_service=_mock_metrics_service
            )
            with pytest.raises(QuestionsFileError):
                await service.upsert_user_feedback(get_random_user_id(),
                                                   get_random_session_id(),
                                                   given_feedback_specs)

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_questions_file(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                          _mock_metrics_service: IMetricsService):
        # GIVEN a feedback object
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id="nonexistent_question",
                    simplified_answer=SimplifiedAnswer(rating_numeric=5),
                )
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND no existing feedback for the session
        _mock_feedback_repository.get_feedback_by_session_id = AsyncMock(return_value=None)

        # AND the questions cache is empty
        questions_cache.clear()

        # AND loading questions fails with an invalid format error
        with patch('app.conversations.feedback.services.service.load_questions',
                   side_effect=QuestionsFileError("Invalid questions file format")):
            # WHEN the upsert_feedback method is called
            # THEN a QuestionsFileError should be raised
            service = UserFeedbackService(
                user_feedback_repository=_mock_feedback_repository,
                metrics_service=_mock_metrics_service
            )
            with pytest.raises(QuestionsFileError):
                await service.upsert_user_feedback(get_random_user_id(),
                                                   get_random_session_id(),
                                                   given_feedback_specs)


class TestGetAnsweredQuestions:
    @pytest.mark.asyncio
    async def test_get_answered_questions_success(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                  _mock_metrics_service: IMetricsService):
        # GIVEN a user ID
        given_user_id = "user123"

        # AND some feedback data in the repository
        given_feedback = {
            123: _def_feedback(),
            456: _def_feedback()
        }
        _mock_feedback_repository.get_all_feedback_for_user = AsyncMock(return_value=given_feedback)

        # WHEN get_answered_questions is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        result = await service.get_answered_questions(given_user_id)

        # THEN the question IDs for each session should be returned
        expected_dict = {}
        for key in list(given_feedback.keys()):
            expected_dict[key] = [item.question_id for item in given_feedback[key].feedback_items]
        assert result == expected_dict

        # AND the repository's get_all_feedback_for_user method was called with the expected user ID
        _mock_feedback_repository.get_all_feedback_for_user.assert_called_once_with(given_user_id)

    @pytest.mark.asyncio
    async def test_get_answered_questions_no_feedback(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                      _mock_metrics_service: IMetricsService):
        # GIVEN a user ID with no feedback
        given_user_id = "user123"

        # AND no feedback in the repository
        _mock_feedback_repository.get_all_feedback_for_user = AsyncMock(return_value={})

        # WHEN get_answered_questions is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        result = await service.get_answered_questions(given_user_id)

        # THEN an empty dictionary should be returned
        assert result == {}

        # AND the repository's get_all_feedback_for_user method was called with the expected user ID
        _mock_feedback_repository.get_all_feedback_for_user.assert_called_once_with(given_user_id)


class TestMetricsRecording:
    @pytest.mark.asyncio
    async def test_record_feedback_provided_event(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                  _mock_metrics_service: IMetricsService,
                                                  setup_application_config: ApplicationConfig):
        # GIVEN a feedback specs to upsert
        given_user_id = get_random_user_id()
        given_session_id = get_random_session_id()
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id="clarity_of_skills",
                    simplified_answer=SimplifiedAnswer(rating_boolean=True),
                ),  # will record a FeedbackProvidedEvent but not a FeedbackRatingValueEvent
                NewFeedbackItemSpec(
                    question_id="work_experience_accuracy",
                    simplified_answer=SimplifiedAnswer(selected_options_keys=["experience_title"]),
                ),  # will record a FeedbackProvidedEvent and a FeedbackRatingValueEvent
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND the repository will update the feedback successfully
        given_returned_feedback = _def_feedback()
        _mock_feedback_repository.upsert_feedback = AsyncMock(return_value=given_returned_feedback)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.bulk_record_events = AsyncMock()

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        await service.upsert_user_feedback(given_user_id, given_session_id, given_feedback_specs)

        # THEN the metrics service should be called with a FeedbackProvidedEvent
        _mock_metrics_service.bulk_record_events.assert_called_once()
        event = _mock_metrics_service.bulk_record_events.call_args[0][0]
        assert isinstance(event, list)
        assert isinstance(event[0], FeedbackProvidedEvent)
        assert len(event) == 1
        assert event[0].event_type == EventType.FEEDBACK_PROVIDED

    @pytest.mark.parametrize("feedback_type,question_id,answer,expected_score", [
        # NPS tests
        ("NPS", "recommendation", "1", -1),  # Detractor
        ("NPS", "recommendation", "2", -1),  # Detractor
        ("NPS", "recommendation", "3", -1),  # Detractor
        ("NPS", "recommendation", "4", 0),  # Passive
        ("NPS", "recommendation", "5", 1),  # Promoter

        # CSAT tests
        ("CSAT", "satisfaction_with_compass", "1", 0),  # Low satisfaction
        ("CSAT", "satisfaction_with_compass", "2", 0),  # Low satisfaction
        ("CSAT", "satisfaction_with_compass", "3", 0),  # Low satisfaction
        ("CSAT", "satisfaction_with_compass", "4", 1),  # High satisfaction
        ("CSAT", "satisfaction_with_compass", "5", 1),  # High satisfaction

        # CES tests
        ("CES", "interaction_ease", "1", 0),  # Low ease
        ("CES", "interaction_ease", "2", 0),  # Low ease
        ("CES", "interaction_ease", "3", 0),  # Low ease
        ("CES", "interaction_ease", "4", 1),  # High ease
        ("CES", "interaction_ease", "5", 1),  # High ease
    ], ids=["NPS with value 1",
            "NPS with value 2",
            "NPS with value 3",
            "NPS with value 4",
            "NPS with value 5",
            "CSAT with value 1",
            "CSAT with value 2",
            "CSAT with value 3",
            "CSAT with value 4",
            "CSAT with value 5",
            "CES with value 1", "CES with value 2", "CES with value 3", "CES with value 4", "CES with value 5"])
    @pytest.mark.asyncio
    async def test_record_feedback_rating_value_events(self, _mock_feedback_repository: IUserFeedbackRepository,
                                                       _mock_metrics_service: IMetricsService,
                                                       feedback_type: str, question_id: str, answer: str,
                                                       expected_score: int,
                                                       setup_application_config: ApplicationConfig):
        # GIVEN a feedback specs with a specific question type
        given_user_id = get_random_user_id()
        given_session_id = get_random_session_id()
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id=question_id,
                    simplified_answer=SimplifiedAnswer(rating_numeric=int(answer)),
                )
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND the repository will update the feedback successfully
        given_returned_feedback = _def_feedback()
        _mock_feedback_repository.upsert_feedback = AsyncMock(return_value=given_returned_feedback)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.bulk_record_events = AsyncMock()

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        await service.upsert_user_feedback(given_user_id, given_session_id, given_feedback_specs)

        # THEN the metrics service should be called with both FeedbackProvidedEvent and FeedbackRatingValueEvent
        assert _mock_metrics_service.bulk_record_events.call_count == 1

        # AND the first event should be a FeedbackProvidedEvent
        actual_events = _mock_metrics_service.bulk_record_events.call_args[0][0]
        assert len(actual_events) == 2

        first_event = actual_events[0]
        assert isinstance(first_event, FeedbackProvidedEvent)

        # AND the second event should be a FeedbackRatingValueEvent
        second_event = actual_events[1]
        assert isinstance(second_event, FeedbackRatingValueEvent)
        assert second_event.event_type == EventType.FEEDBACK_RATING_VALUE
        assert second_event.feedback_type == feedback_type
        assert second_event.value == expected_score

    @pytest.mark.asyncio
    async def test_record_multiple_feedback_rating_value_events(self,
                                                                _mock_feedback_repository: IUserFeedbackRepository,
                                                                _mock_metrics_service: IMetricsService,
                                                                setup_application_config: ApplicationConfig):
        # GIVEN feedback specs with multiple question types
        given_user_id = get_random_user_id()
        given_session_id = get_random_session_id()

        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[
                NewFeedbackItemSpec(
                    question_id="recommendation",
                    simplified_answer=SimplifiedAnswer(rating_numeric=5),
                ),
                NewFeedbackItemSpec(
                    question_id="satisfaction_with_compass",
                    simplified_answer=SimplifiedAnswer(rating_numeric=4),
                ),
                NewFeedbackItemSpec(
                    question_id="interaction_ease",
                    simplified_answer=SimplifiedAnswer(rating_numeric=3),
                ),
            ],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND the repository will update the feedback successfully
        given_returned_feedback = _def_feedback()
        _mock_feedback_repository.upsert_feedback = AsyncMock(return_value=given_returned_feedback)

        # AND the metrics service is mocked
        _mock_metrics_service.bulk_record_events = AsyncMock()

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(
            user_feedback_repository=_mock_feedback_repository,
            metrics_service=_mock_metrics_service
        )
        await service.upsert_user_feedback(given_user_id, given_session_id, given_feedback_specs)

        # THEN the metrics service should be called once
        assert _mock_metrics_service.bulk_record_events.call_count == 1

        # AND each FeedbackRatingValueEvent should have the correct properties
        # 1 FeedbackProvidedEvent + 3 FeedbackRatingValueEvents
        actual_events = _mock_metrics_service.bulk_record_events.call_args[0][0]

        # The first event should be a FeedbackProvidedEvent
        assert isinstance(actual_events[0], FeedbackProvidedEvent)
        assert actual_events[0].event_type == EventType.FEEDBACK_PROVIDED

        # The next 3 events should be FeedbackRatingValueEvent
        assert len(actual_events) == 4
        assert all(isinstance(event, FeedbackRatingValueEvent) for event in actual_events[1:])

        # Check the FeedbackRatingValueEvent
        assert actual_events[1].feedback_type == "NPS"
        assert actual_events[1].value == 1
        assert actual_events[2].feedback_type == "CSAT"
        assert actual_events[2].value == 1
        assert actual_events[3].feedback_type == "CES"
        assert actual_events[3].value == 0
