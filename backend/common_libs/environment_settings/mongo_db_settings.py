from pydantic_settings import BaseSettings
from pydantic import BaseModel


class EmbeddingSettings(BaseModel):
    """ Settings for the embedding models. """
    skill_collection_name: str
    occupation_collection_name: str
    embedding_key: str
    embedding_index: str


class MongoDbSettings(BaseSettings):
    """ Settings for the MongoDB database. """
    mongodb_uri: str
    database_name: str
