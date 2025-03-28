import asyncio
from typing import Literal, Sequence, Mapping, Any
import re

from pydantic import BaseModel, Field
from pymongo.errors import OperationFailure
from pymongo.operations import SearchIndexModel
import logging.config
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from _base_data_settings import CompassEmbeddingsCollections


def redact_credentials_from_uri(uri: str) -> str:
    # Regular expression pattern to match username and password
    pattern = r'//[^@]+@'

    # Replace the matched username and password with asterisks
    return re.sub(pattern, "//*:*@", uri)


class EmbeddingContext(BaseModel):
    collection_schema: Literal["occupation", "skill"]
    """
    schema is the name of the schema
    """
    source_collection: str
    destination_collection: str
    id_field_name: str
    extra_fields: list[str] = Field(default_factory=list)
    excluded_codes: list[str] = Field(default_factory=list)


async def _upsert_index(*,
                        hot_run: bool,
                        collection: AsyncIOMotorCollection,
                        keys: str | Sequence[str | tuple[str, int | str | Mapping[str, Any]]] | Mapping[str, Any],
                        name: str,
                        logger: logging.Logger,
                        **index_options):
    """
    Upserts an index in a MongoDB collection using motor.
    :param hot_run: If True, the index will be created. If False, the index will not be created.
    :param collection: The MongoDB collection object
    :param name: The name of the index
    :param keys: A list of tuples specifying the index fields and order (e.g., [('field1', 1), ('field2', -1)])
    :param logger: The logger object
    :param index_options: Additional options for the index (e.g., unique=True)
    """

    # Get the existing indexes in the collection
    existing_indexes = await collection.index_information()

    # Check if the index already exists
    if name in existing_indexes:
        logger.info(f"Index '{collection.name}.{name}' already exists")

        # Update the index by dropping it and recreating with new options
        if hot_run:
            await collection.drop_index(name)
            logger.info(f"Dropped existing index '{collection.name}.{name}'")
        else:
            logger.info(f"Would drop existing index '{collection.name}.{name}'")

    # Create the index
    try:
        if hot_run:
            await collection.create_index(keys, name=name, **index_options)
            logger.info(f"Created index '{collection.name}.{name}' with options {index_options}")
        else:
            logger.info(f"Would create index '{collection.name}.{name}' with options {index_options}")
    except OperationFailure as ex:
        # Error code 85 indicates IndexOptionsConflict, which means even though the name has been updated
        # the index with the same keys already exists
        # For more information read: https://www.mongodb.com/docs/manual/reference/error-codes/#mongodb-error-85
        if ex.code == 85:
            logger.error(f"IndexOptionsConflict: '{collection.name}.{name}': {ex}")
    except Exception as ex:
        logger.error(f"Failed to create index '{collection.name}.{name}': {ex}")


async def _create_std_indexes(*, hot_run: bool,
                              collection: AsyncIOMotorCollection,
                              id_field_name: str,
                              logger: logging.Logger,
                              ):
    """
    Create the indexes for the destination collection
    :param hot_run: bool - if True, the indexes will be created
    :param collection: AsyncIOMotorCollection - the collection to create the indexes on
    :param id_field_name: str - the name of the field to use as the ID field
    :param logger: logging.Logger - the logger to use
    """

    # Unique index for modelId, ctx.id_field_name, embedded_field
    # For consistency, ensure that the combination of modelId, ctx.id_field_name, embedded_field is unique
    # This index is used by the pipeline in app.vector_search.esco_search_service.OccupationSkillSearchService._find_skills_from_occupation
    # Additionally an index based on the modelId is also required by the vector search filter
    await _upsert_index(
        hot_run=hot_run,
        collection=collection,
        keys={
            'modelId': 1,
            id_field_name: 1,
            'embedded_field': 1
        },
        unique=True,  # Currently the embeddings of a model are generated only once.
        name=f"model_id_and_{id_field_name}_index",
        logger=logger,
    )
    # The modelId, UUID index is needed by the vector search filter
    await _upsert_index(
        hot_run=hot_run,
        collection=collection,
        keys={'modelId': 1, 'UUID': 1},
        name='UUID_index',
        logger=logger
    )


async def _create_vector_search_index(*,
                                      hot_run: bool,
                                      collection: AsyncIOMotorCollection,
                                      logger: logging.Logger
                                      ):
    logger.info(f"Creating vector search index for collection:{collection.name}")
    _index_name = "embedding_index"
    _vector_index_definition = {
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

    async for index in collection.list_search_indexes():
        if index["name"] == _index_name:
            embedding_index_exists = True
            break

    if embedding_index_exists:
        # if it exists, update it
        if hot_run:
            logger.info(f"Updating the search index '{_index_name}'")
            await collection.update_search_index(_index_name, _vector_index_definition)
        else:
            logger.info(f"Would update the search index '{_index_name}'")
    else:
        # if it does not exist, create it
        search_index_model = SearchIndexModel(
            definition=_vector_index_definition,
            name=_index_name,
            type="vectorSearch",
        )
        if hot_run:
            logger.info(f"Creating the search index '{_index_name}'")
            await collection.create_search_index(model=search_index_model)
        else:
            logger.info(f"Would create the search index '{_index_name}'")


async def create_model_info_indexes(*, hot_run: bool,
                                    db: AsyncIOMotorDatabase,
                                    logger: logging.Logger,
                                    ):
    logger.info("Creating indexes for model info collection")

    # Currently the embeddings of a model are generated only once
    # so we can create a unique index on the modelId field
    await _upsert_index(
        hot_run=hot_run,
        collection=db[CompassEmbeddingsCollections.MODEL_INFO.value],
        keys={"modelId": 1},
        unique=True,
        name="model_id_index",
        logger=logger,
    )


async def create_relations_indexes(*, hot_run: bool,
                                   db: AsyncIOMotorDatabase,
                                   logger: logging.Logger, ):
    collection = db[CompassEmbeddingsCollections.RELATIONS.value]
    logger.info("Creating indexes of the relations collection")

    # This index is used by the backend/app.vector_search.esco_search_service.OccupationSkillSearchService._find_skills_from_occupation
    await _upsert_index(
        hot_run=hot_run,
        collection=collection,
        keys={"modelId": 1, "requiringOccupationId": 1},
        name="requiring_occupation_id_index",
        logger=logger,
    )

    # Currently we do not offer a search by requiredSkillId
    # await upsert_index(
    #     to_collection,
    #     {"modelId": 1, "requiredSkillId": 1},
    #     name="required_skill_id_index"
    # )

    # This index is used from copy_relations_collection() to efficiently search for already copied relations
    await _upsert_index(
        hot_run=hot_run,
        collection=collection,
        keys={"modelId": 1, "source_id": 1},
        unique=True,  # Currently the embeddings of a model are generated only once.
        name="model_id_and_source_id_index",
        logger=logger,
    )


async def create_occupations_indexes(*, hot_run: bool,
                                     db: AsyncIOMotorDatabase,
                                     logger: logging.Logger,
                                     ):
    # Create the indexes
    logger.info("Creating indexes for occupations collection")
    collection = db[CompassEmbeddingsCollections.OCCUPATIONS.value]
    await _create_std_indexes(hot_run=hot_run,
                              collection=collection,
                              id_field_name="occupationId",
                              logger=logger,
                              )
    # Add an index to efficiently search for a specific occupation code
    # It is used from backend/app.vector_search.esco_search_service.OccupationSearchService.get_by_esco_code
    await _upsert_index(
        hot_run=hot_run,
        collection=collection,
        keys={"modelId": 1, "code": 1},
        name="model_code_index",
        logger=logger,
    )
    await _create_vector_search_index(hot_run=hot_run,
                                      collection=collection,
                                      logger=logger)


async def create_skills_indexes(*, hot_run: bool,
                                db: AsyncIOMotorDatabase,
                                logger: logging.Logger,
                                ):
    # Create the indexes
    logger.info("Creating indexes for skills collection")
    collection = db[CompassEmbeddingsCollections.SKILLS.value]
    await _create_std_indexes(hot_run=hot_run,
                              collection=collection,
                              id_field_name="skillId",
                              logger=logger,
                              )
    await _create_vector_search_index(hot_run=hot_run,
                                      collection=collection,
                                      logger=logger)


async def generate_indexes(*, hot_run: bool, db: AsyncIOMotorDatabase, logger: logging.Logger):
    await asyncio.gather(
        create_model_info_indexes(
            hot_run=hot_run,
            db=db,
            logger=logger
        ),
        create_relations_indexes(
            hot_run=hot_run,
            db=db,
            logger=logger
        ),
    )
    # Sometimes list_search_indexes() fails so, moving the
    # vector search index creation to the end of the script and doing it sequentially
    await create_occupations_indexes(hot_run=hot_run,
                                     db=db,
                                     logger=logger)
    await create_skills_indexes(hot_run=hot_run,
                                db=db,
                                logger=logger)
