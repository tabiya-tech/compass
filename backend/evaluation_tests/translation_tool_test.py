import pytest

from app.i18n.types import Locale
from common_libs.agent.translation_tool import TranslationTool
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _TestCase(CompassTestCase):
    given_user_text: str
    """
    Input text for the translation tool.
    """

    expected_translations: list[str]
    """
    The translations that the tool should return.
        it is an array since one word can have many meanings.
    """


test_cases: list[_TestCase] = [
    _TestCase(
        name="compass",
        locale=Locale.ES_AR,
        given_user_text="compass",
        expected_translations=["brújula"]
    ),
    _TestCase(
        name="food",
        locale=Locale.ES_AR,
        given_user_text="food",
        expected_translations=["alimento", "comida"]
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('current_test_case', get_test_cases_to_run(test_cases),
                         ids=[case.test_id for case in get_test_cases_to_run(test_cases)])
async def test_translation_tool(current_test_case):
    # GIVEN user's input
    # AND the target locale
    tool = TranslationTool(target_locale=current_test_case.locale)

    # WHEN the translation tool is executed with the given user's input'
    translated_text = await tool.translate(current_test_case.given_user_text)

    # THEN the translated text should be the expected one
    assert translated_text in current_test_case.expected_translations

    # WHEN comparing the texts, then LLM should return they are similar
    result = await tool.compare(current_test_case.given_user_text, translated_text)
    assert result == "SIMILAR"
