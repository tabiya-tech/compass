import pytest
import logging
from motor.motor_asyncio import AsyncIOMotorClient

from app.server_dependencies.db_dependencies import CompassDBProvider


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
    # After version 6, the storage engine is wiredTiger
    # We need to set this manually as there is an open issue in pymongo_inmemory that
    # incorrectly sets the storage engine to "ephemeralForTest".
    # See https://github.com/kaizendorks/pymongo_inmemory/pull/119
    ctx = Context(version="7.0")
    ctx.storage_engine = "wiredTiger"
    in_mem_mongo = Mongod(ctx)
    in_mem_mongo.start()
    yield in_mem_mongo
    in_mem_mongo.stop()


def random_db_name():
    """
    Generate a random db name for testing purposes.
    :return: str: A random db name.
    """
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))  #nosec B311 # random is used for testing purposes


@pytest.fixture(scope='function')
async def mocked_users_database(in_memory_mongo_server):
    """
    Fixture to create a mocked users' database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked users' database.
    """

    users_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    await CompassDBProvider.initialize_users_mongo_db(
        users_db,
        logger=logging.getLogger(__name__)
    )

    return users_db


@pytest.fixture(scope='function')
async def mocked_application_database(in_memory_mongo_server):
    """
    Fixture to create a mocked application database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked =application database.
    """

    application_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    await CompassDBProvider.initialize_application_mongo_db(
        application_db,
        logger=logging.getLogger(__name__)
    )

    return application_db


@pytest.fixture(scope='function')
async def mock_taxonomy_database(in_memory_mongo_server):
    """
    Fixture to create a mocked taxonomy database.

    This is a re-usable fixture that can be used across multiple test modules.
    :param in_memory_mongo_server:  The in-memory MongoDB server.
    :return:  The mocked =taxonomy database.
    """

    taxonomy_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    return taxonomy_db


@pytest.fixture(autouse=True, scope="function")
def mock_console(mocker):
    """Mock all console methods before each test to silence output"""

    mocker.patch('builtins.print')
    mocker.patch('sys.stdout.write')
    mocker.patch('sys.stderr.write')
