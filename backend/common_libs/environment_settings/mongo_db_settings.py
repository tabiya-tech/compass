from pydantic_settings import BaseSettings


class MongoDbSettings(BaseSettings):
    """ Settings for the MongoDB database. """
    mongodb_uri: str
    database_name: str
