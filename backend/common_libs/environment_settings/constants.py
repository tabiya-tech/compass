from pydantic import BaseModel


class EmbeddingConfig(BaseModel):
    """ Settings for the embedding models. """
    # We can't use model_info_.... because it is reserved by pydantic field names.
    taxonomy_model_info_collection_name: str = "modelinfos"
    skill_collection_name: str = "skillsmodelsembeddings"
    occupation_collection_name: str = "occupationmodelsembeddings"
    occupation_to_skill_collection_name: str = "occupationtoskillrelationmodels"
    embedding_key: str = "embedding"
    embedding_index: str = "embedding_index"
