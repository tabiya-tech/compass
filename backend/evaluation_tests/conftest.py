import asyncio
from datetime import datetime, timezone

from app.app_config import ApplicationConfig, get_application_config, set_application_config
from app.countries import Country
from app.version.types import Version
from app.vector_search.vector_search_dependencies import SearchServices
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from evaluation_tests.conversation_libs.search_service_fixtures import get_search_services
from evaluation_tests.evalution_metrics import *


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


def _eval_application_config() -> ApplicationConfig:
    """
    The ApplicationConfig used by evaluation tests.
    """
    return ApplicationConfig(
        environment_name="test",
        version_info=Version(date="test", branch="test", buildNumber="test", sha="test"),
        enable_metrics=False,
        default_country_of_user=Country.UNSPECIFIED,
        taxonomy_model_id="test",
        embeddings_service_name="test",
        embeddings_model_name="test",
        cv_storage_bucket="test",
        features={},
    )


@pytest.fixture(scope="function", autouse=True)
def ensure_application_config():
    """
    Makes sure an ApplicationConfig is set for every evaluation test.
    Tests that request a specific config (e.g. `setup_application_config`) still override it.
    """
    try:
        get_application_config()
        config_was_set = True
    except RuntimeError:
        config_was_set = False

    if not config_was_set:
        set_application_config(_eval_application_config())

    yield

    if not config_was_set:
        set_application_config(None)


@pytest.fixture(scope="function")
def evals_setup(setup_application_config):
    return True
