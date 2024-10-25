import asyncio
import os
from typing import List, Tuple

import vertexai
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, EmbeddingService
from app.vector_search.esco_entities import OccupationEntity

# Parameters
INPUT_FILENAME = "path/to/your/input.csv"
INPUT_FIELD = 'JobTitle'
OUTPUT_FILENAME = "path/to/your/output.csv"
OUTPUT_FIELD = 'PredictionsJobTitle'

# MongoDB constants - do not change
DATABASE_NAME = os.getenv('TAXONOMY_DATABASE_NAME')
EMBEDDINGS_COLLECTION = 'occupationmodelsembeddings'

# The row to start processing from in the input file
START_ROW = 0


async def search(embedding: List[float], k: int = 10) -> List[OccupationEntity]:
    """
        Perform a similarity search on the vector store. It uses the default similarity search set during vector
        generation.

        :param embedding: The embedding to search for.
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
    return OccupationEntity(
        id=str(doc.get("_id", "")),
        UUID=doc.get("UUID", ""),
        code=doc.get("code", ""),
        preferredLabel=doc.get("preferredLabel", ""),
        description=doc.get("description", ""),
        altLabels=doc.get("altLabels", []),
    )


async def search_in_batch(embedding_service: EmbeddingService, queries: List[str], k: int = 10) -> List[List[Tuple[str, str]]]:
    """
    Perform a similarity search on the vector store in batches. It uses the default similarity search set during vector
    generation.

    :param embedding_service: The embedding service to use to embed the queries.
    :param queries: The queries to search for.
    :param k: The number of results to return.
    :return: A list of T objects.
    """
    embeddings = await embedding_service.embed_batch(queries)
    results = []
    for embedding in embeddings:
        result = await search(embedding, k)
        results.append([(e.code, e.preferredLabel) for e in result])
    return results


def format_string(input_str: List[List[Tuple[str, str]]]) -> List[str]:
    """
    Format the search results into a list of strings.
    """
    return ["\n".join([f"{code}; {preferredLabel}" for code, preferredLabel in result]) for result in input_str]


# Function to write a batch to a CSV file
def write_batch_to_csv(batch_df, file_name, mode='w'):
    batch_df.to_csv(file_name, mode=mode, header=(mode == 'w'), index=False)


# Function to process a batch of data
async def process_batch(batch_df, embedding_service, file_name, mode='w'):
    results = await search_in_batch(embedding_service, batch_df['JobTitle'], k=10)
    formatted_results = format_string(results)
    batch_df = batch_df.copy()
    batch_df.loc[:, 'Predictions'] = formatted_results
    write_batch_to_csv(batch_df, file_name, mode=mode)


if __name__ == "__main__":
    vertexai.init()
    compass_db = AsyncIOMotorClient(os.getenv('TAXONOMY_MONGODB_URI')).get_database(DATABASE_NAME)
    collection = compass_db[EMBEDDINGS_COLLECTION]
    gecko_embedding_service = GoogleGeckoEmbeddingService()

    # Load the dataset
    df = pd.read_csv(INPUT_FILENAME)

    # Fill rows with missing values
    df.fillna('', inplace=True)

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
