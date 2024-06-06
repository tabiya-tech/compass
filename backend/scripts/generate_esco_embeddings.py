"""
Functions to embed an entire collection
of a database in MongoDB and save the embeddings.
"""
import argparse
import asyncio
import logging
import os
from datetime import datetime
from typing import List

import vertexai
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection, AsyncIOMotorClient
from tqdm import tqdm

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, EmbeddingService

load_dotenv()
vertexai.init()

# TODO: Save them in a config file and load them here.
DATABASE_NAME = 'compass-test'
OCCUPATION_COLLECTION_NAME = 'occupationmodels'
OCCUPATION_EMBEDDINGS_COLLECTION = 'occupationmodelsembeddings'
SKILLS_COLLECTION_NAME = 'skillmodels'
SKILLS_EMBEDDINGS_COLLECTION = 'skillsmodelsembeddings'

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
                          document):
    # TODO: We might want to only copy relevant fields, not all. This will become relevant once we start copying from
    #  the Platform taxonomy database.
    embedded_text = _field_to_string(field, document)
    embedding = await embedding_service.embed(embedded_text)
    # TODO: The embedding key should also be set in a config and shared between creation and search.
    document['embedding'] = embedding
    document['embedded_field'] = field
    document['embedded_text'] = embedded_text
    document['updatedAt'] = datetime.utcnow()
    await collection.replace_one(
        {'$and': [
            {'UUID': document['UUID']},
            {'embedded_field': field}]},
        document,
        upsert=True)


async def generate_embeddings(
        db: AsyncIOMotorDatabase,
        model: EmbeddingService,
        embedding_collection_name: str,
        clean_data_collection_name: str,
        field: str,
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
        :param embedding_collection_name: The name of the collection to store the embeddings.
        :param field: The field to embed.
        :param uuids: A list of UUIDs to embed. If None, all the documents in the collection will be embedded.
    """
    # This could be a collection from the Platform taxonomy database.
    clean_data_collection = db[clean_data_collection_name]
    embeddings_collection = db[embedding_collection_name]
    # TODO: Run this in parallelized batches. At the moment, parallelism quickly reaches the quota limit of 1500 per
    #  minute, so we're doing it slow on purpose.
    search_filter = {'UUID': {'$in': uuids}} if uuids else {}
    pbar = tqdm(desc=f'Embedding progress for {field}',
                total=await clean_data_collection.count_documents(search_filter))
    i = 0
    async for document in clean_data_collection.find(search_filter, {'_id': 0}):
        i += 1
        try:
            await _embed_document(embeddings_collection, model, field, document)
        except Exception as e:
            logging.error(f"Error embedding document UUID:{document['UUID']}, label: {document['preferredLabel']}: {e}")
        pbar.update(i)
    pbar.close()


async def create_indexes(db: AsyncIOMotorDatabase, embedding_collection_name: str):
    """Creates the search index for the embeddings."""
    collection = db[embedding_collection_name]
    definition = {'mappings': {
        'dynamic': True,
        'fields': {
            'embedding': {
                'dimensions': 768,
                'similarity': 'cosine',
                'type': 'knnVector'
            }
        }
    }}
    if 'embedding_index' in [index['name'] for index in await collection.list_search_indexes().to_list(length=None)]:
        await collection.update_search_index('embedding_index', definition)
    else:
        await collection.create_search_index({'name': 'embedding_index', 'definition': definition})


async def create_collection(db: AsyncIOMotorDatabase, embedding_collection_name: str, drop=True):
    """Creates the collection to store the embeddings. If it already exists and drop = True, it will be dropped and
    recreated."""
    collist = await db.list_collection_names()
    if embedding_collection_name in collist and drop:
        await db.drop_collection(embedding_collection_name)
    else:
        return
    await db.create_collection(embedding_collection_name)
    await db[embedding_collection_name].create_index(
        {'UUID': 1, 'embedded_field': 1},
        unique=True, name='UUID_embedded_field_index')
    await db[embedding_collection_name].create_index(
        {'UUID': 1}, name='UUID_index')


async def generate_embeddings_for_collection(
        db: AsyncIOMotorDatabase,
        embedding_service: EmbeddingService,
        embedding_collection_name: str,
        clean_data_collection_name: str,
        arguments: argparse.Namespace,
) -> None:
    """Embeds the entire collection in a MongoDB database. """
    await create_collection(db, embedding_collection_name, drop=arguments.drop_collection)
    await asyncio.gather(
        *[generate_embeddings(db, embedding_service, embedding_collection_name, clean_data_collection_name, label,
                              arguments.uuids) for label in
          ['preferredLabel', 'altLabels', 'description']])
    asyncio.get_event_loop().run_until_complete(create_indexes(db, embedding_collection_name))


async def main():
    args = parser.parse_args()
    gecko_embedding_service = GoogleGeckoEmbeddingService()
    compass_db = AsyncIOMotorClient(os.getenv('MONGODB_URI')).get_database(DATABASE_NAME)
    await generate_embeddings_for_collection(compass_db, gecko_embedding_service, OCCUPATION_EMBEDDINGS_COLLECTION,
                                             OCCUPATION_COLLECTION_NAME, args)
    await generate_embeddings_for_collection(compass_db, gecko_embedding_service, SKILLS_EMBEDDINGS_COLLECTION,
                                             SKILLS_COLLECTION_NAME, args)


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
