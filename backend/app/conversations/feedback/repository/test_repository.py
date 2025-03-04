"""
Tests for the feedback repository.
It uses the userdata_mocked database, and tests if repository methods work as expected with actual data.
"""
from typing import Awaitable
from datetime import datetime, timezone
import random

import pytest
import pytest_mock
import bson

from app.conversations.feedback.repository import UserFeedbackRepository
from app.conversations.feedback.services import Feedback, FeedbackItem, Answer, Version
from common_libs.time_utilities import datetime_to_mongo_date, get_now
from common_libs.test_utilities import get_random_printable_string, get_random_user_id
from app.users.sessions import generate_new_session_id


def _assert_feedback_matches(doc, expected_feedback):
    # First check the basic fields
    assert doc["session_id"] == expected_feedback.session_id
    assert doc["user_id"] == expected_feedback.user_id
    assert doc["version"]["frontend"] == expected_feedback.version.frontend
    assert doc["version"]["backend"] == expected_feedback.version.backend

    # Create a map of question_id to feedback items for both actual and expected
    actual_items = {item["question_id"]: item for item in doc["feedback_items"]}
    expected_items = {item.question_id: item for item in expected_feedback.feedback_items}

    # Check that we have the same number of items
    assert len(actual_items) == len(expected_items)

    # Check each expected item exists in actual with matching data
    for question_id, expected_item in expected_items.items():
        assert question_id in actual_items, f"Expected question {question_id} not found in actual feedback"
        actual_item = actual_items[question_id]

        # Compare all fields
        assert actual_item["question_text"] == expected_item.question_text
        assert actual_item["description"] == expected_item.description

        # Compare answer fields
        assert actual_item["answer"]["selected_options"] == expected_item.answer.selected_options
        assert actual_item["answer"]["rating_numeric"] == expected_item.answer.rating_numeric
        assert actual_item["answer"]["rating_boolean"] == expected_item.answer.rating_boolean
        assert actual_item["answer"]["comment"] == expected_item.answer.comment


@pytest.fixture(scope="function")
async def get_feedback_repository(in_memory_application_database) -> UserFeedbackRepository:
    application_db = await in_memory_application_database
    repository = UserFeedbackRepository(application_db)
    return repository


def _get_feedback_item(*, question_id: str) -> FeedbackItem:
    return FeedbackItem(
        question_id=question_id,
        question_text=get_random_printable_string(10),
        description=get_random_printable_string(10),
        answer=Answer(
            selected_options={get_random_printable_string(10): get_random_printable_string(10)},
            rating_numeric=random.randint(1, 5),  # nosec B311 # random is used for testing purposes
            rating_boolean=random.choice([True, False]),  # nosec B311 # random is used for testing purposes
            comment=get_random_printable_string(10)
        )
    )


def _get_feedback(*, with_id: bool, question_ids: list[str]) -> Feedback:
    return Feedback(
        id=str(bson.ObjectId()) if with_id else None,
        session_id=generate_new_session_id(),
        user_id=get_random_user_id(),
        version=Version(frontend="1.0.0", backend="1.0.0"),
        feedback_items=[
            _get_feedback_item(question_id=q_id) for q_id in question_ids
        ],
        created_at=get_now()
    )


def _get_random_feedback(*, with_id: bool, feedback_items_count: int) -> Feedback:
    return _get_feedback(with_id=with_id, question_ids=[get_random_printable_string(10) for _ in range(feedback_items_count)])


def _get_new_feedback_doc() -> dict:
    """
    Creates a new feedback document for testing.
    """
    return {
        "_id": bson.ObjectId(),
        "session_id": random.randint(5, 10),  # nosec B311 # random is used for testing purposes
        "user_id": get_random_user_id(),
        "version": {
            "frontend": "1.0.0",
            "backend": "1.0.0"
        },
        "feedback_items": [{
            "question_id": get_random_printable_string(10),
            "answer": {
                "selected_options": {get_random_printable_string(10): get_random_printable_string(10)},
                "rating_numeric": random.randint(1, 5),  # nosec B311 # random is used for testing purposes
                "rating_boolean": random.choice([True, False]),  # nosec B311 # random is used for testing purposes
                "comment": get_random_printable_string(10)
            },
            "question_text": get_random_printable_string(10),
            "description": get_random_printable_string(10)
        }, {
            "question_id": get_random_printable_string(10),
            "answer": {
                "selected_options": {},
                "rating_numeric": None,
                "rating_boolean": None,
                "comment": None
            },
            "question_text": get_random_printable_string(10),
            "description": get_random_printable_string(10)
        }],
        "created_at": datetime_to_mongo_date(datetime.now(timezone.utc))
    }


class TestDocumentMapping:
    @pytest.mark.asyncio
    async def test_roundtrip(self):
        # GIVEN a feedback object
        given_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)

        # WHEN it is converted to a document
        actual_doc = UserFeedbackRepository._to_db_doc(given_feedback)

        # AND that document is converted back into a feedback object
        actual_feedback = UserFeedbackRepository._from_db_doc(actual_doc)

        # THEN the result should be identical
        assert given_feedback == actual_feedback

    @pytest.mark.asyncio
    async def test_from_doc_for_feedback_without_feedback_items(self):
        # GIVEN a feedback doc
        given_feedback_doc = _get_new_feedback_doc()
        del given_feedback_doc["feedback_items"]

        # AND that document is converted back into a feedback object
        actual_feedback = UserFeedbackRepository._from_db_doc(given_feedback_doc)

        # THEN the result should be identical
        assert actual_feedback.session_id == given_feedback_doc["session_id"]
        assert actual_feedback.user_id == given_feedback_doc["user_id"]
        assert actual_feedback.version.frontend == given_feedback_doc["version"]["frontend"]
        assert actual_feedback.version.backend == given_feedback_doc["version"]["backend"]
        assert actual_feedback.feedback_items == []
        assert actual_feedback.created_at == datetime_to_mongo_date(given_feedback_doc["created_at"])

    @pytest.mark.asyncio
    async def test_from_doc_for_feedback_items_without_answer(self):
        # GIVEN a feedback doc
        given_feedback_doc = _get_new_feedback_doc()
        del given_feedback_doc["feedback_items"][0]["answer"]

        # AND that document is converted back into a feedback object
        actual_feedback = UserFeedbackRepository._from_db_doc(given_feedback_doc)

        # THEN the result should be identical
        assert actual_feedback.session_id == given_feedback_doc["session_id"]
        assert actual_feedback.user_id == given_feedback_doc["user_id"]
        assert actual_feedback.version.frontend == given_feedback_doc["version"]["frontend"]
        assert actual_feedback.version.backend == given_feedback_doc["version"]["backend"]
        assert actual_feedback.feedback_items[0].question_id == given_feedback_doc["feedback_items"][0]["question_id"]
        assert actual_feedback.feedback_items[0].question_text == given_feedback_doc["feedback_items"][0]["question_text"]
        assert actual_feedback.feedback_items[0].description == given_feedback_doc["feedback_items"][0]["description"]
        assert actual_feedback.feedback_items[0].answer.selected_options == {}
        assert actual_feedback.feedback_items[0].answer.rating_numeric is None
        assert actual_feedback.feedback_items[0].answer.rating_boolean is None
        assert actual_feedback.feedback_items[0].answer.comment is None
        assert actual_feedback.created_at == datetime_to_mongo_date(given_feedback_doc["created_at"])


class TestUpsertFeedback:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("given_feedback",
                             [_get_random_feedback(with_id=True, feedback_items_count=2), _get_random_feedback(with_id=False, feedback_items_count=2)],
                             ids=["with_id", "without_id"])
    async def test_insert_feedback_success_for_new_feedback(self, given_feedback, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # AND there is no previous feedback for this session
        assert await repository._collection.find_one({'session_id': given_feedback.session_id}) is None

        # WHEN the upsert_feedback method is called
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND it should have an id  be a string
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)
        # AND the id should not be the same as the given feedback
        assert result.id != given_feedback.id

        # AND the feedback can be found in the database with the inserted_id
        doc = await repository._collection.find_one({'_id': bson.ObjectId(result.id)})

        # AND the saved feedback matches the given data
        _assert_feedback_matches(doc, given_feedback)

    @pytest.mark.asyncio
    async def test_update_document_and_feedback_have_same_question_ids(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                                       mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback entry for a user and session exists in the database (no id)
        existing_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(existing_feedback))

        # guard assert that the previous feedback is in the database
        assert await repository._collection.find_one({'session_id': existing_feedback.session_id}) is not None

        # AND a new feedback entry for the same session that answers the same question as the existing feedback
        given_feedback = _get_feedback(with_id=False, question_ids=[item.question_id for item in existing_feedback.feedback_items])
        given_feedback.session_id = existing_feedback.session_id
        given_feedback.user_id = existing_feedback.user_id

        # guard assert that the old feedback and new feedback are not identical but have the same item question_ids
        assert existing_feedback != given_feedback
        assert len(existing_feedback.feedback_items) == len(given_feedback.feedback_items)
        given_feedback_question_ids = [item.question_id for item in given_feedback.feedback_items]
        assert all(item.question_id in given_feedback_question_ids for item in existing_feedback.feedback_items)

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback we find when we query the database with the session_id should match the given feedback
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        _assert_feedback_matches(doc, given_feedback)

    @pytest.mark.asyncio
    async def test_update_feedback_has_all_questions_from_document_and_more(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                                            mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback entry for a user and session exists in the database (no id)
        existing_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(existing_feedback))

        # guard assert that the previous feedback is in the database
        assert await repository._collection.find_one({'session_id': existing_feedback.session_id}) is not None

        # AND a new feedback entry for the same session that answers all of the questions in the existing feedback and more
        given_feedback = _get_feedback(with_id=False, question_ids=[item.question_id for item in existing_feedback.feedback_items])
        given_feedback.session_id = existing_feedback.session_id
        given_feedback.user_id = existing_feedback.user_id
        # add a random question to the new feedback
        given_feedback.feedback_items.append(_get_feedback_item(question_id=get_random_printable_string(10)))

        # guard assert that the old feedback and new feedback are not identical
        assert existing_feedback != given_feedback
        # guard assert that all the question ids in the existing feedback are in the new feedback
        given_feedback_question_ids = [item.question_id for item in given_feedback.feedback_items]
        assert all(existing_item.question_id in given_feedback_question_ids for existing_item in existing_feedback.feedback_items)
        # guard assert that the new feedback has more items than the existing feedback
        assert len(given_feedback.feedback_items) > len(existing_feedback.feedback_items)

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback we find when we query the database with the session_id should match the given feedback
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        _assert_feedback_matches(doc, given_feedback)

    @pytest.mark.asyncio
    async def test_update_document_has_all_questions_from_feedback_and_more(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                                            mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback entry for a user and session exists in the database (no id)
        existing_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(existing_feedback))

        # guard assert that the previous feedback is in the database
        assert await repository._collection.find_one({'session_id': existing_feedback.session_id}) is not None

        # AND a new feedback entry for the same session that answers one (but not all) of the questions in the existing feedback
        given_feedback = _get_feedback(with_id=False, question_ids=[existing_feedback.feedback_items[0].question_id])
        given_feedback.session_id = existing_feedback.session_id
        given_feedback.user_id = existing_feedback.user_id

        # guard assert that the old feedback and new feedback are not identical but have the same question id for the first item
        assert existing_feedback != given_feedback
        assert existing_feedback.feedback_items[0].question_id == given_feedback.feedback_items[0].question_id

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback we find when we query the database with the session_id should have the updated item for the first question
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        assert doc is not None
        actual_expected_feedback_items = []
        actual_expected_feedback_items.append(given_feedback.feedback_items[0])
        actual_expected_feedback_items.append(existing_feedback.feedback_items[1])
        # construct the actual expected feedback
        actual_expected_feedback = Feedback(
            session_id=doc["session_id"],
            user_id=doc["user_id"],
            version=Version(frontend=doc["version"]["frontend"], backend=doc["version"]["backend"]),
            feedback_items=actual_expected_feedback_items
        )
        _assert_feedback_matches(doc, actual_expected_feedback)

    @pytest.mark.asyncio
    async def test_update_feedback_and_document_have_some_in_common_and_some_differences(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                                                         mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback entry for a user and session exists in the database (no id)
        existing_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(existing_feedback))

        # guard assert that the previous feedback is in the database
        assert await repository._collection.find_one({'session_id': existing_feedback.session_id}) is not None

        # AND a new feedback entry for the same session that answers one (but not all) of the questions in the existing feedback
        # AND the new feedback has some additional questions that are not in the existing feedback
        given_feedback = _get_feedback(with_id=False, question_ids=[existing_feedback.feedback_items[0].question_id])
        given_feedback.session_id = existing_feedback.session_id
        given_feedback.user_id = existing_feedback.user_id
        # add a random question to the new feedback
        given_feedback.feedback_items.append(_get_feedback_item(question_id=get_random_printable_string(10)))

        # guard assert that the old feedback and new feedback are not identical but have the same question id for the first item
        assert existing_feedback != given_feedback
        assert existing_feedback.feedback_items[0].question_id == given_feedback.feedback_items[0].question_id

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback items we find in the database should match the intersection of the old and new feedback items
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        assert doc is not None
        actual_expected_feedback_items = []
        # if the question id is in given feedback, then add the given feedback item to the actual feedback items
        # otherwise, add the existing feedback item to the actual feedback items
        actual_expected_feedback_items.append(given_feedback.feedback_items[0])  # in both
        actual_expected_feedback_items.append(existing_feedback.feedback_items[1])  # in old
        actual_expected_feedback_items.append(given_feedback.feedback_items[1])  # in new
        # construct the actual expected feedback
        actual_expected_feedback = Feedback(
            id=str(doc["_id"]),
            session_id=doc["session_id"],
            user_id=doc["user_id"],
            version=Version(frontend=doc["version"]["frontend"], backend=doc["version"]["backend"]),
            feedback_items=actual_expected_feedback_items
        )

        _assert_feedback_matches(doc, actual_expected_feedback)

    @pytest.mark.asyncio
    async def test_update_feedback_and_document_have_no_questions_in_common(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                                            mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository
        # datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # GIVEN a feedback entry for a user and session exists in the database (no id)
        existing_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(existing_feedback))

        # guard assert that the previous feedback is in the database
        assert await repository._collection.find_one({'session_id': existing_feedback.session_id}) is not None

        # AND a new feedback entry for the same session that answers none of the questions in the existing feedback
        given_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        given_feedback.session_id = existing_feedback.session_id
        given_feedback.user_id = existing_feedback.user_id

        # guard assert that the old feedback and new feedback are not identical
        assert existing_feedback != given_feedback

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback we find when we query the database with the session_id should both the old and new feedback
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        actual_expected_feedback_items = [*given_feedback.feedback_items, *existing_feedback.feedback_items]
        # construct the actual expected feedback
        actual_expected_feedback = Feedback(
            id=str(doc["_id"]),
            session_id=doc["session_id"],
            user_id=doc["user_id"],
            version=Version(frontend=doc["version"]["frontend"], backend=doc["version"]["backend"]),
            feedback_items=actual_expected_feedback_items
        )
        _assert_feedback_matches(doc, actual_expected_feedback)

    @pytest.mark.asyncio
    async def test_update_feedback_successfully_for_no_existing_feedback(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a new feedback entry for a user and session that does not exist in the database
        given_feedback = _get_random_feedback(with_id=True, feedback_items_count=2)

        # guard assert that no items in the given feedback are in the database
        assert await repository._collection.find_one({'session_id': given_feedback.session_id}) is None

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the feedback we find when we query the database with the session_id should match the given feedback
        doc = await repository._collection.find_one({'session_id': given_feedback.session_id})
        _assert_feedback_matches(doc, given_feedback)

    @pytest.mark.asyncio
    async def test_should_update_feedback_for_given_user_and_leave_others_untouched(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a feedback entry to add for a user and session
        new_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)

        # AND a feedback entry for a different user and session already exists in the database
        other_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository.upsert_feedback(other_feedback)

        # guard assert that the new feedback and existing feedback are not for the same user
        assert new_feedback.user_id != other_feedback.user_id

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(new_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)

        # AND the feedback we find when we query the database with the session_id should match the given feedback
        doc = await repository._collection.find_one({'session_id': new_feedback.session_id})
        _assert_feedback_matches(doc, new_feedback)

        # AND the other feedback should be untouched
        doc = await repository._collection.find_one({'session_id': other_feedback.session_id})
        _assert_feedback_matches(doc, other_feedback)

    @pytest.mark.asyncio
    async def test_user_should_fail_to_update_feedback_for_another_user(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a feedback entry for a user and session exists in the database
        user_1_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        await repository.upsert_feedback(user_1_feedback)

        # AND a new feedback entry for the same session but different user
        user_2_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        user_2_feedback.session_id = user_1_feedback.session_id  # same session
        assert user_2_feedback.user_id != user_1_feedback.user_id  # different user

        # WHEN the upsert_feedback method is called with new feedback
        # THEN an error should occur
        # Note: The correct filter should return null feedback, triggering an insert attempt.
        # This will fail with a DuplicateKeyError if the filter is correct.
        # If the filter only checks for session_id (without the necessary condition),
        # it may return another user's feedback and overwrite it, which we want to avoid.
        with pytest.raises(Exception):
            await repository.upsert_feedback(user_2_feedback)

        # AND the feedback for user 1 should be untouched
        doc = await repository._collection.find_one({'session_id': user_1_feedback.session_id})
        _assert_feedback_matches(doc, user_1_feedback)

    @pytest.mark.asyncio
    async def test_db_upsert_throws(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                    mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository

        # GIVEN the repository's collection's find_one_and_update function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _find_one_and_update_spy = mocker.spy(repository._collection, 'find_one_and_update')
        _find_one_and_update_spy.side_effect = given_error

        # WHEN the upsert_feedback method is called
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.upsert_feedback(_get_random_feedback(with_id=False, feedback_items_count=2))

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_error


class TestGetFeedbackBySessionId:
    @pytest.mark.asyncio
    async def test_get_feedback_by_session_id_success(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a feedback exists in the database
        given_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        result = await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(given_feedback))
        assert result is not None

        # WHEN get_feedback_by_session_id is called
        feedback = await repository.get_feedback_by_session_id(given_feedback.session_id)

        # THEN the feedback should be found
        assert feedback is not None
        # AND it should match the given feedback
        assert feedback.session_id == given_feedback.session_id
        assert feedback.user_id == given_feedback.user_id
        assert feedback.version == given_feedback.version
        assert feedback.feedback_items == given_feedback.feedback_items

    @pytest.mark.asyncio
    async def test_get_feedback_by_session_id_not_found(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a session id that doesn't exist
        given_session_id = 999

        # WHEN get_feedback_by_session_id is called
        feedback = await repository.get_feedback_by_session_id(given_session_id)

        # THEN None should be returned
        assert feedback is None

    @pytest.mark.asyncio
    async def test_db_find_one_throws(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                      mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository

        # GIVEN the repository's collection's find_one function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _find_one_spy = mocker.spy(repository._collection, 'find_one')
        _find_one_spy.side_effect = given_error

        # WHEN get_feedback_by_session_id is called
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.get_feedback_by_session_id(123)

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_error


class TestGetAllFeedbackForUser:
    @pytest.mark.asyncio
    async def test_feedback_for_user_with_no_feedback(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a user id with no feedback
        given_user_id = get_random_user_id()

        # WHEN get_all_feedback_for_user is called
        result = await repository.get_all_feedback_for_user(given_user_id)

        # THEN an empty dict should be returned
        assert isinstance(result, dict)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_feedback_for_user_with_a_session_that_has_feedback(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN feedback exists for a user in a single session
        given_user_id = get_random_user_id()
        given_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        given_feedback.user_id = given_user_id

        # AND the feedback is added to the database
        await repository.upsert_feedback(given_feedback)

        # WHEN get_all_feedback_for_user is called
        result = await repository.get_all_feedback_for_user(given_user_id)

        # THEN we should get back a dictionary with one session
        assert isinstance(result, dict)
        assert len(result) == 1
        # AND the session should contain the feedback items
        assert given_feedback.session_id in result
        assert isinstance(result[given_feedback.session_id], Feedback)
        assert len(result[given_feedback.session_id].feedback_items) == 2
        # AND the feedback items should match
        assert all(item in given_feedback.feedback_items for item in result[given_feedback.session_id].feedback_items)

    @pytest.mark.asyncio
    async def test_feedback_for_user_with_multiple_sessions_that_have_feedback(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN multiple feedback exists for a user across different sessions
        given_user_id = get_random_user_id()
        given_feedback_1 = _get_random_feedback(with_id=False, feedback_items_count=2)
        given_feedback_1.user_id = given_user_id
        given_feedback_2 = _get_random_feedback(with_id=False, feedback_items_count=3)
        given_feedback_2.user_id = given_user_id

        # AND the feedback is added to the database
        await repository.upsert_feedback(given_feedback_1)
        await repository.upsert_feedback(given_feedback_2)

        # WHEN get_all_feedback_for_user is called
        result = await repository.get_all_feedback_for_user(given_user_id)

        # THEN we should get back a dictionary with both sessions
        assert isinstance(result, dict)
        assert len(result) == 2
        # AND each session should contain the correct feedback items
        assert given_feedback_1.session_id in result
        assert isinstance(result[given_feedback_1.session_id], Feedback)
        assert given_feedback_2.session_id in result
        assert isinstance(result[given_feedback_2.session_id], Feedback)
        # AND the feedback items should match for each session
        assert all(item in given_feedback_1.feedback_items for item in result[given_feedback_1.session_id].feedback_items)
        assert all(item in given_feedback_2.feedback_items for item in result[given_feedback_2.session_id].feedback_items)

    @pytest.mark.asyncio
    async def test_get_all_feedback_for_user_ignores_other_users(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN feedback exists for two different users
        given_user_id = get_random_user_id()
        other_user_id = get_random_user_id()
        given_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        other_feedback = _get_random_feedback(with_id=False, feedback_items_count=2)
        given_feedback.user_id = given_user_id
        other_feedback.user_id = other_user_id

        # AND the feedback is added to the database
        await repository.upsert_feedback(given_feedback)
        await repository.upsert_feedback(other_feedback)

        # WHEN get_all_feedback_for_user is called for the given user
        result = await repository.get_all_feedback_for_user(given_user_id)

        # THEN we should only get back the feedback for the given user
        assert isinstance(result, dict)
        assert len(result) == 1
        assert given_feedback.session_id in result
        assert other_feedback.session_id not in result

    @pytest.mark.asyncio
    async def test_get_all_feedback_for_user_db_find_throws(self, get_feedback_repository: Awaitable[UserFeedbackRepository],
                                                            mocker: pytest_mock.MockerFixture):
        repository = await get_feedback_repository

        # GIVEN the repository's collection's find function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _find_spy = mocker.spy(repository._collection, 'find')
        _find_spy.side_effect = given_error

        # WHEN get_all_feedback_for_user is called
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.get_all_feedback_for_user(get_random_user_id())

        # THEN the raised error message should be the same as the given error
        assert actual_error_info.value == given_error


class TestUniqueIndex:
    @pytest.mark.asyncio
    async def test_not_allow_more_than_one_feedback_per_session(self, get_feedback_repository: Awaitable[UserFeedbackRepository]):
        repository = await get_feedback_repository

        # GIVEN a new feedback entry for a user and session that does not exist in the database
        given_feedback = _get_random_feedback(with_id=True, feedback_items_count=2)

        # WHEN the upsert_feedback method is called with the new feedback
        result = await repository.upsert_feedback(given_feedback)

        # THEN the result should be a Feedback object
        assert isinstance(result, Feedback)
        # AND the feedback response should have been assigned an id
        assert isinstance(result.id, str)

        # WHEN an insert is attempted again for a different feedback for the same session
        given_duplicate_feedback = _get_random_feedback(with_id=True, feedback_items_count=2)
        given_duplicate_feedback.session_id = given_feedback.session_id

        # THEN the upsert_feedback method should raise a ValueError
        with pytest.raises(Exception):
            await repository._collection.insert_one(UserFeedbackRepository._to_db_doc(given_duplicate_feedback))
