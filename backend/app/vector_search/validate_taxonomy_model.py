# app/vector_search/validate_taxonomy_model.py
import logging

from bson import ObjectId #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore

from common_libs.environment_settings.constants import EmbeddingConfig

logger = logging.getLogger(__name__)


async def validate_taxonomy_model(*, taxonomy_db: AsyncIOMotorDatabase,
                                  taxonomy_model_id: str,
                                  embeddings_service_name: str,
                                  embeddings_model_name: str
                                  ) -> None:
    """
    Validate the taxonomy model id set in the application config exists in the taxonomy db.
    Validate the embeddings model version used to generate the embeddings is the same as the one used in the application.
    :param taxonomy_db: The taxonomy database with the embeddings.
    :param taxonomy_model_id: The taxonomy model id to verify it exists in the taxonomy db.
    :param embeddings_service_name: The name of the embeddings service to validate against one used to generate the embeddings.
    :param embeddings_model_name: The name of the embeddings model to validate against one used to generate the embeddings.
    """
    ##########################
    # Check if the taxonomy model id set in the application config exists in the taxonomy db.
    ##########################
    logger.info(f"Validating taxonomy model id: {taxonomy_model_id} - embeddings service: {embeddings_service_name} - {embeddings_model_name}")

    # get the embedding configuration
    embedding_config = EmbeddingConfig()

    model_infos_collection = taxonomy_db[embedding_config.taxonomy_model_info_collection_name]
    try:
        # Get the model information of existing taxonomy model id
        taxonomy_model_info = await model_infos_collection.find_one({
            "modelId": {
                "$eq": ObjectId(taxonomy_model_id)
            }
        })

        if taxonomy_model_info is None:
            error = ValueError(f"Taxonomy model id {taxonomy_model_id} is not found in the taxonomy model info collection.")
            raise error

        logger.info(f"Using taxonomy model id: {taxonomy_model_id}")

        #############################
        # Check if the model version used to generate the embeddings is the same as the one used in the application
        #############################
        taxonomy_embeddings_service = taxonomy_model_info.get("embeddingsService")
        if taxonomy_embeddings_service is None:
            logger.warning("Information on the embeddings model used to generate the taxonomy model embeddings "
                           "is not present for the embeddings used in the application.")
            return
        _taxonomy_embeddings_service_model_name = taxonomy_embeddings_service.get('model_name')
        _taxonomy_embeddings_service_name = taxonomy_embeddings_service.get('service_name')

        if _taxonomy_embeddings_service_name != embeddings_service_name or \
                _taxonomy_embeddings_service_model_name != embeddings_model_name:
            error = ValueError(
                f"The embeddings model used to generate the taxonomy model embeddings is different from the one used in the application. "
                f"\nTaxonomy model info: {_taxonomy_embeddings_service_name} - {_taxonomy_embeddings_service_model_name}, "
                f"\nApplication config: {embeddings_service_name} - {embeddings_model_name}"
            )
            raise error

        logger.info(f"Using embeddings service: {_taxonomy_embeddings_service_name} - {_taxonomy_embeddings_service_model_name}")

    except Exception as e:
        logger.error(f"Error while validating the taxonomy model embeddings: {e}", exc_info=True)
        raise
