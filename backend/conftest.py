import pytest


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
