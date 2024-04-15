import logging

from fastapi import FastAPI
from google.auth import default as gcp_credentials

import google.cloud.dlp

logger = logging.getLogger(__name__)


def add_filter_routes(app: FastAPI):
    """
    Add temporary route used for testing only.
    """

    # TODO(kingam): remove this route
    @app.get("/filter", description="Temporary route used for testing only.")
    async def filter_query(query: str):
        response = await obfuscate(query)
        return {"response": response}


async def obfuscate(query: str) -> str:
    """Obfuscates sensitive information in the query.

      Any sensitive information in the query will be transformed into a placeholder string based on the type of
      content the placeholder obfuscates. Full list of supported content can be found at:
      https://cloud.google.com/sensitive-data-protection/docs/infotypes-reference.
      E.g. A query "My phone number is 20501387556, and I'm Alicia" returns "My phone number is [PHONE_NUMBER],
      and I'm [PERSON_NAME]"

      If the DLP API call fails, the original query is returned.

      :param query: The string to obfuscate.
      :return: An obfuscated string transforming sensitive information into placeholders.
    """
    try:
        # If the query is empty, return it as is to avoid unnecessary API calls,
        # besides the DLP API does not support empty strings
        if not query or len(query) == 0:
            return query
        _, project = gcp_credentials()
        parent = f"projects/{project}"

        dlp = google.cloud.dlp_v2.DlpServiceClient()

        deidentify_config = {
            "info_type_transformations": {
                "transformations": [
                    {"primitive_transformation": {"replace_with_info_type_config": {}}}
                ]
            }
        }

        response = dlp.deidentify_content(
            request={
                "parent": parent,
                "deidentify_config": deidentify_config,
                "item": {"value": query},
            }
        )
        return response.item.value
    except Exception as e:  # pylint: disable=broad-except # it is unclear what exceptions can be raised by the DLP API
        logger.exception(e)
        return query
