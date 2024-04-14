import unittest
from unittest.mock import patch

from esco_search.embeddings.google_gecko.google_gecko import GoogleGecko, GoogleGeckoConfig


class TestGoogleGecko(unittest.TestCase):
    """
    Test class for the GoogleGecko class.
    """
    @patch('esco_search.embeddings.google_gecko.google_gecko.VertexAIEmbeddings')
    def test_vertexai_embeddings_called_with_config_args(self, mock_vertexai_embeddings):
        """Should call VertexAIEmbeddings with the correct model name and arguments"""
        # GIVEN a config object

        given_config = GoogleGeckoConfig(
            location="foo",
            version="latest",
            max_retries=5
        )

        # WHEN creating a GoogleGecko object with the given parameters
        actual_embeddings = GoogleGecko.create(given_config)

        # THEN VertexAIEmbeddings should be called with the correct model name and arguments
        mock_vertexai_embeddings.assert_called_once_with(
            model_name=f'textembedding-gecko@{given_config.version}',
            location=given_config.location,
            max_retries=given_config.max_retries
        )

        # AND GoogleGecko returns the VertexAIEmbeddings object
        self.assertEqual(actual_embeddings, mock_vertexai_embeddings.return_value)


if __name__ == '__main__':
    unittest.main()
