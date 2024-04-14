from pymongo import MongoClient


class DatabaseService:
    """
    A service class for connecting to the MongoDB database.
    """
    @staticmethod
    def connect_to_sync_mongo_db(uri: str, database_name: str):
        """
        Connect to the MongoDB database using the sync client
        https://www.mongodb.com/docs/drivers/pymongo/#connect-to-mongodb-atlas
        :param uri: The connection uri
        :param database_name: The name of the database
        :return: A database object at supports sync operations
        """
        client = MongoClient(uri)
        return client.get_database(database_name)

    @staticmethod
    def connect_to_async_mongo_db(uri: str, database_name: str):
        """
        Connect to the MongoDB database using the async mongo client (motor)
        https://www.mongodb.com/docs/drivers/motor/#connect-to-mongodb-atlas
        :param uri: The connection uri
        :param database_name: The name of the database
        :return: A database object at supports sync operations
        """
        raise NotImplementedError("This method is not implemented yet")
