"""
Functions to embed an entire collection
of a database in MongoDB and save the embeddings.
"""

import argparse
import os

from dotenv import load_dotenv
from pymongo import MongoClient
from tqdm import tqdm

from vertexai.language_models import TextEmbeddingModel
from esco_search.embeddings.google_gecko.google_gecko import GoogleGeckoConfig, GoogleGecko

load_dotenv()

def embed_db_in_mongodb(
        collection_name: str,
        model: TextEmbeddingModel = TextEmbeddingModel.from_pretrained("textembedding-gecko@003"),
) -> None:
    """Embeds the entire collection in a MongoDB database,
    saving the embeddings in the collection in the 'target_field'
    field, as well as a search index in the 'vector_search_{target_field}'
    field.

    Args:
        collection_name (str): name of the collection in the database
            above.
        model (TextEmbeddingModel): embedding model to be used for embeddings.
            Defaults to VertexAI 'textembedding-gecko@003'.

    """
    # Connect to MongoDB
    client = MongoClient(os.environ.get("MONGODB_ATLAS_DEV_URI"))
    db = client["compass-poc"]
    collection = db[collection_name]
    stats = db.command('collStats', collection_name)
    # Access the collection in the MongoDB database
    for document in tqdm(collection.find(), total=stats["count"]):
        # Embed the node using the specified model
        # TODO: insert batch processing
        embedding = model.get_embeddings([document["PREFERREDLABEL"]])[0]
        # Update the document with the embedded representation
        collection.update_one(
            {"_id": document["_id"]},
            {"$set": {"embedding": embedding}}
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
        "collection_name", type=str, help="collection of the MongoDB database"
    )
    parser.add_argument(
        "model_name", type=str, help="Name of the embedding model"
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
        args.collection_name,
    )
