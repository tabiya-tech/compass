from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Settings class for export discovered skills script.
    """

    application_mongo_db_uri: str
    application_mongo_db_name: str

    taxonomy_mongo_db_uri: str
    taxonomy_mongo_db_name: str

    class Config:
        env_prefix = "EXPORT_DISCOVERED_SKILLS_"
