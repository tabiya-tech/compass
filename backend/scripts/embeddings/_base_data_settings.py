from enum import Enum

from pydantic import Field
from pydantic_settings import BaseSettings


class PlatformCollections(Enum):
    SKILLS = "skillmodels"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodels"
    MODEL_INFO = "modelinfos"


class CompassEmbeddingsCollections(Enum):
    SKILLS = "skillsmodelsembeddings"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodelsembeddings"
    MODEL_INFO = "modelinfos"


class EmbeddingsScriptSettings(BaseSettings):
    """
    Base settings for generating embeddings.
    All environment variables should be prefixed with EMBEDDINGS_SCRIPT_.

    """
    tabiya_mongodb_uri: str
    """ The URI of the Tabiya Platform MongoDB we will be copying the data from."""

    tabiya_db_name: str
    """ The name of the database with the platform taxonomy."""

    tabiya_model_id: str
    """ The model ID of the model to use to create the embeddings."""

    excluded_occupation_codes: list[str] = Field(default_factory=list)
    """ A list of occupation codes to exclude when generating the embeddings."""

    excluded_skill_codes: list[str] = Field(default_factory=list)
    """ A list of skill codes to exclude when generating the embeddings."""

    compass_taxonomy_db_name: str
    """ The name of the database to store the embeddings."""

    compass_taxonomy_db_uri: str
    """ The URI of the database to store the embeddings."""

    embeddings_service_name: str
    """ The name of the embeddings service to use."""

    embeddings_model_name: str
    """ The name of the embeddings model to use."""

    class Config:
        env_prefix = "EMBEDDINGS_SCRIPT_"


class Type(Enum):
    """
    An enumeration class to define the type of the entity.
    """
    OCCUPATION = "occupation"
    SKILL = "skill"
