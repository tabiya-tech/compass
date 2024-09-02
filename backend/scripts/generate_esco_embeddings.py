import asyncio
import logging
import re
from datetime import datetime
from enum import Enum
from typing import Literal

import vertexai
from pydantic import BaseModel, Field
from pymongo.errors import OperationFailure
from pymongo.operations import SearchIndexModel
from tqdm import tqdm
from dotenv import load_dotenv
from bson.objectid import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from scripts.base_data_settings import ScriptSettings, TabiyaDatabaseConfig

load_dotenv()
vertexai.init()
logger = logging.getLogger(__name__)

##########################
# Load the settings
##########################

MONGO_SETTINGS = MongoDbSettings()

SCRIPT_SETTINGS = ScriptSettings()

TABIYA_CONFIG = TabiyaDatabaseConfig()
GECKO_EMBEDDING_SERVICE = GoogleGeckoEmbeddingService()

##########################
# Connect to the databases
##########################
PLATFORM_DB = AsyncIOMotorClient(
    SCRIPT_SETTINGS.tabiya_mongodb_uri, tlsAllowInvalidCertificates=True).get_database(SCRIPT_SETTINGS.tabiya_db_name)


class PlatformCollections(Enum):
    SKILLS = "skillmodels"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodels"
    MODEL_INFO = "modelinfos"


COMPASS_DB = AsyncIOMotorClient(
    MONGO_SETTINGS.taxonomy_mongodb_uri, tlsAllowInvalidCertificates=True).get_database(MONGO_SETTINGS.taxonomy_database_name)


class CompassCollections(Enum):
    SKILLS = "skillsmodelsembeddings"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodelsembeddings"
    MODEL_INFO = "modelinfos"


##########################
# Types
##########################
class EmbeddingContext(BaseModel):
    collection_schema: Literal["occupation", "skill"]
    """
    schema is the name of the schema
    """
    source_collection: str
    destination_collection: str
    id_field_name: str
    extra_fields: list[str] = Field(default_factory=list)


_OCCUPATIONS_EMBEDDING_CONTEXT = EmbeddingContext(
    collection_schema="occupation",
    source_collection=PlatformCollections.OCCUPATIONS.value,
    destination_collection=CompassCollections.OCCUPATIONS.value,
    id_field_name="occupationId",
    extra_fields=["code"]
)

_SKILLS_EMBEDDING_CONTEXT = EmbeddingContext(
    collection_schema="skill",
    source_collection=PlatformCollections.SKILLS.value,
    destination_collection=CompassCollections.SKILLS.value,
    id_field_name="skillId",
    extra_fields=["skillType"]
)


def redact_credentials_from_uri(uri: str) -> str:
    # Regular expression pattern to match username and password
    pattern = r'//[^@]+@'

    # Replace the matched username and password with asterisks
    return re.sub(pattern, "//*:*@", uri)


async def upsert_index(collection, keys, name, **index_options):
    """
    Upserts an index in a MongoDB collection using motor.

    :param collection: The MongoDB collection object
    :param name: The name of the index
    :param keys: A list of tuples specifying the index fields and order (e.g., [('field1', 1), ('field2', -1)])
    :param index_options: Additional options for the index (e.g., unique=True)
    """

    # Get the existing indexes in the collection
    existing_indexes = await collection.index_information()

    # Check if the index already exists
    if name in existing_indexes:
        logger.info(f"Index '{collection.name}.{name}' already exists")

        # Update the index by dropping it and recreating with new options
        await collection.drop_index(name)
        logger.info(f"Dropped existing index '{collection.name}.{name}'")

    # Create the index
    try:
        await collection.create_index(keys, name=name, **index_options)
        logger.info(f"Created index '{collection.name}.{name}' with options {index_options}")
    except OperationFailure as e:
        # Error code 85 indicates IndexOptionsConflict, which means even though the name has been updated
        # the index with the same keys already exists
        # For more information read: https://www.mongodb.com/docs/manual/reference/error-codes/#mongodb-error-85
        if e.code == 85:
            logger.error(f"IndexOptionsConflict: '{collection.name}.{name}': {e}")
    except Exception as e:
        logger.error(f"Failed to create index '{collection.name}.{name}': {e}")


async def generate_and_save_embeddings(documents: list[dict[str, any]], ctx: EmbeddingContext):
    """
    Generate the embeddings for the given documents
    :param documents:
    :param ctx:
    :return:
    """
    texts = []

    for document in documents:
        texts.append(document["description"])
        texts.append(document["preferredLabel"])
        texts.append("\n".join(document["altLabels"]))

    # Remove the empty strings
    # Later when iterating over the documents we need to make that we check
    # for empty strings to ensure that we keep the same order
    texts = [text for text in texts if text]

    embeddings = await GECKO_EMBEDDING_SERVICE.embed_batch(texts)

    insertable_documents = []

    i = 0
    for document in documents:
        new_document = {
            "UUID": document["UUID"],
            "modelId": document["modelId"],
            "preferredLabel": document["preferredLabel"],
            "altLabels": document["altLabels"],
            "description": document["description"],
            "updatedAt": datetime.now(),
            ctx.id_field_name: document["_id"]
        }

        for extra_field in ctx.extra_fields:
            new_document[extra_field] = document[extra_field]

        if document["description"]:
            insertable_documents.append({
                **new_document,
                "embedding": embeddings[i],
                "embedded_field": "description",
                "embedded_text": document["description"]
            })
            i += 1

        if document["preferredLabel"]:
            insertable_documents.append({
                **new_document,
                "embedding": embeddings[i],
                "embedded_field": "preferredLabel",
                "embedded_text": document["preferredLabel"]
            })
            i += 1

        alt_labels = "\n".join(document["altLabels"])
        if alt_labels:
            insertable_documents.append({
                **new_document,
                "embedding": embeddings[i],
                "embedded_field": "altLabels",
                "embedded_text": alt_labels
            })
            i += 1

    if len(texts) != i:
        raise ValueError("The number of embeddings generated is different from the number of texts")

    await COMPASS_DB[ctx.destination_collection].insert_many(insertable_documents)


async def create_std_indexes(ctx: EmbeddingContext):
    """
    Create the indexes for the destination collection
    :param ctx: EmbeddingContext - the context
    """

    # unique index for modelId, ctx.id_field_name, embedded_field
    # we have to ensure that the combination of modelId, ctx.id_field_name, embedded_field is unique

    # delete all indexes apart from _id index.
    for index in await COMPASS_DB[ctx.destination_collection].index_information():
        if index != "_id_":
            await COMPASS_DB[ctx.destination_collection].drop_index(index)
            logger.info(f"Dropped existing index '{ctx.destination_collection}.{index}'")

    await upsert_index(
        COMPASS_DB[ctx.destination_collection],
        {
            'modelId': 1,
            ctx.id_field_name: 1,
            'embedded_field': 1
        },
        unique=True,
        name=f"model_id_and_{ctx.id_field_name}_index",
    )

    await upsert_index(
        COMPASS_DB[ctx.destination_collection],
        {'UUID': 1},
        name='UUID_index'
    )


async def create_vector_search_index(ctx: EmbeddingContext):
    vector_index_definition = {
        "fields": [
            {
                "numDimensions": 768,
                "path": "embedding",
                "similarity": "cosine",
                "type": "vector"
            },
            {
                "path": "modelId",
                "type": "filter"
            },
            {
                "path": "UUID",
                "type": "filter"
            },
        ]
    }

    # if search index exists, update it.
    embedding_index_exists: bool = False

    async for index in COMPASS_DB[ctx.destination_collection].list_search_indexes():
        if index["name"] == "embedding_index":
            embedding_index_exists = True
            break

    if embedding_index_exists:
        # if it exists, update it
        await COMPASS_DB[ctx.destination_collection].update_search_index("embedding_index", vector_index_definition)
    else:
        # if it does not exist, create it
        search_index_model = SearchIndexModel(
            definition=vector_index_definition,
            name="embedding_index",
            type="vectorSearch",
        )
        await COMPASS_DB[ctx.destination_collection].create_search_index(model=search_index_model)


async def create_occupations_indexes():
    # Create the indexes
    logger.info("[2/2] creating indexes for occupations collection")
    await create_std_indexes(_OCCUPATIONS_EMBEDDING_CONTEXT)
    # add an index to searching for a specific occupation code
    await upsert_index(
        COMPASS_DB[_OCCUPATIONS_EMBEDDING_CONTEXT.destination_collection],
        {"modelId": 1, "code": 1},
        name="model_code_index",
    )
    await create_vector_search_index(_OCCUPATIONS_EMBEDDING_CONTEXT)


async def create_skills_indexes():
    # Create the indexes
    logger.info("[2/2] creating indexes for skills collection")
    await create_std_indexes(_SKILLS_EMBEDDING_CONTEXT)
    await create_vector_search_index(_SKILLS_EMBEDDING_CONTEXT)


async def process_schema(ctx: EmbeddingContext):
    """
    Process the documents collection
    :return:
    """
    logger.info(f"Processing documents: {ctx.collection_schema}")

    # Define the context
    # it is used to define the source and destination collections
    # and the field name that will be used as the id field

    from_collection = PLATFORM_DB[ctx.source_collection]
    to_collection = COMPASS_DB[ctx.destination_collection]

    logger.info(f"[1/2] copying the {ctx.collection_schema}s documents from {from_collection.name} to {to_collection.name}")

    # Define the search filter
    # check all ids in the to_collection where the embeddings are already generated
    done_ids = await to_collection.distinct(ctx.id_field_name, {"modelId": ObjectId(SCRIPT_SETTINGS.tabiya_model_id)})
    search_filter = {
        "modelId": ObjectId(SCRIPT_SETTINGS.tabiya_model_id),
        "_id": {
            "$nin": done_ids
        }
    }

    documents_to_process_count = await from_collection.count_documents(search_filter)
    if documents_to_process_count == 0:
        logger.info(f"No documents to process for {ctx.collection_schema}")
        return

    progress = tqdm(
        desc=f'generating embeddings for {ctx.collection_schema}',
        total=documents_to_process_count,
    )

    # Set the batch size
    # The batch size is the number of documents to insert in one batch
    batch_size = 1000
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    documents = []

    async for document in cursor:
        documents.append(document)

        # batch is full, start generating embeddings
        if len(documents) == batch_size:
            progress.update(batch_size)
            await generate_and_save_embeddings(documents, ctx)
            documents = []

    if len(documents) > 0:
        # sometimes the last batch is not full
        # if it is empty then we don't need to generate embeddings
        # but if it is not empty then we need to generate embeddings
        progress.update(len(documents))
        await generate_and_save_embeddings(documents, ctx)

    # Close the progress bar
    progress.close()


async def copy_model_info():
    model_id = SCRIPT_SETTINGS.tabiya_model_id

    logger.info("[1/2] Copying the model info")

    # Get the model info document for the model_id from the PLATFORM_DB
    from_model_info = await PLATFORM_DB[PlatformCollections.MODEL_INFO.value].find_one({"_id": ObjectId(model_id)})
    del from_model_info["_id"]
    from_model_info["modelId"] = ObjectId(model_id)

    # add the source db info
    from_model_info["sourceDb"] = {
        "uri": redact_credentials_from_uri(SCRIPT_SETTINGS.tabiya_mongodb_uri),
        "db": SCRIPT_SETTINGS.tabiya_db_name,
        "modelId": model_id
    }

    # Upsert the model info document in the COMPASS_DB
    await COMPASS_DB[CompassCollections.MODEL_INFO.value].update_one(
        {"modelId": ObjectId(model_id)},
        {"$set": from_model_info},
        upsert=True
    )
    logger.info("[2/2] creating indexes for model info collection")
    # Create the index
    await upsert_index(
        COMPASS_DB[CompassCollections.MODEL_INFO.value],
        {"modelId": 1},
        name="model_id_index",
    )


async def copy_relations_collection():
    """
    Copy the relations collection from the platform database to the compass database
    :return:
    """

    from_collection = PLATFORM_DB[PlatformCollections.RELATIONS.value]
    to_collection = COMPASS_DB[CompassCollections.RELATIONS.value]

    logger.info(f"[1/2] Copying the relations documents from {from_collection.name} to {to_collection.name}")

    # FInd all the document that were not copied in a previous run
    # completed ids are the ids of the documents that were already copied
    # the source_id is used to keep track of the original document id
    # it is found in the source_id field, its insertion happens in the next step
    completed_ids = await to_collection.distinct("source_id", {"modelId": ObjectId(SCRIPT_SETTINGS.tabiya_model_id)})
    search_filter = {
        "modelId": ObjectId(SCRIPT_SETTINGS.tabiya_model_id),
        "_id": {
            "$nin": completed_ids
        }
    }

    documents_to_process_count = await from_collection.count_documents(search_filter)
    if documents_to_process_count == 0:
        logger.info("No relations to process")
        return

    progress = tqdm(
        desc='copying progress for relations',
        total=documents_to_process_count,
    )

    # Set the batch size
    # The batch size is the number of documents to insert in one batch
    batch_size = 5000
    documents = []
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    async for relation in cursor:
        # copy the document
        # remove the _id field so that we can insert it in the new collection and let mongo generate a new _id
        # and add the source_id field
        # we need a source_id field to keep track of the original document id
        # this is the new format of the saved document
        new_document = relation.copy()
        del new_document["_id"]
        new_document["source_id"] = relation["_id"]

        documents.append(new_document)

        if len(documents) == batch_size:
            progress.update(batch_size)
            await to_collection.insert_many(documents)
            documents = []

    if len(documents) > 0:
        progress.update(len(documents))
        await to_collection.insert_many(documents)

    progress.close()

    logger.info("[2/2] creating indexes")
    await upsert_index(
        to_collection,
        {"modelId": 1, "requiringOccupationId": 1},
        name="requiring_occupation_id_index",
    )

    await upsert_index(
        to_collection,
        {"modelId": 1, "requiredSkillId": 1},
        name="required_skill_id_index",
    )

    await upsert_index(
        to_collection,
        {"modelId": 1, "source_id": 1},
        name="model_id_and_source_id_index",
    )


async def main():
    """
    Main function:
    Entry point of the script
    :return:
    """
    logger.info("Starting the main function")

    # run the three tasks in parallel
    await asyncio.gather(
        # [1/5] Copy the model info
        copy_model_info(),

        # [2/5] Copy the relations collection
        copy_relations_collection(),

        # [3/5] Process the occupations
        process_schema(_OCCUPATIONS_EMBEDDING_CONTEXT),

        # [4/5] Process the skills
        process_schema(_SKILLS_EMBEDDING_CONTEXT),
    )

    # [5/5] Create the indexes
    await asyncio.gather(
        create_occupations_indexes(),
        create_skills_indexes()
    )

    logger.info("Script execution completed")


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
