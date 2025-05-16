from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


def get_db_connection(mongodb_uri: str, database_name: str) -> AsyncIOMotorDatabase:
    """
    Create a database connection.

    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Name of the database.

    Returns:
        An AsyncIOMotorDatabase instance
    """
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    return client.get_database(database_name)
