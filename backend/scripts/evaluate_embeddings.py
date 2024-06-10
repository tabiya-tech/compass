import asyncio
import os
from typing import List, Optional, Tuple

import vertexai
from datasets import load_dataset, Features, Value, VerificationMode
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from tqdm import tqdm

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService, EmbeddingService

OCCUPATION_REPO_ID = "tabiya/hahu_test"
OCCUPATION_FILENAME = "redacted_hahu_test_with_id.csv"
SKILL_REPO_ID = "tabiya/esco_skills_test"
SKILL_FILENAME = "data/processed_skill_test_set_with_id.parquet"
# TODO: Load the database name and collection name from the environment variables.
DATABASE_NAME = 'compass-test'
OCCUPATION_EMBEDDINGS_COLLECTION = 'occupationmodelsembeddings'
SKILLS_EMBEDDINGS_COLLECTION = 'skillsmodelsembeddings'


# TODO: Use the OccupationSearchService to perform a similarity search on the vector store, once we migrate everything
#  to the new structure.
async def _search(embedding_service: EmbeddingService, collection: AsyncIOMotorCollection, query: str, k: int = 5) -> \
        List[dict]:
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
    return [entry async for entry in collection.aggregate(pipeline)]


def _precision_at_k(prediction: List[List[str]], true: List[List[str]], k: Optional[int] = None):
    """
    Calculates the average precision at k considering for each prediction the number of correct retrieved nodes
    divided by the number of total retrieved nodes.
    """
    total_precision = 0
    for pred_list, true_vals in zip(prediction, true):
        if k:
            pred_list = pred_list[:k]
            tot_samples = k
        else:
            tot_samples = len(pred_list)
        total_precision += len(set(true_vals).intersection(set(pred_list))) / tot_samples
    return total_precision / len(true)


def _recall_at_k(prediction: List[List[str]], true: List[List[str]], k: Optional[int] = None):
    """
    Calculates the average recall at k considering for each prediction the number of correct retrieved nodes
    divided by the number of total correct nodes.
    """
    total_recall = 0
    for pred_list, true_vals in zip(prediction, true):
        if k:
            pred_list = pred_list[:k]
        total_recall += len(set(true_vals).intersection(set(pred_list))) / len(true_vals)
    return total_recall / len(true)


def _get_f_score(prec: float, rec: float) -> float:
    """Returns the f-score corresponding to a given precision and recall. """
    return 2 * prec * rec / (prec + rec)


def _get_all_metrics(predictions: List[List[str]], true_values: List[List[str]], k: Optional[int] = None) \
        -> Tuple[float, float, float]:
    """Get recall, precision and F-score for given results and true values. """
    rec_at_k = _recall_at_k(predictions, true_values, k)
    prec_at_k = _precision_at_k(predictions, true_values, k)
    f_score_at_k = _get_f_score(prec_at_k, rec_at_k)
    return rec_at_k, prec_at_k, f_score_at_k


async def _get_predictions(embedding_service: EmbeddingService, collection: AsyncIOMotorCollection, queries: List[str],
                           evaluated_field: str = "code", k: int = 10):
    # We could run predictions in batches to make it quicker, however there is a quota limit on the gecko embeddings
    # API. We are running it sequentially to avoid hitting the limit.
    predictions = []
    for query in tqdm(queries):
        result = await _search(embedding_service, collection, query, k)
        predictions.append([e[evaluated_field] for e in result])
    return predictions


async def get_metrics(embedding_service: EmbeddingService, collection: AsyncIOMotorCollection, ground_truth: List[str],
                      synthetic_queries: List[str], evaluated_field: str = "code",
                      k: int = 10):
    """ Evaluate the embeddings using ground truth data and synthetic queries."""
    predictions = await _get_predictions(embedding_service, collection, synthetic_queries, evaluated_field, k)
    ground_truth = [[elem] for elem in ground_truth]
    print(f"Metrics for the embeddings: {collection.name}")
    for k in [1, 3, 5, 10]:
        recall, precision, f_score = _get_all_metrics(predictions, ground_truth, k)
        print(f"K = {k}, recall: {recall}, precision: {precision}, f_score: {f_score}")


if __name__ == "__main__":
    vertexai.init()
    compass_db = AsyncIOMotorClient(os.getenv('MONGODB_URI')).get_database(DATABASE_NAME)
    gecko_embedding_service = GoogleGeckoEmbeddingService()
    occupation_dataset = load_dataset(OCCUPATION_REPO_ID, data_files=[OCCUPATION_FILENAME],
                                      token=os.environ["HF_ACCESS_TOKEN"]).get("train")
    # Load the skill dataset. The columns are not consistent with the definition in the dataset so we need to override
    # it and disable verification.
    skill_dataset = load_dataset(SKILL_REPO_ID, data_files=[SKILL_FILENAME], token=os.environ["HF_ACCESS_TOKEN"],
                                 features=Features(
                                     {
                                         "label": Value(dtype="string"),
                                         "sentence": Value(dtype="string"),
                                         "span": Value(dtype="string"),
                                         "sub_span": Value(dtype="string"),
                                         "ID": Value(dtype="string"),
                                         "UUID": Value(dtype="string"),
                                         "synthetic_query": Value(dtype="string"),
                                         "__index_level_0__": Value(dtype="int64"),
                                     }
                                 ),
                                 split="train",
                                 verification_mode=VerificationMode.NO_CHECKS)
    asyncio.get_event_loop().run_until_complete(
        asyncio.gather(*[get_metrics(gecko_embedding_service, compass_db[OCCUPATION_EMBEDDINGS_COLLECTION],
                                     occupation_dataset["esco_code"],
                                     occupation_dataset["synthetic_query"], evaluated_field="code"),
                         get_metrics(gecko_embedding_service, compass_db[SKILLS_EMBEDDINGS_COLLECTION],
                                     skill_dataset["label"],
                                     skill_dataset["synthetic_query"], evaluated_field="preferredLabel")]))
