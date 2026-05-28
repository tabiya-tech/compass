import pytest

from app.context_vars import user_language_ctx_var
from app.i18n.locale_context import LocaleContext
from app.i18n.types import Locale


@pytest.fixture(autouse=True)
def set_user_language_locale():
    """
    Set the user language locale context variable for all tests in this package.

    The agent builds its prompts via get_language_style(with_locale=True), which reads the
    locale from user_language_ctx_var. Without this, get_locale() raises LookupError during
    agent construction. We set it as part of test preparation and reset it afterwards.
    """
    # GIVEN the user language locale is set
    token = user_language_ctx_var.set(LocaleContext(
        conversation_locale=Locale.EN_US,
        reporting_locale=Locale.EN_US
    ))
    yield
    # cleanup: reset the context variable after the test
    user_language_ctx_var.reset(token)
