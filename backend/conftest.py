import logging
import platform
import resource
from typing import Generator, Any

import pymongo
import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.app_config import ApplicationConfig, set_application_config, get_application_config
from app.countries import Country
from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry
from app.i18n.types import Locale
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.version.types import Version


_mocked_application_config = ApplicationConfig(
    environment_name="foo",
    version_info=Version(
        date="foo-date",
        branch="foo-branch",
        buildNumber="foo-build-number",
        sha="foo-sha"),
    default_country_of_user=Country.UNSPECIFIED,
    enable_metrics=True,
    taxonomy_model_id=str(ObjectId()),  # get a random object id.
    embeddings_service_name="foo-service",
    embeddings_model_name="bar-model",
    cv_storage_bucket="foo-bucket",
    features={},
    enable_cv_upload=True,
    language_config=LanguageConfig(
        conversation_fallback_locale=Locale.EN_US,
        reporting_locale=Locale.EN_US,
        available_locales=[
            LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
        ]
    ),
    app_name="Compass"
)

def _raise_open_file_limit(target: int = 10240):
    """
    Raise this process's open-file soft limit (RLIMIT_NO FILE) towards `target`, bounded by the hard limit.

    The in-memory mongodb is launched as a subprocess and inherits this limit, so raising it here gives
    mongodb enough file descriptors for WiredTiger's per-collection/per-index file handles. Never lowers
    the limit and silently no-ops if the platform refuses the change.
    """
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    desired = target if hard == resource.RLIM_INFINITY else min(target, hard)
    new_soft = max(soft, desired)
    if new_soft == soft:
        return
    try:
        resource.setrlimit(resource.RLIMIT_NOFILE, (new_soft, hard))
        logging.info("Raised open-file soft limit from %s to %s (hard limit: %s)", soft, new_soft, hard)
    except (ValueError, OSError) as e:
        logging.warning("Could not raise open-file soft limit from %s: %s", soft, e)


@pytest.fixture(scope='session')
def in_memory_mongo_server():
    """
    Fixture to start an in-memory MongoDB server.
    As starting and stopping the server is a heavy operation, we use the session scope.
    This may lead to issues if tests are not properly isolated.
    For that reason it is recommended to, use a different database name for each test (use the random_db_name() function).
    :return:
    """
    from pymongo_inmemory import Mongod
    from pymongo_inmemory.context import Context

    # Raise the open-file soft limit before starting mongodb.
    # The mongodb subprocess inherits this process's RLIMIT_NO FILE. On systems with a low default
    # (e.g., macOS' 256) mongodb runs out of file descriptors part-way through the suite and crashes
    # ("Too many open files" / dropped connections), because WiredTiger keeps a file handle per
    # collection and per index. We bump the soft limit up to the hard limit (capped at a sane value)
    # so the test run has enough headroom.
    _raise_open_file_limit()
    # -----

    # There is a bug in pymongo_inmemory where the for ubuntu and debian it will fall back to mongo v4.0.23
    # https://github.com/kaizendorks/pymongo_inmemory/issues/115
    # so for these operating systems we manually set the os_name in the context constructor
    os_name: str | None = None
    is_ubuntu = 'ubuntu' in platform.uname().version.lower()
    is_debian = 'debian' in platform.uname().version.lower()
    if is_ubuntu:
        os_name = 'ubuntu'
    if is_debian:
        os_name = 'debian'
    ctx = Context(version="7.0", os_name=os_name)
    # -----

    # After version 6, the storage engine is wiredTiger
    # We need to set this manually as there is an open issue in pymongo_inmemory that
    # incorrectly sets the storage engine to "ephemeralForTest".
    # See https://github.com/kaizendorks/pymongo_inmemory/pull/119
    ctx.storage_engine = "wiredTiger"
    # -----

    in_mem_mongo = Mongod(ctx)
    in_mem_mongo.start()
    yield in_mem_mongo
    logging.info("Stopping in-memory MongoDB server")
    in_mem_mongo.stop()


def random_db_name():
    """
    Generate a random db name for testing purposes.
    :return: str: A random db name.
    """
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits,
                                  k=10))  # nosec B311 # random is used for testing purposes


def drop_database_and_close_client(client: AsyncIOMotorClient, connection_string: str, db_name: str):
    """
    Tear down a per-test database created against the session-scoped in-memory MongoDB server.

    Every test creates a fresh database (see random_db_name()) with multiple collections and indexes.
    Because the mongodb server lives for the whole test session, the WiredTiger file handles for those
    collections/indexes keep accumulating and are never released until the database is dropped. On systems
    with a low open-file limit (e.g., the macOS default of 256) this eventually causes mongod to fail with
    "Too many open files" (TooManyFilesOpen / errno 24).

    Dropping the database releases mongodb's file handles; closing the client releases client-side sockets.
    A short-lived synchronous client is used so this can run from a (synchronous) pytest finalizer without
    depending on an active event loop.
    """
    try:
        with pymongo.MongoClient(connection_string, tlsAllowInvalidCertificates=True) as sync_client:
            sync_client.drop_database(db_name)
    finally:
        client.close()


@pytest.fixture(scope='function')
async def in_memory_userdata_database(in_memory_mongo_server, request) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory userdata database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked userdata database.
    """

    client = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                tlsAllowInvalidCertificates=True)
    userdata_db = client.get_database(random_db_name())
    request.addfinalizer(
        lambda: drop_database_and_close_client(client, in_memory_mongo_server.connection_string, userdata_db.name))
    set_application_config(_mocked_application_config)
    await CompassDBProvider.initialize_userdata_mongo_db(userdata_db, logger=logging.getLogger(__name__))
    logging.info(f"Created userdata database: {userdata_db.name}")
    return userdata_db


@pytest.fixture(scope='function')
async def in_memory_taxonomy_database(in_memory_mongo_server, request) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory taxonomy database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked taxonomy database.
    """

    client = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                tlsAllowInvalidCertificates=True)
    taxonomy_db = client.get_database(random_db_name())
    request.addfinalizer(
        lambda: drop_database_and_close_client(client, in_memory_mongo_server.connection_string, taxonomy_db.name))
    await CompassDBProvider.initialize_application_mongo_db(taxonomy_db, logger=logging.getLogger(__name__))
    logging.info(f"Created application database: {taxonomy_db.name}")
    return taxonomy_db


@pytest.fixture(scope='function')
async def in_memory_application_database(in_memory_mongo_server, request) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory application database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked application database.
    """

    client = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                tlsAllowInvalidCertificates=True)
    application_db = client.get_database(random_db_name())
    request.addfinalizer(
        lambda: drop_database_and_close_client(client, in_memory_mongo_server.connection_string, application_db.name))
    await CompassDBProvider.initialize_application_mongo_db(application_db, logger=logging.getLogger(__name__))
    logging.info(f"Created application database: {application_db.name}")
    return application_db


@pytest.fixture(scope='function')
async def in_memory_metrics_database(in_memory_mongo_server, request) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory metrics database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked metrics database.
    """
    client = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                tlsAllowInvalidCertificates=True)
    metrics_db = client.get_database(random_db_name())
    request.addfinalizer(
        lambda: drop_database_and_close_client(client, in_memory_mongo_server.connection_string, metrics_db.name))
    await CompassDBProvider.initialize_metrics_mongo_db(metrics_db, logger=logging.getLogger(__name__))
    logging.info(f"Created metrics database: {metrics_db.name}")
    return metrics_db


@pytest.fixture(scope="function")
def setup_application_config() -> Generator[ApplicationConfig, Any, None]:
    """
    Fixture to create an application config. For all tests that need to use the application config,
    they should use this fixture.
    """
    config = _mocked_application_config

    set_application_config(config)
    # guard to ensure the config is set
    if get_application_config() != config:
        raise RuntimeError("Application config not set properly.")
    yield config
    set_application_config(None)
