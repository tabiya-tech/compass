from pydantic_settings import BaseSettings


class VectorSearchSettings(BaseSettings):
    """
    Settings for the vector search.
    """
    taxonomy_model_id: str
    """ The model ID of the model to use to create the embeddings."""
