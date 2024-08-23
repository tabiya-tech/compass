from enum import Enum

from pydantic import BaseModel
from pydantic_settings import BaseSettings


class TabiyaDatabaseConfig(BaseModel):
    """ Settings for where to find the base data to be used to create embeddings. """
    occupation_collection_name: str = "occupationmodels"
    skill_collection_name: str = "skillmodels"
    relation_collection_name: str = 'occupationtoskillrelationmodels'


class ScriptSettings(BaseSettings):
    """ The access token to use to download the datasets from Hugging Face."""
    tabiya_mongodb_uri: str
    """ The URI of the Tabiya Platform MongoDB we will be copying the data from."""
    tabiya_db_name: str
    """ The name of the database with the platform taxonomy."""
    tabiya_model_id: str
    """ The model ID of the model to use to create the embeddings."""


class EvaluateScriptSettings(ScriptSettings):
    """ Settings for the scripts. """
    hf_access_token: str
    """ The access token to use to download the datasets from Hugging Face."""


class Type(Enum):
    """
    An enumeration class to define the type of the entity.
    """
    OCCUPATION = "occupation"
    SKILL = "skill"
