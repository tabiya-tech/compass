import pytest
import random

from app.conversations.feedback.services.types import Answer, SimplifiedAnswer, InvalidOptionError
from common_libs.test_utilities import get_random_printable_string


def _get_random_answer() -> Answer:
    return Answer(
        selected_options={get_random_printable_string(10): get_random_printable_string(10) for _ in range(random.randint(1, 5))},  # nosec B311 # random is used for testing purposes
        rating_numeric=random.randint(1, 5),  # nosec B311 # random is used for testing purposes
        rating_boolean=random.choice([True, False]),  # nosec B311 # random is used for testing purposes
        comment=get_random_printable_string(10)
    )

def test_simplified_answer_from_answer():
    # GIVEN an Answer with all fields populated
    given_answer = _get_random_answer()

    # WHEN converting to SimplifiedAnswer
    actual_simplified_answer = SimplifiedAnswer.from_answer(given_answer)

    # THEN all fields should be correctly converted
    assert actual_simplified_answer.rating_numeric == given_answer.rating_numeric
    assert actual_simplified_answer.rating_boolean is given_answer.rating_boolean
    assert actual_simplified_answer.comment == given_answer.comment
    assert actual_simplified_answer.selected_options_keys == list(given_answer.selected_options.keys())

def test_simplified_answer_from_answer_with_empty_fields():
    # GIVEN an Answer with empty fields
    given_answer = Answer(
        selected_options={},
        rating_numeric=None,
        rating_boolean=None,
        comment=None
    )

    # WHEN converting to SimplifiedAnswer
    actual_simplified_answer = SimplifiedAnswer.from_answer(given_answer)

    # THEN all fields should be None or empty
    assert actual_simplified_answer.rating_numeric is None
    assert actual_simplified_answer.rating_boolean is None
    assert actual_simplified_answer.comment is None
    assert actual_simplified_answer.selected_options_keys == []

def test_simplified_answer_to_answer():
    # GIVEN a SimplifiedAnswer and available options
    given_simplified_answer = SimplifiedAnswer(
        selected_options_keys=["option1", "option3"],
        rating_numeric=5,
        rating_boolean=True,
        comment="Test comment"
    )
    # AND some available options for the question that includes all the keys in the SimplifiedAnswer with a few extra options
    available_options = {
        "option1": "First Option",
        "option2": "Second Option",
        "option3": "Third Option",
        "option4": "Fourth Option",
        "option5": "Fifth Option"
    }
    # WHEN converting back to Answer
    actual_answer = given_simplified_answer.to_answer(question_id="test_question", available_options=available_options)

    # THEN all fields should be correctly converted
    assert actual_answer.rating_numeric == given_simplified_answer.rating_numeric
    assert actual_answer.rating_boolean is given_simplified_answer.rating_boolean
    assert actual_answer.comment == given_simplified_answer.comment
    assert actual_answer.selected_options == {
        "option1": "First Option",
        "option3": "Third Option"
    }

def test_simplified_answer_to_answer_with_invalid_option():
    # GIVEN a SimplifiedAnswer with an invalid option key
    simplified = SimplifiedAnswer(
        selected_options_keys=["invalid_option"],
        rating_numeric=5
    )
    # AND some available options for the question that dont include the invalid option
    available_options = {
        "valid_option1": "Valid Option 1",
        "valid_option2": "Valid Option 2"
    }

    # WHEN converting back to Answer
    # THEN it should raise InvalidOptionError
    with pytest.raises(InvalidOptionError) as exc_info:
        simplified.to_answer(question_id="test_question", available_options=available_options)
    
    assert str(exc_info.value) == "Invalid option 'invalid_option' for question 'test_question'"