from datetime import datetime
import random

from app.conversations.feedback.services.types import Answer, FeedbackItem, Feedback, Version
from app.conversations.feedback.routes._types import FeedbackItemResponse, FeedbackResponse
from app.users.sessions import generate_new_session_id
from common_libs.test_utilities import get_random_printable_string


def _get_random_feedback_item() -> FeedbackItem:
    return FeedbackItem(
        question_id=get_random_printable_string(10),
        question_text=get_random_printable_string(20),
        description=get_random_printable_string(30),
        answer=Answer(
            selected_options={get_random_printable_string(10): get_random_printable_string(10) for _ in
                              range(random.randint(1, 5))},  # nosec B311 # random is used for testing purposes,
            rating_numeric=random.randint(1, 5),  # nosec B311 # random is used for testing purposes
            rating_boolean=random.choice([True, False]),  # nosec B311 # random is used for testing purposes
            comment=get_random_printable_string(40)
        )
    )


def _get_random_feedback() -> Feedback:
    return Feedback(
        id=get_random_printable_string(10),
        session_id=generate_new_session_id(),
        user_id=get_random_printable_string(10),
        version=Version(
            frontend=get_random_printable_string(10),
            backend=get_random_printable_string(10)
        ),
        feedback_items=[_get_random_feedback_item() for _ in range(random.randint(1, 5))],  # nosec B311 # random is used for testing purposes
        created_at=datetime.now()
    )


def test_feedback_item_response_from_feedback_item():
    # GIVEN a FeedbackItem
    given_feedback_item = _get_random_feedback_item()

    # WHEN converting to FeedbackItemResponse
    actual_response = FeedbackItemResponse.from_feedback_item(given_feedback_item)

    # THEN all fields should be correctly converted
    assert actual_response.question_id == given_feedback_item.question_id
    assert actual_response.question_text == given_feedback_item.question_text
    assert actual_response.description == given_feedback_item.description
    assert actual_response.simplified_answer.rating_numeric == given_feedback_item.answer.rating_numeric
    assert actual_response.simplified_answer.rating_boolean == given_feedback_item.answer.rating_boolean
    assert actual_response.simplified_answer.comment == given_feedback_item.answer.comment
    assert actual_response.simplified_answer.selected_options_keys == list(given_feedback_item.answer.selected_options.keys())


def test_feedback_response_from_feedback():
    # GIVEN a Feedback
    given_feedback = _get_random_feedback()

    # WHEN converting to FeedbackResponse
    actual_response = FeedbackResponse.from_feedback(given_feedback)

    # THEN all fields should be correctly converted
    assert actual_response.id == given_feedback.id
    assert actual_response.version == given_feedback.version
    assert actual_response.created_at == given_feedback.created_at

    # AND all feedback items should be correctly converted
    assert len(actual_response.feedback_items) == len(given_feedback.feedback_items)
    for actual_item, expected_item in zip(actual_response.feedback_items, given_feedback.feedback_items):
        assert actual_item.question_id == expected_item.question_id
        assert actual_item.question_text == expected_item.question_text
        assert actual_item.description == expected_item.description
        assert actual_item.simplified_answer.rating_numeric == expected_item.answer.rating_numeric
        assert actual_item.simplified_answer.rating_boolean == expected_item.answer.rating_boolean
        assert actual_item.simplified_answer.comment == expected_item.answer.comment
        assert actual_item.simplified_answer.selected_options_keys == list(expected_item.answer.selected_options.keys())
