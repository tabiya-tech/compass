from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient


def get_mongo_db_connection(mongo_db_uri: str, db_name: str ) -> AsyncIOMotorDatabase:
    """
    Returns a connection to the specified MongoDB database.

    :param mongo_db_uri: The URI of the MongoDB server, e.g., "mongodb://localhost:27017"
    :param db_name:  The name of the database to connect to.
    :return: An instance of AsyncIOMotorDatabase connected to the specified database.
    """

    return AsyncIOMotorClient(mongo_db_uri,
                               tlsAllowInvalidCertificates=True).get_database(db_name)
