from pydantic import BaseModel
from pydantic_settings import BaseSettings


class BaseDataSettings(BaseModel):
    """ Settings for where to find the base data to be used to create embeddings. """
    occupation_collection_name: str
    skill_collection_name: str
    db_name: str


class ScriptSettings(BaseSettings):
    """ Settings for the scripts. """
    base_data_settings: BaseDataSettings
    hf_access_token: str
    """ The access token to use to download the datasets from Hugging Face."""
