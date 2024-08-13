import asyncio
import logging
from datetime import datetime
from enum import Enum


import vertexai
from pydantic import BaseModel
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
    schema: str
    source_collection: str
    destination_collection: str
    id_field_name: str
    extra_fields: list[str] = []


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
    texts = [text for text in texts if text]

    embeddings = await GECKO_EMBEDDING_SERVICE.embed_batch(texts)

    insertable_documents = []
    for i, document in enumerate(documents):
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

        if document["altLabels"]:
            insertable_documents.append({
                **new_document,
                "embedding": embeddings[i+2],
                "embedded_field": "altLabels",
                "embedded_text": "\n".join(document["altLabels"])
            })
            i += 1

    await COMPASS_DB[ctx.destination_collection].insert_many(insertable_documents)


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

    # Define the search filter
    search_filter = {"modelId": ObjectId(MODEL_ID)}

    # check all ids in the to_collection where the embeddings are already generated
    done_ids = await to_collection.distinct(ctx.id_field_name, search_filter)
    search_filter["_id"] = {"$nin": done_ids}

    # Set the batch size
    # The batch size is the number of documents to insert in one batch
    batch_size = 1000

    logger.info(f"[1/2] copying the {ctx.schema}s documents from {from_collection.name} to {to_collection.name}")

    # Get the cursor
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    documents = []
    progress = tqdm(
        desc=f'copying generating embeddings for {ctx.schema}',
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
    await create_indexes(ctx)


async def copy_relations_collection():
    """
    Copy the relations collection from the platform database to the compass database
    :return:
    """

    collection_list = await COMPASS_DB.list_collection_names()

    from_collection = PLATFORM_DB[PlatformCollections.RELATIONS.value]
    to_collection = COMPASS_DB[PlatformCollections.RELATIONS.value]

    search_filter = {
        "modelId": ObjectId(MODEL_ID),
        "_id": {
            "$nin": await to_collection.distinct("_id", {"modelId": ObjectId(MODEL_ID)})
        }
    }

    # if collection already exists, delete all the documents
    if to_collection.name in collection_list:
        logger.info(f"Deleting the existing collection {to_collection.name}")
        await to_collection.delete_many(search_filter)
        to_collection = COMPASS_DB[PlatformCollections.RELATIONS.value]

    # Set the batch size
    # The batch size is the number of documents to insert in one batch
    batch_size = 5000

    logger.info(f"[1/2] Copying the relations documents from {from_collection.name} to {to_collection.name}")

    progress = tqdm(
        desc=f'copying progress for ',
        total=await from_collection.count_documents(search_filter),
    )

    documents = []
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    async for relation in cursor:
        documents.append(relation)

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


async def create_indexes(ctx: EmbeddingContext):
    await COMPASS_DB[ctx.destination_collection].create_index(
        {'UUID': 1, 'embedded_field': 1},
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
