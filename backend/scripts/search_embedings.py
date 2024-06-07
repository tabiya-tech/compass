import asyncio
import os
from typing import List, Optional, Tuple

import vertexai
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, EmbeddingService
from app.vector_search.esco_entities import OccupationEntity
from tqdm import tqdm

OUTPUT_FILENAME = "data/output.csv"
OCCUPATION_FILENAME = "data/OUTPUT_DATA_transition1_all_multiples_for_nlp_proc(in).csv"
DATABASE_NAME = 'compass-test'
EMBEDDINGS_COLLECTION = 'occupationmodelsembeddings'
START_ROW = 25401

# TODO: Use the OccupationSearchService to perform a similarity search on the vector store, once we migrate everything
#  to the new structure.
async def _search(embedding_service: EmbeddingService, query: str, k: int = 5) -> List[OccupationEntity]:
    """
        Perform a similarity search on the vector store. It uses the default similarity search set during vector
        generation.

        :param embedding_service: The embedding service to use to embed the queries.
        :param query: The query to search for.
        :param k: The number of results to return.
        :return: A list of T objects.
    """
    params = {
        "queryVector": await embedding_service.embed(query),
        "path": "embedding",
        "numCandidates": k * 10 * 3,
        "limit": k * 3,
        "index": "embedding_index",
    }
    pipeline = [
        {"$vectorSearch": params},
        {"$set": {"score": {"$meta": "vectorSearchScore"}}},
        {"$group": {"_id": "$UUID",
                    "preferredLabel": {"$first": "$preferredLabel"},
                    "description": {"$first": "$description"},
                    "altLabels": {"$first": "$altLabels"},
                    "code": {"$first": "$code"},
                    "score": {"$max": "$score"},
                    }
         },
        {"$sort": {"score": -1}},
        {"$limit": k},
    ]
    return [_to_entity(entry) async for entry in collection.aggregate(pipeline)]

async def search(embedding: List[float], query: str, k: int = 10) -> List[OccupationEntity]:
    """
        Perform a similarity search on the vector store. It uses the default similarity search set during vector
        generation.

        :param embedding: The embedding to search for.
        :param query: The query to search for.
        :param k: The number of results to return.
        :return: A list of T objects.
    """
    params = {
        "queryVector": embedding,
        "path": "embedding",
        "numCandidates": k * 10 * 3,
        "limit": k * 3,
        "index": "embedding_index",
    }
    # Ask explanation about the pipeline and is it doing what is it intended to do
    pipeline = [
        {"$vectorSearch": params},
        {"$set": {"score": {"$meta": "vectorSearchScore"}}},
        {"$group": {"_id": "$UUID",
                    "preferredLabel": {"$first": "$preferredLabel"},
                    "description": {"$first": "$description"},
                    "altLabels": {"$first": "$altLabels"},
                    "code": {"$first": "$code"},
                    "score": {"$max": "$score"},
                    }
         },
        {"$sort": {"score": -1}},
        {"$limit": k},
    ]
    return [_to_entity(entry) async for entry in collection.aggregate(pipeline)]

def _to_entity(doc: dict) -> OccupationEntity:
    """
    Convert a Document object to an OccupationEntity object.
    """
    # Ask kinga about the structure of the database and the structure of the request
    return OccupationEntity(
        id=str(doc.get("_id", "")),
        UUID=doc.get("UUID", ""),
        code=doc.get("code", ""),
        preferredLabel=doc.get("preferredLabel", ""),
        description=doc.get("description", ""),
        altLabels=doc.get("altLabels", []),
    )

async def search_in_batch(embedding_service: EmbeddingService, queries: List[str], k: int = 10) -> List[List[OccupationEntity]]:
    """
    Perform a similarity search on the vector store in batches. It uses the default similarity search set during vector
    generation.

    :param embedding_service: The embedding service to use to embed the queries.
    :param queries: The queries to search for.
    :param k: The number of results to return.
    :return: A list of T objects.
    """
    embeddings = await embedding_service.embed_strings_in_batch(queries)
    results = []
    for embedding, query in zip(embeddings, queries):
        result = await search(embedding, query, k)
        results.append([(e.code,e.preferredLabel) for e in result])
    return results

async def _get_predictions(embedding_service: EmbeddingService, queries: List[str], k: int = 10):
    # We could run predictions in batches to make it quicker, however there is a quota limit on the gecko embeddings
    # API. We are running it sequentially to avoid hitting the limit.
    results = []
    for query in tqdm(queries):
        result = await _search(embedding_service, query, k)

        results.append([(e.code,e.preferredLabel) for e in result])
    return results


# Function to write a batch to a CSV file
def write_batch_to_csv(batch_df, file_name, mode='w'):
    batch_df.to_csv(file_name, mode=mode, header=(mode == 'w'), index=False)

# Function to process a batch of data
async def process_batch(batch_df, gecko_embedding_service, file_name, mode='w'):
    results = await search_in_batch(gecko_embedding_service, batch_df['JobTitle'], k=10)
    batch_df = batch_df.copy()
    batch_df.loc[:, 'Predictions'] = results
    write_batch_to_csv(batch_df, file_name, mode=mode)

if __name__ == "__main__":
    vertexai.init()
    compass_db = AsyncIOMotorClient(os.getenv('MONGODB_URI')).get_database(DATABASE_NAME)
    collection = compass_db[EMBEDDINGS_COLLECTION]
    gecko_embedding_service = GoogleGeckoEmbeddingService()


    # Load the dataset
    df = pd.read_csv(OCCUPATION_FILENAME)

    # Remove rows with missing values
    df.dropna(inplace=True)

    batch_size = 50
    num_batches = (len(df) - START_ROW + batch_size - 1) // batch_size  # Calculate the number of batches

    async def main():
        for i in range(num_batches):
            start_index = START_ROW + i * batch_size
            print(f"Processing batch {i + 1} of {num_batches} (rows {start_index + 1} to {min(start_index + batch_size, len(df))})")
            end_index = min(start_index + batch_size, len(df))
            batch_df = df.iloc[start_index:end_index]  # Get the current batch
            mode = 'w' if start_index == 0 else 'a'  # Write mode for the first batch, append mode for subsequent batches
            await process_batch(batch_df, gecko_embedding_service, OUTPUT_FILENAME, mode)

    asyncio.get_event_loop().run_until_complete(main())

# Clean the ouput
# Generate LLM new jobTitle prompt