from enum import Enum

from pydantic import BaseModel
from pydantic_settings import BaseSettings


class TabiyaDatabaseConfig(BaseModel):
    """ Settings for where to find the base data to be used to create embeddings. """
    occupation_collection_name: str = "occupationmodels"
    skill_collection_name: str = "skillmodels"
    relation_collection_name: str = 'occupationtoskillrelationmodels'
    db_name: str = "tabiya"


class ScriptSettings(BaseSettings):
    """ Settings for the scripts. """
    hf_access_token: str
    """ The access token to use to download the datasets from Hugging Face."""
    tabiya_mongodb_uri: str
    """ The URI to connect to the Tabiya Platform MongoDB database."""

class Type(Enum):
    """
    An enumeration class to define the type of the entity.
    """
    OCCUPATION = "occupation"
    SKILL = "skill"
