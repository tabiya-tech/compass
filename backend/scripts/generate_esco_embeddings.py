import asyncio
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Literal

import vertexai
from pydantic import BaseModel, Field
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

MONGO_SETTINGS = MongoDbSettings(
    mongodb_uri=os.getenv("MONGODB_URI"),
    database_name=os.getenv("DATABASE_NAME")
)

SCRIPT_SETTINGS = ScriptSettings(
    hf_access_token=os.getenv("HF_ACCESS_TOKEN"),
    tabiya_mongodb_uri=os.getenv("TABIYA_MONGODB_URI")
)

TABIYA_CONFIG = TabiyaDatabaseConfig()
MODEL_ID = "66845ccb635d10616a2895aa"
GECKO_EMBEDDING_SERVICE = GoogleGeckoEmbeddingService()

##########################
# Connect to the databases
##########################
PLATFORM_DB = AsyncIOMotorClient(
    SCRIPT_SETTINGS.tabiya_mongodb_uri, tlsAllowInvalidCertificates=True).get_database(TABIYA_CONFIG.db_name)


class PlatformCollections(Enum):
    SKILLS = "skillmodels"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodels"


COMPASS_DB = AsyncIOMotorClient(
    MONGO_SETTINGS.mongodb_uri, tlsAllowInvalidCertificates=True).get_database(MONGO_SETTINGS.database_name)


class CompassCollections(Enum):
    SKILLS = "skillsmodelsembeddings"
    RELATIONS = "occupationtoskillrelationmodels"
    OCCUPATIONS = "occupationmodelsembeddings"


##########################
# Types
##########################
class EmbeddingContext(BaseModel):
    schema: Literal["occupation", "skill"]
    """
    schema is the name of the schema
    """
    source_collection: str
    destination_collection: str
    id_field_name: str
    extra_fields: list[str] = Field(default_factory=list)


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


async def create_indexes(ctx: EmbeddingContext):
    """
    Create the indexes for the destination collection
    :param ctx: EmbeddingContext - the context
    """

    # create index for model_id and _id,
    # this is used to search for the document by the model_id and the original document id.
    # to ensure that the combination of model_id and id_field_name is reserved on every import.
    await COMPASS_DB[ctx.destination_collection].create_index(
        {"modelId": 1, ctx.id_field_name: 1},
        name=f"model_id_and_{ctx.id_field_name}_index",
    )

    # unique index for modelId, ctx.id_field_name, embedded_field
    # we have to ensure that the combination of modelId, ctx.id_field_name, embedded_field is unique
    await COMPASS_DB[ctx.destination_collection].create_index(
        {
            'modelId': 1,
            ctx.id_field_name: 1,
            'embedded_field': 1
        },
        unique=True,
        name='UUID_embedded_field_index'
    )

    await COMPASS_DB[ctx.destination_collection].create_index(
        {'UUID': 1},
        name='UUID_index'
    )

    await COMPASS_DB[ctx.destination_collection].create_index(
        {ctx.id_field_name: 1},
        name=ctx.id_field_name + '_index'
    )

    vector_index_definition = {
        "fields": [
            {
                "numDimensions": 768,
                "path": "embedding",
                "similarity": "cosine",
                "type": "vector"
            },
            {
                "path": "UUID",
                "type": "filter"
            }
        ]
    }

    search_index_model = SearchIndexModel(
        definition=vector_index_definition,
        name="embedding_index",
        type="vectorSearch",
    )

    # if search index exists, update it.
    existing_indexes = []
    async for index in COMPASS_DB[ctx.destination_collection].list_search_indexes():
        existing_indexes.append(index["name"])

    if "embedding_index" in existing_indexes:
        # if it exists, update it
        await COMPASS_DB[ctx.destination_collection].update_search_index("embedding_index", vector_index_definition)
    else:
        # if it does not exist, create it
        await COMPASS_DB[ctx.destination_collection].create_search_index(model=search_index_model)

    # Create the indexes for the relations collection
    # this index is used for the search of already generated embeddings
    await COMPASS_DB[ctx.destination_collection].create_index(
        {"modelId": 1, "source_id": 1},
        name="model_id_index",
    )


async def process_schema(ctx: EmbeddingContext):
    """
    Process the documents collection
    :return:
    """
    logger.info(f"Processing documents: {ctx.schema}")

    # Define the context
    # it is used to define the source and destination collections
    # and the field name that will be used as the id field

    from_collection = PLATFORM_DB[ctx.source_collection]
    to_collection = COMPASS_DB[ctx.destination_collection]

    logger.info(f"[1/2] copying the {ctx.schema}s documents from {from_collection.name} to {to_collection.name}")

    # Define the search filter
    # check all ids in the to_collection where the embeddings are already generated
    done_ids = await to_collection.distinct(ctx.id_field_name, {"modelId": ObjectId(MODEL_ID)})
    search_filter = {
        "modelId": ObjectId(MODEL_ID),
        "_id": {
            "$nin": done_ids
        }
    }
    # Set the batch size
    # The batch size is the number of documents to insert in one batch
    batch_size = 1000
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    documents = []
    progress = tqdm(
        desc=f'generating embeddings for {ctx.schema}',
        total=await from_collection.count_documents(search_filter),
    )

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

    # Create the indexes
    logger.info("[2/2] creating indexes for embeddings-collection")
    await create_indexes(ctx)


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
    completed_ids = await to_collection.distinct("source_id", {"modelId": ObjectId(MODEL_ID)})
    search_filter = {
        "modelId": ObjectId(MODEL_ID),
        "_id": {
            "$nin": completed_ids
        }
    }

    progress = tqdm(
        desc=f'copying progress for ',
        total=await from_collection.count_documents(search_filter),
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
    await to_collection.create_index(
        {"requiringOccupationId": 1},
        name="requiring_occupation_id_index",
    )

    await to_collection.create_index(
        {"requiredSkillId": 1},
        name="required_skill_id_index",
    )

    await to_collection.create_index(
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
        # [1/3] Copy the relations collection
        copy_relations_collection(),

        # [2/3] Process the occupations
        process_schema(EmbeddingContext(
            schema="occupation",
            source_collection=PlatformCollections.OCCUPATIONS.value,
            destination_collection=CompassCollections.OCCUPATIONS.value,
            id_field_name="occupationId",
            extra_fields=["code"]
        )),

        # [3/3] Process the skills
        process_schema(EmbeddingContext(
            schema="skill",
            source_collection=PlatformCollections.SKILLS.value,
            destination_collection=CompassCollections.SKILLS.value,
            id_field_name="skillId",
            extra_fields=["skillType"]
        )),
    )

    logger.info("Script execution completed")


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
