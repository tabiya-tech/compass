import logging
import math
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


async def get_database_connection_info(database: AsyncIOMotorDatabase) -> str:
    """
    Retrieves connection information for a MongoDB database, formatted for logging.

    :param database: The MongoDB database object from AsyncIOMotorClient
    :return: A single-line string describing the database connection details
    """
    client = database.client
    db_name = database.name
    # Get the primary address (host and port)
    try:
        # Ensure the client is connected, before trying to get the client.address, otherwise it might be None
        si = await client.server_info()
        host, port = client.address
        primary_info = f"{host}:{port} version:{si.get('version', 'Unknown version')}"
    except Exception:  # noqa
        primary_info = "Unknown primary node"

    # Get all connected nodes
    connected_nodes = client.nodes
    connected_nodes_info = ", ".join([f"{node[0]}:{node[1]}" for node in connected_nodes]) or "None"  # type: ignore

    # Format the output for logging
    connection_info = (
        f"Database: {db_name}, Primary: {primary_info}, Nodes: {connected_nodes_info}"
    )

    return connection_info


async def check_mongo_health(client: AsyncIOMotorClient) -> bool:
    """
    Check if MongoDB is healthy by sending a ping command.
    
    :param client: The MongoDB client to check
    :return: True if the database is healthy, False otherwise
    """
    try:
        result = await client.admin.command("ping")
        return math.isclose(result.get("ok"), 1.0)
    except Exception:
        return False


async def initialize_mongo_db_indexes(database: AsyncIOMotorDatabase, collection_name: str, indexes: list, logger: logging.Logger):
    """
    Initialize MongoDB indexes for a collection.
    
    :param database: The MongoDB database
    :param collection_name: The name of the collection to create indexes for
    :param indexes: List of index specifications
    :param logger: Logger instance for logging
    """
    try:
        logger.info(f"Initializing indexes for collection: {collection_name}")
        
        collection = database.get_collection(collection_name)
        for index_spec in indexes:
            await collection.create_index(index_spec["fields"], **index_spec.get("options", {}))
            
        logger.info(f"Finished creating indexes for collection: {collection_name}")
    except Exception as e:
        logger.exception(f"Error creating indexes for collection {collection_name}: {e}")
        raise e 