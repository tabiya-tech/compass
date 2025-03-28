import logging

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.app_config import get_application_config
from common_libs.environment_settings.constants import EmbeddingConfig

logger = logging.getLogger(__name__)


async def validate_taxonomy_model_id(taxonomy_db: AsyncIOMotorDatabase) -> None:
    """
    Validate the taxonomy model id.
        if it exists in the taxonomy db.
        if the version used for generating embeddings is the same version used when running the application.
    """

    # get configurations
    application_config = get_application_config()
    embedding_config = EmbeddingConfig()

    taxonomy_model_id = application_config.taxonomy_model_id
    model_infos_collection = taxonomy_db[embedding_config.taxonomy_model_info_collection_name]

    # Get the model information of existing taxonomy model id
    taxonomy_model_info = await model_infos_collection.find_one({
        "modelId": {
            "$eq": ObjectId(taxonomy_model_id)
        }
    })

    if taxonomy_model_info is None:
        logger.error("Taxonomy model id is not found in the taxonomy model info collection.")
        return

    logger.info(f"Using taxonomy model id: {taxonomy_model_id}")

    embeddings_service = taxonomy_model_info.get("embeddingsService")
    if embeddings_service is None:
        logger.warning("Embeddings service is not available for the current existing embeddings")
        return

    if embeddings_service.get('version') != application_config.embeddings_service_version:
        logger.error(
            f"Embeddings service version mismatch: "
            f"expected: {application_config.embeddings_service_version}, "
            f"actual: {embeddings_service.get('version')}"
        )
        raise ValueError("Embeddings service version mismatch")

    logger.info(f"Using embeddings service version: {embeddings_service.get('version')}")
