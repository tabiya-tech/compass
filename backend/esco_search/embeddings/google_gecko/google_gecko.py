from deprecated import deprecated
from langchain_google_vertexai import VertexAIEmbeddings

from pydantic import BaseModel, constr


class GoogleGeckoConfig(BaseModel):
    """
    Type definition of the configuration of the VertexAI Embeddings model.
    """

    location: str
    """
    Google cloud region to use.
    See https://cloud.google.com/vertex-ai/docs/general/locations for more information.
    """

    version: constr(regex="^(latest|001|002|003)$")
    """
    Version of gecko embeddings to use.
    Possible values 'latest', '001', '002', '003'.
    See https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings#model_versions for more information.
    """

    max_retries: int
    """
    Number of max retries.
    """


class GoogleGecko:

    @staticmethod
    @deprecated("""
    The PaLM API is deprecated and will be decommissioned from August 2024. 
    Use instead the Gemini API. 
    See https://ai.google.dev/palm_docs/deprecation.
    """, action="always")
    def create(config: GoogleGeckoConfig) -> VertexAIEmbeddings:
        """
        Create an Embeddings object that uses the textembedding-gecko model.
        See https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/overview for more information.

        :param config: GoogleGeckoConfig for the model.
        :return: A VertexAIEmbeddings object.
        """

        # Extract the location and max_retries from the config dictionary
        return VertexAIEmbeddings(model_name=f'textembedding-gecko@{config.version}',
                                  max_retries=config.max_retries,
                                  location=config.location)
