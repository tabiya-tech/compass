from pydantic_settings import BaseSettings


class MongoDbSettings(BaseSettings):
    """ Settings for the MongoDB database. """

    mongodb_uri: str
    """
    The URI of the MongoDB instance.
    """

    application_database_name: str
    """
    The name of the application database
    """

    taxonomy_database_name: str
    """
    The name of the taxonomy database
    """
