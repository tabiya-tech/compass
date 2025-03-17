"""
Tests for the feedback service
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch
import random
from typing import Any
from uuid import uuid4

import pytest
import pytest_mock

from app.conversations.feedback.repository import IUserFeedbackRepository
from app.users.sessions import generate_new_session_id
from app.version.utils import load_version_info
from common_libs.test_utilities import get_random_user_id, get_random_printable_string
from . import SimplifiedAnswer
from .service import UserFeedbackService
from .types import Feedback, FeedbackItem, Version, Answer, NewFeedbackSpec, NewFeedbackItemSpec, NewFeedbackVersionSpec
from app.conversations.feedback.services.service import questions_cache
from .errors import (
    InvalidQuestionError,
    InvalidOptionError, QuestionsFileError
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

def _def_feedback() -> Feedback:
    random_question_id = random.choice(list(actual_questions_json.keys()))  # nosec B311 # random is used for testing purposes
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

    @pytest.mark.asyncio
    async def test_upsert_feedback_nonexistent_questions_file(self, _mock_feedback_repository: IUserFeedbackRepository):
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
            service = UserFeedbackService(user_feedback_repository=_mock_feedback_repository)
            with pytest.raises(QuestionsFileError):
                await service.upsert_user_feedback(get_random_user_id(),
                                                   random.randint(1, 10000),  #nosec B311 # random is used for testing purposes
                                                   given_feedback_specs)

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_questions_file(self, _mock_feedback_repository: IUserFeedbackRepository):
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
            service = UserFeedbackService(user_feedback_repository=_mock_feedback_repository)
            with pytest.raises(QuestionsFileError):
                await service.upsert_user_feedback(get_random_user_id(),
                                                   random.randint(1, 10000),  #nosec B311 # random is used for testing purposes
                                                   given_feedback_specs)


class TestGetAnsweredQuestions:
    @pytest.mark.asyncio
    async def test_get_answered_questions_success(self, _mock_feedback_repository: IUserFeedbackRepository):
        # GIVEN a user ID
        given_user_id = "user123"

        # AND some feedback data in the repository
        given_feedback = {
            123: _def_feedback(),
            456: _def_feedback()
        }
        _mock_feedback_repository.get_all_feedback_for_user = AsyncMock(return_value=given_feedback)

        # WHEN get_answered_questions is called
        result = await UserFeedbackService(user_feedback_repository=_mock_feedback_repository).get_answered_questions(given_user_id)

        # THEN the question IDs for each session should be returned
        expected_dict = {}
        for key in list(given_feedback.keys()):
            expected_dict[key] = [item.question_id for item in given_feedback[key].feedback_items]
        assert result == expected_dict

        # AND the repository's get_all_feedback_for_user method was called with the expected user ID
        _mock_feedback_repository.get_all_feedback_for_user.assert_called_once_with(given_user_id)

    @pytest.mark.asyncio
    async def test_get_answered_questions_no_feedback(self, _mock_feedback_repository: IUserFeedbackRepository):
        # GIVEN a user ID with no feedback
        given_user_id = "user123"

        # AND no feedback in the repository
        _mock_feedback_repository.get_all_feedback_for_user = AsyncMock(return_value={})

        # WHEN get_answered_questions is called
        result = await UserFeedbackService(user_feedback_repository=_mock_feedback_repository).get_answered_questions(given_user_id)

        # THEN an empty dictionary should be returned
        assert result == {}

        # AND the repository's get_all_feedback_for_user method was called with the expected user ID
        _mock_feedback_repository.get_all_feedback_for_user.assert_called_once_with(given_user_id)
