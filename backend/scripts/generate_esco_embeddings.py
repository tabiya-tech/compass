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
from bson.objectid import ObjectId
from dotenv import load_dotenv
from google.api_core.exceptions import ResourceExhausted
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorClient
from tqdm import tqdm

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from constants.database import EmbeddingConfig
from scripts.base_data_settings import ScriptSettings, Type, TabiyaDatabaseConfig

load_dotenv()
vertexai.init()

PARALLEL_TASK_SIZE = 10
MAX_RETRIES = 3
MONGO_SETTINGS = MongoDbSettings()
EMBEDDING_SETTINGS = EmbeddingConfig()
SCRIPT_SETTINGS = ScriptSettings()
TABIYA_CONFIG = TabiyaDatabaseConfig()
TABIYA_DB = AsyncIOMotorClient(SCRIPT_SETTINGS.tabiya_mongodb_uri).get_database(
    TABIYA_CONFIG.db_name)
COMPASS_DB = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(MONGO_SETTINGS.database_name)
GECKO_EMBEDDING_SERVICE = GoogleGeckoEmbeddingService()

# The model ID to use for the embeddings. We dont' want to copy more than one model for now.
# TODO: COM-328 Support multiple models (e.g. French ESCO).
RELEVANT_MODEL_ID = ObjectId("6613c0a34436e3a6dbb41b66")

PER_TYPE_SETTINGS = {
    Type.OCCUPATION: {
        'clean_data_collection_name': TABIYA_CONFIG.occupation_collection_name,
        'collection_name': EMBEDDING_SETTINGS.occupation_collection_name,
        'fields': ['preferredLabel', 'altLabels', 'description', 'UUID', 'code'],
        'id_field_name': 'occupationId'
    },
    Type.SKILL: {
        'clean_data_collection_name': TABIYA_CONFIG.skill_collection_name,
        'collection_name': EMBEDDING_SETTINGS.skill_collection_name,
        'fields': ['preferredLabel', 'altLabels', 'description', 'UUID', 'skillType'],
        'id_field_name': 'skillId'
    }
}

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
                          type: Type,
                          field: str,
                          document,
                          errors: List[str] = None,
                          retry_count: int = 0):
    if errors is None:
        errors = []
    try:
        embedded_text = _field_to_string(field, document)
        if embedded_text == "":
            logging.debug(f"Document UUID:{document['UUID']} has no text in field {field}. Skipping.")
            return
        embedding = await GECKO_EMBEDDING_SERVICE.embed(embedded_text)
        document_to_save = {k: v for k, v in document.items() if k in PER_TYPE_SETTINGS[type]['fields']}
        document_to_save[EMBEDDING_SETTINGS.embedding_key] = embedding
        document_to_save['embedded_field'] = field
        document_to_save['embedded_text'] = embedded_text
        document_to_save['updatedAt'] = datetime.utcnow()
        document_to_save[PER_TYPE_SETTINGS[type]['id_field_name']] = document['_id']
        await collection.replace_one(
            {'$and': [  # Make sure we only have one embedding per field per occupation.
                {'UUID': document['UUID']},
                {'embedded_field': field}]},
            document_to_save,
            upsert=True)
    except Exception as e:
        if isinstance(e, ResourceExhausted) and retry_count < MAX_RETRIES:
            logging.debug(f"Retriable resource exhausted for document {document['UUID']}: {e}.")
            await asyncio.sleep(randint(5, 10) * (retry_count + 1))  # nosec
            await _embed_document(collection, type, field, document, errors,
                                  retry_count + 1)
        else:
            logging.error(f"Error embedding document UUID:{document['UUID']}, label: {document['preferredLabel']}: {e}")
            errors.append(document['UUID'])


async def generate_embeddings(
        type: Type,
        uuids: List[str] = None
) -> None:
    """Embeds the entire collection in a MongoDB database.

    Saving the embeddings in the collection in the 'embedding' field. Each field to embed creates its own copy of the
    record. The record includes all the fields of the original document, plus the embedding, the name of the embedded
    field, the text embedded, and the date of the embedding. The combination of the UUID and the embedded field is
    unique, if it already exists, it will be updated, if not it will be created.

    Args:
        :param type: The type of the entity to embed.
        :param uuids: A list of UUIDs to embed. If None, all the documents in the collection will be embedded.
    """
    # This could be a collection from the Platform taxonomy database.
    clean_data_collection = TABIYA_DB[PER_TYPE_SETTINGS[type]['clean_data_collection_name']]
    embeddings_collection = COMPASS_DB[PER_TYPE_SETTINGS[type]['collection_name']]
    search_filter: dict = {'UUID': {'$in': uuids}} if uuids else {}
    search_filter.update({"modelId": RELEVANT_MODEL_ID})
    pbar = tqdm(desc=f'Embedding progress for {type.name}',
                total=await clean_data_collection.count_documents(search_filter))
    i = 0
    tasks = []
    errors = []
    async for document in clean_data_collection.find(search_filter):
        tasks += [
            _embed_document(embeddings_collection, type, field, document,
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
        logging.error(f"Errors embedding documents in collection {type.name}: {' '.join(errors)}")


async def upsert_indexes(collection_name: str):
    """Creates the search index for the embeddings."""
    collection = COMPASS_DB[collection_name]
    definition = {'mappings': {
        'dynamic': True,
        'fields': {
            EMBEDDING_SETTINGS.embedding_key: {
                'dimensions': 768,
                'similarity': 'cosine',
                'type': 'knnVector'
            }
        }
    }}
    if 'embedding_index' in [index['name'] for index in await collection.list_search_indexes().to_list(length=None)]:
        await collection.update_search_index(EMBEDDING_SETTINGS.embedding_index, definition)
    else:
        await collection.create_search_index(
            {'name': EMBEDDING_SETTINGS.embedding_index, 'definition': definition})


async def create_collection(type: Type, drop=True):
    """Creates the collection to store the embeddings. If it already exists and drop = True, it will be dropped and
    recreated."""
    embedding_collection_name = PER_TYPE_SETTINGS[type]["collection_name"]
    collist = await COMPASS_DB.list_collection_names()
    if embedding_collection_name in collist and drop:
        await COMPASS_DB.drop_collection(embedding_collection_name)
    else:
        return
    await COMPASS_DB.create_collection(embedding_collection_name)
    await COMPASS_DB[embedding_collection_name].create_index({'UUID': 1, 'embedded_field': 1},
                                                             name='UUID_embedded_field_index')
    await COMPASS_DB[embedding_collection_name].create_index({'UUID': 1}, name='UUID_index')
    id_field_name = PER_TYPE_SETTINGS[type]['id_field_name']
    await COMPASS_DB[embedding_collection_name].create_index({id_field_name: 1}, name=id_field_name + '_index')
    await asyncio.sleep(3)  # Wait for the indexes to be created.


async def generate_embeddings_for_collection(
        type: Type,
        arguments: argparse.Namespace,
) -> None:
    """Embeds the entire collection in a MongoDB database. """
    await create_collection(type, drop=arguments.drop_collection)
    await generate_embeddings(type, arguments.uuids)
    await upsert_indexes(PER_TYPE_SETTINGS[type]["collection_name"])


async def copy_relationship_model(drop=False):
    """Copies the occupation to skill relationship model from the Tabiya database to the Compass database."""
    relation_collection_name = TABIYA_CONFIG.relation_collection_name
    collist = await COMPASS_DB.list_collection_names()
    if relation_collection_name in collist and drop:
        await COMPASS_DB.drop_collection(relation_collection_name)
    if relation_collection_name not in collist:
        await COMPASS_DB.create_collection(relation_collection_name)
        await COMPASS_DB[relation_collection_name].create_index({'requiredSkillId': 1}, name='requiredSkillId_index')
        await COMPASS_DB[relation_collection_name].create_index({'requiredOccupationId': 1},
                                                                name='requiredOccupationId_index')
    await asyncio.gather(*[COMPASS_DB[relation_collection_name].insert_one(document) async for document in
                           TABIYA_DB[relation_collection_name].find({"modelId": RELEVANT_MODEL_ID})])


async def main():
    args = parser.parse_args()

    await generate_embeddings_for_collection(Type.OCCUPATION, args)
    await generate_embeddings_for_collection(Type.SKILL, args)
    await copy_relationship_model(drop=args.drop_collection)


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
