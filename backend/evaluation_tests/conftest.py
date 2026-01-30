import asyncio
import os
from datetime import datetime, timezone

import pytest

from app.app_config import get_application_config, set_application_config, ApplicationConfig
from app.countries import Country
from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry
from app.i18n.locale_date_format import reset_date_format_cache
from app.i18n.types import Locale
from app.vector_search.vector_search_dependencies import SearchServices
from app.version.types import Version
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from evaluation_tests.conversation_libs.search_service_fixtures import get_search_services


def pytest_addoption(parser):
    parser.addoption("--max_iterations", action="store", default="5")
    parser.addoption("--test_cases_to_run", action="store", default="")
    parser.addoption("--test_cases_to_exclude", action="store", default="")


def pytest_generate_tests(metafunc):
    max_iterations_value = metafunc.config.option.max_iterations
    if 'max_iterations' in metafunc.fixturenames and max_iterations_value is not None:
        metafunc.parametrize("max_iterations", [int(max_iterations_value)])


@pytest.fixture(scope="session")
def event_loop():
    """
    Makes sure that all the async calls finish.

    Without it, the tests sometimes fail with "Event loop is closed" error.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def fake_conversation_context() -> FakeConversationContext:
    """ Returns a fake conversation context. """
    return FakeConversationContext()


@pytest.fixture()
def common_folder_path() -> str:
    """ Returns a common folder path that should be used in tests. """
    time_now = datetime.now(timezone.utc).isoformat()
    return os.path.join(os.path.dirname(__file__), 'test_output', time_now + '_')


@pytest.fixture(scope="function")
async def setup_search_services() -> SearchServices:
    search_services = await get_search_services()
    return search_services


@pytest.fixture(scope="function")
def setup_multi_locale_app_config():
    """
    Ensure ApplicationConfig is set with multi-locale language config for evaluation tests.
    Reuses existing ApplicationConfig if present, replacing language_config with EN_US and EN_GB entries.
    """
    try:
        current = get_application_config()
    except RuntimeError:
        current = None

    language_config = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[
            LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY"),
            LocaleDateFormatEntry(locale=Locale.EN_GB, date_format="DD/MM/YYYY"),
            LocaleDateFormatEntry(locale=Locale.ES_AR, date_format="DD/MM/YYYY"),
            LocaleDateFormatEntry(locale=Locale.ES_ES, date_format="DD/MM/YYYY")
        ],
    )

    if current is None:
        config = ApplicationConfig(
            environment_name="test",
            version_info=Version(date="test", branch="test", buildNumber="test", sha="test"),
            enable_metrics=False,
            default_country_of_user=Country.UNSPECIFIED,
            taxonomy_model_id="test",
            embeddings_service_name="test",
            embeddings_model_name="test",
            cv_storage_bucket="test",
            features={},
            language_config=language_config,
        )
    else:
        config = current.model_copy(update={"language_config": language_config})

    set_application_config(config)
    reset_date_format_cache()

    yield config

    # No teardown of ApplicationConfig to avoid affecting other fixtures; just clear the cache.
    reset_date_format_cache()



@pytest.fixture(scope="function")
def evals_setup(setup_application_config):
    return True
