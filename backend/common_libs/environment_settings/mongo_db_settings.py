from pydantic import Field
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

    users_mongodb_uri: str
    """
    The URI of the users MongoDB instance.
    """

    users_database_name: str
    """
    The name of the users database
    """

    taxonomy_mongodb_uri: str
    """
    The URI of the taxonomy MongoDB instance.
    """

    taxonomy_database_name: str
    """
    The name of the taxonomy database
    """

    taxonomy_excluded_occupations: list[str] = Field(default_factory=list)
    """
    The list of occupations to exclude from the taxonomy.
    """

    taxonomy_excluded_skills: list[str] = Field(default_factory=list)
    """
    The list of skills to exclude from the taxonomy.
    """
