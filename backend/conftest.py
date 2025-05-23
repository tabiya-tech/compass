import logging
import platform
from typing import Generator, Any

import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.countries import Country
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.version.types import Version
from app.app_config import ApplicationConfig, set_application_config, get_application_config


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


@pytest.fixture(scope='function')
async def in_memory_userdata_database(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory userdata database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked userdata database.
    """

    userdata_db = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                     tlsAllowInvalidCertificates=True).get_database(random_db_name())

    await CompassDBProvider.initialize_userdata_mongo_db(userdata_db, logger=logging.getLogger(__name__))
    logging.info(f"Created userdata database: {userdata_db.name}")
    return userdata_db


@pytest.fixture(scope='function')
async def in_memory_taxonomy_database(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory taxonomy database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked taxonomy database.
    """

    taxonomy_db = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                     tlsAllowInvalidCertificates=True).get_database(random_db_name())

    await CompassDBProvider.initialize_application_mongo_db(taxonomy_db, logger=logging.getLogger(__name__))
    logging.info(f"Created application database: {taxonomy_db.name}")
    return taxonomy_db


@pytest.fixture(scope='function')
async def in_memory_application_database(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory application database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked application database.
    """

    application_db = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                        tlsAllowInvalidCertificates=True).get_database(random_db_name())

    await CompassDBProvider.initialize_application_mongo_db(application_db, logger=logging.getLogger(__name__))
    logging.info(f"Created application database: {application_db.name}")
    return application_db


@pytest.fixture(scope='function')
async def in_memory_metrics_database(in_memory_mongo_server) -> AsyncIOMotorDatabase:
    """
    Fixture to create an in-memory metrics database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked metrics database.
    """
    metrics_db = AsyncIOMotorClient(in_memory_mongo_server.connection_string,
                                    tlsAllowInvalidCertificates=True).get_database(random_db_name())

    await CompassDBProvider.initialize_metrics_mongo_db(metrics_db, logger=logging.getLogger(__name__))
    logging.info(f"Created metrics database: {metrics_db.name}")
    return metrics_db


@pytest.fixture(scope="function")
def setup_application_config() -> Generator[ApplicationConfig, Any, None]:
    """
    Fixture to create an application config. For all tests that need to use the application config,
    they should use this fixture.
    """
    config = ApplicationConfig(
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
        features={}
    )

    set_application_config(config)
    # guard to ensure the config is set
    if get_application_config() != config:
        raise RuntimeError("Application config not set properly.")
    yield config
    set_application_config(None)
