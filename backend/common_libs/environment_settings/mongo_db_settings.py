from pydantic_settings import BaseSettings


class MongoDbSettings(BaseSettings):
    """ Settings for the MongoDB database. """

    application_mongodb_uri: str
    """
    The URI of the application MongoDB instance.
    """

    application_database_name: str
    """
    The name of the application database
    """

    taxonomy_mongodb_uri: str
    """
    The URI of the taxonomy MongoDB instance.
    """

    taxonomy_database_name: str
    """
    The name of the taxonomy database
    """
