"""
Functions to embed an entire collection
of a database in MongoDB and save the embeddings.
"""
import argparse
import asyncio
import logging
from datetime import datetime
from random import randint
from typing import List

import vertexai
from dotenv import load_dotenv
from google.api_core.exceptions import ResourceExhausted
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection, AsyncIOMotorClient
from tqdm import tqdm

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, EmbeddingService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from scripts.base_data_settings import ScriptSettings

load_dotenv()
vertexai.init()

PARALLEL_TASK_SIZE = 5
MAX_RETRIES = 3
MONGO_SETTINGS = MongoDbSettings()
BASE_SETTINGS = ScriptSettings().base_data_settings

logger = logging.getLogger(__name__)
parser = argparse.ArgumentParser(
    prog='ESCO Embeddings Generator',
    description='Generates embeddings for the ESCO database in MongoDB')
parser.add_argument('--drop_collection', type=bool, action=argparse.BooleanOptionalAction,
                    help='Indicates whether to delete the current embedding collection',
                    default=False)
parser.add_argument('--uuids', type=str, nargs="*",
                    help='List of UUIDs to embed. If None, all the documents will be embedded',
                    default=None)


def _field_to_string(field, document):
    if field == "altLabels":
        return "\n".join(document[field])
    return document[field]


async def _embed_document(collection: AsyncIOMotorCollection,
                          embedding_service: EmbeddingService,
                          field: str,
                          document,
                          errors: List[str] = None,
                          retry_count: int = 0):
    if errors is None:
        errors = []
    try:
        # TODO: We might want to only copy relevant fields, not all. This will become relevant once we start copying
        #  from the Platform taxonomy database.
        embedded_text = _field_to_string(field, document)
        if embedded_text == "":
            logging.debug(f"Document UUID:{document['UUID']} has no text in field {field}. Skipping.")
            return
        embedding = await embedding_service.embed(embedded_text)
        document[MONGO_SETTINGS.embedding_settings.embedding_key] = embedding
        document['embedded_field'] = field
        document['embedded_text'] = embedded_text
        document['updatedAt'] = datetime.utcnow()
        await collection.replace_one(
            {'$and': [
                {'UUID': document['UUID']},
                {'embedded_field': field}]},
            document,
            upsert=True)
    except Exception as e:
        if isinstance(e, ResourceExhausted) and retry_count < MAX_RETRIES:
            logging.debug(f"Retriable resource exhausted for document {document['UUID']}: {e}.")
            await asyncio.sleep(randint(5, 10) * (retry_count + 1))  # nosec
            await _embed_document(collection, embedding_service, field, document, errors,
                                  retry_count + 1)
        else:
            logging.error(f"Error embedding document UUID:{document['UUID']}, label: {document['preferredLabel']}: {e}")
            errors.append(document['UUID'])


async def generate_embeddings(
        db: AsyncIOMotorDatabase,
        model: EmbeddingService,
        collection_name: str,
        clean_data_collection_name: str,
        uuids: List[str] = None
) -> None:
    """Embeds the entire collection in a MongoDB database.

    Saving the embeddings in the collection in the 'embedding' field. Each field to embed creates its own copy of the
    record. The record includes all the fields of the original document, plus the embedding, the name of the embedded
    field, the text embedded, and the date of the embedding. The combination of the UUID and the embedded field is
    unique, if it already exists, it will be updated, if not it will be created.

    Args:
        :param db: The MongoDB database to use.
        :param model: The embedding model to use.
        :param clean_data_collection_name: The name of the collection to use for data.
        :param collection_name: The settings of the collection to store the embeddings.
        :param uuids: A list of UUIDs to embed. If None, all the documents in the collection will be embedded.
    """
    # This could be a collection from the Platform taxonomy database.
    clean_data_collection = db[clean_data_collection_name]
    embeddings_collection = db[collection_name]
    search_filter = {'UUID': {'$in': uuids}} if uuids else {}
    pbar = tqdm(desc=f'Embedding progress for {collection_name}',
                total=await clean_data_collection.count_documents(search_filter))
    i = 0
    tasks = []
    errors = []
    async for document in clean_data_collection.find(search_filter, {'_id': 0}):
        tasks += [
            _embed_document(embeddings_collection, model, field, document,
                            errors) for field in
            ['preferredLabel', 'altLabels', 'description']]
        i += 1
        pbar.update()
        if len(tasks) > PARALLEL_TASK_SIZE:
            await asyncio.gather(*tasks)
            tasks = []
    await asyncio.gather(*tasks)
    pbar.close()
    if len(errors) > 0:
        logging.error(
            f"Errors embedding documents in collection {collection_name}: {errors}")


async def upsert_indexes(db: AsyncIOMotorDatabase, collection_name: str):
    """Creates the search index for the embeddings."""
    collection = db[collection_name]
    definition = {'mappings': {
        'dynamic': True,
        'fields': {
            MONGO_SETTINGS.embedding_settings.embedding_key: {
                'dimensions': 768,
                'similarity': 'cosine',
                'type': 'knnVector'
            }
        }
    }}
    if 'embedding_index' in [index['name'] for index in await collection.list_search_indexes().to_list(length=None)]:
        await collection.update_search_index(MONGO_SETTINGS.embedding_settings.embedding_index, definition)
    else:
        await collection.create_search_index(
            {'name': MONGO_SETTINGS.embedding_settings.embedding_index, 'definition': definition})


async def create_collection(db: AsyncIOMotorDatabase, embedding_collection_name: str, drop=True):
    """Creates the collection to store the embeddings. If it already exists and drop = True, it will be dropped and
    recreated."""
    collist = await db.list_collection_names()
    if embedding_collection_name in collist and drop:
        await db.drop_collection(embedding_collection_name)
    else:
        return
    await db.create_collection(embedding_collection_name)
    await db[embedding_collection_name].create_index({'UUID': 1, 'embedded_field': 1}, name='UUID_embedded_field_index')
    await db[embedding_collection_name].create_index({'UUID': 1}, name='UUID_index')
    await asyncio.sleep(3)  # Wait for the indexes to be created.


async def generate_embeddings_for_collection(
        db: AsyncIOMotorDatabase,
        embedding_service: EmbeddingService,
        collection_name: str,
        clean_data_collection_name: str,
        arguments: argparse.Namespace,
) -> None:
    """Embeds the entire collection in a MongoDB database. """
    await create_collection(db, collection_name, drop=arguments.drop_collection)
    await generate_embeddings(db, embedding_service, collection_name,
                              clean_data_collection_name,
                              arguments.uuids)
    await upsert_indexes(db, collection_name)


async def main():
    args = parser.parse_args()
    gecko_embedding_service = GoogleGeckoEmbeddingService()
    compass_db = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(MONGO_SETTINGS.database_name)
    await generate_embeddings_for_collection(compass_db, gecko_embedding_service,
                                             MONGO_SETTINGS.embedding_settings.occupation_collection_name,
                                             BASE_SETTINGS.occupation_collection_name, args)
    await generate_embeddings_for_collection(compass_db, gecko_embedding_service,
                                             MONGO_SETTINGS.embedding_settings.skill_collection_name,
                                             BASE_SETTINGS.skill_collection_name,
                                             args)


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
