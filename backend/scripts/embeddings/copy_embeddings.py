#!/usr/bin/env python3
import argparse
import asyncio
import logging
from textwrap import dedent

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorClientSession
from pydantic import Field
from pydantic_settings import BaseSettings
from pymongo import InsertOne
from tqdm import tqdm

from common_libs.logging.log_utilities import setup_logging_config
from generate_taxonomy_embeddings import CompassEmbeddingsCollections
from scripts.embeddings._common import generate_indexes, redact_credentials_from_uri

# Set up logging
setup_logging_config("logging.cfg.yaml")
logger = logging.getLogger()


class CopyEmbeddingsScriptSettings(BaseSettings):
    source_mongodb_uri: str
    """ The URI of the source MongoDB we will be copying the data from."""

    source_db_name: str
    """ The name of the source database with the embeddings."""

    target_mongodb_uris: list[str]
    """ A list of target MongoDB URIs we will be copying the data to."""

    target_db_names: list[str]
    """ A list of target database names to store the embeddings."""

    tabiya_model_ids: list[str] = Field(default_factory=list)
    """ A list of model IDs to copy the embeddings for."""

    class Config:
        env_prefix = "COPY_EMBEDDINGS_SCRIPT_"


def get_filter(model_ids: list[str]):
    """
    Generate a filter for the MongoDB query to select documents with the given model IDs.
    """
    if not model_ids:
        return {}
    _model_ids = [ObjectId(model_id) for model_id in model_ids]
    return {"modelId": {"$in": _model_ids}}


async def delete_existing_collection(*,
                                     hot_run: bool = False,
                                     db: AsyncIOMotorDatabase,
                                     collection_name: str,
                                     model_ids: list[str]):
    selection_filter = get_filter(model_ids)
    count_before = await db[collection_name].count_documents(selection_filter)

    if hot_run:
        logging.info(f"Deleting {count_before} {collection_name} with model IDs {model_ids}...")
        await db[collection_name].delete_many(selection_filter)
    else:
        logging.info(f"Would have deleted {count_before} {collection_name} with model IDs {model_ids}...")


async def copy_collection(*,
                          hot_run: bool = False,
                          source_db: AsyncIOMotorDatabase,
                          source_session: AsyncIOMotorClientSession,
                          target_db: AsyncIOMotorDatabase,
                          # target_session: AsyncIOMotorClientSession,
                          collection_name: str,
                          model_ids: list[str]):
    _model_ids = [ObjectId(model_id) for model_id in model_ids]
    selection_filter = get_filter(model_ids)
    batch_size = 500

    source_col = source_db[collection_name]
    target_col = target_db[collection_name]

    documents_count = await source_col.count_documents(selection_filter, session=source_session)
    cursor = source_col.find(selection_filter, no_cursor_timeout=True, session=source_session)
    ops = []
    count = 0
    logging.info(f"Copying collection '{collection_name}' with model ID {model_ids}...")

    progress = tqdm(
        desc=f"Copying collection '{collection_name}' with model IDs {model_ids}...",
        total=documents_count
    )

    async for doc in cursor:
        doc.pop("_id", None)  # remove the _id so MongoDB assigns a new one
        ops.append(InsertOne(doc))
        if len(ops) >= batch_size:
            if hot_run:
                # In normal mode, we insert the documents
                await target_col.bulk_write(ops, ordered=False)
            count += len(ops)
            progress.update(len(ops))
            ops = []

    if ops:
        if hot_run:
            await target_col.bulk_write(ops, ordered=False)
        count += len(ops)
        progress.update(len(ops))

    if hot_run:
        logging.info(f"Inserted {count} new docs into collection '{collection_name}'")
    else:
        logging.info(f"Would have inserted {count} new docs into collection '{collection_name}'")

    await cursor.close()
    progress.close()


async def main():
    parser = argparse.ArgumentParser(dedent("""
                                        Copy embeddings from one MongoDB to another.
                                        
                                        This script copies documents from collections related to Brujula embeddings between MongoDB databases.
                                        You can optionally delete existing documents and regenerate indexes post-copy, or just create indexes.
    
                                        Required environment variables:
                                          - COPY_EMBEDDINGS_SCRIPT_SOURCE_MONGODB_URI: MongoDB URI of the source database
                                          - COPY_EMBEDDINGS_SCRIPT_SOURCE_DB_NAME: Name of the source database
                                          - COPY_EMBEDDINGS_SCRIPT_TARGET_MONGODB_URIS: List of target MongoDB URIs (JSON array)
                                          - COPY_EMBEDDINGS_SCRIPT_TARGET_DB_NAMES: List of target database names (JSON array)
                                          - COPY_EMBEDDINGS_SCRIPT_TABIYA_MODEL_IDS: List of model IDs to copy (comma-separated or JSON array)

                                        Example:
                                          COPY_EMBEDDINGS_SCRIPT_SOURCE_MONGODB_URI=mongodb://localhost:27017 
                                          COPY_EMBEDDINGS_SCRIPT_SOURCE_DB_NAME=source_db
                                          COPY_EMBEDDINGS_SCRIPT_TARGET_MONGODB_URIS='["mongodb://localhost:27018"]'
                                          COPY_EMBEDDINGS_SCRIPT_TARGET_DB_NAMES='["target_db"]'
                                          COPY_EMBEDDINGS_SCRIPT_TABIYA_MODEL_IDS='["model1", "model2"]'
                                          
                                          python copy_embeddings.py --hot-run --delete-existing --generate-indexes
                                        """),
                                     formatter_class=argparse.RawTextHelpFormatter)
    options_group = parser.add_argument_group("Options")

    options_group.add_argument(
        "--hot-run",
        required=False,
        action="store_true",
        help="Run the script in hot run mode")

    options_group.add_argument(
        "--delete-existing",
        required=False,
        action="store_true",
        help="Delete existing embeddings before copying"
    )

    # Create a mutually exclusive group within the options group
    exclusive_group = options_group.add_mutually_exclusive_group(required=False)

    exclusive_group.add_argument(
        "--indexes-only",
        action="store_true",
        help="Create indexes only")

    exclusive_group.add_argument(
        "--generate-indexes",
        action="store_true",
        help="Generate indexes after copying")

    args = parser.parse_args()

    # Load settings from environment variables
    # noinspection PyArgumentList
    settings = CopyEmbeddingsScriptSettings()

    if len(settings.target_mongodb_uris) != len(settings.target_db_names):
        raise ValueError("The number of target URIs must match the number of target DB names")

    source_client = AsyncIOMotorClient(settings.source_mongodb_uri)
    logger.info(f"Source MongoDB URI: {redact_credentials_from_uri(settings.source_mongodb_uri)}")
    source_db = source_client.get_database(settings.source_db_name)
    logger.info(f"Source database: {settings.source_db_name}")

    target_clients = []
    target_dbs = []

    for uri, db_name in zip(settings.target_mongodb_uris, settings.target_db_names):
        redacted_uri = redact_credentials_from_uri(uri)
        logger.info(f"Target MongoDB URI: {redacted_uri}")
        logger.info(f"Target database: {db_name}")

        client = AsyncIOMotorClient(uri)
        db = client.get_database(db_name)

        target_clients.append(client)
        target_dbs.append(db)

    total = len(CompassEmbeddingsCollections) * len(target_dbs) + len(target_dbs)
    progress = tqdm(desc="Processing", total=total)
    async with await source_client.start_session() as source_session:
        for target_db in target_dbs:
            logger.info(f"Processing target database: {target_db.name}")

            if args.indexes_only:
                logger.info("Generating indexes only...")
                await generate_indexes(
                    hot_run=args.hot_run,
                    db=target_db,
                    logger=logger
                )
                progress.update(1)
            elif not args.generate_indexes:
                logger.info("Copying collections...")

                for col in CompassEmbeddingsCollections:
                    if args.delete_existing:
                        await delete_existing_collection(
                            hot_run=args.hot_run,
                            db=target_db,
                            collection_name=col.value,
                            model_ids=settings.tabiya_model_ids
                        )
                    await copy_collection(
                        hot_run=args.hot_run,
                        source_db=source_db,
                        target_db=target_db,
                        collection_name=col.value,
                        model_ids=settings.tabiya_model_ids,
                        source_session=source_session,
                    )
                    progress.update(1)

                if args.generate_indexes:
                    logger.info("Generating indexes after copying collections...")
                    await generate_indexes(
                        hot_run=args.hot_run,
                        db=target_db,
                        logger=logger
                    )
                    progress.update(1)

    progress.close()

    source_client.close()
    for client in target_clients:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
