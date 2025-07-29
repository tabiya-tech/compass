#!/usr/bin/env python3
import argparse
import asyncio
import logging.config
import time
from datetime import datetime
from typing import Any

import vertexai
from bson.objectid import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from tqdm import tqdm

from _base_data_settings import EmbeddingsScriptSettings, CompassEmbeddingsCollections, PlatformCollections
from app.vector_search.embeddings_model import EmbeddingService
from app.vector_search.vector_search_dependencies import get_embeddings_service
from common_libs.logging.log_utilities import setup_logging_config
from common_libs.time_utilities import get_now, datetime_to_mongo_date
from scripts.embeddings._common import EmbeddingContext, generate_indexes, redact_credentials_from_uri

load_dotenv()
vertexai.init()

# Set up logging
setup_logging_config("logging.cfg.yaml")
logger = logging.getLogger()
##########################
# Load the settings
##########################

# noinspection PyArgumentList
SCRIPT_SETTINGS = EmbeddingsScriptSettings()

##########################
# Connect to the databases
##########################
# See https://pymongo.readthedocs.io/en/stable/api/pymongo/asynchronous/mongo_client.html#pymongo.asynchronous.mongo_client.AsyncMongoClient
# for more information about available options
PLATFORM_DB = AsyncIOMotorClient(
    SCRIPT_SETTINGS.tabiya_mongodb_uri,
    tlsAllowInvalidCertificates=True,
    connectTimeoutMS=45000,  # Set to 45 seconds, defaults is 20000 (20 seconds)
).get_database(SCRIPT_SETTINGS.tabiya_db_name)

COMPASS_DB = (AsyncIOMotorClient(
    SCRIPT_SETTINGS.compass_taxonomy_db_uri, tlsAllowInvalidCertificates=True)
              .get_database(SCRIPT_SETTINGS.compass_taxonomy_db_name))


##########################
# Types
##########################

class Options(BaseModel):
    hot_run: bool = False
    delete_existing: bool = False
    generate_embeddings: bool = True
    generate_indexes: bool = True


_OCCUPATIONS_EMBEDDING_CONTEXT = EmbeddingContext(
    collection_schema="occupation",
    source_collection=PlatformCollections.OCCUPATIONS.value,
    destination_collection=CompassEmbeddingsCollections.OCCUPATIONS.value,
    id_field_name="occupationId",
    extra_fields=["code", "scopeNote"],
    excluded_codes=SCRIPT_SETTINGS.excluded_occupation_codes
)

_SKILLS_EMBEDDING_CONTEXT = EmbeddingContext(
    collection_schema="skill",
    source_collection=PlatformCollections.SKILLS.value,
    destination_collection=CompassEmbeddingsCollections.SKILLS.value,
    id_field_name="skillId",
    extra_fields=["skillType", "scopeNote"],
    excluded_codes=SCRIPT_SETTINGS.excluded_skill_codes
)


async def generate_and_save_embeddings(*,
                                       hot_run: bool,
                                       documents: list[dict[str, Any]],
                                       ctx: EmbeddingContext,
                                       embeddings_service: EmbeddingService):
    """
    Generate the embeddings for the given documents
    :param hot_run: bool - if True, the embeddings will be generated and saved
    :param documents: list[dict[str, any]] - the documents to generate the embeddings for
    :param ctx: EmbeddingContext - the context
    :param embeddings_service: EmbeddingService - the embeddings service to use
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

    embeddings: list[list[float]]
    if hot_run:
        logger.info(f"Generate embeddings for {len(texts)} texts")
        start_time = time.time()
        embeddings = await embeddings_service.embed_batch(texts)
        end_time = time.time()
        logger.info(f"Time taken to generate embeddings: {end_time - start_time:.2f} seconds for {len(texts)} texts, "
                    f"{len(texts) / (end_time - start_time):.2f} texts/seconds")
    else:
        # and array of length len(texts) and each element is an empty array
        embeddings: list[list[float]] = [[] for _ in range(len(texts))]
        logger.info(f"Would generate embeddings for {len(texts)} texts")

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
            "UUIDHistory": document["UUIDHistory"],
            "originUUID": document["UUIDHistory"][-1],
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
        raise ValueError(f"The number of embeddings generated {len(texts)} does not match the number of texts {i}")
    if hot_run:
        start_time = time.time()
        await COMPASS_DB[ctx.destination_collection].insert_many(insertable_documents)
        end_time = time.time()
        logger.info(f"Time taken to insert documents in collection {ctx.destination_collection}: {end_time - start_time:.2f} seconds "
                    f"for {len(insertable_documents)} documents, "
                    f"{len(insertable_documents) / (end_time - start_time):.2f} documents/seconds")
    else:
        logger.info(f"Would insert {len(insertable_documents)} documents in {ctx.destination_collection} collection")


async def process_schema(*, hot_run: bool, ctx: EmbeddingContext, embeddings_service: EmbeddingService):
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
    logger.info(f"Found {len(done_ids)} documents already processed for {ctx.collection_schema}")
    search_filter = {
        "modelId": ObjectId(SCRIPT_SETTINGS.tabiya_model_id),
        "code": {
            "$nin": ctx.excluded_codes
        }
    }
    # Find all the documents that are relevant in the source collection
    all_relevant_documents_count = await from_collection.count_documents(search_filter)
    logger.info(f"Found {all_relevant_documents_count} documents in the source collection for {ctx.collection_schema}")
    # Find all the documents that were not copied in a previous run
    search_filter["_id"] = {
        "$nin": done_ids
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
    # The batch size is the amount of documents to insert in one batch.
    batch_size = 500
    cursor = from_collection.find(search_filter).batch_size(batch_size)
    documents = await cursor.to_list(length=None)
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        if batch:  # double-check just in case
            progress.update(len(batch))
            await generate_and_save_embeddings(hot_run=hot_run, documents=batch, ctx=ctx, embeddings_service=embeddings_service)

    # Close the progress bar
    progress.close()


async def _copy_model_info(*, hot_run: bool, embeddings_service: EmbeddingService):
    model_id = SCRIPT_SETTINGS.tabiya_model_id

    logger.info("[1/2] Copying the model info")

    # Get the model info document for the model_id from the PLATFORM_DB
    from_model_info: dict = await PLATFORM_DB[PlatformCollections.MODEL_INFO.value].find_one({"_id": ObjectId(model_id)})
    if not from_model_info:
        raise ValueError(f"Taxonomy model with modelid:{model_id} not found.")

    existing_model_info = await COMPASS_DB[CompassEmbeddingsCollections.MODEL_INFO.value].find_one({
        "modelId": ObjectId(model_id)})

    if existing_model_info:
        # if the previous embeddings used a different model_version log and raise an error
        previous_embeddings_service = existing_model_info.get('embeddingsService')
        if previous_embeddings_service is not None:
            previous_service_name = previous_embeddings_service.get('service_name')
            previous_model_name = previous_embeddings_service.get('model_name')
            if (previous_service_name != embeddings_service.service_name or
                    previous_model_name != embeddings_service.model_name):
                error = ValueError(f"Model info for model_id:{model_id} already exists in the COMPASS_DB with embeddings from a different "
                                   f"embeddings service: {previous_service_name} or model: {previous_model_name}. "
                                   f"Use the same service and model as the existing embeddings, "
                                   f"or delete the existing embeddings and regenerate them.")
                logger.error(error)
                raise error

    del from_model_info["_id"]
    from_model_info["modelId"] = ObjectId(model_id)

    # add the source db info
    from_model_info["sourceDb"] = {
        "uri": redact_credentials_from_uri(SCRIPT_SETTINGS.tabiya_mongodb_uri),
        "db": SCRIPT_SETTINGS.tabiya_db_name,
        "modelId": model_id
    }
    # add which occupations and skills are excluded
    from_model_info["excludedOccupationCodes"] = SCRIPT_SETTINGS.excluded_occupation_codes
    from_model_info["excludedSkillCodes"] = SCRIPT_SETTINGS.excluded_skill_codes

    from_model_info["embeddingsService"] = dict(
        service_name=embeddings_service.service_name,
        model_name=embeddings_service.model_name,
    )

    # Add the origin UUID to the model Info
    # UUID and UUIDHistory are already present in the from_model_info.
    from_model_info["originUUID"] = from_model_info["UUIDHistory"][-1]

    # Add the time the embeddings were generated
    from_model_info["generatedAt"] = datetime_to_mongo_date(get_now())

    # Upsert the model info document in the COMPASS_DB
    # Currently the embeddings of a model are generated only once
    if hot_run:
        logger.info(f"Upserting the model info document in {CompassEmbeddingsCollections.MODEL_INFO.value} collection")
        await COMPASS_DB[CompassEmbeddingsCollections.MODEL_INFO.value].update_one(
            {"modelId": ObjectId(model_id)},
            {"$set": from_model_info},
            upsert=True
        )
    else:
        logger.info(f"Would upsert the model info document in {CompassEmbeddingsCollections.MODEL_INFO.value} collection")


async def copy_relations_collection(*, hot_run: bool = False):
    """
    Copy the relations collection from the platform database to the compass database
    :return:
    """

    from_collection = PLATFORM_DB[PlatformCollections.RELATIONS.value]
    to_collection = COMPASS_DB[CompassEmbeddingsCollections.RELATIONS.value]

    logger.info(f"[1/2] Copying the relations documents from {from_collection.name} to {to_collection.name}")

    # Currently the embeddings of a model are generated only once.
    # Find all the documents that were not copied in a previous run.
    # Completed ids are the ids of the documents that were already copied.
    # The source_id is used to keep track of the original document id,
    # it is found in the source_id field, it's insertion happens in the next step.
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
            if hot_run:
                logger.info(f"Inserting a batch of {len(documents)} relations")
                await to_collection.insert_many(documents)
            else:
                logger.info(f"Would insert a batch of {len(documents)} relations")
            documents = []

    if len(documents) > 0:
        progress.update(len(documents))
        if hot_run:
            logger.info(f"Inserting a batch of {len(documents)} relations")
            await to_collection.insert_many(documents)
        else:
            logger.info(f"Would insert a batch of {len(documents)} relations")

    progress.close()


async def delete_existing(*,
                          hot_run: bool = False,
                          collection_name: str,
                          model_id: str):
    count_before = await COMPASS_DB[collection_name].count_documents({"modelId": ObjectId(model_id)})

    if hot_run:
        logging.info(f"Deleting {count_before} {collection_name} with model ID {model_id} ...")
        await COMPASS_DB[collection_name].delete_many({"modelId": ObjectId(model_id)})
    else:
        logging.info(f"Would have deleted {count_before} {collection_name} with model ID {model_id}")


async def main(opts: Options):
    """
    Main function:
    Entry point of the script
    :return:
    """
    logger.info("Starting the main function")
    logger.info("Using options: " + opts.__str__())

    if opts.delete_existing:
        # Delete existing relations and model info collections
        for collection in CompassEmbeddingsCollections:
            await delete_existing(hot_run=opts.hot_run,
                                  collection_name=collection.value,
                                  model_id=SCRIPT_SETTINGS.tabiya_model_id)

    embeddings_service = await get_embeddings_service(service_name=SCRIPT_SETTINGS.embeddings_service_name,
                                                      model_name=SCRIPT_SETTINGS.embeddings_model_name)

    # [1/5] Copy the model info and validate for existing state, if it is compatible with the new state.
    await _copy_model_info(hot_run=opts.hot_run, embeddings_service=embeddings_service)

    # run the three tasks in parallel
    if opts.generate_embeddings:
        await asyncio.gather(
            # [2/5] Copy the relations collection
            copy_relations_collection(hot_run=opts.hot_run),

            # [3/5] Process the occupations
            process_schema(hot_run=opts.hot_run, ctx=_OCCUPATIONS_EMBEDDING_CONTEXT, embeddings_service=embeddings_service),

            # [4/5] Process the skills
            process_schema(hot_run=opts.hot_run, ctx=_SKILLS_EMBEDDING_CONTEXT, embeddings_service=embeddings_service),
        )

    # [5/5] Create the indexes
    if opts.generate_indexes:
        await generate_indexes(hot_run=opts.hot_run,
                               db=COMPASS_DB,
                               logger=logger)


logger.info("Script execution completed")

if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description="Generate Taxonomy Embeddings\n"
                                                     "The script handles retrying, rate limiting, and processes the data in batches. "
                                                     "Additionally, if the generation process is interrupted, the script can be re-run, "
                                                     "and it will continue processing the remaining data from where it left off.",
                                         formatter_class=argparse.RawTextHelpFormatter)
        options_group = parser.add_argument_group("Options")
        options_group.add_argument(
            "--hot-run",
            required=False,
            action="store_true",
            help="Run the script in hot run mode")

        options_group.add_argument(
            "--indexes-only",
            required=False,
            action="store_true",
            help="Create indexes only")

        options_group.add_argument(
            "--delete-existing",
            required=False,
            action="store_true",
            help="Delete existing embeddings before copying"
        )

        args = parser.parse_args()

        # Whether the main function will generate embeddings,
        # if the user said --indexes-only then we will not generate embeddings.
        generate_embeddings = not args.indexes_only

        # Whether the main function will generate indexes.

        _options = Options(
            hot_run=args.hot_run,
            delete_existing=args.delete_existing,
            generate_embeddings=generate_embeddings,
            generate_indexes=True
        )

        asyncio.run(main(_options))
    except Exception as e:
        logger.error(f"Error in the script: {e}", exc_info=True)
        import traceback

        traceback.print_exc()
