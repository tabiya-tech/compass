from pydantic import BaseModel


class Collections:
    USER_PREFERENCES: str = "user_preferences"
    APPLICATION_STATE: str = "application_state"


class EmbeddingConfig(BaseModel):
    """ Settings for the embedding models. """
    skill_collection_name: str = "skillsmodelsembeddings"
    occupation_collection_name: str = "occupationmodelsembeddings"
    occupation_to_skill_collection_name: str = "occupationtoskillrelationmodels"
    embedding_key: str = "embedding"
    embedding_index: str = "embedding_index"
