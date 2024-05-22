"""
Functions to embed an entire collection
of a database in MongoDB and save the embeddings.
"""

import argparse
import os

from dotenv import load_dotenv
from langchain_core.embeddings.embeddings import Embeddings
from pymongo import MongoClient
from tqdm import tqdm

from esco_search.embeddings.google_gecko.google_gecko import GoogleGecko, GoogleGeckoConfig

load_dotenv()

"""
------ BEGIN OF METHODS FOR NODE EMBEDDINGS ----
The following are methods to represent each node
through a string that will then be embedded in a
vector space.
"""


def get_description(document: dict) -> str:
    """Returns the 'description' field of the node.

    Args:
        document (dict): node of interest.

    Returns:
        str: 'description' field of the node.
    """
    return document["description"]


def get_all_skill(document: dict) -> str:
    """Returns a combination of different fields of
     each node, preceded by their label. The method
     is thought to be used for skill nodes.

    Args:
        document (dict): node of interest.

    Returns:
        str: string to be embedded.
    """
    altlabels = "\n".join(document["altLabels"])
    return f"""Skill Names: {document['preferredLabel']}
{altlabels}

Skill Description: {document['description']}"""


def get_all_occupation(document: dict) -> str:
    """Returns a combination of different fields of
     each node, preceded by their label. The method
     is thought to be used for occupation nodes.

    Args:
        document (dict): node of interest.

    Returns:
        str: string to be embedded.
    """
    altlabels = "\n".join(document["altLabels"])
    return f"""Skill Names: {document['preferredLabel']}
{altlabels}

Skill Description: {document['description']}"""


"""
-------- END OF METHODS FOR NODE EMBEDDINGS ------
"""
# maps each method string to its function to
# get the string from the node
METHOD_TO_FUNCTION = {
    "description": get_description,
    "all_skill": get_all_skill,
    "all_occupation": get_all_occupation,
}


def embed_db_in_mongodb(
        model: Embeddings,
        method: str,
        target_field: str,
        database_name: str,
        collection_name: str,
) -> None:
    """Embeds the entire collection in a MongoDB database,
    saving the embeddings in the collection in the 'target_field'
    field, as well as a search index in the 'vector_search_{target_field}'
    field.

    Args:
        model (Embedder): embedding model to be used for embeddings.
        method (str): method to be used to get a string from any
            given node.
        target_field (str): name of the embedding field.
        database_name (str): name of the database for the
            provided MongoDB client, whose connection URI is
            saved in a 'MONGODB_ATLAS_DEV_URI' environment variable.
        collection_name (str): name of the collection in the database
            above.
    """
    # Connect to MongoDB
    client = MongoClient(os.environ.get("MONGODB_ATLAS_DEV_URI"))
    db = client[database_name]
    collection = db[collection_name]
    stats = db.command('collStats', collection_name)
    embed_method = METHOD_TO_FUNCTION[method]
    # Access the collection in the MongoDB database
    for document in tqdm(collection.find(), total=stats["count"]):
        to_embed = embed_method(document)
        # Embed the node using the specified model and method
        embedding = model.embed_documents([to_embed])[0]
        embedding_length = len(embedding)

        # Update the document with the embedded representation
        if method not in document:
            # If "method" field doesn't exist, update the document with "method"
            # field set to the value of to_embed
            collection.update_one(
                {"_id": document["_id"]},
                {"$set": {method: to_embed, target_field: embedding}}
            )
        else:
            # If "method" field exists, update the document only with the embedding
            collection.update_one(
                {"_id": document["_id"]},
                {"$set": {target_field: embedding}}
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Script to embed all the nodes of a "
            "collection in a database, according to the "
            "given method and model"
        )
    )
    parser.add_argument(
        "model_name", type=str, help="Name of the embedding model"
    )
    parser.add_argument("method", type=str, help="Embedding method")
    parser.add_argument(
        "database_name", type=str, help="MongoDB database name"
    )
    parser.add_argument(
        "collection_name", type=str, help="collection of the MongoDB database"
    )
    parser.add_argument(
        "embedding_field",
        type=str,
        help="field of the embeddings in the collection",
    )
    args = parser.parse_args()
    if args.model_name == "gecko":
        config = GoogleGeckoConfig(
            version="latest",
            location="europe-west3",
            max_retries=3
        )
        model = GoogleGecko.create(config)
    else:
        raise ValueError("Model type not supported.")
    embed_db_in_mongodb(
        model,
        args.method,
        args.embedding_field,
        args.database_name,
        args.collection_name,
    )
