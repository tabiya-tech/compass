"""
Tests for the feedback service
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock
import random
from typing import Any
from uuid import uuid4

import pytest
import pytest_mock

from app.conversations.feedback.repository import IUserFeedbackRepository
from app.version.utils import load_version_info
from common_libs.test_utilities import get_random_user_id, get_random_printable_string
from . import SimplifiedAnswer
from .service import UserFeedbackService
from .types import Feedback, FeedbackItem, Version, Answer, NewFeedbackSpec, NewFeedbackItemSpec, NewFeedbackVersionSpec
from .errors import (
    InvalidQuestionError,
    InvalidOptionError
)

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


def _get_new_feedback_spec(*,
                           session_id: int | None = None,
                           user_id: str | None = None,
                           feedback_items_specs: list[NewFeedbackItemSpec] | None = None
                           ) -> NewFeedbackSpec:
    """
    Returns a new feedback object with random data for testing purposes.
    If any parameters are provided, they will be used instead of random values.

    Args:
        session_id: Optional specific session ID to use
        user_id: Optional specific user ID to use
        feedback_items_specs: Optional specific feedback items to use
    """
    # Generate random session ID if not provided
    _session_id = session_id if session_id is not None else random.randint(1, 10000)  # nosec B311 # random is used for testing purposes
    # Generate random user ID if not provided
    _user_id = user_id if user_id is not None else get_random_user_id()

    random_question_id = random.choice(list(actual_questions_json_file.keys()))  # nosec B311 # random is used for testing purposes
    random_question: dict[str, Any] = actual_questions_json_file[random_question_id]

    # Use provided feedback items or create a default one
    _feedback_items = feedback_items_specs if feedback_items_specs is not None else [NewFeedbackItemSpec(
        question_id=random_question_id,
        simplified_answer=SimplifiedAnswer.from_answer(_get_random_answer(random_question))
    )]

    return NewFeedbackSpec(
        version=NewFeedbackVersionSpec(
            frontend=get_random_printable_string(5)
        ),
        feedback_items_specs=_feedback_items
    )


def _def_feedback() -> Feedback:
    random_question_id = random.choice(list(actual_questions_json.keys()))  # nosec B311 # random is used for testing purposes
    random_question: dict[str, Any] = actual_questions_json[random_question_id]

    return Feedback(
        id=str(uuid4()),
        session_id=random.randint(1, 10000),  # nosec B311 # random is used for testing purposes
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

        async def get_feedback_session_ids(self, user_id: str) -> list[int]:
            raise NotImplementedError()

    return MockedFeedbackRepository()


class TestUpsertFeedback:
    @pytest.mark.asyncio
    async def test_upsert_feedback_update(self, _mock_feedback_repository: IUserFeedbackRepository,
                                          mocker: pytest_mock.MockerFixture):
        # GIVEN a feedback specs to upsert
        given_user_id = get_random_user_id()
        given_session_id = random.randint(1, 10000)  # nosec B311 # random is used for testing purposes
        given_feedback_specs = NewFeedbackSpec(
            feedback_items_specs=[NewFeedbackItemSpec(**item) for item in given_feedback_item_specs_json],
            version=NewFeedbackVersionSpec(frontend="foo")
        )

        # AND the repository will update the feedback successfully
        given_returned_feedback = _def_feedback()
        _mock_feedback_repository.upsert_feedback = AsyncMock(return_value=given_returned_feedback)

        # AND datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # WHEN the upsert_feedback method is called
        service = UserFeedbackService(user_feedback_repository=_mock_feedback_repository)
        actual_feedback = await service.upsert_user_feedback(given_user_id,
                                                             given_session_id,  #nosec B311 # random is used for testing purposes
                                                             given_feedback_specs)
        actual_backend_version_info = await load_version_info()
        expected_backend_version = f"{actual_backend_version_info['branch']}-{actual_backend_version_info['buildNumber']}"
        expected_feedback = Feedback(
            id=None,
            session_id=given_session_id,
            user_id=given_user_id,
            version=Version(frontend=given_feedback_specs.version.frontend, backend=expected_backend_version),
            feedback_items=[FeedbackItem(**item) for item in expected_feedback_specs_json]
        )

        # THEN the repository's upsert_feedback method was called with the expected feedback
        _mock_feedback_repository.upsert_feedback.assert_called_once_with(expected_feedback)
        # AND the actual feedback returned by the method is whatever the repository returned
        assert actual_feedback == given_returned_feedback

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_question(self, _mock_feedback_repository: IUserFeedbackRepository):
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
        # THEN an InvalidQuestionError should be raised
        service = UserFeedbackService(user_feedback_repository=_mock_feedback_repository)
        with pytest.raises(InvalidQuestionError) as error_info:
            await service.upsert_user_feedback(get_random_user_id(),
                                               random.randint(1, 10000),  #nosec B311 # random is used for testing purposes
                                               given_feedback_specs)

        # AND the error should contain the invalid question ID
        assert "invalid_question" in str(error_info.value)

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_option(self, _mock_feedback_repository: IUserFeedbackRepository):
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
        service = UserFeedbackService(user_feedback_repository=_mock_feedback_repository)
        with pytest.raises(InvalidOptionError) as error_info:
            await service.upsert_user_feedback(get_random_user_id(),
                                               random.randint(1, 10000),  #nosec B311 # random is used for testing purposes
                                               given_feedback_specs)

        # AND the error should contain both the invalid option and question ID
        assert "invalid_option" in str(error_info.value)
        assert "interaction_ease" in str(error_info.value)


class TestGetUserFeedback:
    @pytest.mark.asyncio
    async def test_get_user_feedback_success(self, _mock_feedback_repository: IUserFeedbackRepository):
        # GIVEN a user ID
        given_user_id = "user123"

        # AND some session IDs in the repository
        given_session_ids = [123, 456]
        _mock_feedback_repository.get_feedback_session_ids = AsyncMock(return_value=given_session_ids)

        # WHEN get_user_feedback is called
        result = await UserFeedbackService(user_feedback_repository=_mock_feedback_repository).get_user_feedback(given_user_id)

        # THEN the session IDs should be returned
        assert result == given_session_ids

    @pytest.mark.asyncio
    async def test_get_user_feedback_no_feedback(self, _mock_feedback_repository: IUserFeedbackRepository):
        # GIVEN a user ID with no feedback
        given_user_id = "user123"

        # AND no session IDs in the repository
        _mock_feedback_repository.get_feedback_session_ids = AsyncMock(return_value=[])

        # WHEN get_user_feedback is called
        result = await UserFeedbackService(user_feedback_repository=_mock_feedback_repository).get_user_feedback(given_user_id)

        # THEN an empty list should be returned
        assert result == []
